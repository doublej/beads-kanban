import type { RequestHandler } from './$types';
import { existsSync, statSync } from 'fs';
import { resolve } from 'path';
import { getStoredCwd, setStoredCwd } from '$lib/db';
import { ok, wrap, ApiError } from '$lib/server/response';
import { parseBody, SetCwdSchema } from '$lib/server/schemas';

export const GET: RequestHandler = wrap(async () => {
	const cwd = getStoredCwd();
	return ok({ cwd, name: cwd.split('/').pop() });
});

export const POST: RequestHandler = wrap(async ({ request }) => {
	const { path } = await parseBody(request, SetCwdSchema);
	const resolved = resolve(path);
	if (!existsSync(resolved)) throw new ApiError('Path does not exist', 400, 'NOT_FOUND');
	if (!statSync(resolved).isDirectory()) throw new ApiError('Path is not a directory', 400, 'NOT_DIR');
	if (!existsSync(resolve(resolved, '.beads'))) throw new ApiError('No .beads directory found', 400, 'NO_BEADS');

	setStoredCwd(resolved);
	return ok({ cwd: resolved, name: resolved.split('/').pop() });
});
