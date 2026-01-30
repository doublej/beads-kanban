import type { Issue } from '$lib/types';
import type { NotificationEventType, NotificationEvent } from './types';

type EventHandler = (event: NotificationEvent) => void;

/**
 * Simple pub/sub system for notification events
 */
class NotificationEventEmitter {
	private handlers: Map<NotificationEventType | '*', Set<EventHandler>> = new Map();

	/**
	 * Subscribe to a specific event type or all events ('*')
	 */
	on(eventType: NotificationEventType | '*', handler: EventHandler): () => void {
		if (!this.handlers.has(eventType)) {
			this.handlers.set(eventType, new Set());
		}
		this.handlers.get(eventType)!.add(handler);

		// Return unsubscribe function
		return () => {
			this.handlers.get(eventType)?.delete(handler);
		};
	}

	/**
	 * Emit a notification event
	 */
	emit(type: NotificationEventType, issue: Issue, metadata?: Record<string, unknown>): void {
		const event: NotificationEvent = {
			type,
			issue,
			timestamp: Date.now(),
			metadata
		};

		// Call specific handlers
		this.handlers.get(type)?.forEach((handler) => {
			try {
				handler(event);
			} catch (err) {
				console.error(`Error in notification handler for ${type}:`, err);
			}
		});

		// Call wildcard handlers
		this.handlers.get('*')?.forEach((handler) => {
			try {
				handler(event);
			} catch (err) {
				console.error('Error in wildcard notification handler:', err);
			}
		});
	}

	/**
	 * Remove all handlers for an event type
	 */
	off(eventType: NotificationEventType | '*'): void {
		this.handlers.delete(eventType);
	}

	/**
	 * Remove all handlers
	 */
	clear(): void {
		this.handlers.clear();
	}
}

export const notificationEmitter = new NotificationEventEmitter();
