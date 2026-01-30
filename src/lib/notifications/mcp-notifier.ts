import type { NotificationEvent } from './types';

/**
 * MCP notification handler using Consult User MCP tools.
 *
 * This module provides notification delivery via the Consult User MCP server.
 * Since MCP tools are invoked by the AI agent (not directly by the web app),
 * this notifier works by queuing events and exposing them for the agent to consume.
 */
class McpNotifier {
	private queue: NotificationEvent[] = [];
	private batchTimer: ReturnType<typeof setTimeout> | null = null;
	private batchDelay = 5000;

	/**
	 * Set the batch delay for grouping notifications
	 */
	setBatchDelay(ms: number): void {
		this.batchDelay = ms;
	}

	/**
	 * Queue a notification event for MCP delivery.
	 * Events are batched by default to avoid notification spam.
	 */
	async notify(event: NotificationEvent): Promise<void> {
		this.queue.push(event);

		// Reset batch timer
		if (this.batchTimer) {
			clearTimeout(this.batchTimer);
		}

		this.batchTimer = setTimeout(() => {
			this.flush();
		}, this.batchDelay);
	}

	/**
	 * Flush all queued events immediately
	 */
	flush(): NotificationEvent[] {
		const events = [...this.queue];
		this.queue = [];

		if (this.batchTimer) {
			clearTimeout(this.batchTimer);
			this.batchTimer = null;
		}

		return events;
	}

	/**
	 * Get pending notification count
	 */
	get pendingCount(): number {
		return this.queue.length;
	}

	/**
	 * Format a notification event for display
	 */
	formatEvent(event: NotificationEvent): { title: string; body: string } {
		const id = event.issue.id.substring(0, 8);
		const issue = event.issue;

		switch (event.type) {
			case 'issue_created':
				return { title: 'Issue Created', body: `#${id}: ${issue.title}` };
			case 'issue_closed':
				return { title: 'Issue Closed', body: `#${id}: ${issue.title}` };
			case 'status_changed':
				return { title: 'Status Changed', body: `#${id} is now ${issue.status}` };
			case 'priority_changed':
				return { title: 'Priority Changed', body: `#${id} priority: ${issue.priority}` };
			case 'blocked':
				return { title: 'Issue Blocked', body: `#${id}: ${issue.title}` };
			case 'unblocked':
				return { title: 'Issue Unblocked', body: `#${id}: ${issue.title}` };
			case 'assignee_changed':
				return {
					title: 'Assignee Changed',
					body: issue.assignee ? `#${id} assigned to ${issue.assignee}` : `#${id} unassigned`
				};
			case 'label_modified':
				return { title: 'Labels Modified', body: `#${id}: ${issue.title}` };
			default:
				return { title: 'Notification', body: `#${id}: ${issue.title}` };
		}
	}

	/**
	 * Format batch of events into a single notification body
	 */
	formatBatch(events: NotificationEvent[]): string {
		if (events.length === 1) {
			const { body } = this.formatEvent(events[0]);
			return body;
		}

		return events
			.map((e) => {
				const { body } = this.formatEvent(e);
				return `- ${body}`;
			})
			.join('\n');
	}
}

export const mcpNotifier = new McpNotifier();
