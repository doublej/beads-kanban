import type { Toast } from './types';

const MAX_VISIBLE_TOASTS = 3;

/**
 * Toast notification queue
 * Manages in-app toast notifications with auto-dismiss
 */
class ToastQueue {
	private toasts = $state<Toast[]>([]);
	private nextId = 0;

	/**
	 * Get all visible toasts
	 */
	get all(): Toast[] {
		return this.toasts;
	}

	/**
	 * Show a toast notification
	 */
	show(toast: Omit<Toast, 'id'>): string {
		const id = `toast-${++this.nextId}`;
		const newToast: Toast = { ...toast, id };

		// Add to queue
		this.toasts = [...this.toasts, newToast];

		// Limit visible toasts
		if (this.toasts.length > MAX_VISIBLE_TOASTS) {
			this.toasts = this.toasts.slice(-MAX_VISIBLE_TOASTS);
		}

		// Auto-dismiss after duration
		setTimeout(() => {
			this.dismiss(id);
		}, toast.duration);

		return id;
	}

	/**
	 * Dismiss a toast by ID
	 */
	dismiss(id: string): void {
		this.toasts = this.toasts.filter((t) => t.id !== id);
	}

	/**
	 * Clear all toasts
	 */
	clear(): void {
		this.toasts = [];
	}
}

export const toastQueue = new ToastQueue();
