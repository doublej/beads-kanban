// WebSocket store for embedded agent server at ws://localhost:9347
// Each session gets its own WebSocket connection for proper isolation
// Uses tab coordination to prevent branching when multiple tabs are open
import { untrack } from 'svelte';
import {
	persistSdkSessionId,
	clearPersistedSdkSessionId,
	loadSessions,
	saveSessions,
} from './session-persistence';
import { tabCoordinator, type ActionRequest } from './tabCoordinator';

// Re-export persistence functions for external use
export {
	getPersistedSdkSessionId,
	getAllPersistedSessions,
	deletePersistedSession,
	fetchSdkSessions,
	type SdkSessionInfo,
} from './session-persistence';

export type NotificationType = 'comment' | 'dependency' | 'attachment' | 'status' | 'priority' | 'assignee' | 'label';

export interface ChatMessage {
	role: 'user' | 'assistant' | 'tool' | 'notification';
	content: string;
	toolName?: string;
	toolInput?: Record<string, unknown>;
	toolResult?: string;
	timestamp?: string;
	notificationType?: NotificationType;
}

export interface TokenUsage {
	inputTokens: number;
	outputTokens: number;
	cacheRead: number;
	cacheCreation: number;
}

export interface AgentSession {
	id: string;
	name: string;
	cwd: string;
	streaming: boolean;
	messages: ChatMessage[];
	currentDelta: string;
	cost?: number;
	diffs?: FileDiff[];
	serverId?: string;
	sdkSessionId?: string; // Claude SDK session ID for resume
	compacted?: boolean; // Whether context was compacted
	usage?: TokenUsage; // Latest token usage from SDK
	pane_type: string;
	backend: string;
	lastReadCount?: number; // Number of messages when pane was last viewed
}

export interface FileDiff {
	path: string;
	operation: 'created' | 'modified' | 'deleted';
	before: string | null;
	after: string | null;
}

interface StreamEvent {
	type: 'stream_event';
	event: { type: string; delta?: { type: string; text?: string } };
}

interface AssistantMessage {
	type: 'assistant';
	message?: { content: Array<{ type: string; name?: string; text?: string; input?: Record<string, unknown>; id?: string }> };
}

interface ToolResult {
	type: 'user';
	message?: { content: string | Array<{ type: string; text?: string; tool_use_id?: string }> };
	tool_use_result?: string;
}

interface ToolCallEvent {
	type: 'tool_call';
	tool_name: string;
	input: Record<string, unknown>;
}

interface ToolResultEvent {
	type: 'tool_result';
	tool_name: string;
	result: string;
}

type ServerMessage =
	| { type: 'session_started'; sessionId: string; resuming?: boolean }
	| { type: 'session_resumed'; sessionId: string; sdkSessionId?: string; isRunning?: boolean }
	| { type: 'sdk_session'; sdkSessionId: string; source: 'new' | 'resume' }
	| { type: 'compacted'; metadata?: unknown }
	| { type: 'usage'; inputTokens: number; outputTokens: number; cacheRead: number; cacheCreation: number }
	| { type: 'session_ended'; sessionId: string }
	| { type: 'session_cleared'; sessionId: string }
	| { type: 'stream'; data: StreamEvent | AssistantMessage | ToolResult | ToolCallEvent | ToolResultEvent | { type: string } }
	| { type: 'done'; result: { subtype: string; total_cost_usd?: number }; diffs?: FileDiff[] }
	| { type: 'error'; error: string }
	| { type: 'interrupted' };

let sessions = $state<Map<string, AgentSession>>(loadSessions());
let sessionSockets = new Map<string, WebSocket>();
let serverAvailable = $state(false);
let checkTimer: ReturnType<typeof setTimeout> | null = null;
let isTabLeader = $state(false);
let tabCoordinatorInitialized = false;

