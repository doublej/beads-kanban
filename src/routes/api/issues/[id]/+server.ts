import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { RequestHandler } from './$types';

const execAsync = promisify(exec);
const VALID_STATUSES = ['open', 'in_progress', 'blocked', 'closed'];

export const PATCH: RequestHandler = async ({ params, request }) => {
	const { status, title, description, priority, issue_type, design, acceptance_criteria, notes } = await request.json();

	if (status && !VALID_STATUSES.includes(status)) {
		return json({ error: 'Invalid status' }, { status: 400 });
	}

	let cmd = `bd update ${params.id}`;
	if (status) cmd += ` --status ${status}`;
	if (title !== undefined) cmd += ` --title "${title.replace(/"/g, '\\"')}"`;
	if (description !== undefined) cmd += ` --description "${description.replace(/"/g, '\\"')}"`;
	if (priority !== undefined) cmd += ` --priority ${priority}`;
	// Note: bd update does not support --type flag, issue_type cannot be updated
	if (design !== undefined) cmd += ` --design "${(design || '').replace(/"/g, '\\"')}"`;
	if (acceptance_criteria !== undefined) cmd += ` --acceptance "${(acceptance_criteria || '').replace(/"/g, '\\"')}"`;
	if (notes !== undefined) cmd += ` --notes "${(notes || '').replace(/"/g, '\\"')}"`;

	try {
		const { stdout } = await execAsync(cmd);
		return json({ success: true, message: stdout.trim() });
	} catch (err: unknown) {
		const error = err as { stderr?: string; message?: string };
		return json({ error: error.stderr || error.message || 'Update failed' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		await execAsync(`bd close ${params.id} --reason "Deleted from Kanban"`);
		return json({ success: true });
	} catch (err: unknown) {
		const error = err as { stderr?: string; message?: string };
		return json({ error: error.stderr || error.message || 'Delete failed' }, { status: 500 });
	}
};
