import { join } from 'path';
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'fs';
import type { RequestHandler } from './$types';
import type { Attachment } from '$lib/types';
import {
	getAttachmentsDir,
	sanitizeFilename,
	getMimetype,
	MAX_FILE_SIZE_MB,
	MAX_FILE_SIZE_BYTES,
} from '$lib/attachments';
import { requireProjectCwd } from '$lib/server/cwd';
import { ok, wrap, ApiError } from '$lib/server/response';

export const GET: RequestHandler = wrap(async ({ params, url }) => {
	const cwd = requireProjectCwd(url);
	const dir = getAttachmentsDir(params.id, cwd);
	if (!existsSync(dir)) return ok({ attachments: [] });

	const attachments: Attachment[] = readdirSync(dir).map((filename) => {
		const filePath = join(dir, filename);
		const stats = statSync(filePath);
		return {
			filename,
			size: stats.size,
			mimetype: getMimetype(filename),
			created_at: stats.birthtime.toISOString(),
		};
	});
	return ok({ attachments });
});

export const POST: RequestHandler = wrap(async ({ params, request, url }) => {
	const formData = await request.formData();
	const file = formData.get('file') as File | null;
	if (!file) throw new ApiError('No file provided', 400, 'VALIDATION');
	if (file.size > MAX_FILE_SIZE_BYTES) {
		throw new ApiError(
			`File too large. Maximum size is ${MAX_FILE_SIZE_MB}MB`,
			400,
			'FILE_TOO_LARGE',
		);
	}

	const cwd = requireProjectCwd(url);
	const dir = getAttachmentsDir(params.id, cwd);
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

	const sanitized = sanitizeFilename(file.name);
	const filePath = join(dir, sanitized);
	writeFileSync(filePath, Buffer.from(await file.arrayBuffer()));

	const stats = statSync(filePath);
	const attachment: Attachment = {
		filename: sanitized,
		size: stats.size,
		mimetype: getMimetype(sanitized),
		created_at: stats.birthtime.toISOString(),
	};
	return ok({ attachment });
});