// Save sessions whenever they change (debounced)
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
if (typeof window !== 'undefined') {
	$effect.root(() => {
		$effect(() => {
			const _ = sessions.size;
			if (saveTimeout) clearTimeout(saveTimeout);
			saveTimeout = setTimeout(() => untrack(() => saveSessions(sessions)), 100);
		});
	});
}

function getWsUrl(): string {
	const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
	return `ws://${host}:9347`;
}

function updateSession(name: string, updates: Partial<AgentSession>) {
	const session = sessions.get(name);
	if (!session) return;
	sessions.set(name, { ...session, ...updates });
	sessions = new Map(sessions);
	// Broadcast to follower tabs if we're the leader
	if (isTabLeader) {
		broadcastSessionsToFollowers();
	}
}

// Broadcast session state to follower tabs (debounced)
let broadcastTimeout: ReturnType<typeof setTimeout> | null = null;
function broadcastSessionsToFollowers() {
	if (broadcastTimeout) clearTimeout(broadcastTimeout);
	broadcastTimeout = setTimeout(() => {
		const arr = Array.from(sessions.entries());
		tabCoordinator.broadcastState(arr);
	}, 50);
}

// Apply session state received from leader tab
function applySessionsFromLeader(state: unknown) {
	if (!Array.isArray(state)) return;
	try {
		const newSessions = new Map<string, AgentSession>(state as [string, AgentSession][]);
		sessions = newSessions;
	} catch {
		// Invalid state, ignore
	}
}

// Handle becoming the leader tab
function onBecomeLeader() {
	console.log('[wsStore] This tab is now the leader');
	isTabLeader = true;
	// Resume sessions that have serverIds
	for (const [name, session] of sessions) {
		if (session.serverId && !session.streaming) {
			resumeSession(name);
		}
	}
}

// Handle becoming a follower tab
function onBecomeFollower() {
	console.log('[wsStore] This tab is now a follower');
	isTabLeader = false;
	// Close all WebSocket connections - leader will handle them
	for (const [, ws] of sessionSockets) {
		ws.close();
	}
	sessionSockets.clear();
}

// Handle action requests forwarded from follower tabs
function handleActionRequest(request: ActionRequest) {
	const { action, sessionName, args } = request;
	console.log(`[wsStore] Handling action request: ${action} for ${sessionName}`);

	switch (action) {
		case 'startSession':
			startSessionInternal(sessionName, ...(args as [string, string, string?, string?]));
			break;
		case 'sendMessage':
			sendMessageInternal(sessionName, args[0] as string);
			break;
		case 'interrupt':
			interruptInternal(sessionName);
			break;
		case 'killSession':
			killSessionInternal(sessionName);
			break;
		case 'endSession':
			endSessionInternal(sessionName);
			break;
		case 'clearSession':
			clearSessionInternal(sessionName);
			break;
		case 'continueSession':
			continueSessionInternal(sessionName);
			break;
		case 'compactSession':
			compactSessionInternal(sessionName);
			break;
	}
}

// Initialize tab coordinator
function initTabCoordinator() {
	if (tabCoordinatorInitialized || typeof window === 'undefined') return;
	tabCoordinatorInitialized = true;

	tabCoordinator.init(
		(leader) => {
			if (leader) {
				onBecomeLeader();
			} else {
				onBecomeFollower();
			}
		},
		(state) => {
			if (!isTabLeader) {
				applySessionsFromLeader(state);
			}
		},
		handleActionRequest
	);
}

