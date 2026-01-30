<script lang="ts">
	import type { Issue } from '$lib/types';
	import { getTypeIcon, getDepTypeConfig, formatTimestamp, formatDuration } from '$lib/utils';
	import Icon from './Icon.svelte';

	interface Props {
		issue: Issue;
		isAgentAssignee: boolean;
	}

	let { issue, isAgentAssignee }: Props = $props();
</script>

{#if issue.labels && issue.labels.length > 0}
	<div class="card-labels">
		{#each issue.labels.slice(0, 3) as label}
			<span class="label">{label}</span>
		{/each}
		{#if issue.labels.length > 3}
			<span class="label more">+{issue.labels.length - 3}</span>
		{/if}
	</div>
{/if}
{#if issue.assignee && !isAgentAssignee}
	<div class="card-footer">
		<span class="badge assignee">
			<span class="assignee-dot"></span>
			{issue.assignee}
		</span>
	</div>
{/if}
{#if (issue.dependencies && issue.dependencies.length > 0) || (issue.dependents && issue.dependents.length > 0)}
	<div class="card-links">
		{#if issue.dependencies && issue.dependencies.length > 0}
			<div class="link-group blocked-by" title="Blocked by: {issue.dependencies.map(d => `${getDepTypeConfig(d.dependency_type).label}: ${d.title}`).join(', ')}">
				<span class="link-arrow">←</span>
				{#each issue.dependencies.slice(0, 3) as dep}
					{@const depConfig = getDepTypeConfig(dep.dependency_type)}
					<span class="link-id" class:open={dep.status === 'open'} class:in-progress={dep.status === 'in_progress'} class:hooked={dep.status === 'hooked'} class:blocked={dep.status === 'blocked'} class:closed={dep.status === 'closed'} title="{depConfig.label}: {dep.title}">
						<span class="dep-type-indicator" style="color: {depConfig.color}"><Icon name={depConfig.icon} size={10} /></span>{dep.id}
					</span>
				{/each}
				{#if issue.dependencies.length > 3}
					<span class="link-more">+{issue.dependencies.length - 3}</span>
				{/if}
			</div>
		{/if}
		{#if issue.dependents && issue.dependents.length > 0}
			<div class="link-group blocking" title="Blocking: {issue.dependents.map(d => `${getDepTypeConfig(d.dependency_type).label}: ${d.title}`).join(', ')}">
				<span class="link-arrow">→</span>
				{#each issue.dependents.slice(0, 3) as dep}
					{@const depConfig = getDepTypeConfig(dep.dependency_type)}
					<span class="link-id" class:open={dep.status === 'open'} class:in-progress={dep.status === 'in_progress'} class:hooked={dep.status === 'hooked'} class:blocked={dep.status === 'blocked'} class:closed={dep.status === 'closed'} title="{depConfig.label}: {dep.title}">
						<span class="dep-type-indicator" style="color: {depConfig.color}"><Icon name={depConfig.icon} size={10} /></span>{dep.id}
					</span>
				{/each}
				{#if issue.dependents.length > 3}
					<span class="link-more">+{issue.dependents.length - 3}</span>
				{/if}
			</div>
		{/if}
	</div>
{/if}
<div class="card-meta">
	{#if issue.created_at}
		{@const created = formatTimestamp(issue.created_at)}
		{@const closed = issue.closed_at ? formatTimestamp(issue.closed_at) : null}
		{@const duration = issue.closed_at ? formatDuration(issue.created_at, issue.closed_at) : null}
		<span class="meta-item" title="Created {created.absolute} at {created.time}">
			{created.relative}
		</span>
		{#if closed}
			<span class="meta-sep">→</span>
			<span class="meta-item closed" title="Closed {closed.absolute} at {closed.time} ({duration})">
				{closed.relative}
			</span>
		{/if}
	{/if}
	{#if issue.estimated_minutes}
		<span class="meta-estimate" title="Estimated {issue.estimated_minutes}min">{issue.estimated_minutes}m</span>
	{/if}
	{#if issue.close_reason && issue.status === 'closed'}
		<span class="meta-close-reason" title="Close reason: {issue.close_reason}">{issue.close_reason}</span>
	{/if}
	<span class="meta-type"><Icon name={getTypeIcon(issue.issue_type)} size={10} /> {issue.issue_type}</span>
</div>

<style>
	/* Labels */
	.card-labels {
		display: flex;
		flex-wrap: nowrap;
		gap: 0.1875rem;
		margin-bottom: 0.375rem;
		overflow: hidden;
	}

	.label {
		padding: 0.0625rem 0.3125rem;
		background: var(--surface-panel);
		border-radius: var(--radius-xs);
		font-size: 0.5rem;
		font-weight: 500;
		color: var(--text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.02em;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.label.more {
		background: var(--accent-glow);
		color: var(--accent-primary);
	}

	/* Footer / Assignee */
	.card-footer {
		display: flex;
		gap: 0.25rem;
		flex-wrap: wrap;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		gap: 0.1875rem;
		padding: 0.1875rem 0.375rem;
		border-radius: var(--radius-sm);
		font-size: 0.625rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.badge.assignee {
		margin-left: auto;
		background: rgba(99, 102, 241, 0.12);
		color: var(--text-secondary);
	}

	.assignee-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: currentColor;
	}

	/* Dependency links */
	.card-links {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		margin-top: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid var(--border-subtle);
	}

	.link-group {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.5625rem;
	}

	.link-group.blocked-by .link-arrow { color: #ef4444; }
	.link-group.blocking .link-arrow { color: #10b981; }

	.link-arrow {
		font-weight: 600;
		opacity: 0.7;
	}

	.link-id {
		font-family: ui-monospace, 'SF Mono', monospace;
		padding: 0.125rem 0.25rem;
		background: var(--bg-elevated);
		border-radius: 3px;
		border-left: 2px solid var(--text-tertiary);
	}

	.link-id.open { border-left-color: #6366f1; }
	.link-id.in-progress { border-left-color: #f59e0b; }
	.link-id.hooked { border-left-color: #8b5cf6; }
	.link-id.blocked { border-left-color: #ef4444; }
	.link-id.closed { border-left-color: #10b981; opacity: 0.6; }

	.link-more {
		font-size: 0.5rem;
		color: var(--text-tertiary);
		padding: 0.125rem 0.25rem;
	}

	.dep-type-indicator {
		display: inline-flex;
		margin-right: 0.125rem;
	}

	/* Meta row */
	.card-meta {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		margin-top: 0.375rem;
		padding-top: 0.375rem;
		border-top: 1px solid var(--border-subtle);
		font-family: var(--font-mono);
		font-size: 0.5rem;
		color: var(--text-muted);
	}

	.meta-item {
		letter-spacing: 0.01em;
	}

	.meta-item.closed {
		color: var(--state-done);
	}

	.meta-sep {
		opacity: 0.3;
		font-size: 0.5rem;
	}

	.meta-estimate {
		padding: 0.0625rem 0.25rem;
		background: rgba(99, 102, 241, 0.1);
		border-radius: 3px;
		font-weight: 500;
	}

	.meta-close-reason {
		padding: 0.0625rem 0.25rem;
		background: rgba(16, 185, 129, 0.1);
		border-radius: 3px;
		max-width: 80px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.meta-type {
		display: inline-flex;
		align-items: center;
		gap: 0.1875rem;
		margin-left: auto;
		text-transform: uppercase;
		letter-spacing: 0.02em;
		opacity: 0.5;
	}

	/* Mobile */
	@media (max-width: 768px) {
		.card-labels {
			gap: 0.125rem;
			margin-bottom: 0.375rem;
		}

		.label {
			padding: 0.0625rem 0.25rem;
			font-size: 0.5rem;
		}

		.card-links {
			margin-top: 0.375rem;
			padding-top: 0.375rem;
			gap: 0.25rem;
		}

		.link-group {
			font-size: 0.5rem;
			gap: 0.125rem;
		}

		.link-id {
			padding: 0.0625rem 0.1875rem;
		}

		.card-meta {
			margin-top: 0.375rem;
			padding-top: 0.375rem;
			gap: 0.25rem;
			font-size: 0.5rem;
		}

		.badge {
			padding: 0.125rem 0.25rem;
			font-size: 0.5625rem;
		}
	}

	/* Light theme */
	:global(.app.light) .label {
		background: rgba(0, 0, 0, 0.04);
	}
</style>
