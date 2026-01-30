// Message tracking, unread counts, and ticket notification routing
import type { AgentSession, NotificationType, TicketNotificationContext } from './ws-types';
import { getSessions, updateSession } from './agent-sessions.svelte';
import { injectNotification } from './ws-connection.svelte';

// Mark pane as read - update lastReadCount to current message count
export function markPaneAsRead(name: string) {
	const session = getSessions().get(name);
	if (!session) return;
	updateSession(name, { lastReadCount: session.messages.length });
}

// Get total unread count across all panes
export function getTotalUnreadCount(): number {
	let total = 0;
	for (const [, session] of getSessions()) {
		const lastRead = session.lastReadCount ?? 0;
		const unread = Math.max(0, session.messages.length - lastRead);
		total += unread;
	}
	return total;
}

// Get unread count for a specific pane
export function getUnreadCount(name: string): number {
	const session = getSessions().get(name);
	if (!session) return 0;
	const lastRead = session.lastReadCount ?? 0;
	return Math.max(0, session.messages.length - lastRead);
}

// Find session by ticketId field or fallback to name pattern
function findSessionByTicketId(ticketId: string): [string, AgentSession] | null {
	for (const [name, session] of getSessions()) {
		if (session.ticketId === ticketId) return [name, session];
	}
	const agentName = `${ticketId}-agent`;
	const session = getSessions().get(agentName);
	if (session) return [agentName, session];
	return null;
}

// Notify agent about ticket update (finds agent by ticket ID)
export function notifyAgentOfTicketUpdate(
	ticketId: string,
	content: string,
	notificationType: NotificationType,
	context?: Omit<TicketNotificationContext, 'ticketId'>,
	formatTemplate?: string
): boolean {
	const found = findSessionByTicketId(ticketId);
	if (!found) return false;
	const [agentName] = found;

	let richContent: string;
	if (formatTemplate) {
		richContent = formatTemplate
			.replace(/{id}/g, ticketId)
			.replace(/{title}/g, context?.ticketTitle || '')
			.replace(/{sender}/g, context?.sender || '')
			.replace(/{content}/g, content);
	} else {
		const parts: string[] = [];
		parts.push(`[Ticket: ${ticketId}]`);
		if (context?.ticketTitle) parts.push(`"${context.ticketTitle}"`);
		if (context?.sender) parts.push(`(from: ${context.sender})`);
		parts.push(content);
		richContent = parts.join(' ');
	}

	injectNotification(agentName, richContent, notificationType);
	return true;
}