function createMessageHandler(sessionName: string) {
	return (event: MessageEvent) => {
		const msg = JSON.parse(event.data) as ServerMessage;
		console.log(`[agent:${sessionName}] recv`, msg.type);
		const session = sessions.get(sessionName);
		if (!session) return;

		switch (msg.type) {
			case 'session_started':
				updateSession(sessionName, { serverId: msg.sessionId, streaming: true });
				break;

			case 'session_resumed':
				updateSession(sessionName, { serverId: msg.sessionId, streaming: true });
				break;

			case 'sdk_session':
				updateSession(sessionName, { sdkSessionId: msg.sdkSessionId });
				persistSdkSessionId(sessionName, msg.sdkSessionId);
				break;

			case 'compacted':
				updateSession(sessionName, { compacted: true });
				break;

			case 'usage':
				// Server sends cumulative totals
				updateSession(sessionName, {
					usage: {
						inputTokens: msg.inputTokens,
						outputTokens: msg.outputTokens,
						cacheRead: msg.cacheRead,
						cacheCreation: msg.cacheCreation,
					}
				});
				break;

			case 'session_ended':
				updateSession(sessionName, { streaming: false, serverId: undefined });
				break;

			case 'session_cleared':
				updateSession(sessionName, {
					messages: [],
					currentDelta: '',
					sdkSessionId: undefined,
					compacted: false
				});
				clearPersistedSdkSessionId(sessionName);
				break;

			case 'stream':
				handleStream(sessionName, session, msg.data);
				break;

			case 'done': {
				let messages = session.messages;
				if (session.currentDelta) {
					messages = [...messages, {
						role: 'assistant' as const,
						content: session.currentDelta,
						timestamp: new Date().toISOString()
					}];
				}
				updateSession(sessionName, {
					streaming: false,
					messages,
					currentDelta: '',
					cost: msg.result.total_cost_usd,
					diffs: msg.diffs
				});
				break;
			}

			case 'error':
				updateSession(sessionName, {
					streaming: false,
					messages: [...session.messages, {
						role: 'assistant',
						content: `Error: ${msg.error}`,
						timestamp: new Date().toISOString()
					}]
				});
				break;

			case 'interrupted':
				updateSession(sessionName, {
					streaming: false,
					messages: [...session.messages, {
						role: 'assistant',
						content: '[Interrupted]',
						timestamp: new Date().toISOString()
					}]
				});
				break;
		}
	};
}

function handleStream(name: string, session: AgentSession, data: StreamEvent | AssistantMessage | ToolResult | ToolCallEvent | ToolResultEvent | { type: string }) {
	if (data.type === 'stream_event') {
		const ev = (data as StreamEvent).event;
		if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta' && ev.delta.text) {
			updateSession(name, { currentDelta: session.currentDelta + ev.delta.text });
		}
	} else if (data.type === 'tool_call') {
		// SDK tool_call event - add new tool message
		const toolCall = data as ToolCallEvent;
		updateSession(name, {
			messages: [...session.messages, {
				role: 'tool',
				content: `Using ${toolCall.tool_name}`,
				toolName: toolCall.tool_name,
				toolInput: toolCall.input,
				timestamp: new Date().toISOString()
			}],
			currentDelta: ''
		});
	} else if (data.type === 'tool_result') {
		// SDK tool_result event - update the last tool message with result
		const toolResult = data as ToolResultEvent;
		let lastToolIdx = -1;
		for (let i = session.messages.length - 1; i >= 0; i--) {
			if (session.messages[i].role === 'tool' && session.messages[i].toolName === toolResult.tool_name) {
				lastToolIdx = i;
				break;
			}
		}
		if (lastToolIdx >= 0) {
			const messages = [...session.messages];
			messages[lastToolIdx] = { ...messages[lastToolIdx], toolResult: toolResult.result };
			updateSession(name, { messages });
		}
	} else if (data.type === 'assistant') {
		const msg = data as AssistantMessage;
		const content = msg.message?.content;
		if (Array.isArray(content)) {
			for (const block of content) {
				if (block.type === 'text' && block.text) {
					updateSession(name, {
						messages: [...session.messages, {
							role: 'assistant',
							content: block.text,
							timestamp: new Date().toISOString()
						}],
						currentDelta: ''
					});
				} else if (block.type === 'tool_use' && block.name) {
					updateSession(name, {
						messages: [...session.messages, {
							role: 'tool',
							content: `Using ${block.name}`,
							toolName: block.name,
							toolInput: block.input,
							timestamp: new Date().toISOString()
						}],
						currentDelta: ''
					});
				}
			}
		}
	} else if (data.type === 'user') {
		const userMsg = data as ToolResult;
		// Check if this is a tool_result content block
		if (userMsg.message?.content && Array.isArray(userMsg.message.content)) {
			for (const block of userMsg.message.content) {
				if (block.type === 'tool_result' && block.tool_use_id) {
					// Find matching tool message and add result
					let lastToolIdx = -1;
					for (let i = session.messages.length - 1; i >= 0; i--) {
						if (session.messages[i].role === 'tool' && !session.messages[i].toolResult) {
							lastToolIdx = i;
							break;
						}
					}
					if (lastToolIdx >= 0) {
						const messages = [...session.messages];
						const resultText = block.text || '';
						messages[lastToolIdx] = { ...messages[lastToolIdx], toolResult: resultText };
						updateSession(name, { messages });
					}
					continue;
				}
			}
		}
		// Handle regular user messages
		if (userMsg.message?.content) {
			const rawContent = userMsg.message.content;
			const content = typeof rawContent === 'string'
				? rawContent
				: Array.isArray(rawContent)
					? rawContent.filter(b => b.type === 'text' && b.text).map(b => b.text).join('\n')
					: String(rawContent);
			if (!content) return;
			const alreadyHas = session.messages.some(m => m.role === 'user' && m.content === content);
			if (!alreadyHas) {
				updateSession(name, {
					messages: [...session.messages, {
						role: 'user',
						content,
						timestamp: new Date().toISOString()
					}]
				});
			}
		}
	}
}

