<script lang="ts">
	import type { Issue } from '$lib/types';
	import { columns, getPriorityConfig } from '$lib/utils';
	import Icon from './Icon.svelte';

	interface Props {
		issues: Issue[];
		selectedId?: string | null;
		isDark?: boolean;
		onselect?: (issue: Issue) => void;
	}

	let { issues, selectedId = null, isDark = true, onselect }: Props = $props();

	// Controls state
	type GroupBy = 'status' | 'priority' | 'type' | 'assignee' | 'none';
	type LayoutMode = 'wrap' | 'columns';

	let blockSize = $state(12);
	let groupBy = $state<GroupBy>('status');
	let layoutMode = $state<LayoutMode>('wrap');

	const groupByOptions: { value: GroupBy; label: string }[] = [
		{ value: 'status', label: 'Status' },
		{ value: 'priority', label: 'Priority' },
		{ value: 'type', label: 'Type' },
		{ value: 'assignee', label: 'Assignee' },
		{ value: 'none', label: 'None' }
	];

	// Group configuration based on groupBy
	const groupConfig = $derived.by(() => {
		switch (groupBy) {
			case 'status':
				return columns.map(col => ({
					key: col.status,
					label: col.label,
					accent: col.accent,
					icon: col.icon as 'circle' | 'circle-dot' | 'circle-slash' | 'check-circle'
				}));
			case 'priority':
				return [0, 1, 2, 3, 4].map(p => {
					const config = getPriorityConfig(p);
					return { key: String(p), label: config.label, accent: config.color, icon: null };
				});
			case 'type':
				const types = [...new Set(issues.map(i => i.issue_type).filter(Boolean))].sort();
				return types.map(t => ({ key: t, label: t, accent: '#6366f1', icon: null }));
			case 'assignee':
				const assignees = [...new Set(issues.map(i => i.assignee || 'Unassigned'))].sort();
				return assignees.map(a => ({ key: a, label: a, accent: '#6366f1', icon: null }));
			case 'none':
				return [{ key: 'all', label: 'All Issues', accent: '#6366f1', icon: null }];
		}
	});

	// Group issues based on groupBy selection
	const groupedIssues = $derived.by(() => {
		const groups = new Map<string, Issue[]>();

		// Initialize all groups
		for (const g of groupConfig) {
			groups.set(g.key, []);
		}

		for (const issue of issues) {
			let key: string;
			switch (groupBy) {
				case 'status':
					key = issue.status;
					break;
				case 'priority':
					key = String(issue.priority);
					break;
				case 'type':
					key = issue.issue_type || '';
					break;
				case 'assignee':
					key = issue.assignee || 'Unassigned';
					break;
				case 'none':
					key = 'all';
					break;
			}
			const list = groups.get(key);
			if (list) list.push(issue);
		}

		return groups;
	});

	// Calculate columns per row based on block size
	const columnsPerRow = $derived.by(() => {
		if (blockSize <= 8) return 20;
		if (blockSize <= 12) return 16;
		if (blockSize <= 16) return 12;
		return 10;
	});

	const gap = $derived(blockSize > 12 ? 3 : 2);

	function handleBlockClick(issue: Issue) {
		onselect?.(issue);
	}

	function handleKeydown(e: KeyboardEvent, issue: Issue) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			onselect?.(issue);
		}
	}

	function getBlockColor(issue: Issue): string {
		// Always color by priority for now
		return getPriorityConfig(issue.priority).color;
	}

	function getStatusAccent(issue: Issue): string {
		const col = columns.find(c => c.status === issue.status);
		return col?.accent || '#6366f1';
	}
</script>

