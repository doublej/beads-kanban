<script lang="ts">
	import type { Issue, Column } from '$lib/types';
	import IssueCard from './IssueCard.svelte';
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
		copiedId: string | null;
		hasActiveFilters: boolean;
		flyingCards: Map<string, any>;
		placeholders: Array<{id: string; targetColumn: string; height: number}>;
		activeColumnIndex: number;
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
		flyingCards,
		placeholders,
		activeColumnIndex,
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
		oncopyid
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
	<div class="column-header" onclick={() => isCollapsed && oncollapseclick(column.key)}>
		<div class="column-title">
			<kbd class="hotkey-hint hotkey-hint-column">{columnIndex + 1}</kbd>
			<span class="column-icon">{column.icon}</span>
			<h2>{column.label}</h2>
		</div>
		<div class="column-header-actions">
			<div class="sort-dropdown">
				<button class="sort-btn" class:active={currentSort} onclick={(e) => ontogglesortmenu(column.key, e)} title="Sort by">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M6 12h12M9 18h6"/></svg>
				</button>
				{#if sortMenuOpen === column.key}
					<div class="sort-menu">
						<button class:active={currentSort === 'priority'} onclick={() => onsetcolumnsort(column.key, 'priority')}>Priority</button>
						<button class:active={currentSort === 'created'} onclick={() => onsetcolumnsort(column.key, 'created')}>Newest</button>
						<button class:active={currentSort === 'title'} onclick={() => onsetcolumnsort(column.key, 'title')}>Title</button>
					</div>
				{/if}
			</div>
			<span class="column-count">{#if hasActiveFilters}{matchingCount}/{allColumnIssues.length}{:else}{allColumnIssues.length}{/if}</span>
			<button class="column-collapse-btn" onclick={(e) => ontogglecollapse(e, column.key)} aria-label={isCollapsed ? 'Expand column' : 'Collapse column'}>
				{isCollapsed ? '▶' : '◀'}
			</button>
		</div>
	</div>

	{#if !isCollapsed}
	<div class="cards">
		{#if draggedOverColumn === column.key && dropTargetColumn === column.key && dropIndicatorIndex === 0}
			<div class="drop-indicator"></div>
		{/if}

		<!-- Placeholder slots for incoming cards -->
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
			<IssueCard
				{issue}
				selected={selectedId === issue.id}
				dragging={draggedId === issue.id}
				animating={animatingIds.has(issue.id)}
				hasOpenBlockers={isBlocked}
				{copiedId}
				editing={editingIssue?.id === issue.id}
				filterDimmed={hasActiveFilters && !matchesFilter}
				flyingHidden={isFlying}
				{registerCard}
				onclick={() => oncardclick(issue)}
				ondragstart={(e) => oncarddragstart(e, issue.id)}
				ondragend={oncarddragend}
				oncontextmenu={(e) => oncardcontextmenu(e, issue)}
				oncopyid={(id) => oncopyid(id, id)}
			/>

			{#if draggedOverColumn === column.key && dropTargetColumn === column.key && dropIndicatorIndex === idx + 1}
				<div class="drop-indicator"></div>
			{/if}
		{/each}

		{#if allColumnIssues.length === 0}
			<div class="empty-state">
				<div class="empty-icon">{column.icon}</div>
				<p>No issues</p>
			</div>
		{/if}
	</div>
	{/if}
</section>

<style>
	.column {
		flex: 1 1 0;
		min-width: 280px;
		min-height: 0;
		align-self: stretch;
		display: flex;
		flex-direction: column;
		background: transparent;
		border: none;
		border-radius: var(--radius-lg);
		overflow: visible;
		transition: all var(--transition-smooth);
	}

	.column.drag-over {
		background: var(--accent-glow);
	}

	.column-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 0.5rem;
		border-bottom: none;
		background: transparent;
		flex-shrink: 0;
	}

	.column-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.column-icon {
		font-size: 0.75rem;
		color: var(--accent);
	}

	.column-header h2 {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-secondary);
	}

	.column-count {
		padding: 0.1875rem 0.5rem;
		background: var(--bg-elevated);
		border-radius: 999px;
		font-size: 0.6875rem;
		font-weight: 600;
		color: var(--text-secondary);
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

	.sort-btn svg {
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
		font-size: 0.5rem;
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

	.column.collapsed {
		flex: 0 0 48px;
		min-width: 48px;
	}

	.column.collapsed .column-header {
		flex-direction: column;
		padding: 0.75rem 0.5rem;
		height: 100%;
		cursor: pointer;
	}

	.column.collapsed .column-title {
		flex-direction: column;
		writing-mode: vertical-rl;
		text-orientation: mixed;
	}

	.column.collapsed .column-header-actions {
		flex-direction: column;
	}

	.column.collapsed .column-collapse-btn {
		opacity: 1;
	}

	.cards {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.75rem 1rem 2rem 0.75rem;
		margin: 0 -0.25rem;
		flex: 1;
		overflow-y: auto;
		overflow-x: visible;
		min-height: 0;
	}

	.cards::-webkit-scrollbar {
		width: 5px;
	}

	.cards::-webkit-scrollbar-track {
		background: transparent;
	}

	.cards::-webkit-scrollbar-thumb {
		background: var(--border-default);
		border-radius: 2.5px;
	}

	.cards::-webkit-scrollbar-thumb:hover {
		background: var(--border-strong);
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
		margin-bottom: var(--space-sm);
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
		padding: 1.5rem;
		color: var(--text-tertiary);
		text-align: center;
		border: 2px dashed var(--border-subtle);
		border-radius: var(--radius-md);
		transition: all var(--transition-smooth);
		flex: 1;
	}

	.empty-icon {
		font-size: 1.5rem;
		margin-bottom: 0.375rem;
		opacity: 0.3;
	}

	.empty-state p {
		font-size: 0.75rem;
	}

	/* Hotkey hint for column number */
	.hotkey-hint-column {
		font-size: 0.5rem;
		padding: 0.125rem 0.25rem;
		background: var(--bg-elevated);
		border-radius: var(--radius-xs);
		color: var(--text-tertiary);
		font-family: var(--font-mono);
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

		.column-header {
			padding: 0.5rem;
		}
	}
</style>
