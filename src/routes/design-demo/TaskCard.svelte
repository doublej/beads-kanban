<script lang="ts">
	import type { Issue } from '$lib/types';
	import { getPriorityConfig, isAgentAssignee, hasOpenBlockers, formatTimestamp } from '$lib/utils';
	import Icon from './Icon.svelte';

	type Props = {
		issue: Issue;
		pinned?: boolean;
		worktree?: boolean;
		impact?: number;
		selected?: boolean;
		onopen?: (id: string) => void;
	};
	let { issue, pinned = false, worktree = false, impact = 0, selected = false, onopen }: Props = $props();

	const pri = $derived(getPriorityConfig(issue.priority));
	const isAgent = $derived(isAgentAssignee(issue.assignee));
	const blocked = $derived(hasOpenBlockers(issue));
	const blockerCount = $derived(issue.dependencies?.filter((d) => d.status !== 'closed').length ?? 0);
	const created = $derived(formatTimestamp(issue.created_at));

	const agentWorking = $derived(isAgent && issue.status === 'in_progress');
	const critical = $derived(issue.priority <= 1);
	const hot = $derived(impact >= 60);

	const fiber = $derived(blocked ? 'blocked' : agentWorking ? 'working' : hot ? 'hot' : null);
	const fiberColor = $derived(
		fiber === 'blocked' ? 'var(--danger)'
		: fiber === 'working' ? 'var(--agent)'
		: fiber === 'hot' ? 'var(--warn)'
		: 'transparent'
	);
</script>

<button
	type="button"
	class="card"
	class:is-selected={selected}
	class:has-fiber={!!fiber}
	class:is-closed={issue.status === 'closed'}
	style="--fiber: {fiberColor};"
	onclick={() => onopen?.(issue.key)}
>
	{#if fiber}<span class="fiber"></span>{/if}

	<div class="title-row">
		{#if critical}<span class="dot pri" style="background: {pri.color};" title={pri.label}></span>{/if}
		<h3 class="title">{issue.title}</h3>
	</div>

	<div class="meta">
		<span class="mono">#{issue.seq}</span>
		<span class="sep">·</span>
		<span class="mono">{created.relative}</span>

		{#if blocked}
			<span class="sep">·</span>
			<span class="mono blockers" title="{blockerCount} open blocker{blockerCount === 1 ? '' : 's'}">←&nbsp;{blockerCount}</span>
		{/if}
		{#if pinned}
			<span class="mark pin" title="Pinned"><Icon name="pin" size={12} /></span>
		{/if}

		<span class="spacer"></span>

		{#if agentWorking}
			<span class="mark working" title="{issue.assignee} working">
				<span class="dot pulse"></span>
				<span class="mono">{issue.assignee?.replace(/^agent-/, '')}</span>
			</span>
		{:else if isAgent && issue.assignee}
			<span class="mark agent" title={issue.assignee}><Icon name="agent" size={12} /></span>
		{:else if issue.assignee}
			<span class="mark human" title={issue.assignee}><span class="dot"></span></span>
		{/if}

		{#if worktree}
			<span class="mark worktree" title="Worktree active"><Icon name="tree" size={12} /></span>
		{/if}
	</div>
</button>

<style>
	.card {
		position: relative;
		display: block;
		width: 100%;
		text-align: left;
		background: var(--surf-1);
		border: 1px solid var(--line-1);
		border-radius: var(--r-sm);
		padding: var(--sp-3);
		box-shadow: var(--shadow-1);
		transition: transform 100ms cubic-bezier(0.2, 0.6, 0.2, 1), border-color 100ms, box-shadow 100ms;
	}
	.card:hover {
		transform: translateY(-1px);
		border-color: var(--line-3);
		box-shadow: var(--shadow-2);
	}
	.card.is-selected {
		border-color: var(--accent);
		box-shadow: 0 0 0 1px var(--accent), 0 4px 12px rgba(37, 99, 235, 0.12);
	}
	.card.has-fiber { padding-left: calc(var(--sp-3) + 2px); }
	.card.is-closed { opacity: 0.7; }
	.card.is-closed .title {
		text-decoration: line-through;
		text-decoration-color: var(--ink-4);
	}

	.fiber {
		position: absolute;
		left: 0;
		top: var(--sp-2);
		bottom: var(--sp-2);
		width: 2px;
		background: var(--fiber);
		border-radius: 0 1px 1px 0;
	}

	.title-row {
		display: flex;
		align-items: flex-start;
		gap: var(--sp-2);
		margin-bottom: var(--sp-2);
	}
	.dot.pri {
		margin-top: 7px;
		width: 6px;
		height: 6px;
		flex: 0 0 6px;
	}
	.title {
		margin: 0;
		font-size: var(--fs-md);
		font-weight: 500;
		line-height: var(--lh-snug);
		letter-spacing: -0.01em;
		color: var(--ink-1);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.meta {
		display: flex;
		align-items: center;
		gap: var(--sp-1);
		font-size: var(--fs-xs);
		color: var(--ink-3);
		height: var(--ctrl-sm);
	}
	.sep { color: var(--ink-4); }
	.spacer { flex: 1; }

	.blockers { color: var(--danger); font-weight: 500; }

	.mark {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-1);
		height: var(--ctrl-sm);
	}
	.mark.pin { color: var(--warn); margin-left: var(--sp-1); }
	.mark.agent { color: var(--ink-3); }
	.mark.human .dot { background: var(--human); }
	.mark.worktree { color: var(--worktree); }
	.mark.working {
		color: var(--agent);
		font-weight: 500;
	}
	.mark.working .pulse {
		background: var(--agent);
		animation: pulse 1.4s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; transform: scale(1); }
		50% { opacity: 0.45; transform: scale(0.7); }
	}
</style>
