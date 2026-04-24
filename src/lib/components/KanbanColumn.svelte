<script lang="ts">
	import type { Issue, Column } from '$lib/types';
	import Icon from './Icon.svelte';
	import IssueCard from './IssueCard.svelte';
	import ColumnHeader from './ColumnHeader.svelte';
	import { hasOpenBlockers } from '$lib/utils';

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
		hasActiveFilters: boolean;
		isFilterPreviewing: boolean;
		flyingCards: Map<string, any>;
		placeholders: Array<{id: string; targetColumn: string; height: number}>;
		shrinkingSourceIds: Set<string>;
		worktreeTicketIds?: Set<string>;
		activeColumnIndex: number;
		showAddButton?: boolean;
		showColumnCounts?: boolean;
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
		hasActiveFilters,
		isFilterPreviewing,
		flyingCards,
		placeholders,
		shrinkingSourceIds,
		worktreeTicketIds,
		activeColumnIndex,
		showAddButton = false,
		showColumnCounts = true,
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
	data-column-key={column.key}
	aria-label={column.label}
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
		{showColumnCounts}
		{oncollapseclick}
		{ontogglecollapse}
		{ontogglesortmenu}
		{onsetcolumnsort}
	/>

	{#if !isCollapsed}
		<div class="cards">
			{#if draggedOverColumn === column.key && dropTargetColumn === column.key && dropIndicatorIndex === 0}
				<div class="drop-indicator"></div>
			{/if}

			{#each placeholders.filter(p => p.targetColumn === column.key) as placeholder}
				<div
					class="placeholder-slot"
					style="--placeholder-height: {placeholder.height}px"
					use:registerPlaceholder={placeholder.id}
				></div>
			{/each}

			{#each allColumnIssues as issue, idx}
				{@const isBlocked = hasOpenBlockers(issue)}
				{@const matchesFilter = issueMatchesFilters(issue)}
				{@const isFlying = flyingCards.has(issue.id)}
				{@const isShrinking = shrinkingSourceIds.has(issue.id)}
				{@const shouldHide = hasActiveFilters && !isFilterPreviewing && !matchesFilter}
				{#if !shouldHide}
					<IssueCard
						{issue}
						selected={selectedId === issue.id}
						dragging={draggedId === issue.id}
						animating={animatingIds.has(issue.id)}
						hasOpenBlockers={isBlocked}
						editing={editingIssue?.id === issue.id}
						filterDimmed={hasActiveFilters && isFilterPreviewing && !matchesFilter}
						flyingHidden={isFlying}
						shrinkingSource={isShrinking}
						inWorktree={worktreeTicketIds?.has(issue.id) ?? false}
						{registerCard}
						onclick={() => oncardclick(issue)}
						ondragstart={(e) => oncarddragstart(e, issue.id)}
						ondragend={oncarddragend}
						oncontextmenu={(e) => oncardcontextmenu(e, issue)}
						oncopyid={(id) => oncopyid(id, id)}
					/>
				{/if}

				{#if draggedOverColumn === column.key && dropTargetColumn === column.key && dropIndicatorIndex === idx + 1}
					<div class="drop-indicator"></div>
				{/if}
			{/each}

			{#if allColumnIssues.length === 0}
				<div class="empty-state">
					<div class="empty-icon"><Icon name={column.icon} size={24} /></div>
					<p>No issues</p>
				</div>
			{/if}

			{#if showAddButton && onaddclick}
				<button class="add-card-btn" onclick={onaddclick}>
					<span class="add-text">New Issue</span>
					<kbd class="add-hotkey">N</kbd>
				</button>
			{/if}
		</div>
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

	/* --- Cards (inlined from ColumnDropzone) --- */

	.cards {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding: 0.5rem;
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		min-height: 0;
	}

	.cards::-webkit-scrollbar {
		width: 4px;
	}

	.cards::-webkit-scrollbar-track {
		background: transparent;
	}

	.cards::-webkit-scrollbar-thumb {
		background: var(--border-subtle);
		border-radius: 2px;
	}

	.cards::-webkit-scrollbar-thumb:hover {
		background: var(--border-default);
	}

	.drop-indicator {
		height: 3px;
		background: linear-gradient(90deg, transparent, var(--accent-primary), transparent);
		border-radius: 2px;
		margin: 0.1875rem 0;
		animation: dropPulse 1s ease-in-out infinite;
	}

	@keyframes dropPulse {
		0%, 100% { opacity: 0.6; transform: scaleX(0.95); }
		50% { opacity: 1; transform: scaleX(1); }
	}

	.placeholder-slot {
		height: 0;
		overflow: hidden;
		animation: placeholderExpand 300ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
		margin: 2px 4px;
	}

	@keyframes placeholderExpand {
		from { height: 0; }
		to { height: var(--placeholder-height); }
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 1.5rem 1rem;
		color: var(--text-muted);
		text-align: center;
		border: 1px dashed var(--border-subtle);
		border-radius: var(--radius-sm);
		margin: 0.25rem;
		flex: 1;
	}

	.empty-icon {
		margin-bottom: 0.25rem;
		opacity: 0.25;
	}

	.empty-state p {
		font-size: 0.6875rem;
		font-weight: 500;
	}

	.add-card-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		margin: 0.25rem;
		padding: 0.5rem 0.75rem;
		background: transparent;
		border: 1px dashed var(--border-default);
		border-radius: var(--radius-sm);
		color: var(--text-tertiary);
		font-family: var(--font-sans);
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.add-card-btn:hover {
		border-color: var(--accent-primary);
		border-style: solid;
		color: var(--accent-primary);
		background: var(--accent-glow);
	}

	.add-card-btn:active {
		transform: scale(0.98);
	}

	.add-hotkey {
		font-family: var(--font-mono);
		font-size: 0.5rem;
		font-weight: 500;
		padding: 0.0625rem 0.25rem;
		background: rgba(255, 255, 255, 0.06);
		border-radius: var(--radius-xs);
		color: var(--text-muted);
	}

	.add-card-btn:hover .add-hotkey {
		background: rgba(59, 130, 246, 0.15);
		color: var(--accent-primary);
	}

	@media (max-width: 768px) {
		.cards {
			padding: 0.375rem 0.5rem 1rem;
			gap: 0.375rem;
			margin: 0;
		}

		.empty-state {
			padding: 1rem;
		}

		.empty-icon {
			font-size: 1.25rem;
		}

		.empty-state p {
			font-size: 0.6875rem;
		}

		.add-card-btn {
			margin: 0.125rem 2px;
			padding: 0.625rem 0.75rem;
			font-size: 0.75rem;
		}

		.add-hotkey {
			font-size: 0.5625rem;
			padding: 0.0625rem 0.25rem;
		}
	}
</style>
