import { join } from 'path';
import { existsSync, unlinkSync, readFileSync, readdirSync, rmdirSync } from 'fs';
import type { RequestHandler } from './$types';
import { getAttachmentsDir, getMimetype } from '$lib/attachments';
import { requireProjectCwd } from '$lib/server/cwd';
import { ok, wrap, ApiError } from '$lib/server/response';

// Binary GET bypasses the JSON envelope (file download).
export const GET: RequestHandler = async ({ params, url }) => {
	const cwd = requireProjectCwd(url);
	const filePath = join(getAttachmentsDir(params.id, cwd), params.filename);
	if (!existsSync(filePath)) return new Response('Not found', { status: 404 });

	return new Response(readFileSync(filePath), {
		headers: {
			'Content-Type': getMimetype(params.filename),
			'Content-Disposition': `attachment; filename="${params.filename}"`,
		},
	});
};

export const DELETE: RequestHandler = wrap(async ({ params, url }) => {
	const cwd = requireProjectCwd(url);
	const dir = getAttachmentsDir(params.id, cwd);
	const filePath = join(dir, params.filename);
	if (!existsSync(filePath)) throw new ApiError('Attachment not found', 404, 'NOT_FOUND');

	unlinkSync(filePath);
	const remaining = readdirSync(dir);
	if (remaining.length === 0) rmdirSync(dir);

	return ok({ deleted: true });
});
