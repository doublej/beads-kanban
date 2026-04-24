import type { RequestHandler } from './$types';
import { getIssueById } from '$lib/db';
import { requireProjectCwd } from '$lib/server/cwd';
import { addDependency, removeDependency } from '$lib/bd';
import { notificationStore } from '$lib/notifications/notification-store.svelte';
import { hookExecutor } from '$lib/server/agent/hook-executor';
import { ok, wrap, ApiError } from '$lib/server/response';
import { parseBody, AddDependencySchema, RemoveDependencySchema } from '$lib/server/schemas';

export const POST: RequestHandler = wrap(async ({ params, request, url }) => {
	const { depends_on, dep_type } = await parseBody(request, AddDependencySchema);
	const cwd = requireProjectCwd(url);

	const result = await addDependency(params.id, depends_on, dep_type ?? 'blocks', cwd);
	if (!result.success) throw new ApiError(result.error || 'Failed to create dependency');

	const issue = getIssueById(params.id, cwd);
	if (issue) {
		notificationStore.emit('dependency_added', issue, { cwd });
		await hookExecutor.executeHooks('DependencyAdded', {
			id: issue.id,
			title: issue.title,
			status: issue.status,
			cwd,
		});
	}
	return ok({ added: true });
});

export const DELETE: RequestHandler = wrap(async ({ params, request, url }) => {
	const { depends_on } = await parseBody(request, RemoveDependencySchema);
	const cwd = requireProjectCwd(url);

	const result = await removeDependency(params.id, depends_on, cwd);
	if (!result.success) throw new ApiError(result.error || 'Failed to remove dependency');
	return ok({ removed: true });
});
