// Server-side queue subscriber — receives queue_state from WS, sends commands back
import type { QueueItem } from '$lib/server/agent/queue-types';

let queueItems = $state<QueueItem[]>([]);
let initialized = $state(false);

export function getQueueItems(): QueueItem[] {
	return queueItems;
}

export function setQueueItems(items: QueueItem[]) {
	queueItems = items;
}

export function isQueueInitialized(): boolean {
	return initialized;
}

// Called on WS connect to load initial queue state
export async function fetchInitialQueue(port = 9347): Promise<void> {
	try {
		const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
		const res = await fetch(`http://${host}:${port}/queue`);
		const data = await res.json();
		queueItems = data.items || [];
		initialized = true;
	} catch {
		// Server may not be available yet
		initialized = true;
	}
}

// WS command senders — these get wired up by ws-connection
let sendWsCommand: ((msg: Record<string, unknown>) => void) | null = null;

export function setQueueWsSender(fn: (msg: Record<string, unknown>) => void) {
	sendWsCommand = fn;
}

export function enqueueTicket(item: QueueItem) {
	sendWsCommand?.({ type: 'queue_enqueue', item });
}

export function cancelQueueItem(ticketId: string) {
	sendWsCommand?.({ type: 'queue_cancel', ticketId });
}

export function reorderQueue(fromIndex: number, toIndex: number) {
	sendWsCommand?.({ type: 'queue_reorder', fromIndex, toIndex });
}

export function requestQueueList() {
	sendWsCommand?.({ type: 'queue_list' });
}
