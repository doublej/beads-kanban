// Thin facade - re-exports from focused sub-modules
// All existing imports from '$lib/wsStore.svelte' continue to work

// Types
export type {
	NotificationType,
	SystemMessageSubtype,
	ChatMessage,
	TokenUsage,
	SlashCommandInfo,
	AgentSession,
	FileDiff,
	Pane,
	TicketNotificationContext,
} from './stores/ws-types';

// Session state
export { getSessions } from './stores/agent-sessions.svelte';

// Connection lifecycle and session commands
export {
	connect,
	disconnect,
	isConnected,
	getConnected,
	getPanes,
	isLeaderTab,
	startSession,
	sendMessage,
	interrupt,
	addPane,
	killSession,
	removePane,
	clearAllSessions,
	sendToPane,
	endSession,
	clearSession,
	continueSession,
	compactSession,
	setModel,
	setPermissionMode,
	injectNotification,
	getRunningSessionsForCwd,
} from './stores/ws-connection.svelte';

// Message tracking and notifications
export {
	markPaneAsRead,
	getTotalUnreadCount,
	getUnreadCount,
	notifyAgentOfTicketUpdate,
	notifyManagerOfTicketUpdate,
} from './stores/agent-messages.svelte';

// Session persistence (pass-through re-export)
export {
	getPersistedSdkSessionId,
	getAllPersistedSessions,
	deletePersistedSession,
	fetchSdkSessions,
	fetchSessionHistory,
	type SdkSessionInfo,
} from './session-persistence';
