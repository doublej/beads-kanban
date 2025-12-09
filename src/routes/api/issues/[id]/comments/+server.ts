import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { RequestHandler } from './$types';

const execAsync = promisify(exec);

export const GET: RequestHandler = async ({ params }) => {
	const { stdout } = await execAsync(`bd comments ${params.id} --json`);
	const comments = JSON.parse(stdout || 'null') || [];
	return json({ comments });
};

export const POST: RequestHandler = async ({ params, request }) => {
	const { text } = await request.json();

	if (!text?.trim()) {
		return json({ error: 'Comment text required' }, { status: 400 });
	}

	const { stdout, stderr } = await execAsync(`bd comment ${params.id} "${text.replace(/"/g, '\\"')}"`);

	if (stderr) {
		return json({ error: stderr }, { status: 500 });
	}

	return json({ success: true, message: stdout.trim() });
};
