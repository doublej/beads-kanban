// Tab coordination for multi-tab support
// Bridges the tabCoordinator singleton with session state
import { tabCoordinator, type ActionRequest } from '../tabCoordinator';
import type { AgentSession, NotificationType } from './ws-types';
import {
	getSessions,
	setSessions,
	getSessionSockets,
	getIsTabLeader,
	setIsTabLeader,
} from './agent-sessions.svelte';

let tabCoordinatorInitialized = false;

// Lazily import to break circular dependency
let _internalActions: typeof import('./ws-connection.svelte').internalActions | null = null;
let _resumeSession: typeof import('./ws-connection.svelte').resumeSession | null = null;

async function getConnectionModule() {
	if (!_internalActions) {
		const mod = await import('./ws-connection.svelte');
		_internalActions = mod.internalActions;
		_resumeSession = mod.resumeSession;
	}
	return { internalActions: _internalActions!, resumeSession: _resumeSession! };
}

// Apply session state received from leader tab
function applySessionsFromLeader(state: unknown) {
	if (!Array.isArray(state)) return;
	try {
		const newSessions = new Map<string, AgentSession>(state as [string, AgentSession][]);
		setSessions(newSessions);
	} catch {
		// Invalid state, ignore
	}
}

// Handle becoming the leader tab
function onBecomeLeader() {
	console.log('[wsStore] This tab is now the leader');
	setIsTabLeader(true);
	getConnectionModule().then(({ resumeSession }) => {
		for (const [name, session] of getSessions()) {
			if (session.serverId && !session.streaming) {
				resumeSession(name);
			}
		}
	});
}

// Handle becoming a follower tab
function onBecomeFollower() {
	console.log('[wsStore] This tab is now a follower');
	setIsTabLeader(false);
	for (const [, ws] of getSessionSockets()) {
		ws.close();
	}
	getSessionSockets().clear();
}

// Handle action requests forwarded from follower tabs
function handleActionRequest(request: ActionRequest) {
	const { action, sessionName, args } = request;
	console.log(`[wsStore] Handling action request: ${action} for ${sessionName}`);

	getConnectionModule().then(({ internalActions }) => {
		switch (action) {
			case 'startSession':
				internalActions.startSessionInternal(sessionName, ...(args as [string, string, string?, string?, string?]));
				break;
			case 'sendMessage':
				internalActions.sendMessageInternal(sessionName, args[0] as string);
				break;
			case 'interrupt':
				internalActions.interruptInternal(sessionName);
				break;
			case 'killSession':
				internalActions.killSessionInternal(sessionName);
				break;
			case 'endSession':
				internalActions.endSessionInternal(sessionName);
				break;
			case 'clearSession':
				internalActions.clearSessionInternal(sessionName);
				break;
			case 'continueSession':
				internalActions.continueSessionInternal(sessionName);
				break;
			case 'compactSession':
				internalActions.compactSessionInternal(sessionName);
				break;
			case 'injectNotification':
				internalActions.injectNotificationInternal(sessionName, args[0] as string, args[1] as NotificationType);
				break;
		}
	});
}

// Initialize tab coordinator
export function initTabCoordinator() {
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
			if (!getIsTabLeader()) {
				applySessionsFromLeader(state);
			}
		},
		handleActionRequest
	);
}

export function resetTabCoordinator() {
	tabCoordinatorInitialized = false;
}
