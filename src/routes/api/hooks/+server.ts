import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resolveProjectCwd } from '$lib/db';
import { hookExecutor } from '$lib/server/agent/hook-executor';

export const GET: RequestHandler = async ({ url }) => {
	const cwd = resolveProjectCwd(url);
	const hooks = hookExecutor.getLoadedHooks(cwd);
	return json({ cwd, hooks });
};