function getOrCreateSocket(sessionName: string): WebSocket | null {
	// Only the leader tab creates WebSocket connections
	if (!isTabLeader) {
		console.log(`[agent:${sessionName}] not leader, skipping socket creation`);
		return null;
	}

	let ws = sessionSockets.get(sessionName);
	if (ws?.readyState === WebSocket.OPEN) return ws;

	// Clean up old socket
	if (ws) {
		ws.close();
		sessionSockets.delete(sessionName);
	}

	ws = new WebSocket(getWsUrl());
	sessionSockets.set(sessionName, ws);

	ws.onopen = () => {
		console.log(`[agent:${sessionName}] connected`);
		serverAvailable = true;
	};

	ws.onclose = () => {
		console.log(`[agent:${sessionName}] disconnected`);
		sessionSockets.delete(sessionName);
		updateSession(sessionName, { streaming: false });
	};

	ws.onerror = (e) => {
		console.error(`[agent:${sessionName}] error`, e);
		ws?.close();
	};

	ws.onmessage = createMessageHandler(sessionName);

	return ws;
}

function sendToSocket(sessionName: string, payload: Record<string, unknown>) {
	const ws = sessionSockets.get(sessionName);
	if (ws?.readyState === WebSocket.OPEN) {
		console.log(`[agent:${sessionName}] send`, payload.type);
		ws.send(JSON.stringify(payload));
	}
}

// Resume a session that has a serverId
function resumeSession(name: string) {
	const session = sessions.get(name);
	if (!session?.serverId) return;

	console.log(`[agent:${name}] resuming session`, session.serverId);

	const ws = getOrCreateSocket(name);
	if (!ws) return;

	const sendResume = () => {
		sendToSocket(name, { type: 'resume', sessionId: session.serverId });
	};

	if (ws.readyState === WebSocket.OPEN) {
		sendResume();
	} else {
		ws.addEventListener('open', sendResume, { once: true });
	}
}

// Check if server is available and resume sessions
export function connect() {
	if (typeof window === 'undefined') return;

	// Initialize tab coordination first
	initTabCoordinator();

	const ws = new WebSocket(getWsUrl());
	ws.onopen = () => {
		serverAvailable = true;
		ws.close();
		// Only leader tab resumes sessions
		if (isTabLeader) {
			for (const [name, session] of sessions) {
				if (session.serverId && !session.streaming) {
					resumeSession(name);
				}
			}
		}
	};
	ws.onerror = () => {
		serverAvailable = false;
	};
	// Schedule periodic check (only leader needs to do this)
	if (!checkTimer) {
		checkTimer = setInterval(() => {
			if (!serverAvailable && isTabLeader) connect();
		}, 5000);
	}
}

