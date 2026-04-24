import type { RequestHandler } from './$types';
import { requireProjectCwd } from '$lib/server/cwd';
import { hookExecutor } from '$lib/server/agent/hook-executor';
import { ok, wrap } from '$lib/server/response';

export const GET: RequestHandler = wrap(async ({ url }) => {
	const cwd = requireProjectCwd(url);
	const hooks = hookExecutor.getLoadedHooks(cwd);
	return ok({ cwd, hooks });
});
