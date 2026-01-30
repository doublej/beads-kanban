import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { RequestHandler } from './$types';
import { getBdDbFlag, getIssueById } from '$lib/db';
import { notificationStore } from '$lib/notifications/notification-store.svelte';

const execAsync = promisify(exec);
const VALID_STATUSES = ['open', 'in_progress', 'hooked', 'blocked', 'closed'];

export const PATCH: RequestHandler = async ({ params, request }) => {
	const { status, title, description, priority, issue_type, design, acceptance_criteria, notes, assignee, addLabels, removeLabels } = await request.json();

	if (status && !VALID_STATUSES.includes(status)) {
		return json({ error: 'Invalid status' }, { status: 400 });
	}

	// Read issue before update to detect changes
	const beforeIssue = getIssueById(params.id);

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
	if (assignee !== undefined) { updateCmd += ` --assignee "${(assignee || '').replace(/"/g, '\\"')}"`; hasUpdates = true; }
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
		await Promise.all(commands.map(cmd => execAsync(cmd)));

		// Read updated issue
		const afterIssue = getIssueById(params.id);

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
		const error = err as { stderr?: string; message?: string };
		return json({ error: error.stderr || error.message || 'Update failed' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		// Read issue before deletion for notification
		const issue = getIssueById(params.id);

		await execAsync(`bd ${getBdDbFlag()} delete ${params.id}`);

		// Emit notification event
		if (issue) {
			notificationStore.emit('issue_closed', issue);
		}

		return json({ success: true });
	} catch (err: unknown) {
		const error = err as { stderr?: string; message?: string };
		return json({ error: error.stderr || error.message || 'Delete failed' }, { status: 500 });
	}
};
