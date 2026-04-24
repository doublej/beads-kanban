import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resolveProjectCwd } from '$lib/db';
import { listActiveWorktrees } from '$lib/server/agent/worktree-registry';

export const GET: RequestHandler = async ({ url }) => {
	const cwd = resolveProjectCwd(url);
	const worktrees = listActiveWorktrees(cwd);
	return json({ cwd, worktrees });
};
