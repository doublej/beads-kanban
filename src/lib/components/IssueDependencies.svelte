<script lang="ts">
	import type { Issue, Dependency } from '$lib/types';
	import { getDepTypeConfig } from '$lib/utils';
	import Icon from './Icon.svelte';

	interface Relation extends Dependency {
		direction: 'blocked-by' | 'blocking';
	}

	interface Props {
		editingIssue: Issue;
		onremovedep: (issueId: string, depId: string) => void;
	}

	let { editingIssue, onremovedep }: Props = $props();

	const relations = $derived(() => {
		const deps = (editingIssue.dependencies || []).map(d => ({ ...d, direction: 'blocked-by' as const }));
		const depts = (editingIssue.dependents || []).map(d => ({ ...d, direction: 'blocking' as const }));
		return [...deps, ...depts] as Relation[];
	});
</script>

{#if relations().length > 0}
	<section class="section">
		<span class="section-label">Relations</span>
		<div class="relations">
			{#each relations() as rel}
				{@const cfg = getDepTypeConfig(rel.dependency_type)}
				<div class="relation" class:blocked-by={rel.direction === 'blocked-by'} class:blocking={rel.direction === 'blocking'}>
					<span class="rel-type" style="background: {cfg.color}20; color: {cfg.color}" title={cfg.label}><Icon name={cfg.icon} size={10} /></span>
					<span class="rel-status" class:open={rel.status === 'open'} class:in-progress={rel.status === 'in_progress'} class:closed={rel.status === 'closed'}></span>
					<span class="rel-id">{rel.id}</span>
					<span class="rel-title">{rel.title}</span>
					<button class="rel-x" onclick={() => rel.direction === 'blocked-by' ? onremovedep(editingIssue.id, rel.id) : onremovedep(rel.id, editingIssue.id)}>×</button>
				</div>
			{/each}
		</div>
	</section>
{/if}

<style>
	.section { margin-bottom: 1.25rem; }

	.section-label {
		display: block;
		font-size: 0.625rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-tertiary);
		margin-bottom: 0.375rem;
	}

	.relations {
		display: flex;
		flex-direction: column;
		background: var(--surface-panel);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	.relation {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid var(--border-subtle);
		font-size: 0.8125rem;
		transition: background var(--transition-fast);
	}
	.relation:last-child { border-bottom: none; }
	.relation:hover { background: var(--bg-elevated); }
	.relation.blocked-by { box-shadow: inset 2px 0 0 #ef4444; }
	.relation.blocking { box-shadow: inset 2px 0 0 #10b981; }

	.rel-type {
		display: inline-flex;
		align-items: center;
		padding: 0.125rem 0.25rem;
		border-radius: 4px;
		font-size: 0.5625rem;
		flex-shrink: 0;
	}

	.rel-status {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--text-tertiary);
		flex-shrink: 0;
	}
	.rel-status.open { background: #6366f1; }
	.rel-status.in-progress { background: #f59e0b; }
	.rel-status.closed { background: #10b981; }

	.rel-id {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--text-muted);
		flex-shrink: 0;
	}

	.rel-title {
		flex: 1;
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.rel-x {
		background: none;
		border: none;
		color: var(--text-tertiary);
		font-size: 0.75rem;
		cursor: pointer;
		padding: 0;
		opacity: 0;
		transition: opacity 150ms ease;
	}
	.relation:hover .rel-x { opacity: 1; }
	.rel-x:hover { color: #ef4444; }

	:global(.app.light) .relations {
		background: rgba(0, 0, 0, 0.02);
		border-color: var(--border-subtle);
	}
</style>
