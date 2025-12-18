import { json, error } from '@sveltejs/kit';
import { join } from 'path';
import { existsSync, unlinkSync, readFileSync, readdirSync, rmdirSync } from 'fs';
import type { RequestHandler } from './$types';
import { getStoredCwd } from '$lib/db';

function getAttachmentsDir(issueId: string): string {
	return join(getStoredCwd(), '.beads', 'attachments', issueId);
}

function getMimetype(filename: string): string {
	const ext = filename.split('.').pop()?.toLowerCase() || '';
	const mimeTypes: Record<string, string> = {
		png: 'image/png',
		jpg: 'image/jpeg',
		jpeg: 'image/jpeg',
		gif: 'image/gif',
		webp: 'image/webp',
		svg: 'image/svg+xml',
		pdf: 'application/pdf',
		txt: 'text/plain',
		md: 'text/markdown',
		json: 'application/json',
		zip: 'application/zip',
	};
	return mimeTypes[ext] || 'application/octet-stream';
}

export const GET: RequestHandler = async ({ params }) => {
	const dir = getAttachmentsDir(params.id);
	const filePath = join(dir, params.filename);

	if (!existsSync(filePath)) {
		throw error(404, 'Attachment not found');
	}

	const content = readFileSync(filePath);
	const mimetype = getMimetype(params.filename);

	return new Response(content, {
		headers: {
			'Content-Type': mimetype,
			'Content-Disposition': `attachment; filename="${params.filename}"`,
		},
	});
};

export const DELETE: RequestHandler = async ({ params }) => {
	const dir = getAttachmentsDir(params.id);
	const filePath = join(dir, params.filename);

	if (!existsSync(filePath)) {
		return json({ error: 'Attachment not found' }, { status: 404 });
	}

	unlinkSync(filePath);

	const remainingFiles = readdirSync(dir);
	if (remainingFiles.length === 0) {
		rmdirSync(dir);
	}

	return json({ success: true });
};
