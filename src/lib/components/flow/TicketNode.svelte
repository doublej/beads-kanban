<script lang="ts">
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import { getContext } from 'svelte';
	import Icon from '../Icon.svelte';
	import { getIssueColumn, getPriorityConfig, getTypeIcon } from '$lib/utils';
	import { FLOW_CTX, type FlowContext } from './flow-context';

	let { data }: NodeProps = $props();

	const ctx = getContext<FlowContext>(FLOW_CTX);
	const issueId = $derived((data as { issueId: string }).issueId);
	const issue = $derived(ctx.getIssue(issueId));
	const selected = $derived(ctx.getSelectedId() === issueId);
	const column = $derived(issue ? getIssueColumn(issue) : null);
	const prio = $derived(issue ? getPriorityConfig(issue.priority) : null);
</script>

{#if issue && column && prio}
	<div
		class="ticket-node"
		class:selected
		class:closed={issue.status === 'closed'}
		style="--accent: {column.accent}"
	>
		<Handle type="target" position={Position.Left} />

		<div class="top">
			<span class="seq">#{issue.seq}</span>
			<span class="prio" style="--prio: {prio.color}; background: {prio.bg}">{prio.label}</span>
		</div>

		<div class="title">{issue.title}</div>

		<div class="bottom">
			<span class="type"><Icon name={getTypeIcon(issue.issue_type)} size={11} /> {issue.issue_type}</span>
			<span class="status" style="color: {column.accent}">{column.label}</span>
		</div>

		<Handle type="source" position={Position.Right} />
	</div>
{/if}

<style>
	.ticket-node {
		box-sizing: border-box;
		width: 240px;
		padding: 0.625rem 0.75rem;
		background: var(--surface-panel, #1a1a1a);
		border: 1px solid var(--border-default, #333);
		border-left: 3px solid var(--accent);
		border-radius: var(--radius-md, 8px);
		font-family: var(--font-sans, system-ui);
		cursor: pointer;
		transition: border-color var(--transition-fast, 0.12s), box-shadow var(--transition-fast, 0.12s);
	}

	.ticket-node:hover {
		border-color: var(--border-strong, #555);
	}

	.ticket-node.selected {
		border-color: var(--accent-primary, #6366f1);
		box-shadow: 0 0 0 1px var(--accent-primary, #6366f1), 0 4px 16px rgba(0, 0, 0, 0.35);
	}

	.ticket-node.closed {
		opacity: 0.6;
	}

	.top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.375rem;
	}

	.seq {
		font: 600 10px/1 var(--font-mono, monospace);
		color: var(--text-tertiary, #888);
	}

	.prio {
		padding: 0.0625rem 0.375rem;
		border-radius: var(--radius-xs, 4px);
		font: 600 9px/1.4 var(--font-sans, system-ui);
		color: var(--prio);
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.title {
		font: 500 12px/1.35 var(--font-sans, system-ui);
		color: var(--text-primary, #eee);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.closed .title {
		text-decoration: line-through;
		text-decoration-color: var(--text-tertiary, #888);
	}

	.bottom {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.type {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font: 500 10px/1 var(--font-sans, system-ui);
		color: var(--text-secondary, #aaa);
		text-transform: capitalize;
	}

	.status {
		font: 600 9px/1 var(--font-sans, system-ui);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
</style>
