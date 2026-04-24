import type { RequestHandler } from './$types';
import { requireProjectCwd } from '$lib/server/cwd';
import { ok, wrap } from '$lib/server/response';

export const GET: RequestHandler = wrap(async ({ params, url }) => {
	const sessionId = params.sessionId;
	if (!sessionId) return ok({ messages: [] });

	const cwd = requireProjectCwd(url);
	try {
		const res = await fetch(
			`http://localhost:9347/sessions/${encodeURIComponent(sessionId)}/history?cwd=${encodeURIComponent(cwd)}`,
		);
		if (!res.ok) return ok({ messages: [] });
		const data = (await res.json()) as { messages?: unknown[] };
		return ok({ messages: data.messages ?? [] });
	} catch {
		return ok({ messages: [] });
	}
});
