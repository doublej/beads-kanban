import type { RequestHandler } from './$types';
import { getAllIssues } from '$lib/db';
import { requireProjectCwd } from '$lib/server/cwd';
import { createIssue } from '$lib/bd';
import { notificationStore } from '$lib/notifications/notification-store.svelte';
import { hookExecutor } from '$lib/server/agent/hook-executor';
import { ok, wrap, ApiError } from '$lib/server/response';
import { parseBody, CreateIssueSchema } from '$lib/server/schemas';

export const GET: RequestHandler = wrap(async ({ url }) => {
	const cwd = requireProjectCwd(url);
	return ok({ issues: getAllIssues(cwd) });
});

export const POST: RequestHandler = wrap(async ({ request, url }) => {
	const body = await parseBody(request, CreateIssueSchema);
	const cwd = requireProjectCwd(url);

	const result = await createIssue(
		body.title,
		{
			description: body.description,
			priority: body.priority,
			issue_type: body.issue_type,
			deps: body.deps ?? body.dependencies,
		},
		cwd,
	);
	if (!result.success || !result.issue) {
		throw new ApiError(result.error || 'Failed to create issue', 500);
	}

	const created = result.issue as {
		id: string;
		title: string;
		status: string;
		priority: number;
		assignee?: string;
	};
	notificationStore.emit('issue_created', created as never, { cwd });
	await hookExecutor.executeHooks('TicketCreated', {
		id: created.id,
		title: created.title,
		status: created.status,
		priority: created.priority,
		assignee: created.assignee,
		cwd,
	});

	return ok({ id: created.id, issue: created, warning: result.warning });
});