export function disconnect() {
	if (checkTimer) {
		clearInterval(checkTimer);
		checkTimer = null;
	}
	for (const [, ws] of sessionSockets) {
		ws.close();
	}
	sessionSockets.clear();
	serverAvailable = false;
	tabCoordinator.destroy();
	tabCoordinatorInitialized = false;
}

export function getSessions() { return sessions; }
export function isConnected() { return serverAvailable; }
export function getConnected() { return serverAvailable; }
export function getPanes() { return sessions; }
export function isLeaderTab() { return isTabLeader; }
export type Pane = AgentSession;

// Mark pane as read - update lastReadCount to current message count
export function markPaneAsRead(name: string) {
	const session = sessions.get(name);
	if (!session) return;
	updateSession(name, { lastReadCount: session.messages.length });
}

// Get total unread count across all panes
export function getTotalUnreadCount(): number {
	let total = 0;
	for (const [, session] of sessions) {
		const lastRead = session.lastReadCount ?? 0;
		const unread = Math.max(0, session.messages.length - lastRead);
		total += unread;
	}
	return total;
}

// Get unread count for a specific pane
export function getUnreadCount(name: string): number {
	const session = sessions.get(name);
	if (!session) return 0;
	const lastRead = session.lastReadCount ?? 0;
	return Math.max(0, session.messages.length - lastRead);
}

// Internal functions that do the actual work (called by leader tab)
function startSessionInternal(name: string, cwd: string, briefing: string, systemPromptAppend?: string, resumeSessionId?: string) {
	console.log('[agent] startSession:', name, 'cwd:', cwd, resumeSessionId ? `resuming: ${resumeSessionId}` : '');

	const existing = sessions.get(name);
	const session: AgentSession = {
		id: crypto.randomUUID(),
		name,
		cwd,
		streaming: true,
		messages: existing?.messages ?? [],
		currentDelta: '',
		pane_type: 'agent',
		backend: 'claude',
		sdkSessionId: resumeSessionId
	};
	sessions.set(name, session);
	sessions = new Map(sessions);

	const ws = getOrCreateSocket(name);
	if (!ws) return;

	const sendStart = () => {
		sendToSocket(name, { type: 'start', cwd, agentName: name, briefing, systemPromptAppend, resumeSessionId });
	};

	if (ws.readyState === WebSocket.OPEN) {
		sendStart();
	} else {
		ws.addEventListener('open', sendStart, { once: true });
	}
}

function sendMessageInternal(name: string, text: string) {
	const session = sessions.get(name);
	if (!session) return;

	updateSession(name, {
		messages: [...session.messages, {
			role: 'user',
			content: text,
			timestamp: new Date().toISOString()
		}]
	});

	sendToSocket(name, { type: 'message', text });
}

function interruptInternal(name: string) {
	sendToSocket(name, { type: 'interrupt' });
}

function killSessionInternal(name: string) {
	const session = sessions.get(name);
	if (session?.streaming) {
		sendToSocket(name, { type: 'interrupt' });
	}
	const ws = sessionSockets.get(name);
	if (ws) {
		ws.close();
		sessionSockets.delete(name);
	}
	sessions.delete(name);
	sessions = new Map(sessions);
}

function endSessionInternal(name: string) {
	sendToSocket(name, { type: 'end' });
}

function clearSessionInternal(name: string) {
	sendToSocket(name, { type: 'clear' });
}

function continueSessionInternal(name: string) {
	sendToSocket(name, { type: 'continue' });
}

function compactSessionInternal(name: string) {
	sendToSocket(name, { type: 'compact' });
}

