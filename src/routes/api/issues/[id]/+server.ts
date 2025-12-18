import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { RequestHandler } from './$types';
import { getBdDbFlag } from '$lib/db';

const execAsync = promisify(exec);
const VALID_STATUSES = ['open', 'in_progress', 'blocked', 'closed'];

export const PATCH: RequestHandler = async ({ params, request }) => {
	const { status, title, description, priority, issue_type, design, acceptance_criteria, notes, addLabels, removeLabels } = await request.json();

	if (status && !VALID_STATUSES.includes(status)) {
		return json({ error: 'Invalid status' }, { status: 400 });
	}

	const dbFlag = getBdDbFlag();
	const commands: string[] = [];

	// Build update command if there are field updates
	let updateCmd = `bd ${dbFlag} update ${params.id}`;
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
			commands.push(`bd ${dbFlag} label remove ${params.id} ${label}`);
		}
	}
	if (addLabels?.length) {
		for (const label of addLabels) {
			commands.push(`bd ${dbFlag} label add ${params.id} ${label}`);
		}
	}

	try {
		// Run all commands in parallel for better performance
		const results = await Promise.all(commands.map(cmd => execAsync(cmd)));
		return json({ success: true, message: results.map(r => r.stdout.trim()).join('\n') });
	} catch (err: unknown) {
		const error = err as { stderr?: string; message?: string };
		return json({ error: error.stderr || error.message || 'Update failed' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		await execAsync(`bd ${getBdDbFlag()} close ${params.id} --reason "Deleted from Kanban"`);
		return json({ success: true });
	} catch (err: unknown) {
		const error = err as { stderr?: string; message?: string };
		return json({ error: error.stderr || error.message || 'Delete failed' }, { status: 500 });
	}
};
