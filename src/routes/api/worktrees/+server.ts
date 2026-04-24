import type { RequestHandler } from './$types';
import { requireProjectCwd } from '$lib/server/cwd';
import { listActiveWorktrees } from '$lib/server/agent/worktree-registry';
import { ok, wrap } from '$lib/server/response';

export const GET: RequestHandler = wrap(async ({ url }) => {
	const cwd = requireProjectCwd(url);
	const worktrees = listActiveWorktrees(cwd);
	return ok({ cwd, worktrees });
});
