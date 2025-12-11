import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { RequestHandler } from './$types';

const execAsync = promisify(exec);
const VALID_STATUSES = ['open', 'in_progress', 'blocked', 'closed'];

export const PATCH: RequestHandler = async ({ params, request }) => {
	const { status, title, description, priority, issue_type, design, acceptance_criteria, notes, addLabels, removeLabels } = await request.json();

	if (status && !VALID_STATUSES.includes(status)) {
		return json({ error: 'Invalid status' }, { status: 400 });
	}

	const commands: string[] = [];

	// Build update command if there are field updates
	let updateCmd = `bd update ${params.id}`;
	let hasUpdates = false;
	if (status) { updateCmd += ` --status ${status}`; hasUpdates = true; }
	if (title !== undefined) { updateCmd += ` --title "${title.replace(/"/g, '\\"')}"`; hasUpdates = true; }
	if (description !== undefined) { updateCmd += ` --description "${description.replace(/"/g, '\\"')}"`; hasUpdates = true; }
	if (priority !== undefined) { updateCmd += ` --priority ${priority}`; hasUpdates = true; }
	if (design !== undefined) { updateCmd += ` --design "${(design || '').replace(/"/g, '\\"')}"`; hasUpdates = true; }
	if (acceptance_criteria !== undefined) { updateCmd += ` --acceptance "${(acceptance_criteria || '').replace(/"/g, '\\"')}"`; hasUpdates = true; }
	if (notes !== undefined) { updateCmd += ` --notes "${(notes || '').replace(/"/g, '\\"')}"`; hasUpdates = true; }
	if (hasUpdates) commands.push(updateCmd);

	// Add label commands
	if (removeLabels?.length) {
		for (const label of removeLabels) {
			commands.push(`bd label remove ${params.id} ${label}`);
		}
	}
	if (addLabels?.length) {
		for (const label of addLabels) {
			commands.push(`bd label add ${params.id} ${label}`);
		}
	}

	try {
		const results = [];
		for (const cmd of commands) {
			const { stdout } = await execAsync(cmd);
			results.push(stdout.trim());
		}
		return json({ success: true, message: results.join('\n') });
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
