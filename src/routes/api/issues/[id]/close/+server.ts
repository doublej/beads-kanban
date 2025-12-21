import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { RequestHandler } from './$types';
import { getBdDbFlag } from '$lib/db';

const execAsync = promisify(exec);

export const POST: RequestHandler = async ({ params, request }) => {
	const { reason } = await request.json().catch(() => ({ reason: 'Completed' }));
	const reasonText = reason || 'Completed';

	try {
		const { stdout, stderr } = await execAsync(
			`bd ${getBdDbFlag()} close ${params.id} --reason "${reasonText.replace(/"/g, '\\"')}"`
		);
		return json({ success: true, message: stdout.trim(), warning: stderr || undefined });
	} catch (err: unknown) {
		const error = err as { stderr?: string; message?: string };
		return json({ error: error.stderr || error.message || 'Failed to close issue' }, { status: 500 });
	}
};
