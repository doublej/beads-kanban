import { join } from 'path';
import { getStoredCwd } from '$lib/db';

export function getAttachmentsDir(issueId: string): string {
	return join(getStoredCwd(), '.beads', 'attachments', issueId);
}

export function sanitizeFilename(filename: string): string {
	return filename.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 255);
}

export function getMimetype(filename: string): string {
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

export const MAX_FILE_SIZE_MB = 10;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