// Public functions that forward to leader if not the leader tab
export function startSession(name: string, cwd: string, briefing: string, systemPromptAppend?: string, resumeSessionId?: string) {
	if (isTabLeader) {
		startSessionInternal(name, cwd, briefing, systemPromptAppend, resumeSessionId);
	} else {
		tabCoordinator.requestAction({ action: 'startSession', sessionName: name, args: [cwd, briefing, systemPromptAppend, resumeSessionId] });
	}
}

export function sendMessage(name: string, text: string) {
	if (isTabLeader) {
		sendMessageInternal(name, text);
	} else {
		tabCoordinator.requestAction({ action: 'sendMessage', sessionName: name, args: [text] });
	}
}

export function interrupt(name: string) {
	if (isTabLeader) {
		interruptInternal(name);
	} else {
		tabCoordinator.requestAction({ action: 'interrupt', sessionName: name, args: [] });
	}
}

export function addPane(name: string, cwd: string, firstMessage?: string, systemPrompt?: string, resumeSessionId?: string) {
	const briefing = firstMessage ? firstMessage.replace('{name}', name) : `You are an agent named "${name}". Await further instructions.`;
	const prompt = systemPrompt ? systemPrompt.replace('{name}', name) : undefined;
	startSession(name, cwd, briefing, prompt, resumeSessionId);
}

export function killSession(name: string) {
	if (isTabLeader) {
		killSessionInternal(name);
	} else {
		tabCoordinator.requestAction({ action: 'killSession', sessionName: name, args: [] });
	}
}

export function removePane(name: string) {
	killSession(name);
}

export function clearAllSessions() {
	for (const [name] of sessions) {
		killSession(name);
	}
}

export function sendToPane(name: string, message: string, cwd: string) {
	console.log('[agent] sendToPane:', name, 'cwd:', cwd);
	const session = sessions.get(name);

	if (!session) {
		startSession(name, cwd, message);
	} else if (!session.streaming) {
		updateSession(name, { streaming: true });
		if (isTabLeader) {
			const ws = getOrCreateSocket(name);
			if (!ws) return;
			const send = () => sendToSocket(name, { type: 'message', text: message });
			if (ws.readyState === WebSocket.OPEN) {
				send();
			} else {
				ws.addEventListener('open', send, { once: true });
			}
		} else {
			tabCoordinator.requestAction({ action: 'sendMessage', sessionName: name, args: [message] });
		}
	} else {
		sendMessage(name, message);
	}
}

// Session control commands
export function endSession(name: string) {
	if (isTabLeader) {
		endSessionInternal(name);
	} else {
		tabCoordinator.requestAction({ action: 'endSession', sessionName: name, args: [] });
	}
}

export function clearSession(name: string) {
	if (isTabLeader) {
		clearSessionInternal(name);
	} else {
		tabCoordinator.requestAction({ action: 'clearSession', sessionName: name, args: [] });
	}
}

export function continueSession(name: string) {
	if (isTabLeader) {
		continueSessionInternal(name);
	} else {
		tabCoordinator.requestAction({ action: 'continueSession', sessionName: name, args: [] });
	}
}

export function compactSession(name: string) {
	if (isTabLeader) {
		compactSessionInternal(name);
	} else {
		tabCoordinator.requestAction({ action: 'compactSession', sessionName: name, args: [] });
	}
}

// Inject a notification message into an agent session
export function injectNotification(name: string, content: string, notificationType: NotificationType) {
	const session = sessions.get(name);
	if (!session) return;

	updateSession(name, {
		messages: [...session.messages, {
			role: 'notification',
			content,
			notificationType,
			timestamp: new Date().toISOString()
		}]
	});
}

// Notify agent about ticket update (finds agent by ticket ID)
export function notifyAgentOfTicketUpdate(ticketId: string, content: string, notificationType: NotificationType) {
	const agentName = `${ticketId}-agent`;
	const session = sessions.get(agentName);
	if (!session) return false;

	injectNotification(agentName, content, notificationType);
	return true;
}
