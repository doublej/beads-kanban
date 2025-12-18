import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { RequestHandler } from './$types';
import { getBdDbFlag, getComments } from '$lib/db';

const execAsync = promisify(exec);

export const GET: RequestHandler = async ({ params }) => {
	const comments = getComments(params.id);
	return json({ comments });
};

export const POST: RequestHandler = async ({ params, request }) => {
	const { text } = await request.json();

	if (!text?.trim()) {
		return json({ error: 'Comment text required' }, { status: 400 });
	}

	try {
		const { stdout, stderr } = await execAsync(`bd ${getBdDbFlag()} comment ${params.id} "${text.replace(/"/g, '\\"')}"`);
		return json({ success: true, message: stdout.trim(), warning: stderr || undefined });
	} catch (err: unknown) {
		const error = err as { stderr?: string; message?: string };
		return json({ error: error.stderr || error.message || 'Failed to add comment' }, { status: 500 });
	}
};
