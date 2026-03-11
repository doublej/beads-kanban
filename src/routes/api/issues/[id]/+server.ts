import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { RequestHandler } from './$types';
import { resolveProjectCwd, getIssueById } from '$lib/db';
import { notificationStore } from '$lib/notifications/notification-store.svelte';
import { extractErrorMessage } from '$lib/server-utils';

const execAsync = promisify(exec);
const VALID_STATUSES = ['open', 'in_progress', 'hooked', 'blocked', 'closed'];

export const PATCH: RequestHandler = async ({ params, request, url }) => {
	const { status, title, description, priority, issue_type, design, acceptance_criteria, notes, assignee, addLabels, removeLabels, agent_model, agent_effort } = await request.json();

	if (status && !VALID_STATUSES.includes(status)) {
		return json({ error: 'Invalid status' }, { status: 400 });
	}

	const cwd = resolveProjectCwd(url);

	// Read issue before update to detect changes
	const beforeIssue = getIssueById(params.id, cwd);
	const commands: string[] = [];

	// Build update command if there are field updates
	let updateCmd = `bd update ${params.id}`;
	let hasUpdates = false;
	if (status) { updateCmd += ` --status ${status}`; hasUpdates = true; }
	if (priority !== undefined) { updateCmd += ` --priority ${priority}`; hasUpdates = true; }

	const quotedFields: [string | undefined, string][] = [
		[title, '--title'],
		[description, '--description'],
		[design, '--design'],
		[acceptance_criteria, '--acceptance'],
		[notes, '--notes'],
		[assignee, '--assignee'],
	];
	for (const [value, flag] of quotedFields) {
		if (value !== undefined) {
			updateCmd += ` ${flag} "${(value || '').replace(/"/g, '\\"')}"`;
			hasUpdates = true;
		}
	}

	// Handle agent metadata fields
	if (agent_model !== undefined) {
		if (agent_model) {
			updateCmd += ` --set-metadata agent_model=${agent_model}`;
		} else {
			updateCmd += ` --unset-metadata agent_model`;
		}
		hasUpdates = true;
	}
	if (agent_effort !== undefined) {
		if (agent_effort) {
			updateCmd += ` --set-metadata agent_effort=${agent_effort}`;
		} else {
			updateCmd += ` --unset-metadata agent_effort`;
		}
		hasUpdates = true;
	}

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
		// Run all commands in parallel for better performance
		await Promise.all(commands.map(cmd => execAsync(cmd, { cwd })));

		// Read updated issue
		const afterIssue = getIssueById(params.id, cwd);

		// Emit notification events based on changes
		if (beforeIssue && afterIssue) {
			// Status changes
			if (beforeIssue.status !== afterIssue.status) {
				notificationStore.emit('status_changed', afterIssue);

				// Special handling for blocked/unblocked
				if (afterIssue.status === 'blocked') {
					notificationStore.emit('blocked', afterIssue);
				}
				if (beforeIssue.status === 'blocked' && afterIssue.status !== 'blocked') {
					notificationStore.emit('unblocked', afterIssue);
				}
			}

			// Priority changes
			if (beforeIssue.priority !== afterIssue.priority) {
				notificationStore.emit('priority_changed', afterIssue);
			}

			// Assignee changes
			if (beforeIssue.assignee !== afterIssue.assignee) {
				notificationStore.emit('assignee_changed', afterIssue);
			}

			// Label changes
			if (addLabels?.length || removeLabels?.length) {
				notificationStore.emit('label_modified', afterIssue);
			}
		}

		return json({ success: true });
	} catch (err: unknown) {
		return json({ error: extractErrorMessage(err, 'Update failed') }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params, url }) => {
	const cwd = resolveProjectCwd(url);
	try {
		// Read issue before deletion for notification
		const issue = getIssueById(params.id, cwd);

		await execAsync(`bd delete ${params.id}`, { cwd });

		// Emit notification event
		if (issue) {
			notificationStore.emit('issue_closed', issue);
		}

		return json({ success: true });
	} catch (err: unknown) {
		return json({ error: extractErrorMessage(err, 'Delete failed') }, { status: 500 });
	}
};
