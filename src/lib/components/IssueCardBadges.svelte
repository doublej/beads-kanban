<script lang="ts">
	import type { Issue } from '$lib/types';
	import { getPriorityConfig, calculateImpactScore, getImpactLevel } from '$lib/utils';
	import Icon from './Icon.svelte';

	interface Props {
		issue: Issue;
		copiedId: string | null;
		hasOpenBlockers: boolean;
		showImpact: boolean;
		isAgentAssignee: boolean;
		oncopyid: (id: string) => void;
	}

	let { issue, copiedId, hasOpenBlockers, showImpact, isAgentAssignee, oncopyid }: Props = $props();

	const priorityConfig = $derived(getPriorityConfig(issue.priority));
	const impactScore = $derived(calculateImpactScore(issue));
	const impactLevel = $derived(getImpactLevel(impactScore));
</script>

<div class="card-header">
	<span class="card-id-wrap">
		{#if issue.pinned}<span class="pinned-icon" title="Pinned"><Icon name="pin" size={10} /></span>{/if}
		<span class="priority-dot" style="background: {priorityConfig.color}"></span>
		<span class="card-id">{issue.id}</span>
		<button
			class="btn-copy"
			class:copied={copiedId === issue.id}
			onclick={(e) => { e.stopPropagation(); oncopyid(issue.id); }}
			aria-label="Copy ID"
		>
			{#if copiedId === issue.id}
				<Icon name="check" size={10} />
			{:else}
				<Icon name="copy" size={10} />
			{/if}
		</button>
	</span>
	{#if showImpact && impactScore >= 40}
		<span class="impact-badge" class:critical={impactLevel.level === 'critical'} class:high={impactLevel.level === 'high'} style="--impact-color: {impactLevel.color}" title="{impactLevel.label} (Score: {impactScore})">
			<Icon name="zap" size={10} />
			<span class="impact-score">{impactScore}</span>
		</span>
	{/if}
	{#if hasOpenBlockers}
		<span class="blocked-indicator" title="Blocked by open dependencies"><Icon name="dep-blocks" size={14} /></span>
	{/if}
	{#if (issue.dependencies && issue.dependencies.length > 0) || (issue.dependents && issue.dependents.length > 0)}
		{@const totalDeps = (issue.dependencies?.length || 0) + (issue.dependents?.length || 0)}
		<span class="deps-indicator" title="{issue.dependencies?.length || 0} dependencies, {issue.dependents?.length || 0} dependents">
			<Icon name="link" size={10} />
			<span class="count">{totalDeps}</span>
		</span>
	{/if}
</div>
{#if issue.assignee && isAgentAssignee}
	<div class="agent-chip" class:working={issue.status === 'in_progress'} class:idle={issue.status !== 'in_progress' && issue.status !== 'closed'} class:done={issue.status === 'closed'}>
		{#if issue.status === 'in_progress'}
			<span class="agent-pulse"></span>
		{/if}
		<span class="agent-icon">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
				<circle cx="12" cy="12" r="3"/>
				<path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
			</svg>
		</span>
		<span class="agent-name">{issue.assignee}</span>
		{#if issue.status === 'in_progress'}
			<span class="agent-status">working</span>
		{:else if issue.status === 'closed'}
			<span class="agent-status done">done</span>
		{:else}
			<span class="agent-status">assigned</span>
		{/if}
	</div>
{/if}

<style>
	.card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.375rem;
		gap: 0.5rem;
	}

	.card-id-wrap {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
	}

	.priority-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.card-id {
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 0.625rem;
		font-weight: 500;
		color: var(--text-tertiary);
		letter-spacing: 0.02em;
	}

	.btn-copy {
		width: 16px;
		height: 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		border-radius: 3px;
		color: var(--text-tertiary);
		cursor: pointer;
		opacity: 0;
		transition: opacity 120ms ease, color 120ms ease;
	}

	.btn-copy :global(svg) {
		width: 10px;
		height: 10px;
	}

	/* Parent .card hover triggers copy visibility via global */
	:global(.card:hover) .btn-copy {
		opacity: 0.5;
	}

	.btn-copy:hover {
		opacity: 1 !important;
		color: var(--text-secondary);
	}

	.btn-copy.copied {
		opacity: 1 !important;
		color: #34c759;
	}

	.pinned-icon {
		display: flex;
		color: #f59e0b;
		flex-shrink: 0;
	}

	/* Impact Badge */
	.impact-badge {
		display: flex;
		align-items: center;
		gap: 0.125rem;
		padding: 0.125rem 0.3rem;
		background: rgba(var(--impact-color), 0.12);
		border-radius: 4px;
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 0.5625rem;
		font-weight: 600;
		color: var(--impact-color);
		cursor: help;
	}

	.impact-badge.critical {
		background: rgba(239, 68, 68, 0.15);
		color: #ef4444;
		animation: impactPulse 2s ease-in-out infinite;
	}

	.impact-badge.high {
		background: rgba(245, 158, 11, 0.12);
		color: #f59e0b;
	}

	.impact-badge :global(svg) {
		width: 10px;
		height: 10px;
	}

	.impact-score {
		letter-spacing: 0.02em;
	}

	@keyframes impactPulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.7; }
	}

	.blocked-indicator {
		display: flex;
		color: #ef4444;
		margin-left: 0.25rem;
		cursor: help;
	}

	.deps-indicator {
		display: flex;
		align-items: center;
		gap: 0.125rem;
		padding: 0.125rem 0.25rem;
		background: rgba(99, 102, 241, 0.1);
		border-radius: 3px;
		font-size: 0.5625rem;
		color: var(--text-tertiary);
	}

	.deps-indicator :global(svg) {
		width: 10px;
		height: 10px;
		opacity: 0.7;
	}

	.deps-indicator .count {
		font-family: ui-monospace, 'SF Mono', monospace;
		font-weight: 500;
	}

	/* Agent Chip */
	.agent-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.1875rem 0.375rem;
		background: rgba(16, 185, 129, 0.1);
		border-radius: var(--radius-xs);
		margin-bottom: 0.375rem;
		width: fit-content;
	}

	.agent-chip.idle {
		background: rgba(99, 102, 241, 0.1);
	}

	.agent-chip.idle .agent-icon { color: #8b5cf6; }
	.agent-chip.idle .agent-name { color: #8b5cf6; }
	.agent-chip.idle .agent-status { color: rgba(139, 92, 246, 0.6); }

	.agent-chip.done {
		background: rgba(16, 185, 129, 0.06);
		opacity: 0.6;
	}

	.agent-status.done { color: var(--state-done) !important; }

	.agent-pulse { display: none; }

	.agent-icon {
		display: flex;
		color: var(--state-done);
		flex-shrink: 0;
	}

	.agent-chip.working .agent-icon {
		animation: agent-icon-pulse 2s ease-in-out infinite;
	}

	@keyframes agent-icon-pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}

	.agent-name {
		font-family: var(--font-mono);
		font-size: 0.5625rem;
		font-weight: 500;
		color: var(--state-done);
		letter-spacing: 0.01em;
	}

	.agent-status {
		font-size: 0.5rem;
		font-weight: 500;
		color: rgba(16, 185, 129, 0.6);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	/* Mobile */
	@media (max-width: 768px) {
		.card-header {
			margin-bottom: 0.25rem;
			gap: 0.375rem;
		}

		.card-id {
			font-size: 0.5625rem;
		}

		.btn-copy {
			width: 14px;
			height: 14px;
		}

		.btn-copy :global(svg) {
			width: 8px;
			height: 8px;
		}

		.deps-indicator {
			padding: 0.0625rem 0.1875rem;
			font-size: 0.5rem;
		}

		.impact-badge {
			padding: 0.0625rem 0.1875rem;
			font-size: 0.5rem;
		}

		.agent-chip {
			padding: 0.125rem 0.375rem 0.125rem 0.25rem;
			margin-bottom: 0.375rem;
			gap: 0.25rem;
		}

		.agent-chip .agent-icon svg {
			width: 12px;
			height: 12px;
		}

		.agent-name {
			font-size: 0.625rem;
		}

		.agent-status {
			font-size: 0.5rem;
			padding-left: 0.125rem;
		}
	}

	/* Light theme */
	:global(.app.light) .agent-chip {
		background: rgba(16, 185, 129, 0.08);
	}

	:global(.app.light) .agent-chip.idle {
		background: rgba(99, 102, 241, 0.08);
	}
</style>
