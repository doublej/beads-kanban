import type { RequestHandler } from './$types';
import { requireProjectCwd } from '$lib/server/cwd';
import { closeIssue } from '$lib/bd';
import { ok, wrap, ApiError } from '$lib/server/response';

export const POST: RequestHandler = wrap(async ({ params, request, url }) => {
	const body = await request.json().catch(() => ({}));
	const reason = body?.reason || 'Completed';

	const cwd = requireProjectCwd(url);
	const result = await closeIssue(params.id, reason, cwd);
	if (!result.success) throw new ApiError(result.error || 'Failed to close issue');

	return ok({ closed: true });
});
