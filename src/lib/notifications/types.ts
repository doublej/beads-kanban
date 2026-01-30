import type { Issue } from '$lib/types';

/**
 * All notification event types
 */
export type NotificationEventType =
	| 'issue_created'
	| 'issue_closed'
	| 'status_changed'
	| 'priority_changed'
	| 'comment_added'
	| 'dependency_added'
	| 'assignee_changed'
	| 'label_modified'
	| 'blocked'
	| 'unblocked'
	| 'attachment_added';

/**
 * Notification event payload
 */
export interface NotificationEvent {
	type: NotificationEventType;
	issue: Issue;
	timestamp: number;
	metadata?: Record<string, unknown>;
}

/**
 * Notification mode settings
 */
export type NotificationMode = 'none' | 'browser' | 'mcp';

/**
 * Per-event notification settings
 */
export interface NotificationEventSettings {
	blocked: boolean;
	unblocked: boolean;
	status_changed: boolean;
	priority_changed: boolean;
	assignee_changed: boolean;
	comment_added: boolean;
	dependency_added: boolean;
	label_modified: boolean;
	attachment_added: boolean;
	issue_created: boolean;
	issue_closed: boolean;
}

/**
 * Toast notification types
 */
export type ToastType = 'info' | 'success' | 'warning' | 'error';

/**
 * Toast notification data
 */
export interface Toast {
	id: string;
	type: ToastType;
	title: string;
	message: string;
	duration: number;
	action?: {
		label: string;
		handler: () => void;
	};
}
