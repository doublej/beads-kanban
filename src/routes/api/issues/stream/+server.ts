import type { RequestHandler } from './$types';
import { getAllIssues } from '$lib/db';
import type { Issue } from '$lib/types';

export const GET: RequestHandler = async () => {
	let interval: ReturnType<typeof setInterval> | null = null;
	let closed = false;
	let pollCount = 0;
	let lastHash = '';

	const stream = new ReadableStream({
		start(controller) {
			const encoder = new TextEncoder();

			const send = (data: object) => {
				if (!closed) controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
			};

			const poll = () => {
				if (closed) return;
				pollCount++;

				let issues: Issue[];
				try {
					issues = getAllIssues();
				} catch (e) {
					const msg = e instanceof Error ? e.message : String(e);
					send({ type: 'error', errorType: 'db-read', message: msg });
					return;
				}

				const hash = JSON.stringify(issues.map((i) => i.id + i.updated_at));
				const hasChanges = hash !== lastHash;
				lastHash = hash;

				send({
					type: 'data',
					issues,
					pollCount,
					hasChanges,
					timestamp: Date.now()
				});
			};

			poll();
			interval = setInterval(poll, 2000);
		},
		cancel() {
			closed = true;
			if (interval) clearInterval(interval);
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
};
