import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { RequestHandler } from './$types';

const execAsync = promisify(exec);

export const GET: RequestHandler = async () => {
	const { stdout, stderr } = await execAsync('bd list --json');

	if (stderr) {
		return json({ error: stderr }, { status: 500 });
	}

	const issues = JSON.parse(stdout);
	return json({ issues });
};

export const POST: RequestHandler = async ({ request }) => {
	const { title, description, priority, issue_type } = await request.json();

	if (!title) {
		return json({ error: 'Title required' }, { status: 400 });
	}

	let cmd = `bd create "${title.replace(/"/g, '\\"')}"`;
	if (description) cmd += ` --description "${description.replace(/"/g, '\\"')}"`;
	if (priority) cmd += ` --priority ${priority}`;
	if (issue_type) cmd += ` --type ${issue_type}`;

	const { stdout, stderr } = await execAsync(cmd);

	if (stderr) {
		return json({ error: stderr }, { status: 500 });
	}

	return json({ success: true, message: stdout.trim() });
};
