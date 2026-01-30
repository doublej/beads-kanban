import { browser } from '$app/environment';
import type { NotificationEvent } from './types';

/**
 * Browser push notification service.
 * Manages service worker registration, push subscription,
 * and sending notifications via the backend API.
 */
class PushService {
	private registration: ServiceWorkerRegistration | null = null;
	private subscription: PushSubscription | null = null;

	/**
	 * Check if push notifications are supported
	 */
	isSupported(): boolean {
		if (!browser) return false;
		return 'serviceWorker' in navigator && 'PushManager' in window;
	}

	/**
	 * Get current permission state
	 */
	getPermissionState(): NotificationPermission | 'unsupported' {
		if (!browser || !('Notification' in window)) return 'unsupported';
		return Notification.permission;
	}

	/**
	 * Check if currently subscribed to push
	 */
	isSubscribed(): boolean {
		return this.subscription !== null;
	}

	/**
	 * Initialize: register service worker
	 */
	async init(): Promise<void> {
		if (!this.isSupported()) return;

		try {
			this.registration = await navigator.serviceWorker.register('/sw.js');
			// Check for existing subscription
			this.subscription = await this.registration.pushManager.getSubscription();
		} catch (err) {
			console.error('Failed to register service worker:', err);
		}
	}

	/**
	 * Request notification permission and subscribe to push
	 */
	async subscribe(): Promise<boolean> {
		if (!this.registration) {
			await this.init();
		}
		if (!this.registration) return false;

		// Request permission
		const permission = await Notification.requestPermission();
		if (permission !== 'granted') return false;

		try {
			// Get VAPID public key
			const response = await fetch('/api/notifications/vapid');
			if (!response.ok) return false;
			const { publicKey } = await response.json();
			if (!publicKey) return false;

			// Subscribe
			const applicationServerKey = urlBase64ToUint8Array(publicKey);
			this.subscription = await this.registration.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: applicationServerKey.buffer as ArrayBuffer
			});

			// Save subscription to server
			await this.saveSubscription(this.subscription);
			return true;
		} catch (err) {
			console.error('Failed to subscribe to push:', err);
			return false;
		}
	}

	/**
	 * Unsubscribe from push notifications
	 */
	async unsubscribe(): Promise<void> {
		if (!this.subscription) return;

		try {
			await this.subscription.unsubscribe();
			this.subscription = null;
		} catch (err) {
			console.error('Failed to unsubscribe:', err);
		}
	}

	/**
	 * Send push notification via backend
	 */
	async send(event: NotificationEvent): Promise<void> {
		const id = event.issue.id.substring(0, 8);
		const title = formatPushTitle(event);
		const body = formatPushBody(event);

		try {
			await fetch('/api/notifications/send', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title,
					body,
					data: { issueId: event.issue.id, eventType: event.type }
				})
			});
		} catch (err) {
			console.error('Failed to send push notification:', err);
		}
	}

	/**
	 * Save subscription to server
	 */
	private async saveSubscription(sub: PushSubscription): Promise<void> {
		const key = sub.getKey('p256dh');
		const auth = sub.getKey('auth');

		await fetch('/api/notifications/subscribe', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				endpoint: sub.endpoint,
				keys: {
					p256dh: key ? btoa(String.fromCharCode(...new Uint8Array(key))) : '',
					auth: auth ? btoa(String.fromCharCode(...new Uint8Array(auth))) : ''
				}
			})
		});
	}
}

function formatPushTitle(event: NotificationEvent): string {
	const titles: Record<string, string> = {
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
	return titles[event.type] || 'Beads Kanban';
}

function formatPushBody(event: NotificationEvent): string {
	const id = event.issue.id.substring(0, 8);
	switch (event.type) {
		case 'status_changed':
			return `#${id} is now ${event.issue.status}`;
		case 'blocked':
		case 'unblocked':
			return `#${id}: ${event.issue.title}`;
		case 'assignee_changed':
			return event.issue.assignee
				? `#${id} assigned to ${event.issue.assignee}`
				: `#${id} unassigned`;
		default:
			return `#${id}: ${event.issue.title}`;
	}
}

/**
 * Convert VAPID public key from URL-safe base64 to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
	const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
	const raw = atob(base64);
	const output = new Uint8Array(raw.length);
	for (let i = 0; i < raw.length; i++) {
		output[i] = raw.charCodeAt(i);
	}
	return output;
}

export const pushService = new PushService();
