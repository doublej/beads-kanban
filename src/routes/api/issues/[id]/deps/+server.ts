import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { RequestHandler } from './$types';

const execAsync = promisify(exec);

export const POST: RequestHandler = async ({ params, request }) => {
	const { depends_on, dep_type = 'blocks' } = await request.json();

	if (!depends_on) {
		return json({ error: 'depends_on is required' }, { status: 400 });
	}

	const cmd = `bd dep add ${params.id} ${depends_on} --type ${dep_type}`;

	try {
		const { stdout } = await execAsync(cmd);
		return json({ success: true, message: stdout.trim() });
	} catch (err: unknown) {
		const error = err as { stderr?: string; message?: string };
		return json({ error: error.stderr || error.message || 'Failed to create dependency' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params, request }) => {
	const { depends_on } = await request.json();

	if (!depends_on) {
		return json({ error: 'depends_on is required' }, { status: 400 });
	}

	const cmd = `bd dep remove ${params.id} ${depends_on}`;

	try {
		const { stdout } = await execAsync(cmd);
		return json({ success: true, message: stdout.trim() });
	} catch (err: unknown) {
		const error = err as { stderr?: string; message?: string };
		return json({ error: error.stderr || error.message || 'Failed to remove dependency' }, { status: 500 });
	}
};
