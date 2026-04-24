import type { RequestHandler } from './$types';
import { getTypes } from '$lib/bd';
import { requireProjectCwd } from '$lib/server/cwd';
import { ok, wrap } from '$lib/server/response';

const DEFAULT_TYPES = ['task', 'bug', 'feature', 'enhancement', 'epic', 'chore'];

export const GET: RequestHandler = wrap(async ({ url }) => {
	const cwd = requireProjectCwd(url);
	const result = await getTypes(cwd);
	if (result.success && result.stdout) {
		try {
			return ok({ types: JSON.parse(result.stdout) });
		} catch { /* fall through */ }
	}
	return ok({ types: DEFAULT_TYPES });
});
