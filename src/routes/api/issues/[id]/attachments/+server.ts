import { json } from '@sveltejs/kit';
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

export const GET: RequestHandler = async ({ params }) => {
	const dir = getAttachmentsDir(params.id);

	if (!existsSync(dir)) {
		return json({ attachments: [] });
	}

	const files = readdirSync(dir);
	const attachments: Attachment[] = files.map((filename) => {
		const filePath = join(dir, filename);
		const stats = statSync(filePath);
		return {
			filename,
			size: stats.size,
			mimetype: getMimetype(filename),
			created_at: stats.birthtime.toISOString(),
		};
	});

	return json({ attachments });
};

export const POST: RequestHandler = async ({ params, request }) => {
	const formData = await request.formData();
	const file = formData.get('file') as File | null;

	if (!file) {
		return json({ error: 'No file provided' }, { status: 400 });
	}

	if (file.size > MAX_FILE_SIZE_BYTES) {
		return json({ error: `File too large. Maximum size is ${MAX_FILE_SIZE_MB}MB` }, { status: 400 });
	}

	const dir = getAttachmentsDir(params.id);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}

	const sanitized = sanitizeFilename(file.name);
	const filePath = join(dir, sanitized);

	const buffer = Buffer.from(await file.arrayBuffer());
	writeFileSync(filePath, buffer);

	const stats = statSync(filePath);
	const attachment: Attachment = {
		filename: sanitized,
		size: stats.size,
		mimetype: getMimetype(sanitized),
		created_at: stats.birthtime.toISOString(),
	};

	return json({ success: true, attachment });
};
