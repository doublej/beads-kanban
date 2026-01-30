<script lang="ts">
	import type { Column } from '$lib/types';
	import Icon from './Icon.svelte';

	interface Props {
		column: Column;
		columnIndex: number;
		issueCount: number;
		matchingCount: number;
		isCollapsed: boolean;
		currentSort: 'priority' | 'created' | 'title' | undefined;
		sortMenuOpen: string | null;
		hasActiveFilters: boolean;
		oncollapseclick: (columnKey: string) => void;
		ontogglecollapse: (e: MouseEvent, columnKey: string) => void;
		ontogglesortmenu: (columnKey: string, e: MouseEvent) => void;
		onsetcolumnsort: (columnKey: string, sortBy: 'priority' | 'created' | 'title') => void;
	}

	let {
		column,
		columnIndex,
		issueCount,
		matchingCount,
		isCollapsed,
		currentSort,
		sortMenuOpen,
		hasActiveFilters,
		oncollapseclick,
		ontogglecollapse,
		ontogglesortmenu,
		onsetcolumnsort
	}: Props = $props();
</script>

<div class="column-header" onclick={() => isCollapsed && oncollapseclick(column.key)}>
	<div class="column-title">
		<kbd class="hotkey-hint hotkey-hint-column">{columnIndex + 1}</kbd>
		<span class="column-icon"><Icon name={column.icon} size={12} /></span>
		<h2>{column.label}</h2>
	</div>
	<div class="column-header-actions">
		<div class="sort-dropdown">
			<button class="sort-btn" class:active={currentSort} onclick={(e) => ontogglesortmenu(column.key, e)} title="Sort by">
				<Icon name="list-filter" size={12} />
			</button>
			{#if sortMenuOpen === column.key}
				<div class="sort-menu">
					<button class:active={currentSort === 'priority'} onclick={() => onsetcolumnsort(column.key, 'priority')}>Priority</button>
					<button class:active={currentSort === 'created'} onclick={() => onsetcolumnsort(column.key, 'created')}>Newest</button>
					<button class:active={currentSort === 'title'} onclick={() => onsetcolumnsort(column.key, 'title')}>Title</button>
				</div>
			{/if}
		</div>
		<span class="column-count">{#if hasActiveFilters}{matchingCount}/{issueCount}{:else}{issueCount}{/if}</span>
		<button class="column-collapse-btn" onclick={(e) => ontogglecollapse(e, column.key)} aria-label={isCollapsed ? 'Expand column' : 'Collapse column'}>
			{#if isCollapsed}
				<Icon name="chevron-right" size={10} />
			{:else}
				<Icon name="chevron-left" size={10} />
			{/if}
		</button>
	</div>
</div>

<style>
	.column-header {
		position: sticky;
		top: 0;
		z-index: 10;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.625rem 0.75rem;
		background: var(--surface-panel);
		border-bottom: 1px solid var(--border-subtle);
		flex-shrink: 0;
	}

	.column-title {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	.column-icon {
		display: flex;
		color: var(--accent);
		opacity: 0.8;
	}

	.column-header h2 {
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-secondary);
	}

	.column-count {
		padding: 0.125rem 0.375rem;
		background: var(--surface-card);
		border-radius: var(--radius-full);
		font-family: var(--font-mono);
		font-size: 0.625rem;
		font-weight: 500;
		color: var(--text-tertiary);
	}

	.column-header-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.sort-dropdown {
		position: relative;
	}

	.sort-btn {
		width: 2rem;
		height: 2rem;
		min-width: 2.75rem;
		min-height: 2.75rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-sm);
		border: none;
		background: transparent;
		color: var(--text-tertiary);
		cursor: pointer;
		transition: all var(--transition-fast);
		opacity: 0;
	}

	.sort-btn :global(svg) {
		width: 0.75rem;
		height: 0.75rem;
	}

	.column-header:hover .sort-btn {
		opacity: 0.6;
	}

	.sort-btn:hover, .sort-btn.active {
		opacity: 1;
		color: var(--accent);
	}

	.sort-menu {
		position: absolute;
		top: 100%;
		right: 0;
		margin-top: 0.25rem;
		background: var(--bg-secondary);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		padding: 0.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		z-index: 50;
		min-width: 80px;
		box-shadow: var(--shadow-md);
	}

	.sort-menu button {
		padding: 0.375rem 0.5rem;
		font-size: 0.625rem;
		font-weight: 500;
		text-align: left;
		border: none;
		background: transparent;
		color: var(--text-secondary);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.sort-menu button:hover {
		background: var(--bg-elevated);
		color: var(--text-primary);
	}

	.sort-menu button.active {
		background: var(--accent-primary);
		color: white;
	}

	.column-collapse-btn {
		width: 1.25rem;
		height: 1.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		color: var(--text-tertiary);
		cursor: pointer;
		transition: all var(--transition-fast);
		opacity: 0;
	}

	.column-header:hover .column-collapse-btn {
		opacity: 1;
	}

	.column-collapse-btn:hover {
		background: var(--bg-elevated);
		color: var(--text-primary);
	}

	.hotkey-hint-column {
		font-size: 0.5rem;
		padding: 0.125rem 0.25rem;
		background: var(--bg-elevated);
		border-radius: var(--radius-xs);
		color: var(--text-tertiary);
		font-family: var(--font-mono);
	}

	@media (max-width: 1023px) {
		.column-header {
			padding: 0.5rem;
		}
	}

	@media (max-width: 768px) {
		.column-header {
			padding: 0.25rem 0.5rem;
		}

		.column-title {
			gap: 0.375rem;
		}

		.column-icon :global(svg) {
			width: 10px;
			height: 10px;
		}

		.column-header h2 {
			font-size: 0.6875rem;
		}

		.column-count {
			padding: 0.125rem 0.375rem;
			font-size: 0.625rem;
		}

		.column-header-actions {
			gap: 0.375rem;
		}

		.hotkey-hint-column {
			display: none;
		}

		.sort-btn {
			width: 1.5rem;
			height: 1.5rem;
			min-width: 1.5rem;
			min-height: 1.5rem;
		}

		.column-collapse-btn {
			display: none;
		}
	}

	:global(.app.light) .column-count {
		background: rgba(0, 0, 0, 0.04);
	}

	:global(.app.light) .sort-menu {
		box-shadow: var(--shadow-md);
	}
</style>
