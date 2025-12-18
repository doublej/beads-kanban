import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { RequestHandler } from './$types';
import { getAllIssues, getBdDbFlag } from '$lib/db';

const execAsync = promisify(exec);

export const GET: RequestHandler = async () => {
	const issues = getAllIssues();
	return json({ issues });
};

export const POST: RequestHandler = async ({ request }) => {
	const { title, description, priority, issue_type, deps } = await request.json();

	if (!title) {
		return json({ error: 'Title required' }, { status: 400 });
	}

	let cmd = `bd ${getBdDbFlag()} create "${title.replace(/"/g, '\\"')}" --json`;
	if (description) cmd += ` --description "${description.replace(/"/g, '\\"')}"`;
	if (priority !== undefined) cmd += ` --priority ${priority}`;
	if (issue_type) cmd += ` --type ${issue_type}`;
	if (deps && deps.length > 0) {
		cmd += ` --deps ${deps.join(',')}`;
	}

	try {
		const { stdout, stderr } = await execAsync(cmd);
		// Parse JSON output to get the new issue ID
		const created = JSON.parse(stdout.trim());
		return json({ success: true, id: created.id, issue: created, warning: stderr || undefined });
	} catch (err: unknown) {
		const error = err as { stderr?: string; message?: string };
		return json({ error: error.stderr || error.message || 'Failed to create issue' }, { status: 500 });
	}
};
