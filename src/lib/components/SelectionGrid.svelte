<script lang="ts">
	import type { Issue } from '$lib/types';
	import { getIssueColumn, getPriorityConfig, getTypeIcon, isAgentAssignee } from '$lib/utils';
	import Icon from './Icon.svelte';

	interface Props {
		issues: Issue[];
		onselect: (issue: Issue) => void;
		ondeselect: (id: string) => void;
		onclear: () => void;
	}

	let { issues, onselect, ondeselect, onclear }: Props = $props();
</script>

<aside class="selection-grid">
	<header class="grid-header">
		<span class="grid-title">{issues.length} selected</span>
		<button class="text-btn" onclick={onclear}>Clear</button>
	</header>

	<div class="grid">
		{#each issues as issue (issue.id)}
			{@const col = getIssueColumn(issue)}
			{@const p = getPriorityConfig(issue.priority)}
			<div
				class="block"
				class:closed={issue.status === 'closed'}
				role="button"
				tabindex="0"
				onclick={() => onselect(issue)}
				onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onselect(issue); } }}
			>
				<button
					class="deselect"
					title="Remove from selection"
					aria-label="Remove from selection"
					onclick={(e) => { e.stopPropagation(); ondeselect(issue.id); }}
				>×</button>

				<div class="block-top">
					<span class="seq mono">#{issue.seq}</span>
					<span class="type"><Icon name={getTypeIcon(issue.issue_type)} size={11} /></span>
					<span class="status-pill" style="--c: {col.accent};"><span class="dot"></span>{col.label}</span>
				</div>

				<div class="block-title" title={issue.title}>{issue.title}</div>

				<div class="block-bottom">
					<span class="prio" style="--c: {p.color};"><span class="dot"></span>{p.label}</span>
					{#if issue.assignee}
						<span class="assignee" class:agent={isAgentAssignee(issue.assignee)} title={issue.assignee}>{issue.assignee}</span>
					{/if}
				</div>
			</div>
		{/each}
	</div>
</aside>

<style>
	.selection-grid {
		display: flex;
		flex-direction: column;
		min-width: 0;
		min-height: 0;
		background: var(--surface-panel);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	.grid-header {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.625rem 0.875rem;
		border-bottom: 1px solid var(--border-subtle);
	}

	.grid-title {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.text-btn {
		padding: 0.1875rem 0.375rem;
		background: transparent;
		border: none;
		border-radius: var(--radius-xs);
		color: var(--text-tertiary);
		font-family: inherit;
		font-size: 0.6875rem;
		cursor: pointer;
		transition: color var(--transition-fast);
	}
	.text-btn:hover {
		color: var(--text-primary);
	}

	.grid {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 0.75rem;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 0.5rem;
		align-content: start;
	}

	.block {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding: 0.5rem 0.625rem;
		background: var(--surface-card);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		text-align: left;
		cursor: pointer;
		transition: border-color var(--transition-fast), background var(--transition-fast), transform var(--transition-fast);
	}
	.block:hover {
		background: var(--surface-elevated);
		border-color: var(--border-default);
		transform: translateY(-1px);
	}
	.block:focus-visible {
		outline: 2px solid var(--accent-primary);
		outline-offset: 1px;
	}
	.block.closed {
		opacity: 0.55;
	}

	.deselect {
		position: absolute;
		top: 0.25rem;
		right: 0.25rem;
		width: 1.125rem;
		height: 1.125rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		border-radius: var(--radius-xs);
		color: var(--text-tertiary);
		font-size: 1rem;
		line-height: 1;
		cursor: pointer;
		opacity: 0;
		transition: opacity var(--transition-fast), background var(--transition-fast), color var(--transition-fast);
	}
	.block:hover .deselect {
		opacity: 1;
	}
	.deselect:hover {
		background: rgba(239, 68, 68, 0.12);
		color: #ef4444;
	}

	.block-top {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding-right: 1rem;
	}

	.seq {
		color: var(--text-muted);
		font-size: 0.6875rem;
	}

	.type {
		display: inline-flex;
		align-items: center;
		color: var(--text-tertiary);
	}

	.status-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		margin-left: auto;
		padding: 0.0625rem 0.375rem;
		border-radius: var(--radius-full);
		background: color-mix(in srgb, var(--c) 12%, transparent);
		color: var(--c);
		font-size: 0.625rem;
		font-weight: 600;
		white-space: nowrap;
	}
	.status-pill .dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--c);
	}

	.block-title {
		font-size: 0.75rem;
		font-weight: 500;
		line-height: 1.35;
		color: var(--text-primary);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.block-bottom {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.375rem;
	}

	.prio {
		display: inline-flex;
		align-items: center;
		gap: 0.3125rem;
		color: var(--c);
		font-size: 0.625rem;
		font-weight: 600;
	}
	.prio .dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--c);
	}

	.assignee {
		font-size: 0.625rem;
		color: var(--text-tertiary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 55%;
	}
	.assignee.agent {
		color: var(--accent-primary);
		font-family: var(--font-mono);
	}
</style>