<div class="grid-view" class:dark={isDark}>
	<!-- Controls bar -->
	<div class="controls-bar">
		<div class="control-group">
			<label class="control-label">Size</label>
			<input
				type="range"
				class="size-slider"
				min="6"
				max="24"
				step="2"
				bind:value={blockSize}
			/>
			<span class="size-value">{blockSize}px</span>
		</div>

		<div class="control-group">
			<label class="control-label">Group by</label>
			<select class="control-select" bind:value={groupBy}>
				{#each groupByOptions as opt}
					<option value={opt.value}>{opt.label}</option>
				{/each}
			</select>
		</div>

		<div class="control-group">
			<label class="control-label">Layout</label>
			<div class="layout-toggle">
				<button
					class="toggle-btn"
					class:active={layoutMode === 'wrap'}
					onclick={() => layoutMode = 'wrap'}
					title="Wrapped groups"
				>
					<Icon name="view-board" size={14} />
				</button>
				<button
					class="toggle-btn"
					class:active={layoutMode === 'columns'}
					onclick={() => layoutMode = 'columns'}
					title="Column lanes"
				>
					<Icon name="view-table" size={14} />
				</button>
			</div>
		</div>

		<div class="control-spacer"></div>

		<div class="issue-count">
			{issues.length} tickets
		</div>
	</div>

	{#if issues.length === 0}
		<div class="grid-empty">No tickets to display</div>
	{:else}
		<div class="grid-canvas" class:columns-mode={layoutMode === 'columns'}>
			{#each groupConfig as group}
				{@const groupIssues = groupedIssues.get(group.key) ?? []}
				{#if groupIssues.length > 0 || layoutMode === 'columns'}
					<div class="status-group" class:empty-column={groupIssues.length === 0}>
						<div class="group-header" style="--accent: {group.accent}">
							{#if group.icon}
								<Icon name={group.icon} size={12} />
							{/if}
							<span class="group-label">{group.label}</span>
							<span class="group-count">{groupIssues.length}</span>
						</div>
						<div
							class="blocks-grid"
							style="--block-size: {blockSize}px; --gap: {gap}px; --cols: {columnsPerRow}"
						>
							{#each groupIssues as issue (issue.id)}
								{@const isSelected = issue.id === selectedId}
								<button
									class="block"
									class:selected={isSelected}
									style="--priority-color: {getBlockColor(issue)}; --status-accent: {getStatusAccent(issue)}"
									onclick={() => handleBlockClick(issue)}
									onkeydown={(e) => handleKeydown(e, issue)}
									title="{issue.id}: {issue.title}"
								>
									<span class="block-inner"></span>
								</button>
							{/each}
						</div>
					</div>
				{/if}
			{/each}
		</div>

		<div class="grid-legend">
			<div class="legend-section">
				<span class="legend-title">Priority</span>
				<div class="legend-items">
					{#each [0, 1, 2, 3, 4] as p}
						{@const config = getPriorityConfig(p)}
						<div class="legend-item">
							<span class="legend-swatch" style="background: {config.color}"></span>
							<span class="legend-label">{config.label}</span>
						</div>
					{/each}
				</div>
			</div>
			{#if groupBy !== 'status'}
				<div class="legend-section">
					<span class="legend-title">Status</span>
					<div class="legend-items">
						{#each columns as col}
							<div class="legend-item">
								<span class="legend-swatch status-swatch" style="border-color: {col.accent}"></span>
								<span class="legend-label">{col.label}</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.grid-view {
		flex: 1;
		min-width: 0;
		min-height: 0;
		position: relative;
		display: flex;
		flex-direction: column;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		overflow: hidden;
		background: var(--surface-base, var(--surface-panel));
	}

	/* Controls bar */
	.controls-bar {
		display: flex;
		align-items: center;
		gap: 1.25rem;
		padding: 0.625rem 1rem;
		background: var(--surface-panel);
		border-bottom: 1px solid var(--border-subtle);
	}

	.control-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.control-label {
		font-size: 0.6875rem;
		font-weight: 500;
		color: var(--text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.size-slider {
		width: 80px;
		height: 4px;
		-webkit-appearance: none;
		appearance: none;
		background: var(--border-default);
		border-radius: 2px;
		cursor: pointer;
	}

	.size-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 12px;
		height: 12px;
		background: var(--accent-primary);
		border-radius: 50%;
		cursor: pointer;
		transition: transform 0.1s;
	}

	.size-slider::-webkit-slider-thumb:hover {
		transform: scale(1.2);
	}

	.size-value {
		font-size: 0.6875rem;
		font-family: var(--font-mono);
		color: var(--text-secondary);
		min-width: 32px;
	}

	.control-select {
		padding: 0.25rem 0.5rem;
		font-size: 0.75rem;
		background: var(--surface-elevated);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		color: var(--text-primary);
		cursor: pointer;
	}

	.control-select:focus {
		outline: none;
		border-color: var(--accent-primary);
	}

	.layout-toggle {
		display: flex;
		gap: 2px;
		padding: 2px;
		background: var(--surface-elevated);
		border-radius: var(--radius-sm);
	}

	.toggle-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 22px;
		padding: 0;
		border: none;
		border-radius: 3px;
		background: transparent;
		color: var(--text-tertiary);
		cursor: pointer;
		transition: all 0.1s;
	}

	.toggle-btn:hover {
		color: var(--text-secondary);
	}

	.toggle-btn.active {
		background: var(--accent-primary);
		color: white;
	}

	.control-spacer {
		flex: 1;
	}

	.issue-count {
		font-size: 0.6875rem;
		color: var(--text-tertiary);
	}

	/* Canvas */
	.grid-empty {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-tertiary);
		font-size: 0.8125rem;
	}

	.grid-canvas {
		flex: 1;
		display: flex;
		flex-wrap: wrap;
		align-content: flex-start;
		gap: 1.5rem;
		padding: 1.25rem;
		overflow: auto;
	}

	.grid-canvas.columns-mode {
		flex-wrap: nowrap;
		gap: 0;
	}

	.status-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 120px;
	}

	.columns-mode .status-group {
		flex: 1;
		min-width: 0;
		padding: 0 0.75rem;
		border-right: 1px solid var(--border-subtle);
	}

	.columns-mode .status-group:last-child {
		border-right: none;
	}

	.columns-mode .status-group.empty-column {
		opacity: 0.4;
	}

	.group-header {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.25rem 0;
		color: var(--accent);
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.group-label {
		color: var(--text-secondary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.group-count {
		margin-left: auto;
		padding: 0.125rem 0.375rem;
		background: var(--surface-elevated);
		border-radius: var(--radius-sm);
		color: var(--text-tertiary);
		font-size: 0.625rem;
		font-weight: 500;
		flex-shrink: 0;
	}

	.blocks-grid {
		display: grid;
		grid-template-columns: repeat(var(--cols), var(--block-size));
		gap: var(--gap);
	}

	.columns-mode .blocks-grid {
		grid-template-columns: repeat(auto-fill, var(--block-size));
	}

	.block {
		width: var(--block-size);
		height: var(--block-size);
		padding: 0;
		border: 1px solid transparent;
		border-radius: 2px;
		background: transparent;
		cursor: pointer;
		transition: transform 0.1s, box-shadow 0.1s;
		position: relative;
	}

	.block-inner {
		display: block;
		width: 100%;
		height: 100%;
		border-radius: 1px;
		background: var(--priority-color);
		opacity: 0.85;
		transition: opacity 0.1s;
	}

	.block:hover {
		transform: scale(1.3);
		z-index: 10;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
	}

	.block:hover .block-inner {
		opacity: 1;
	}

	.block.selected {
		border-color: var(--text-primary);
		transform: scale(1.4);
		z-index: 11;
		box-shadow: 0 0 0 2px var(--bg-primary), 0 0 0 4px var(--status-accent);
	}

	.block:focus-visible {
		outline: 2px solid var(--accent-primary);
		outline-offset: 2px;
	}

	/* Legend */
	.grid-legend {
		display: flex;
		gap: 2rem;
		padding: 0.75rem 1.25rem;
		background: var(--surface-panel);
		border-top: 1px solid var(--border-subtle);
	}

	.legend-section {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.legend-title {
		font-size: 0.625rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-tertiary);
	}

	.legend-items {
		display: flex;
		gap: 0.75rem;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.legend-swatch {
		width: 8px;
		height: 8px;
		border-radius: 2px;
	}

	.legend-swatch.status-swatch {
		background: transparent;
		border: 2px solid;
	}

	.legend-label {
		font-size: 0.625rem;
		color: var(--text-secondary);
	}

	/* Light mode adjustments */
	:global(.app.light) .block:hover {
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
	}

	:global(.app.light) .size-slider {
		background: var(--border-subtle);
	}
</style>
