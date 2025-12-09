// WebSocket store for pane bridge at ws://localhost:8765
// Daemon events: pane_added, message, delta, status
// Response format: {"type": "response", "data": {...}}
// Event format: {"event": "...", "pane": "name", ...}

export interface ChatMessage {
	role: string;
	content: string;
	block_type: string;
	timestamp?: string;
}

export interface Pane {
	name: string;
	pane_type: string;
	backend: string;
	streaming: boolean;
	messages: ChatMessage[];
	currentDelta: string;
}

interface DaemonEvent {
	event: 'pane_added' | 'message' | 'delta' | 'status';
	pane: string;
	pane_type?: string;
	backend?: string;
	streaming?: boolean;
	version?: number;
	message?: { role: string; content: string; block_type: string };
}

interface DaemonResponse {
	type: 'response' | 'error';
	data?: Record<string, unknown>;
	message?: string;
}

let panes = $state<Map<string, Pane>>(new Map());
let connected = $state(false);
let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function handlePaneAdded(data: DaemonEvent) {
	const name = data.pane;
	if (panes.has(name)) return;
	panes.set(name, {
		name,
		pane_type: data.pane_type || 'worker',
		backend: data.backend || 'claude',
		streaming: false,
		messages: [],
		currentDelta: ''
	});
	panes = new Map(panes);
}

function handleMessage(data: DaemonEvent) {
	const pane = panes.get(data.pane);
	if (!pane || !data.message) return;
	const msg: ChatMessage = {
		role: data.message.role,
		content: data.message.content,
		block_type: data.message.block_type,
		timestamp: new Date().toISOString()
	};
	panes.set(data.pane, {
		...pane,
		messages: [...pane.messages, msg],
		currentDelta: ''
	});
	panes = new Map(panes);
}

function handleDelta(data: DaemonEvent) {
	const pane = panes.get(data.pane);
	if (!pane) return;
	const delta = pane.currentDelta + (data.message?.content || '');
	panes.set(data.pane, { ...pane, currentDelta: delta });
	panes = new Map(panes);
}

function handleStatus(data: DaemonEvent) {
	const pane = panes.get(data.pane);
	if (!pane) return;
	panes.set(data.pane, { ...pane, streaming: data.streaming ?? pane.streaming });
	panes = new Map(panes);
}

function handleResponse(data: DaemonResponse) {
	if (data.type === 'error') {
		console.error('[ws] daemon error:', data.message);
		return;
	}
	// Handle panes list response
	if (data.data?.panes && Array.isArray(data.data.panes)) {
		for (const name of data.data.panes as string[]) {
			if (!panes.has(name)) {
				panes.set(name, {
					name,
					pane_type: 'worker',
					backend: 'claude',
					streaming: false,
					messages: [],
					currentDelta: ''
				});
			}
		}
		panes = new Map(panes);
	}
	// Handle status response
	if (data.data?.status && typeof data.data.status === 'object') {
		const statusMap = data.data.status as Record<string, { streaming?: boolean; pane_type?: string; backend?: string }>;
		for (const [name, status] of Object.entries(statusMap)) {
			const pane = panes.get(name);
			if (pane) {
				panes.set(name, {
					...pane,
					streaming: status.streaming ?? pane.streaming,
					pane_type: status.pane_type ?? pane.pane_type,
					backend: status.backend ?? pane.backend
				});
			}
		}
		panes = new Map(panes);
	}
}

function onMessage(event: MessageEvent) {
	const data = JSON.parse(event.data);
	console.log('[ws] recv', data);

	// Handle command responses
	if (data.type === 'response' || data.type === 'error') {
		handleResponse(data as DaemonResponse);
		return;
	}

	// Handle broadcast events
	if (data.event) {
		const handlers: Record<string, (d: DaemonEvent) => void> = {
			pane_added: handlePaneAdded,
			message: handleMessage,
			delta: handleDelta,
			status: handleStatus
		};
		handlers[data.event]?.(data as DaemonEvent);
	}
}

function scheduleReconnect() {
	if (reconnectTimer) return;
	reconnectTimer = setTimeout(() => {
		reconnectTimer = null;
		connect();
	}, 3000);
}

export function connect(url = 'ws://localhost:8765') {
	if (ws?.readyState === WebSocket.OPEN) return;
	console.log('[ws] connecting to', url);
	ws = new WebSocket(url);
	ws.onopen = () => {
		connected = true;
		console.log('[ws] connected');
		listPanes();
		getStatus();
	};
	ws.onclose = () => { connected = false; console.log('[ws] disconnected'); scheduleReconnect(); };
	ws.onerror = (e) => { console.error('[ws] error', e); ws?.close(); };
	ws.onmessage = onMessage;
}

export function disconnect() {
	if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
	ws?.close();
	ws = null;
	connected = false;
}

export function getPanes() { return panes; }
export function isConnected() { return connected; }

function send(payload: Record<string, unknown>) {
	if (ws?.readyState === WebSocket.OPEN) {
		console.log('[ws] send', payload);
		ws.send(JSON.stringify(payload));
	}
}

export function listPanes() { send({ action: 'panes' }); }
export function getStatus() { send({ action: 'status' }); }
export function addPane(name: string) { send({ action: 'add', name }); }
export function removePane(name: string) { send({ action: 'rm', name }); }
export function getPaneOutput(name: string) { send({ action: 'get', name }); }
export function sendToPane(name: string, message: string, cwd?: string) {
	send({ action: 'send', name, message, ...(cwd && { cwd }) });
}
