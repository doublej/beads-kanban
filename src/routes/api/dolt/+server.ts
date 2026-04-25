import { resolve } from 'path';
import type { RequestHandler } from './$types';
import { ok, err, wrap } from '$lib/server/response';
import { findOrphanedDoltPids, killDoltPids } from '$lib/dolt-reaper';
import { readTouchedCwds } from '$lib/touched-cwds';

/** Limit reap scope to ?project=… (must be inside this session's touched cwds) or all touched cwds. */
function scopeCwds(url: URL): string[] | { error: string } {
	const touched = readTouchedCwds();
	const project = url.searchParams.get('project');
	if (!project) return touched;
	const target = resolve(project);
	if (!touched.includes(target)) {
		return { error: `project not in this session's touched cwds: ${target}` };
	}
	return [target];
}

export const GET: RequestHandler = wrap(async ({ url }) => {
	const scope = scopeCwds(url);
	if (!Array.isArray(scope)) return err(scope.error, 400);
	const orphans = findOrphanedDoltPids(scope);
	return ok({ orphaned: orphans.length, pids: orphans });
});

export const POST: RequestHandler = wrap(async ({ url }) => {
	const scope = scopeCwds(url);
	if (!Array.isArray(scope)) return err(scope.error, 400);
	const orphans = findOrphanedDoltPids(scope);
	const { killed, failed } = killDoltPids(orphans.map((o) => o.pid));
	return ok({ orphaned: orphans.length, pids: orphans, killed, failed });
});
