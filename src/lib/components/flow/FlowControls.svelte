<script lang="ts">
	import { Panel, useSvelteFlow } from '@xyflow/svelte';
	import type { FlowLayout, GroupDim } from './flow-context';

	interface Props {
		layout: FlowLayout;
		groupDim: GroupDim;
		/** Changes whenever the computed layout changes, so we can refit the view. */
		layoutSig: string;
		onlayout: (l: FlowLayout) => void;
		ondim: (d: GroupDim) => void;
	}

	let { layout, groupDim, layoutSig, onlayout, ondim }: Props = $props();

	const { fitView } = useSvelteFlow();

	const layouts: { k: FlowLayout; label: string }[] = [
		{ k: 'deps', label: 'Dependencies' },
		{ k: 'groups', label: 'Groups' },
		{ k: 'timeline', label: 'Timeline' }
	];
	const dims: { k: GroupDim; label: string }[] = [
		{ k: 'label', label: 'Label' },
		{ k: 'status', label: 'Status' },
		{ k: 'assignee', label: 'Assignee' },
		{ k: 'priority', label: 'Priority' },
		{ k: 'type', label: 'Type' }
	];

	// Refit the viewport after the node set is swapped for a new layout.
	let lastSig = '';
	$effect(() => {
		const sig = layoutSig;
		if (sig === lastSig) return;
		lastSig = sig;
		requestAnimationFrame(() => fitView({ duration: 400, padding: 0.16 }));
	});
</script>

<Panel position="top-left">
	<div class="flow-toolbar">
		<div class="seg">
			{#each layouts as l (l.k)}
				<button class:active={layout === l.k} onclick={() => onlayout(l.k)}>{l.label}</button>
			{/each}
		</div>
		{#if layout === 'groups'}
			<div class="seg dim">
				{#each dims as d (d.k)}
					<button class:active={groupDim === d.k} onclick={() => ondim(d.k)}>{d.label}</button>
				{/each}
			</div>
		{/if}
	</div>
</Panel>

<style>
	.flow-toolbar {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}

	.seg {
		display: flex;
		gap: 1px;
		padding: 2px;
		background: var(--surface-panel);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		box-shadow: var(--shadow-sm, 0 1px 3px rgba(0, 0, 0, 0.2));
	}

	.seg button {
		padding: 0.25rem 0.5rem;
		background: transparent;
		border: none;
		border-radius: var(--radius-xs);
		color: var(--text-tertiary);
		font-family: inherit;
		font-size: 0.6875rem;
		font-weight: 600;
		cursor: pointer;
		transition: background var(--transition-fast), color var(--transition-fast);
	}

	.seg button:hover {
		color: var(--text-primary);
		background: var(--bg-elevated);
	}

	.seg button.active {
		background: var(--accent-primary);
		color: #fff;
	}
</style>
