import type { RequestHandler } from './$types';
import { requireProjectCwd } from '$lib/server/cwd';
import { setIssueState } from '$lib/bd';
import { ok, wrap, ApiError } from '$lib/server/response';

/** Operational-state labels follow the `<dimension>:<value>` convention (alphanumeric, dash, underscore). */
const TOKEN = /^[a-zA-Z0-9_-]+$/;

export const POST: RequestHandler = wrap(async ({ params, request, url }) => {
	const body = await request.json().catch(() => ({}));
	const dimension = String(body?.dimension ?? '').trim();
	const value = String(body?.value ?? '').trim();
	const reason = body?.reason ? String(body.reason) : undefined;

	if (!TOKEN.test(dimension)) throw new ApiError('Invalid dimension (use letters, digits, - or _)');
	if (!TOKEN.test(value)) throw new ApiError('Invalid value (use letters, digits, - or _)');

	const cwd = requireProjectCwd(url);
	const result = await setIssueState(params.id, dimension, value, reason, cwd);
	if (!result.success) throw new ApiError(result.error || 'Failed to set state');

	return ok({ updated: true });
});
