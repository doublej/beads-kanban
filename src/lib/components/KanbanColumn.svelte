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
