// Session state CRUD and persistence
import { untrack } from 'svelte';
import {
	loadSessions,
	saveSessions,
	persistSdkSessionId,
	clearPersistedSdkSessionId,
} from '../session-persistence';
import type {
	AgentSession,
	ActiveRemoteSession,
	ChatMessage,
	ServerMessage,
	StreamEvent,
	AssistantMessage,
	ToolResult,
	ToolCallEvent,
	ToolResultEvent,
	SystemMessageSubtype,
} from './ws-types';
import { setQueueItems } from './queue.svelte';

// --- Shared state ---
let sessions = $state<Map<string, AgentSession>>(loadSessions());
let sessionSockets = new Map<string, WebSocket>();
let serverAvailable = $state(false);
let isTabLeader = $state(false);

// Callback set by ws-connection to broadcast to followers
let broadcastCallback: (() => void) | null = null;
// Callback for when a session is gone (server returned "Session not found")
let sessionGoneCallback: ((sessionName: string) => void) | null = null;
// Callback for when a backend-only session is discovered and should be resumed by the leader tab
let discoveredSessionCallback: ((sessionName: string) => void) | null = null;

export function setBroadcastCallback(cb: () => void) {
	broadcastCallback = cb;
}

export function setSessionGoneCallback(cb: (sessionName: string) => void) {
	sessionGoneCallback = cb;
}

export function setDiscoveredSessionCallback(cb: (sessionName: string) => void) {
	discoveredSessionCallback = cb;
}

// --- Getters / setters for shared state ---
export function getSessions(): Map<string, AgentSession> { return sessions; }
export function setSessions(s: Map<string, AgentSession>) { sessions = s; }

export function getSessionSockets(): Map<string, WebSocket> { return sessionSockets; }

export function getServerAvailable(): boolean { return serverAvailable; }
export function setServerAvailable(v: boolean) { serverAvailable = v; }

export function getIsTabLeader(): boolean { return isTabLeader; }
export function setIsTabLeader(v: boolean) { isTabLeader = v; }

// --- Auto-save effect ---
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

// --- Session CRUD ---
export function updateSession(name: string, updates: Partial<AgentSession>) {
	const session = sessions.get(name);
	if (!session) return;
	sessions.set(name, { ...session, ...updates });
	sessions = new Map(sessions);
	if (isTabLeader && broadcastCallback) {
		broadcastCallback();
	}
}

/**
 * Adds a system message to an existing session.
 * Used for progress updates and status messages.
 */
export function addSystemMessage(
	sessionName: string,
	content: string,
	subtype: SystemMessageSubtype = 'info'
) {
	const session = sessions.get(sessionName);
	if (!session) return;

	updateSession(sessionName, {
		messages: [...session.messages, makeMsg('system', content, { systemSubtype: subtype })]
	});
}

/**
 * Marks session as errored and adds error message.
 * Disables streaming to prevent further input.
 */
export function setSessionError(sessionName: string, errorMessage: string) {
	const session = sessions.get(sessionName);
	if (!session) return;

	updateSession(sessionName, {
		streaming: false,
		error: true,
		errorMessage,
		messages: [...session.messages, makeMsg('system', `Error: ${errorMessage}`, { systemSubtype: 'error' })]
	});
}

// --- Message helpers ---
function makeMsg(role: ChatMessage['role'], content: string, extra: Partial<ChatMessage> = {}): ChatMessage {
	return { role, content, timestamp: new Date().toISOString(), ...extra };
}

function applySessions(next: Map<string, AgentSession>) {
	sessions = next;
	if (isTabLeader && broadcastCallback) {
		broadcastCallback();
	}
}

function syncActiveSessions(scopeCwd: string | null, activeSessions: ActiveRemoteSession[]) {
	const next = new Map(sessions);
	const activeNames = new Set(activeSessions.map((session) => session.name));
	const discoveredToResume: string[] = [];

	for (const remote of activeSessions) {
		const existing = next.get(remote.name);
		if (existing) {
			next.set(remote.name, {
				...existing,
				cwd: remote.cwd,
				projectCwd: remote.projectCwd ?? existing.projectCwd,
				serverId: remote.sessionId,
				streaming: remote.isRunning || existing.streaming,
				ticketId: remote.ticketId ?? existing.ticketId,
				worktreePath: remote.worktreePath ?? existing.worktreePath,
				isManager: remote.isManager,
			});
			continue;
		}

		if (remote.isManager) continue;

		next.set(remote.name, {
			id: crypto.randomUUID(),
			name: remote.name,
			cwd: remote.cwd,
			projectCwd: remote.projectCwd,
			streaming: false,
			messages: [],
			currentDelta: '',
			pane_type: 'agent',
			backend: 'claude',
			ticketId: remote.ticketId,
			worktreePath: remote.worktreePath,
			serverId: remote.sessionId,
			isManager: remote.isManager,
			discoveredFromServer: true,
		});
		discoveredToResume.push(remote.name);
	}

	// Only prune discovered sessions within the broadcast scope (same cwd).
	// Sessions from other projects are filtered out server-side, so their absence
	// here doesn't mean they stopped streaming.
	for (const [name, session] of next) {
		if (!session.discoveredFromServer) continue;
		if (activeNames.has(name)) continue;
		const sessionProjectCwd = session.projectCwd ?? session.cwd;
		if (scopeCwd && sessionProjectCwd !== scopeCwd) continue;
		next.set(name, { ...session, streaming: false });
	}

	applySessions(next);

	for (const sessionName of discoveredToResume) {
		discoveredSessionCallback?.(sessionName);
	}
}

