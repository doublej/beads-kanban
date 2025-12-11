// WebSocket store for kanban_claude agent server at ws://localhost:9347
// Protocol: start session, stream events, send messages, interrupt

export interface ChatMessage {
	role: 'user' | 'assistant' | 'tool';
	content: string;
	toolName?: string;
	timestamp?: string;
}

export interface AgentSession {
	id: string;
	name: string;
	streaming: boolean;
	messages: ChatMessage[];
	currentDelta: string;
	cost?: number;
	diffs?: FileDiff[];
	// Compatibility with old Pane interface
	pane_type: string;
	backend: string;
}

export interface FileDiff {
	path: string;
	operation: 'created' | 'modified' | 'deleted';
	before: string | null;
	after: string | null;
}

interface StreamEvent {
	type: 'stream_event';
	event: {
		type: string;
		delta?: { type: string; text?: string };
	};
}

interface AssistantMessage {
	type: 'assistant';
	message?: {
		content: Array<{ type: string; name?: string; text?: string }>;
	};
}

interface ToolResult {
	type: 'user';
	tool_use_result?: string;
}

type ServerMessage =
	| { type: 'session_started'; sessionId: string }
	| { type: 'stream'; data: StreamEvent | AssistantMessage | ToolResult | { type: string } }
	| { type: 'done'; result: { subtype: string; total_cost_usd?: number }; diffs?: FileDiff[] }
	| { type: 'error'; error: string }
	| { type: 'interrupted' };

const STORAGE_KEY = 'beads-kanban-sessions';

function loadSessionsFromStorage(): Map<string, AgentSession> {
	if (typeof window === 'undefined') return new Map();
	const stored = localStorage.getItem(STORAGE_KEY);
	if (!stored) return new Map();
	try {
		const arr: [string, AgentSession][] = JSON.parse(stored);
		// Mark all loaded sessions as not streaming (they were interrupted)
		return new Map(arr.map(([k, v]) => [k, { ...v, streaming: false, currentDelta: '' }]));
	} catch {
		return new Map();
	}
}

function saveSessionsToStorage(sessions: Map<string, AgentSession>) {
	if (typeof window === 'undefined') return;
	const arr = Array.from(sessions.entries());
	localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

let sessions = $state<Map<string, AgentSession>>(loadSessionsFromStorage());
let connected = $state(false);
let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let currentSessionName: string | null = null;

// Save sessions whenever they change
$effect.root(() => {
	$effect(() => {
		saveSessionsToStorage(sessions);
	});
});

function handleSessionStarted(sessionId: string) {
	if (!currentSessionName) return;
	const session: AgentSession = {
		id: sessionId,
		name: currentSessionName,
		streaming: true,
		messages: [],
		currentDelta: '',
		pane_type: 'agent',
		backend: 'claude'
	};
	sessions.set(currentSessionName, session);
	sessions = new Map(sessions);
}

function handleStream(data: StreamEvent | AssistantMessage | ToolResult | { type: string }) {
	if (!currentSessionName) return;
	const session = sessions.get(currentSessionName);
	if (!session) return;

	if (data.type === 'stream_event') {
		const ev = (data as StreamEvent).event;
		if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta' && ev.delta.text) {
			sessions.set(currentSessionName, {
				...session,
				currentDelta: session.currentDelta + ev.delta.text
			});
			sessions = new Map(sessions);
		}
	} else if (data.type === 'assistant') {
		const msg = data as AssistantMessage;
		const content = msg.message?.content;
		if (Array.isArray(content)) {
			for (const block of content) {
				if (block.type === 'text' && block.text) {
					const chatMsg: ChatMessage = {
						role: 'assistant',
						content: block.text,
						timestamp: new Date().toISOString()
					};
					sessions.set(currentSessionName, {
						...session,
						messages: [...session.messages, chatMsg],
						currentDelta: ''
					});
					sessions = new Map(sessions);
				} else if (block.type === 'tool_use' && block.name) {
					const toolMsg: ChatMessage = {
						role: 'tool',
						content: `Using ${block.name}`,
						toolName: block.name,
						timestamp: new Date().toISOString()
					};
					sessions.set(currentSessionName, {
						...session,
						messages: [...session.messages, toolMsg],
						currentDelta: ''
					});
					sessions = new Map(sessions);
				}
			}
		}
	}
}

function handleDone(result: { subtype: string; total_cost_usd?: number }, diffs?: FileDiff[]) {
	if (!currentSessionName) return;
	const session = sessions.get(currentSessionName);
	if (!session) return;

	// Flush any remaining delta as a message
	let messages = session.messages;
	if (session.currentDelta) {
		messages = [...messages, {
			role: 'assistant' as const,
			content: session.currentDelta,
			timestamp: new Date().toISOString()
		}];
	}

	sessions.set(currentSessionName, {
		...session,
		streaming: false,
		messages,
		currentDelta: '',
		cost: result.total_cost_usd,
		diffs
	});
	sessions = new Map(sessions);
	currentSessionName = null;
}

