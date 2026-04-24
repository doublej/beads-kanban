import type { RequestHandler } from './$types';
import { renameIssue } from '$lib/bd';
import { requireProjectCwd } from '$lib/server/cwd';
import { ok, wrap, ApiError } from '$lib/server/response';

export const POST: RequestHandler = wrap(async ({ params, request, url }) => {
	const { newId } = (await request.json()) ?? {};
	if (!newId?.trim()) throw new ApiError('newId is required', 400, 'VALIDATION');

	const cwd = requireProjectCwd(url);
	const result = await renameIssue(params.id, newId.trim(), cwd);
	if (!result.success) throw new ApiError(result.error || 'Rename failed');

	return ok({ renamed: true, id: newId.trim() });
});
