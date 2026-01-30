// WebSocket lifecycle, message routing, and session commands
import { tabCoordinator } from '../tabCoordinator';
import type { AgentSession, NotificationType } from './ws-types';
import {
	getSessions,
	setSessions,
	getSessionSockets,
	getServerAvailable,
	setServerAvailable,
	getIsTabLeader,
	setIsTabLeader,
	setBroadcastCallback,
	updateSession,
	createMessageHandler,
} from './agent-sessions.svelte';
import { initTabCoordinator } from './tab-coordinator.svelte';

let checkTimer: ReturnType<typeof setTimeout> | null = null;

function getWsUrl(): string {
	const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
	return `ws://${host}:9347`;
}

function getOrCreateSocket(sessionName: string): WebSocket | null {
	if (!getIsTabLeader()) {
		console.log(`[agent:${sessionName}] not leader, skipping socket creation`);
		return null;
	}

	const sockets = getSessionSockets();
	let ws = sockets.get(sessionName);
	if (ws?.readyState === WebSocket.OPEN) return ws;

	if (ws) {
		ws.close();
		sockets.delete(sessionName);
	}

	ws = new WebSocket(getWsUrl());
	sockets.set(sessionName, ws);

	ws.onopen = () => {
		console.log(`[agent:${sessionName}] connected`);
		setServerAvailable(true);
	};

	ws.onclose = () => {
		console.log(`[agent:${sessionName}] disconnected`);
		sockets.delete(sessionName);
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
	const ws = getSessionSockets().get(sessionName);
	if (ws?.readyState === WebSocket.OPEN) {
		console.log(`[agent:${sessionName}] send`, payload.type);
		ws.send(JSON.stringify(payload));
	}
}

// Resume a session that has a serverId
export function resumeSession(name: string) {
	const session = getSessions().get(name);
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

// --- Broadcast sessions to followers (debounced) ---
let broadcastTimeout: ReturnType<typeof setTimeout> | null = null;
function broadcastSessionsToFollowers() {
	if (broadcastTimeout) clearTimeout(broadcastTimeout);
	broadcastTimeout = setTimeout(() => {
		const arr = Array.from(getSessions().entries());
		tabCoordinator.broadcastState(arr);
	}, 50);
}

// Wire up the broadcast callback so agent-sessions can trigger it
setBroadcastCallback(broadcastSessionsToFollowers);

// --- Internal functions (called by leader tab) ---

function startSessionInternal(name: string, cwd: string, briefing: string, systemPromptAppend?: string, resumeSessionId?: string, ticketId?: string) {
	console.log('[agent] startSession:', name, 'cwd:', cwd, resumeSessionId ? `resuming: ${resumeSessionId}` : '', ticketId ? `ticket: ${ticketId}` : '');

	const sessions = getSessions();
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
		sdkSessionId: resumeSessionId,
		ticketId: ticketId ?? existing?.ticketId
	};
	sessions.set(name, session);
	setSessions(new Map(sessions));

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
	const session = getSessions().get(name);
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
	const sessions = getSessions();
	const session = sessions.get(name);
	if (session?.streaming) {
		sendToSocket(name, { type: 'interrupt' });
	}
	const sockets = getSessionSockets();
	const ws = sockets.get(name);
	if (ws) {
		ws.close();
		sockets.delete(name);
	}
	sessions.delete(name);
	setSessions(new Map(sessions));
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

function injectNotificationInternal(name: string, content: string, notificationType: NotificationType) {
	const session = getSessions().get(name);
	if (!session) return;

	updateSession(name, {
		messages: [...session.messages, {
			role: 'notification',
			content,
			notificationType,
			timestamp: new Date().toISOString()
		}]
	});

	sendToSocket(name, { type: 'inject_context', context: `[${notificationType.toUpperCase()}] ${content}` });
}

// Expose internal functions for tab-coordinator action handling
export const internalActions = {
	startSessionInternal,
	sendMessageInternal,
	interruptInternal,
	killSessionInternal,
	endSessionInternal,
	clearSessionInternal,
	continueSessionInternal,
	compactSessionInternal,
	injectNotificationInternal,
};

// --- Public functions (forward to leader if not leader) ---

export function connect() {
	if (typeof window === 'undefined') return;

	initTabCoordinator();

	const ws = new WebSocket(getWsUrl());
	ws.onopen = () => {
		setServerAvailable(true);
		ws.close();
		if (getIsTabLeader()) {
			for (const [name, session] of getSessions()) {
				if (session.serverId && !session.streaming) {
					resumeSession(name);
				}
			}
		}
	};
	ws.onerror = () => {
		setServerAvailable(false);
	};
	if (!checkTimer) {
		checkTimer = setInterval(() => {
			if (!getServerAvailable() && getIsTabLeader()) connect();
		}, 5000);
	}
}

export function disconnect() {
	if (checkTimer) {
		clearInterval(checkTimer);
		checkTimer = null;
	}
	for (const [, ws] of getSessionSockets()) {
		ws.close();
	}
	getSessionSockets().clear();
	setServerAvailable(false);
	tabCoordinator.destroy();
}

export function isConnected() { return getServerAvailable(); }
export function getConnected() { return getServerAvailable(); }
export function getPanes() { return getSessions(); }
export function isLeaderTab() { return getIsTabLeader(); }

export function startSession(name: string, cwd: string, briefing: string, systemPromptAppend?: string, resumeSessionId?: string, ticketId?: string) {
	if (getIsTabLeader()) {
		startSessionInternal(name, cwd, briefing, systemPromptAppend, resumeSessionId, ticketId);
	} else {
		tabCoordinator.requestAction({ action: 'startSession', sessionName: name, args: [cwd, briefing, systemPromptAppend, resumeSessionId, ticketId] });
	}
}

export function sendMessage(name: string, text: string) {
	if (getIsTabLeader()) {
		sendMessageInternal(name, text);
	} else {
		tabCoordinator.requestAction({ action: 'sendMessage', sessionName: name, args: [text] });
	}
}

export function interrupt(name: string) {
	if (getIsTabLeader()) {
		interruptInternal(name);
	} else {
		tabCoordinator.requestAction({ action: 'interrupt', sessionName: name, args: [] });
	}
}

export function addPane(name: string, cwd: string, firstMessage?: string, systemPrompt?: string, resumeSessionId?: string, ticketId?: string) {
	const briefing = firstMessage ? firstMessage.replace('{name}', name) : `You are an agent named "${name}". Await further instructions.`;
	const prompt = systemPrompt ? systemPrompt.replace('{name}', name) : undefined;
	startSession(name, cwd, briefing, prompt, resumeSessionId, ticketId);
}

export function killSession(name: string) {
	if (getIsTabLeader()) {
		killSessionInternal(name);
	} else {
		tabCoordinator.requestAction({ action: 'killSession', sessionName: name, args: [] });
	}
}

export function removePane(name: string) {
	killSession(name);
}

export function clearAllSessions() {
	for (const [name] of getSessions()) {
		killSession(name);
	}
}

export function sendToPane(name: string, message: string, cwd: string) {
	console.log('[agent] sendToPane:', name, 'cwd:', cwd);
	const sessions = getSessions();
	const session = sessions.get(name);

	if (!session) {
		startSession(name, cwd, message);
	} else if (!session.streaming) {
		updateSession(name, { streaming: true });
		if (getIsTabLeader()) {
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

export function endSession(name: string) {
	if (getIsTabLeader()) {
		endSessionInternal(name);
	} else {
		tabCoordinator.requestAction({ action: 'endSession', sessionName: name, args: [] });
	}
}

export function clearSession(name: string) {
	if (getIsTabLeader()) {
		clearSessionInternal(name);
	} else {
		tabCoordinator.requestAction({ action: 'clearSession', sessionName: name, args: [] });
	}
}

export function continueSession(name: string) {
	if (getIsTabLeader()) {
		continueSessionInternal(name);
	} else {
		tabCoordinator.requestAction({ action: 'continueSession', sessionName: name, args: [] });
	}
}

export function compactSession(name: string) {
	if (getIsTabLeader()) {
		compactSessionInternal(name);
	} else {
		tabCoordinator.requestAction({ action: 'compactSession', sessionName: name, args: [] });
	}
}

export function injectNotification(name: string, content: string, notificationType: NotificationType) {
	if (getIsTabLeader()) {
		injectNotificationInternal(name, content, notificationType);
	} else {
		tabCoordinator.requestAction({ action: 'injectNotification', sessionName: name, args: [content, notificationType] });
	}
}
