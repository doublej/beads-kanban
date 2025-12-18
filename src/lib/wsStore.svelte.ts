// WebSocket store for embedded agent server at ws://localhost:9347
// Each session gets its own WebSocket connection for proper isolation
import { untrack } from 'svelte';

export interface ChatMessage {
	role: 'user' | 'assistant' | 'tool';
	content: string;
	toolName?: string;
	toolInput?: Record<string, unknown>;
	toolResult?: string;
	timestamp?: string;
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

const STORAGE_KEY = 'beads-kanban-sessions';
const SDK_SESSION_KEY = 'beads-kanban-sdk-sessions';

function persistSdkSessionId(sessionName: string, sdkSessionId: string) {
	if (typeof window === 'undefined') return;
	const stored = localStorage.getItem(SDK_SESSION_KEY);
	const map: Record<string, string> = stored ? JSON.parse(stored) : {};
	map[sessionName] = sdkSessionId;
	localStorage.setItem(SDK_SESSION_KEY, JSON.stringify(map));
}

function clearPersistedSdkSessionId(sessionName: string) {
	if (typeof window === 'undefined') return;
	const stored = localStorage.getItem(SDK_SESSION_KEY);
	if (!stored) return;
	const map: Record<string, string> = JSON.parse(stored);
	delete map[sessionName];
	localStorage.setItem(SDK_SESSION_KEY, JSON.stringify(map));
}

export function getPersistedSdkSessionId(sessionName: string): string | undefined {
	if (typeof window === 'undefined') return undefined;
	const stored = localStorage.getItem(SDK_SESSION_KEY);
	if (!stored) return undefined;
	const map: Record<string, string> = JSON.parse(stored);
	return map[sessionName];
}

function loadSessions(): Map<string, AgentSession> {
	if (typeof window === 'undefined') return new Map();
	const stored = localStorage.getItem(STORAGE_KEY);
	if (!stored) return new Map();
	try {
		const arr: [string, AgentSession][] = JSON.parse(stored);
		return new Map(arr.map(([k, v]) => [k, { ...v, streaming: false, currentDelta: '' }]));
	} catch {
		return new Map();
	}
}

function saveSessions() {
	if (typeof window === 'undefined') return;
	// Don't save ws in storage
	const toSave = Array.from(sessions.entries()).map(([k, v]) => {
		const { ...rest } = v;
		return [k, rest] as [string, AgentSession];
	});
	localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
}

let sessions = $state<Map<string, AgentSession>>(loadSessions());
let sessionSockets = new Map<string, WebSocket>();
let serverAvailable = $state(false);
let checkTimer: ReturnType<typeof setTimeout> | null = null;

// Save sessions whenever they change (debounced to prevent infinite loops)
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
if (typeof window !== 'undefined') {
	$effect.root(() => {
		$effect(() => {
			const _ = sessions.size;
			// Debounce saves to prevent rapid-fire updates from causing loops
			if (saveTimeout) clearTimeout(saveTimeout);
			saveTimeout = setTimeout(() => untrack(() => saveSessions()), 100);
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
	const ws = new WebSocket(getWsUrl());
	ws.onopen = () => {
		serverAvailable = true;
		ws.close();
		// Resume all sessions that have serverId
		for (const [name, session] of sessions) {
			if (session.serverId && !session.streaming) {
				resumeSession(name);
			}
		}
	};
	ws.onerror = () => {
		serverAvailable = false;
	};
	// Schedule periodic check
	if (!checkTimer) {
		checkTimer = setInterval(() => {
			if (!serverAvailable) connect();
		}, 5000);
	}
}

export function disconnect() {
	if (checkTimer) {
		clearInterval(checkTimer);
		checkTimer = null;
	}
	for (const [name, ws] of sessionSockets) {
		ws.close();
	}
	sessionSockets.clear();
	serverAvailable = false;
}

export function getSessions() { return sessions; }
export function isConnected() { return serverAvailable; }
export function getConnected() { return serverAvailable; }
export function getPanes() { return sessions; }
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

export function startSession(name: string, cwd: string, briefing: string, systemPromptAppend?: string, resumeSessionId?: string) {
	console.log('[agent] startSession:', name, 'cwd:', cwd, resumeSessionId ? `resuming: ${resumeSessionId}` : '');

	// Create session entry first
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

	// Create socket and send start
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

export function sendMessage(name: string, text: string) {
	const session = sessions.get(name);
	if (!session) return;

	// Add to local messages
	updateSession(name, {
		messages: [...session.messages, {
			role: 'user',
			content: text,
			timestamp: new Date().toISOString()
		}]
	});

	sendToSocket(name, { type: 'message', text });
}

export function interrupt(name: string) {
	sendToSocket(name, { type: 'interrupt' });
}

export function addPane(name: string, cwd: string, firstMessage?: string, systemPrompt?: string, resumeSessionId?: string) {
	const briefing = firstMessage ? firstMessage.replace('{name}', name) : `You are an agent named "${name}". Await further instructions.`;
	startSession(name, cwd, briefing, systemPrompt || undefined, resumeSessionId);
}

export function killSession(name: string) {
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
		// Existing session, not streaming - send follow-up
		updateSession(name, { streaming: true });

		const ws = getOrCreateSocket(name);
		if (!ws) return;

		const send = () => sendToSocket(name, { type: 'message', text: message });
		if (ws.readyState === WebSocket.OPEN) {
			send();
		} else {
			ws.addEventListener('open', send, { once: true });
		}
	} else {
		// Active session - send message
		sendMessage(name, message);
	}
}

// Session control commands
export function endSession(name: string) {
	sendToSocket(name, { type: 'end' });
}

export function clearSession(name: string) {
	sendToSocket(name, { type: 'clear' });
}

export function continueSession(name: string) {
	sendToSocket(name, { type: 'continue' });
}

export function compactSession(name: string) {
	sendToSocket(name, { type: 'compact' });
}

// Get all persisted SDK sessions (for session picker UI)
export function getAllPersistedSessions(): { name: string; sdkSessionId: string }[] {
	if (typeof window === 'undefined') return [];
	const stored = localStorage.getItem(SDK_SESSION_KEY);
	if (!stored) return [];
	try {
		const map: Record<string, string> = JSON.parse(stored);
		return Object.entries(map).map(([name, sdkSessionId]) => ({ name, sdkSessionId }));
	} catch {
		return [];
	}
}

// Delete a persisted SDK session
export function deletePersistedSession(sessionName: string) {
	clearPersistedSdkSessionId(sessionName);
}

// SDK session info from disk
export interface SdkSessionInfo {
	sessionId: string;
	agentName?: string;
	timestamp: string;
	summary?: string;
	preview: string[];
}

// Fetch SDK sessions from disk via agent server API
export async function fetchSdkSessions(cwd: string): Promise<SdkSessionInfo[]> {
	if (typeof window === 'undefined') return [];
	try {
		const host = window.location.hostname;
		const res = await fetch(`http://${host}:9347/sessions?cwd=${encodeURIComponent(cwd)}`);
		if (!res.ok) return [];
		const data = await res.json();
		return data.sessions || [];
	} catch {
		return [];
	}
}
