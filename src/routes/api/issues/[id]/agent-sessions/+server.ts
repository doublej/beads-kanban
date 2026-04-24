import type { RequestHandler } from './$types';
import { requireProjectCwd } from '$lib/server/cwd';
import { ok, wrap } from '$lib/server/response';

type SdkSessionInfo = {
	sessionId: string;
	agentName?: string;
	timestamp: string;
	summary?: string;
	preview: string[];
};

export const GET: RequestHandler = wrap(async ({ params, url }) => {
	const id = params.id;
	if (!id) return ok({ sessions: [] });

	const cwd = requireProjectCwd(url);
	try {
		const res = await fetch(`http://localhost:9347/sessions?cwd=${encodeURIComponent(cwd)}`);
		if (!res.ok) return ok({ sessions: [] });
		const data = (await res.json()) as { sessions?: SdkSessionInfo[] };
		const prefix = `${id}-`;
		const sessions = (data.sessions ?? []).filter((s) => s.agentName?.startsWith(prefix));
		return ok({ sessions });
	} catch {
		return ok({ sessions: [] });
	}
});
