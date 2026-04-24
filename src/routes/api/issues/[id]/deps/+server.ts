import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { RequestHandler } from './$types';
import { resolveProjectCwd, getIssueById } from '$lib/db';
import { notificationStore } from '$lib/notifications/notification-store.svelte';
import { hookExecutor } from '$lib/server/agent/hook-executor';
import { extractErrorMessage } from '$lib/server-utils';

const execAsync = promisify(exec);

async function runDepCmd(cmd: string, cwd: string, fallback: string) {
	try {
		const { stdout } = await execAsync(cmd, { cwd });
		return json({ success: true, message: stdout.trim() });
	} catch (err: unknown) {
		return json({ error: extractErrorMessage(err, fallback) }, { status: 500 });
	}
}

export const POST: RequestHandler = async ({ params, request, url }) => {
	const { depends_on, dep_type = 'blocks' } = await request.json();

	if (!depends_on) {
		return json({ error: 'depends_on is required' }, { status: 400 });
	}

	const cwd = resolveProjectCwd(url);
	const cmd = `bd dep add ${params.id} ${depends_on} --type ${dep_type}`;
	const result = await runDepCmd(cmd, cwd, 'Failed to create dependency');

	const issue = getIssueById(params.id, cwd);
	if (issue) {
		notificationStore.emit('dependency_added', issue);
		await hookExecutor.executeHooks('DependencyAdded', {
			id: issue.id,
			title: issue.title,
			status: issue.status,
			cwd,
		});
	}

	return result;
};

export const DELETE: RequestHandler = async ({ params, request, url }) => {
	const { depends_on } = await request.json();

	if (!depends_on) {
		return json({ error: 'depends_on is required' }, { status: 400 });
	}

	const cwd = resolveProjectCwd(url);
	const cmd = `bd dep remove ${params.id} ${depends_on}`;
	return runDepCmd(cmd, cwd, 'Failed to remove dependency');
};
