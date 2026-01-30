import type { Issue } from '$lib/types';
import type { NotificationEventType, NotificationEvent } from './types';
import { notificationEmitter } from './event-emitter';

/**
 * Central notification routing and state management
 *
 * This store listens to the event emitter and routes notifications
 * to the appropriate handler based on user settings.
 */
class NotificationStore {
	/**
	 * Initialize the notification system
	 * Sets up listener for all notification events
	 */
	init(): void {
		notificationEmitter.on('*', (event) => {
			this.handleEvent(event);
		});
	}

	/**
	 * Emit a notification event
	 */
	emit(type: NotificationEventType, issue: Issue, metadata?: Record<string, unknown>): void {
		notificationEmitter.emit(type, issue, metadata);
	}

	/**
	 * Handle incoming notification event
	 * Routes to appropriate handler based on settings
	 */
	private async handleEvent(event: NotificationEvent): Promise<void> {
		// Import settings here to avoid circular dependency
		const { settings } = await import('$lib/stores/settings.svelte');

		const mode = settings.notificationMode;
		const eventSettings = settings.notificationEvents;

		// Check if this event type is enabled
		if (!eventSettings[event.type]) {
			return;
		}

		// Route based on mode
		switch (mode) {
			case 'none':
				return; // No notifications

			case 'browser':
				await this.handleBrowserNotification(event);
				break;

			case 'mcp':
				await this.handleMcpNotification(event);
				break;
		}
	}

	/**
	 * Handle browser-based notification
	 */
	private async handleBrowserNotification(event: NotificationEvent): Promise<void> {
		// Import services lazily
		const { pushService } = await import('./push-service');
		const { toastQueue } = await import('./toast-queue.svelte');

		if (pushService.isSubscribed()) {
			await pushService.send(event);
		} else {
			// Fallback to toast
			toastQueue.show({
				type: 'info',
				title: this.formatEventTitle(event.type),
				message: this.formatEventMessage(event),
				duration: 5000
			});
		}

		// Always show in-app toast for immediate feedback
		toastQueue.show({
			type: 'info',
			title: this.formatEventTitle(event.type),
			message: this.formatEventMessage(event),
			duration: 3000
		});
	}

	/**
	 * Handle MCP-based notification
	 */
	private async handleMcpNotification(event: NotificationEvent): Promise<void> {
		const { mcpNotifier } = await import('./mcp-notifier');
		await mcpNotifier.notify(event);
	}

	/**
	 * Format event type into human-readable title
	 */
	private formatEventTitle(type: NotificationEventType): string {
		const titles: Record<NotificationEventType, string> = {
			issue_created: 'Issue Created',
			issue_closed: 'Issue Closed',
			status_changed: 'Status Changed',
			priority_changed: 'Priority Changed',
			comment_added: 'New Comment',
			dependency_added: 'Dependency Added',
			assignee_changed: 'Assignee Changed',
			label_modified: 'Labels Modified',
			blocked: 'Issue Blocked',
			unblocked: 'Issue Unblocked',
			attachment_added: 'Attachment Added'
		};
		return titles[type];
	}

	/**
	 * Format event into human-readable message
	 */
	private formatEventMessage(event: NotificationEvent): string {
		const issue = event.issue;
		const id = issue.id.substring(0, 8);

		switch (event.type) {
			case 'issue_created':
				return `Issue #${id}: ${issue.title}`;
			case 'issue_closed':
				return `Issue #${id} has been closed`;
			case 'status_changed':
				return `Issue #${id} is now ${issue.status}`;
			case 'priority_changed':
				return `Issue #${id} priority changed to ${issue.priority}`;
			case 'blocked':
				return `Issue #${id} is now blocked`;
			case 'unblocked':
				return `Issue #${id} is no longer blocked`;
			case 'assignee_changed':
				return issue.assignee
					? `Issue #${id} assigned to ${issue.assignee}`
					: `Issue #${id} unassigned`;
			default:
				return `Issue #${id}: ${issue.title}`;
		}
	}
}

export const notificationStore = new NotificationStore();
