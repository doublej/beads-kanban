import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { RequestHandler } from './$types';
import { resolveProjectCwd, getComments, getIssueById } from '$lib/db';
import { notificationStore } from '$lib/notifications/notification-store.svelte';
import { hookExecutor } from '$lib/server/agent/hook-executor';
import { extractErrorMessage } from '$lib/server-utils';

const execAsync = promisify(exec);

export const GET: RequestHandler = async ({ params, url }) => {
	const cwd = resolveProjectCwd(url);
	const comments = getComments(params.id, cwd);
	return json({ comments });
};

export const POST: RequestHandler = async ({ params, request, url }) => {
	const { text } = await request.json();

	if (!text?.trim()) {
		return json({ error: 'Comment text required' }, { status: 400 });
	}

	const cwd = resolveProjectCwd(url);
	try {
		const { stdout, stderr } = await execAsync(`bd comments add ${params.id} "${text.replace(/"/g, '\\"')}"`, { cwd });

		const issue = getIssueById(params.id, cwd);
		if (issue) {
			notificationStore.emit('comment_added', issue);
			await hookExecutor.executeHooks('CommentAdded', {
				id: issue.id,
				title: issue.title,
				status: issue.status,
				cwd,
				content: text,
				sender: 'user',
			});
		}

		return json({ success: true, message: stdout.trim(), warning: stderr || undefined });
	} catch (err: unknown) {
		return json({ error: extractErrorMessage(err, 'Failed to add comment') }, { status: 500 });
	}
};
