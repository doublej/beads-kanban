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
	ServerMessage,
	StreamEvent,
	AssistantMessage,
	ToolResult,
	ToolCallEvent,
	ToolResultEvent,
} from './ws-types';

// --- Shared state ---
let sessions = $state<Map<string, AgentSession>>(loadSessions());
let sessionSockets = new Map<string, WebSocket>();
let serverAvailable = $state(false);
let isTabLeader = $state(false);

// Callback set by ws-connection to broadcast to followers
let broadcastCallback: (() => void) | null = null;

export function setBroadcastCallback(cb: () => void) {
	broadcastCallback = cb;
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

// --- Message handler factory ---
export function createMessageHandler(sessionName: string) {
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
				updateSession(sessionName, {
					sdkSessionId: msg.sdkSessionId,
					slashCommands: msg.slashCommands
				});
				persistSdkSessionId(sessionName, msg.sdkSessionId);
				break;

			case 'compacted':
				updateSession(sessionName, { compacted: true });
				break;

			case 'system_message':
				updateSession(sessionName, {
					messages: [...session.messages, {
						role: 'system',
						content: msg.content,
						systemSubtype: msg.subtype,
						timestamp: new Date().toISOString()
					}]
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
		}
	} else if (data.type === 'tool_call') {
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
