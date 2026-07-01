import { watch, type FSWatcher } from 'node:fs';
import { join } from 'node:path';
import type { RequestHandler } from './$types';
import { requireProjectCwd } from '$lib/server/cwd';
import { notificationEmitter } from '$lib/notifications/event-emitter';
import type { NotificationEventType } from '$lib/notifications/types';

const HEARTBEAT_MS = 25_000;
// `bd` rewrites these direct children of .beads on every write (its own auto-export),
// so watching them catches external CLI/agent changes the in-process emitter never sees.
const WATCH_FILES = new Set(['issues.jsonl', 'last-touched']);
const WATCH_DEBOUNCE_MS = 300;

const NAME_MAP: Record<NotificationEventType, string> = {
	issue_created: 'issue.created',
	issue_closed: 'issue.closed',
	status_changed: 'issue.updated',
	priority_changed: 'issue.updated',
	assignee_changed: 'issue.updated',
	label_modified: 'issue.updated',
	dependency_added: 'issue.updated',
	blocked: 'issue.updated',
	unblocked: 'issue.updated',
	attachment_added: 'issue.updated',
	comment_added: 'issue.comment_added',
};

export const GET: RequestHandler = async ({ url }) => {
	const cwd = requireProjectCwd(url);

	let closed = false;
	let unsubscribe: (() => void) | null = null;
	let heartbeat: ReturnType<typeof setInterval> | null = null;
	let watcher: FSWatcher | null = null;
	let watchDebounce: ReturnType<typeof setTimeout> | null = null;

	const stream = new ReadableStream({
		start(controller) {
			const encoder = new TextEncoder();
			const send = (data: object) => {
				if (closed) return;
				try {
					controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
				} catch {
					closed = true;
				}
			};

			send({ type: 'ready', cwd, timestamp: Date.now() });

			unsubscribe = notificationEmitter.on('*', (event) => {
				const eventCwd = (event.metadata as { cwd?: string } | undefined)?.cwd;
				if (eventCwd && eventCwd !== cwd) return;
				send({
					type: 'event',
					name: NAME_MAP[event.type] ?? 'issue.updated',
					originalType: event.type,
					issueId: event.issue.id,
					issue: event.issue,
					timestamp: event.timestamp,
				});
			});

			heartbeat = setInterval(() => send({ type: 'heartbeat', timestamp: Date.now() }), HEARTBEAT_MS);

			// Watch .beads for external writes (bd CLI, agents) the emitter can't observe.
			try {
				watcher = watch(join(cwd, '.beads'), (_event, filename) => {
					if (!filename || !WATCH_FILES.has(filename)) return;
					if (watchDebounce) clearTimeout(watchDebounce);
					watchDebounce = setTimeout(
						() => send({ type: 'event', name: 'issue.updated', source: 'fs', timestamp: Date.now() }),
						WATCH_DEBOUNCE_MS
					);
				});
			} catch {
				// .beads may not exist yet; in-app writes still flow via the emitter.
			}
		},
		cancel() {
			closed = true;
			unsubscribe?.();
			if (heartbeat) clearInterval(heartbeat);
			if (watchDebounce) clearTimeout(watchDebounce);
			watcher?.close();
		},
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive',
		},
	});
};
