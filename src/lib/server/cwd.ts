/**
 * Project-cwd resolution helpers for server-side handlers.
 *
 * Every endpoint that touches project data MUST call requireProjectCwd().
 * The only fallback to the stored cwd is /api/cwd GET itself, which uses
 * resolveProjectCwd().
 *
 * cwd is always derived from the URL (?project=…). Body-based cwd is forbidden.
 */
import { resolveProjectCwd, getStoredCwd, setStoredCwd } from '$lib/db';
import { ApiError } from './response';

export { resolveProjectCwd, getStoredCwd, setStoredCwd };

export function requireProjectCwd(url: URL): string {
	const project = url.searchParams.get('project');
	if (!project) throw new ApiError('cwd required', 400, 'CWD_MISSING');
	const cwd = resolveProjectCwd(url);
	return cwd;
}
