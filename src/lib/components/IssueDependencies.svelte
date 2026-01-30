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
		gap: 0.25rem;
	}

	.relation {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.4375rem 0.625rem;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-subtle);
		border-radius: 8px;
		font-size: 0.6875rem;
	}
	.relation.blocked-by { border-left: 3px solid #ef4444; }
	.relation.blocking { border-left: 3px solid #10b981; }

	.rel-type {
		padding: 0.125rem 0.25rem;
		border-radius: 4px;
		font-size: 0.5625rem;
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
		font-family: 'IBM Plex Mono', monospace;
		font-size: 0.5625rem;
		color: var(--text-tertiary);
	}

	.rel-title {
		flex: 1;
		color: var(--text-secondary);
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

	:global(.app.light) .relation {
		background: rgba(0, 0, 0, 0.02);
		border-color: var(--border-subtle);
	}
</style>
