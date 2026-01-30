<script lang="ts">
	import type { ViewMode } from '$lib/types';
	import Icon from './Icon.svelte';

	interface Props {
		viewMode: ViewMode;
	}

	let {
		viewMode = $bindable()
	}: Props = $props();

	const viewModes: { key: ViewMode; icon: 'view-board' | 'view-tree' | 'view-graph' | 'view-stats'; label: string }[] = [
		{ key: 'kanban', icon: 'view-board', label: 'board' },
		{ key: 'tree', icon: 'view-tree', label: 'tree' },
		{ key: 'graph', icon: 'view-graph', label: 'dependency graph' },
		{ key: 'stats', icon: 'view-stats', label: 'stats' }
	];
</script>

<div class="btn-group">
	{#each viewModes as mode}
		<button
			class="toolbar-btn"
			class:active={viewMode === mode.key}
			onclick={() => viewMode = mode.key}
			title={mode.label}
		>
			<Icon name={mode.icon} size={14} />
		</button>
	{/each}
</div>

<style>
	.btn-group {
		display: flex;
		gap: 2px;
	}

	.toolbar-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		height: 1.75rem;
		min-width: 1.75rem;
		padding: 0 0.5rem;
		background: transparent;
		border: none;
		border-radius: 0.25rem;
		color: var(--text-tertiary);
		font-family: inherit;
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.1s, color 0.1s;
	}

	.toolbar-btn :global(svg) {
		flex-shrink: 0;
	}

	.toolbar-btn:hover {
		background: rgba(255, 255, 255, 0.06);
		color: var(--text-primary);
	}

	.toolbar-btn.active {
		background: rgba(255, 255, 255, 0.1);
		color: var(--text-primary);
	}

	:global(.app.light) .toolbar-btn:hover {
		background: rgba(0, 0, 0, 0.04);
	}

	:global(.app.light) .toolbar-btn.active {
		background: rgba(0, 0, 0, 0.06);
	}

	@media (max-width: 768px) {
		.btn-group {
			display: none;
		}
	}
</style>
