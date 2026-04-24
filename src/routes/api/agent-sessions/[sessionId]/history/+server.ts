import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getStoredCwd } from '$lib/db';

export const GET: RequestHandler = async ({ params, url }) => {
	const sessionId = params.sessionId;
	if (!sessionId) return json({ messages: [] });

	const cwd = url.searchParams.get('cwd') || getStoredCwd();
	if (!cwd) return json({ messages: [] });

	try {
		const res = await fetch(
			`http://localhost:9347/sessions/${encodeURIComponent(sessionId)}/history?cwd=${encodeURIComponent(cwd)}`
		);
		if (!res.ok) return json({ messages: [] });
		const data = await res.json();
		return json({ messages: data.messages ?? [] });
	} catch {
		return json({ messages: [] });
	}
};
