import type { RequestHandler } from './$types';
import { getIssueById } from '$lib/db';
import { requireProjectCwd } from '$lib/server/cwd';
import { updateIssue, deleteIssue, addLabel, removeLabel, setMetadata, unsetMetadata } from '$lib/bd';
import { notificationStore } from '$lib/notifications/notification-store.svelte';
import { hookExecutor } from '$lib/server/agent/hook-executor';
import { ok, err, wrap, ApiError } from '$lib/server/response';

const VALID_STATUSES = ['open', 'in_progress', 'hooked', 'blocked', 'closed'];

export const PATCH: RequestHandler = wrap(async ({ params, request, url }) => {
	const body = await request.json();
	const {
		status, title, description, priority, issue_type, design,
		acceptance_criteria, notes, assignee, addLabels, removeLabels,
		agent_model, agent_effort,
	} = body ?? {};

	if (status && !VALID_STATUSES.includes(status)) {
		throw new ApiError('Invalid status', 400, 'VALIDATION');
	}

	const cwd = requireProjectCwd(url);
	const beforeIssue = getIssueById(params.id, cwd);

	const updateRes = await updateIssue(
		params.id,
		{ status, title, description, priority, design, acceptance_criteria, notes, assignee },
		cwd,
	);
	if (!updateRes.success) throw new ApiError(updateRes.error || 'Update failed');

	if (agent_model !== undefined) {
		const r = agent_model
			? await setMetadata(params.id, 'agent_model', String(agent_model), cwd)
			: await unsetMetadata(params.id, 'agent_model', cwd);
		if (!r.success) throw new ApiError(r.error || 'Update failed');
	}
	if (agent_effort !== undefined) {
		const r = agent_effort
			? await setMetadata(params.id, 'agent_effort', String(agent_effort), cwd)
			: await unsetMetadata(params.id, 'agent_effort', cwd);
		if (!r.success) throw new ApiError(r.error || 'Update failed');
	}

	if (removeLabels?.length) {
		for (const label of removeLabels) {
			const r = await removeLabel(params.id, label, cwd);
			if (!r.success) throw new ApiError(r.error || 'Update failed');
		}
	}
	if (addLabels?.length) {
		for (const label of addLabels) {
			const r = await addLabel(params.id, label, cwd);
			if (!r.success) throw new ApiError(r.error || 'Update failed');
		}
	}

	const afterIssue = getIssueById(params.id, cwd);
	if (beforeIssue && afterIssue) {
		const baseCtx = {
			id: afterIssue.id,
			title: afterIssue.title,
			status: afterIssue.status,
			priority: afterIssue.priority,
			assignee: afterIssue.assignee,
			cwd,
		};

		if (beforeIssue.status !== afterIssue.status) {
			notificationStore.emit('status_changed', afterIssue);
			await hookExecutor.executeHooks('StatusChanged', {
				...baseCtx,
				oldStatus: beforeIssue.status,
				newStatus: afterIssue.status,
			});
			if (afterIssue.status === 'closed') {
				await hookExecutor.executeHooks('TicketClosed', baseCtx);
			}
			if (afterIssue.status === 'blocked') {
				notificationStore.emit('blocked', afterIssue);
				await hookExecutor.executeHooks('TicketBlocked', baseCtx);
			}
			if (beforeIssue.status === 'blocked' && afterIssue.status !== 'blocked') {
				notificationStore.emit('unblocked', afterIssue);
				await hookExecutor.executeHooks('TicketUnblocked', baseCtx);
			}
		}
		if (beforeIssue.priority !== afterIssue.priority) {
			notificationStore.emit('priority_changed', afterIssue);
			await hookExecutor.executeHooks('PriorityChanged', baseCtx);
		}
		if (beforeIssue.assignee !== afterIssue.assignee) {
			notificationStore.emit('assignee_changed', afterIssue);
			await hookExecutor.executeHooks('AssigneeChanged', baseCtx);
		}
		if (addLabels?.length || removeLabels?.length) {
			notificationStore.emit('label_modified', afterIssue);
			await hookExecutor.executeHooks('LabelModified', baseCtx);
		}
	}

	return ok({ updated: true });
});

export const DELETE: RequestHandler = wrap(async ({ params, url }) => {
	const cwd = requireProjectCwd(url);
	const issue = getIssueById(params.id, cwd);

	const result = await deleteIssue(params.id, cwd);
	if (!result.success) throw new ApiError(result.error || 'Delete failed');

	if (issue) {
		notificationStore.emit('issue_closed', issue);
		await hookExecutor.executeHooks('TicketClosed', {
			id: issue.id,
			title: issue.title,
			status: issue.status,
			priority: issue.priority,
			assignee: issue.assignee,
			cwd,
		});
	}
	return ok({ deleted: true });
});