// --- Message handler factory ---
export function createMessageHandler(sessionName: string) {
	return (event: MessageEvent) => {
		const msg = JSON.parse(event.data) as ServerMessage;
		console.log(`[agent:${sessionName}] recv`, msg.type);

		if (msg.type === 'active_sessions') {
			syncActiveSessions(msg.cwd, msg.sessions);
			return;
		}

		const session = sessions.get(sessionName);
		if (!session) return;

		switch (msg.type) {
			case 'queue_state':
				setQueueItems(msg.items as any[]);
				return;

			case 'session_started':
				updateSession(sessionName, { serverId: msg.sessionId, streaming: true });
				break;

			case 'session_resumed': {
				updateSession(sessionName, { serverId: msg.sessionId, streaming: true });
				// Populate history from SDK session JSONL if messages are empty
				if (msg.sdkSessionId && session.messages.length === 0 && session.cwd) {
					import('../session-persistence').then(({ fetchSessionHistory }) => {
						fetchSessionHistory(session.cwd!, msg.sdkSessionId!).then((messages) => {
							if (messages.length === 0) return;
							const current = sessions.get(sessionName);
							if (!current || current.messages.length > 0) return;
							updateSession(sessionName, { messages });
						});
					});
				}
				break;
			}

			case 'sdk_session':
				updateSession(sessionName, {
					sdkSessionId: msg.sdkSessionId,
					slashCommands: msg.slashCommands
				});
				persistSdkSessionId(sessionName, msg.sdkSessionId);
				break;

			case 'agent_capabilities':
				updateSession(sessionName, {
					capabilities: {
						models: msg.models ?? [],
						mcpServers: msg.mcpServers ?? [],
						currentModel: msg.currentModel,
						permissionMode: msg.permissionMode,
						tools: msg.tools,
						plugins: msg.plugins,
					},
					permissionMode: msg.permissionMode ?? session.permissionMode,
				});
				break;

			case 'model_changed':
				updateSession(sessionName, {
					capabilities: session.capabilities
						? { ...session.capabilities, currentModel: msg.model }
						: undefined,
				});
				break;

			case 'permission_mode_changed':
				updateSession(sessionName, {
					permissionMode: msg.mode,
					capabilities: session.capabilities
						? { ...session.capabilities, permissionMode: msg.mode }
						: undefined,
				});
				break;

			case 'compacted':
				updateSession(sessionName, { compacted: true });
				break;

			case 'system_message':
				updateSession(sessionName, {
					messages: [...session.messages, makeMsg('system', msg.content, { systemSubtype: msg.subtype })]
				});
				break;

			case 'usage':
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
					currentThinking: '',
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
				if (session.currentThinking) {
					messages = [...messages, makeMsg('assistant', session.currentThinking, { thinking: true })];
				}
				if (session.currentDelta) {
					messages = [...messages, makeMsg('assistant', session.currentDelta)];
				}
				updateSession(sessionName, {
					streaming: false,
					messages,
					currentDelta: '',
					currentThinking: '',
					cost: msg.result.total_cost_usd,
					diffs: msg.diffs
				});
				break;
			}

			case 'error': {
				const isSessionGone = msg.error?.includes('Session not found') || msg.error?.includes('No active session');
				updateSession(sessionName, {
					streaming: false,
					serverId: isSessionGone ? undefined : session.serverId,
					messages: [...session.messages, makeMsg('assistant', `Error: ${msg.error}`)]
				});
				if (isSessionGone && sessionGoneCallback) {
					sessionGoneCallback(sessionName);
				}
				break;
			}

			case 'interrupted':
				updateSession(sessionName, {
					streaming: false,
					messages: [...session.messages, makeMsg('assistant', '[Interrupted]')]
				});
				break;
		}
	};
}

// --- Stream handling ---
function handleStream(
	name: string,
	session: AgentSession,
	data: StreamEvent | AssistantMessage | ToolResult | ToolCallEvent | ToolResultEvent | { type: string }
) {
	if (data.type === 'stream_event') {
		const ev = (data as StreamEvent).event;
		if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta' && ev.delta.text) {
			updateSession(name, { currentDelta: session.currentDelta + ev.delta.text });
		} else if (ev.type === 'content_block_delta' && ev.delta?.type === 'thinking_delta' && ev.delta.thinking) {
			updateSession(name, { currentThinking: (session.currentThinking ?? '') + ev.delta.thinking });
		}
	} else if (data.type === 'tool_call') {
		const toolCall = data as ToolCallEvent;
		updateSession(name, {
			messages: [...session.messages, makeMsg('tool', `Using ${toolCall.tool_name}`, { toolName: toolCall.tool_name, toolInput: toolCall.input })],
			currentDelta: ''
		});
	} else if (data.type === 'tool_result') {
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
			// Accumulate all blocks into a single update so a multi-block message
			// (e.g. thinking + text + tool_use) doesn't clobber itself via stale state.
			const newMessages: ChatMessage[] = [];
			for (const block of content) {
				if (block.type === 'thinking' && block.thinking) {
					newMessages.push(makeMsg('assistant', block.thinking, { thinking: true }));
				} else if (block.type === 'text' && block.text) {
					newMessages.push(makeMsg('assistant', block.text));
				} else if (block.type === 'tool_use' && block.name) {
					newMessages.push(makeMsg('tool', `Using ${block.name}`, { toolName: block.name, toolInput: block.input }));
				}
			}
			if (newMessages.length > 0) {
				updateSession(name, {
					messages: [...session.messages, ...newMessages],
					currentDelta: '',
					currentThinking: ''
				});
			}
		}
	} else if (data.type === 'user') {
		const userMsg = data as ToolResult;
		if (userMsg.message?.content && Array.isArray(userMsg.message.content)) {
			for (const block of userMsg.message.content) {
				if (block.type === 'tool_result' && block.tool_use_id) {
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
					messages: [...session.messages, makeMsg('user', content)]
				});
			}
		}
	}
}
