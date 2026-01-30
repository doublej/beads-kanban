<script lang="ts">
	import type { Issue, Column } from '$lib/types';
	import ColumnHeader from './ColumnHeader.svelte';
	import ColumnDropzone from './ColumnDropzone.svelte';

	interface Props {
		column: Column;
		columnIndex: number;
		allColumnIssues: Issue[];
		matchingCount: number;
		isCollapsed: boolean;
		currentSort: 'priority' | 'created' | 'title' | undefined;
		sortMenuOpen: string | null;
		selectedId: string | null;
		editingIssue: Issue | null;
		draggedId: string | null;
		draggedOverColumn: string | null;
		dropTargetColumn: string | null;
		dropIndicatorIndex: number | null;
		animatingIds: Set<string>;
		copiedId: string | null;
		hasActiveFilters: boolean;
		isFilterPreviewing: boolean;
		flyingCards: Map<string, any>;
		placeholders: Array<{id: string; targetColumn: string; height: number}>;
		activeColumnIndex: number;
		showAddButton?: boolean;
		registerCard: (node: HTMLElement, id: string) => void;
		registerPlaceholder: (node: HTMLElement, id: string) => void;
		issueMatchesFilters: (issue: Issue) => boolean;
		ondragover: (e: DragEvent, columnKey: string) => void;
		ondragleave: (e: DragEvent, columnKey: string) => void;
		ondrop: (e: DragEvent, columnKey: string) => void;
		oncollapseclick: (columnKey: string) => void;
		ontogglecollapse: (e: MouseEvent, columnKey: string) => void;
		ontogglesortmenu: (columnKey: string, e: MouseEvent) => void;
		onsetcolumnsort: (columnKey: string, sortBy: 'priority' | 'created' | 'title') => void;
		oncardclick: (issue: Issue) => void;
		oncarddragstart: (e: DragEvent, issueId: string) => void;
		oncarddragend: () => void;
		oncardcontextmenu: (e: MouseEvent, issue: Issue) => void;
		oncopyid: (id: string, text: string) => void;
		onaddclick?: () => void;
	}

	let {
		column,
		columnIndex,
		allColumnIssues,
		matchingCount,
		isCollapsed,
		currentSort,
		sortMenuOpen,
		selectedId,
		editingIssue,
		draggedId,
		draggedOverColumn,
		dropTargetColumn,
		dropIndicatorIndex,
		animatingIds,
		copiedId,
		hasActiveFilters,
		isFilterPreviewing,
		flyingCards,
		placeholders,
		activeColumnIndex,
		showAddButton = false,
		registerCard,
		registerPlaceholder,
		issueMatchesFilters,
		ondragover,
		ondragleave,
		ondrop,
		oncollapseclick,
		ontogglecollapse,
		ontogglesortmenu,
		onsetcolumnsort,
		oncardclick,
		oncarddragstart,
		oncarddragend,
		oncardcontextmenu,
		oncopyid,
		onaddclick
	}: Props = $props();
</script>

<section
	class="column"
	class:mobile-active={activeColumnIndex === columnIndex}
	class:drag-over={draggedOverColumn === column.key}
	class:collapsed={isCollapsed}
	style="--accent: {column.accent}"
	ondragover={(e) => ondragover(e, column.key)}
	ondragleave={(e) => ondragleave(e, column.key)}
	ondrop={(e) => ondrop(e, column.key)}
>
	<ColumnHeader
		{column}
		{columnIndex}
		issueCount={allColumnIssues.length}
		{matchingCount}
		{isCollapsed}
		{currentSort}
		{sortMenuOpen}
		{hasActiveFilters}
		{oncollapseclick}
		{ontogglecollapse}
		{ontogglesortmenu}
		{onsetcolumnsort}
	/>

	{#if !isCollapsed}
		<ColumnDropzone
			{column}
			{allColumnIssues}
			{selectedId}
			{editingIssue}
			{draggedId}
			{draggedOverColumn}
			{dropTargetColumn}
			{dropIndicatorIndex}
			{animatingIds}
			{copiedId}
			{hasActiveFilters}
			{isFilterPreviewing}
			{flyingCards}
			{placeholders}
			{showAddButton}
			{registerCard}
			{registerPlaceholder}
			{issueMatchesFilters}
			{oncardclick}
			{oncarddragstart}
			{oncarddragend}
			{oncardcontextmenu}
			{oncopyid}
			{onaddclick}
		/>
	{/if}
</section>

<style>
	.column {
		flex: 1 1 300px;
		min-width: 280px;
		min-height: 0;
		align-self: stretch;
		display: flex;
		flex-direction: column;
		background: var(--surface-panel);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		overflow: hidden;
		transition: border-color var(--transition-fast);
	}

	.column.drag-over {
		border-color: var(--accent-primary);
		background: linear-gradient(180deg, var(--accent-glow) 0%, var(--surface-panel) 100%);
	}

	.column.collapsed {
		flex: 0 0 40px;
		min-width: 40px;
	}

	/* Collapsed column header layout overrides (applied via parent) */
	.column.collapsed :global(.column-header) {
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		padding: 0.75rem 0.25rem;
		height: 100%;
		cursor: pointer;
		gap: 0.5rem;
	}

	.column.collapsed :global(.column-title) {
		flex-direction: column;
		align-items: center;
		writing-mode: vertical-rl;
		text-orientation: mixed;
		gap: 0.375rem;
	}

	.column.collapsed :global(.column-title h2) {
		font-size: 0.625rem;
		letter-spacing: 0.06em;
	}

	.column.collapsed :global(.column-icon) {
		font-size: 0.875rem;
	}

	.column.collapsed :global(.hotkey-hint-column) {
		display: none;
	}

	.column.collapsed :global(.column-header-actions) {
		flex-direction: column;
		align-items: center;
		gap: 0.375rem;
		margin-top: auto;
	}

	.column.collapsed :global(.sort-dropdown) {
		display: none;
	}

	.column.collapsed :global(.column-count) {
		padding: 0.125rem 0.25rem;
		font-size: 0.5625rem;
		min-width: 1.25rem;
		text-align: center;
	}

	.column.collapsed :global(.column-collapse-btn) {
		opacity: 0.6;
		width: 1.5rem;
		height: 1.5rem;
		font-size: 0.5rem;
	}

	.column.collapsed:hover :global(.column-collapse-btn) {
		opacity: 1;
	}

	@media (max-width: 1023px) {
		.column {
			display: none;
			width: 100%;
			max-width: 100%;
		}

		.column.mobile-active {
			display: flex;
		}
	}

	:global(.app.light) .column {
		box-shadow: var(--shadow-sm);
	}

	:global(.app.light) .column.drag-over {
		box-shadow: var(--shadow-md);
	}
</style>