function handleError(error: string) {
	console.error('[agent] error:', error);
	if (currentSessionName) {
		const session = sessions.get(currentSessionName);
		if (session) {
			sessions.set(currentSessionName, {
				...session,
				streaming: false,
				messages: [...session.messages, {
					role: 'assistant',
					content: `Error: ${error}`,
					timestamp: new Date().toISOString()
				}]
			});
			sessions = new Map(sessions);
		}
	}
}

function handleInterrupted() {
	if (!currentSessionName) return;
	const session = sessions.get(currentSessionName);
	if (!session) return;
	sessions.set(currentSessionName, {
		...session,
		streaming: false,
		messages: [...session.messages, {
			role: 'assistant',
			content: '[Interrupted]',
			timestamp: new Date().toISOString()
		}]
	});
	sessions = new Map(sessions);
	currentSessionName = null;
}

function onMessage(event: MessageEvent) {
	const msg = JSON.parse(event.data) as ServerMessage;
	console.log('[agent] recv', msg);

	switch (msg.type) {
		case 'session_started':
			handleSessionStarted(msg.sessionId);
			break;
		case 'stream':
			handleStream(msg.data);
			break;
		case 'done':
			handleDone(msg.result, msg.diffs);
			break;
		case 'error':
			handleError(msg.error);
			break;
		case 'interrupted':
			handleInterrupted();
			break;
	}
}

function scheduleReconnect() {
	if (reconnectTimer) return;
	reconnectTimer = setTimeout(() => {
		reconnectTimer = null;
		connect();
	}, 3000);
}

export function connect(url?: string) {
	if (ws?.readyState === WebSocket.OPEN) return;
	const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
	const wsUrl = url || `ws://${host}:9347`;
	console.log('[agent] connecting to', wsUrl);
	ws = new WebSocket(wsUrl);
	ws.onopen = () => {
		connected = true;
		console.log('[agent] connected');
	};
	ws.onclose = () => {
		connected = false;
		console.log('[agent] disconnected');
		scheduleReconnect();
	};
	ws.onerror = (e) => {
		console.error('[agent] error', e);
		ws?.close();
	};
	ws.onmessage = onMessage;
}

export function disconnect() {
	if (reconnectTimer) {
		clearTimeout(reconnectTimer);
		reconnectTimer = null;
	}
	ws?.close();
	ws = null;
	connected = false;
}

export function getSessions() { return sessions; }
export function isConnected() { return connected; }

// Compatibility aliases for existing UI
export function getPanes() { return sessions; }
export type Pane = AgentSession;

function send(payload: Record<string, unknown>) {
	if (ws?.readyState === WebSocket.OPEN) {
		console.log('[agent] send', payload);
		ws.send(JSON.stringify(payload));
	}
}

let workingDirectory = '.';

export function setWorkingDirectory(cwd: string) {
	workingDirectory = cwd;
}

export function startSession(name: string, briefing: string, cwd?: string, systemPromptAppend?: string) {
	currentSessionName = name;
	send({
		type: 'start',
		cwd: cwd || workingDirectory,
		briefing,
		systemPromptAppend
	});
}

export function sendMessage(text: string) {
	if (!currentSessionName) return;
	const session = sessions.get(currentSessionName);
	if (session) {
		sessions.set(currentSessionName, {
			...session,
			messages: [...session.messages, {
				role: 'user',
				content: text,
				timestamp: new Date().toISOString()
			}]
		});
		sessions = new Map(sessions);
	}
	send({ type: 'message', text });
}

export function interrupt() {
	send({ type: 'interrupt' });
}

// Compatibility: addPane starts a session with a default briefing
export function addPane(name: string) {
	startSession(name, `You are an agent named "${name}". Await further instructions.`);
}

// Compatibility: removePane just removes from local state (session continues on server until ws closes)
export function removePane(name: string) {
	sessions.delete(name);
	sessions = new Map(sessions);
}

// Compatibility: sendToPane sends a message or starts session
export function sendToPane(name: string, message: string, cwd?: string) {
	const session = sessions.get(name);
	if (!session) {
		currentSessionName = name;
		send({
			type: 'start',
			cwd: cwd || '.',
			briefing: message
		});
	} else if (!session.streaming) {
		// Session exists but finished - send follow-up message
		currentSessionName = name;
		session.streaming = true;
		sessions.set(name, { ...session, streaming: true });
		sessions = new Map(sessions);
		send({ type: 'message', text: message });
	} else {
		// Active session - send follow-up
		currentSessionName = name;
		sendMessage(message);
	}
}
