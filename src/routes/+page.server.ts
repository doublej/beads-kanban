import type { PageServerLoad } from './$types';
import type { Issue } from '$lib/types';
import { getAllIssues, resolveProjectCwd } from '$lib/db';

/**
 * SSR-preload issues so the board ships filled in the initial HTML instead of
 * blank-then-fetch. resolveProjectCwd falls back to the stored cwd, so this works
 * with or without ?project= and sidesteps the client-side cwd race on cold load.
 * bd export works in embedded mode, so this is safe for the stored cwd.
 */
export const load: PageServerLoad = async ({ url }) => {
	const cwd = resolveProjectCwd(url);
	let issues: Issue[] = [];
	try {
		issues = getAllIssues(cwd);
	} catch {
		// bd unavailable/unhealthy in the server env — fall through to empty; the
		// client's existing fetch/retry path repopulates the board.
	}
	return { cwd, issues };
};
