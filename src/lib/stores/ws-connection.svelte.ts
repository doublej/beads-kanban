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
	setSessionError,
	createMessageHandler,
} from './agent-sessions.svelte';
import { fetchSessionHistory } from '../session-persistence';
import { initTabCoordinator } from './tab-coordinator.svelte';
import { MANAGER_SESSION_NAME, setManagerVisible } from './manager.svelte';
import { fetchInitialQueue, setQueueWsSender } from './queue.svelte';
import { settings } from './settings.svelte';

let checkTimer: ReturnType<typeof setTimeout> | null = null;

function getWsUrl(): string {
	const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
	return `ws://${host}:9347`;
}

async function getOrCreateSocket(sessionName: string): Promise<WebSocket | null> {
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

	// Check health before attempting WebSocket to avoid uncatchable console errors
	const healthy = await checkServerHealth();
	if (!healthy) {
		setSessionError(sessionName, 'Agent server not available. Start it with `bun run dev:agent`.');
		setServerAvailable(false);
		return null;
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

	ws.onerror = () => {
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
export async function resumeSession(name: string) {
	const session = getSessions().get(name);
	if (!session?.serverId) return;

	console.log(`[agent:${name}] resuming session`, session.serverId);

	const ws = await getOrCreateSocket(name);
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

async function startSessionInternal(name: string, cwd: string, briefing: string, systemPromptAppend?: string, resumeSessionId?: string, ticketId?: string, model?: string, isManager?: boolean) {
	console.log('[agent] startSession:', name, 'cwd:', cwd, resumeSessionId ? `resuming: ${resumeSessionId}` : '', ticketId ? `ticket: ${ticketId}` : '', isManager ? 'MANAGER' : '');

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
		ticketId: ticketId ?? existing?.ticketId,
		isManager,
	};
	sessions.set(name, session);
	setSessions(new Map(sessions));

	// Populate history from SDK session JSONL when resuming with no existing messages
	if (resumeSessionId && session.messages.length === 0) {
		fetchSessionHistory(cwd, resumeSessionId).then((messages) => {
			if (messages.length === 0) return;
			const current = getSessions().get(name);
			if (!current || current.messages.length > 0) return; // Don't overwrite if streaming already added messages
			updateSession(name, { messages });
		});
	}

	const ws = await getOrCreateSocket(name);
	if (!ws) return;

	const sendStart = () => {
		sendToSocket(name, { type: 'start', cwd, agentName: name, briefing, systemPromptAppend, resumeSessionId, model, isManager });
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
	// Manager session: minimize instead of killing
	if (name === MANAGER_SESSION_NAME) {
		setManagerVisible(false);
		return;
	}
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

export function startManager(cwd: string) {
	const sessions = getSessions();
	if (sessions.has(MANAGER_SESSION_NAME)) {
		// Already running — just show
		setManagerVisible(true);
		return;
	}
	const model = settings.managerModel || undefined;
	startSessionInternal(
		MANAGER_SESSION_NAME,
		cwd,
		'You are the Manager Agent. Await instructions from the user.',
		undefined,
		undefined,
		undefined,
		model,
		true
	);
	setManagerVisible(true);
}

export function forceKillManager() {
	const sessions = getSessions();
	const session = sessions.get(MANAGER_SESSION_NAME);
	if (session?.streaming) {
		sendToSocket(MANAGER_SESSION_NAME, { type: 'interrupt' });
	}
	const sockets = getSessionSockets();
	const ws = sockets.get(MANAGER_SESSION_NAME);
	if (ws) {
		ws.close();
		sockets.delete(MANAGER_SESSION_NAME);
	}
	sessions.delete(MANAGER_SESSION_NAME);
	setSessions(new Map(sessions));
	setManagerVisible(false);
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

function leaderOrForward<A extends unknown[]>(
	action: string,
	internal: (name: string, ...args: A) => void
): (name: string, ...args: A) => void {
	return (name, ...args) => {
		if (getIsTabLeader()) internal(name, ...args);
		else tabCoordinator.requestAction({ action, sessionName: name, args: args as unknown[] });
	};
}

async function checkServerHealth() {
	try {
		const res = await fetch('/api/agent/health');
		const data = await res.json();
		return data.ok === true;
	} catch {
		return false;
	}
}

export function connect() {
	if (typeof window === 'undefined') return;

	initTabCoordinator();

	// Wire up queue WS sender — uses the first available socket
	setQueueWsSender((msg) => {
		const sockets = getSessionSockets();
		for (const [, ws] of sockets) {
			if (ws.readyState === WebSocket.OPEN) {
				ws.send(JSON.stringify(msg));
				return;
			}
		}
	});

	checkServerHealth().then((ok) => {
		setServerAvailable(ok);
		if (ok && getIsTabLeader()) {
			fetchInitialQueue();
			for (const [name, session] of getSessions()) {
				if (session.serverId && !session.streaming) {
					resumeSession(name);
				}
			}
		}
	});

	if (!checkTimer) {
		checkTimer = setInterval(() => {
			if (!getServerAvailable() && getIsTabLeader()) {
				checkServerHealth().then((ok) => setServerAvailable(ok));
			}
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

export function startSession(name: string, cwd: string, briefing: string, systemPromptAppend?: string, resumeSessionId?: string, ticketId?: string, model?: string, isManager?: boolean) {
	if (getIsTabLeader()) {
		startSessionInternal(name, cwd, briefing, systemPromptAppend, resumeSessionId, ticketId, model, isManager);
	} else {
		tabCoordinator.requestAction({ action: 'startSession', sessionName: name, args: [cwd, briefing, systemPromptAppend, resumeSessionId, ticketId, model, isManager] });
	}
}

export const sendMessage = leaderOrForward('sendMessage', sendMessageInternal);
export const interrupt = leaderOrForward('interrupt', interruptInternal);

export function addPane(name: string, cwd: string, firstMessage?: string, systemPrompt?: string, resumeSessionId?: string, ticketId?: string, model?: string) {
	const briefing = firstMessage ? firstMessage.replace('{name}', name) : `You are an agent named "${name}". Await further instructions.`;
	const prompt = systemPrompt ? systemPrompt.replace('{name}', name) : undefined;
	startSession(name, cwd, briefing, prompt, resumeSessionId, ticketId, model);
}

export const killSession = leaderOrForward('killSession', killSessionInternal);

export function removePane(name: string) {
	killSession(name);
}

export function clearAllSessions() {
	for (const [name] of getSessions()) {
		killSession(name);
	}
}

export async function sendToPane(name: string, message: string, cwd: string) {
	console.log('[agent] sendToPane:', name, 'cwd:', cwd);
	const sessions = getSessions();
	const session = sessions.get(name);

	if (!session) {
		startSession(name, cwd, message);
	} else if (!session.streaming) {
		updateSession(name, { streaming: true });
		if (getIsTabLeader()) {
			const ws = await getOrCreateSocket(name);
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

export const endSession = leaderOrForward('endSession', endSessionInternal);
export const clearSession = leaderOrForward('clearSession', clearSessionInternal);
export const continueSession = leaderOrForward('continueSession', continueSessionInternal);
export const compactSession = leaderOrForward('compactSession', compactSessionInternal);

export function getRunningSessionsForCwd(cwd: string): string[] {
	const results: string[] = [];
	for (const [name, session] of getSessions()) {
		if (session.streaming && session.cwd === cwd) {
			results.push(name);
		}
	}
	return results;
}

export const injectNotification = leaderOrForward('injectNotification', injectNotificationInternal);
