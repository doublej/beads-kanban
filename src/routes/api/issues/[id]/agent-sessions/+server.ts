import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getStoredCwd } from '$lib/db';

type SdkSessionInfo = {
	sessionId: string;
	agentName?: string;
	timestamp: string;
	summary?: string;
	preview: string[];
};

export const GET: RequestHandler = async ({ params, url }) => {
	const id = params.id;
	if (!id) return json({ sessions: [] });

	const cwd = url.searchParams.get('cwd') || getStoredCwd();
	if (!cwd) return json({ sessions: [] });

	try {
		const res = await fetch(`http://localhost:9347/sessions?cwd=${encodeURIComponent(cwd)}`);
		if (!res.ok) return json({ sessions: [] });
		const data = (await res.json()) as { sessions?: SdkSessionInfo[] };
		const prefix = `${id}-`;
		const sessions = (data.sessions ?? []).filter((s) => s.agentName?.startsWith(prefix));
		return json({ sessions });
	} catch {
		return json({ sessions: [] });
	}
};
