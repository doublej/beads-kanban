<script lang="ts">
	import type { Issue, TableColumnConfig, TableColumnKey, TableSortState } from '$lib/types';
	import { TABLE_COLUMN_MAP, defaultTableColumns } from '$lib/table-columns';
	import {
		getIssueColumn,
		getPriorityConfig,
		getTypeIcon,
		getDueInfo,
		formatMinutes,
		formatTimestamp,
		calculateImpactScore,
		getImpactLevel,
		isAgentAssignee
	} from '$lib/utils';
	import Icon from './Icon.svelte';

	interface Props {
		issues: Issue[];
		columnConfig: TableColumnConfig[];
		sort: TableSortState | null;
		selectedId: string | null;
		onselect: (issue: Issue) => void;
		oncolumnschange: (cols: TableColumnConfig[]) => void;
		onsortchange: (sort: TableSortState | null) => void;
		oncreate?: () => void;
	}

	let {
		issues,
		columnConfig,
		sort,
		selectedId,
		onselect,
		oncolumnschange,
		onsortchange,
		oncreate
	}: Props = $props();

	const visibleCols = $derived(columnConfig.filter((c) => c.visible));
	// Parent (+page) pre-sorts `issues` by `sort`, so the row order here matches
	// keyboard next/prev navigation. `sort` is used only for the header indicator.
	const rows = $derived(issues);

	// --- Column resize (live width while dragging, committed on release) ---
	let liveWidths = $state<Record<string, number>>({});
	let resizing: { key: string; startX: number; startW: number } | null = null;

	function widthOf(key: TableColumnKey): number {
		return liveWidths[key] ?? columnConfig.find((c) => c.key === key)?.width ?? TABLE_COLUMN_MAP[key].defaultWidth;
	}

	function startResize(e: PointerEvent, key: TableColumnKey) {
		e.preventDefault();
		e.stopPropagation();
		resizing = { key, startX: e.clientX, startW: widthOf(key) };
		window.addEventListener('pointermove', onResizeMove);
		window.addEventListener('pointerup', endResize);
	}
	function onResizeMove(e: PointerEvent) {
		if (!resizing) return;
		const delta = e.clientX - resizing.startX;
		liveWidths = { ...liveWidths, [resizing.key]: Math.max(56, resizing.startW + delta) };
	}
	function endResize() {
		if (resizing) {
			const key = resizing.key;
			const w = liveWidths[key];
			if (w != null) oncolumnschange(columnConfig.map((c) => (c.key === key ? { ...c, width: Math.round(w) } : c)));
		}
		resizing = null;
		liveWidths = {};
		window.removeEventListener('pointermove', onResizeMove);
		window.removeEventListener('pointerup', endResize);
	}

	// --- Sort (3-state: asc -> desc -> none) ---
	function toggleSort(key: TableColumnKey) {
		if (!TABLE_COLUMN_MAP[key].sortable) return;
		if (!sort || sort.field !== key) return onsortchange({ field: key, dir: 'asc' });
		if (sort.dir === 'asc') return onsortchange({ field: key, dir: 'desc' });
		onsortchange(null);
	}

	// --- Column config popover ---
	let showConfig = $state(false);
	function toggleVisible(key: TableColumnKey) {
		oncolumnschange(columnConfig.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c)));
	}
	function move(i: number, dir: -1 | 1) {
		const j = i + dir;
		if (j < 0 || j >= columnConfig.length) return;
		const next = [...columnConfig];
		[next[i], next[j]] = [next[j], next[i]];
		oncolumnschange(next);
	}
	function resetColumns() {
		oncolumnschange(defaultTableColumns());
		onsortchange(null);
	}

	function onRowKey(e: KeyboardEvent, issue: Issue) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			onselect(issue);
		}
	}
</script>

<div class="table-view">
	<div class="table-toolbar">
		<span class="row-count">{rows.length} {rows.length === 1 ? 'issue' : 'issues'}</span>
		<div class="toolbar-right">
			<div class="config-wrap">
				<button class="tool-btn" class:active={showConfig} onclick={() => (showConfig = !showConfig)} title="Configure columns">
					<Icon name="sliders" size={14} />
					<span>Columns</span>
				</button>
				{#if showConfig}
					<div class="config-panel">
						<div class="config-head">
							<span>Columns</span>
							<button class="text-btn" onclick={resetColumns}>Reset</button>
						</div>
						<div class="config-list">
							{#each columnConfig as c, i (c.key)}
								<div class="cfg-item">
									<label class="cfg-label">
										<input type="checkbox" checked={c.visible} onchange={() => toggleVisible(c.key)} />
										<span>{TABLE_COLUMN_MAP[c.key].label}</span>
									</label>
									<div class="cfg-move">
										<button disabled={i === 0} onclick={() => move(i, -1)} aria-label="Move up"><Icon name="chevron-up" size={12} /></button>
										<button disabled={i === columnConfig.length - 1} onclick={() => move(i, 1)} aria-label="Move down"><Icon name="chevron-down" size={12} /></button>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>

	<div class="table-scroll">
		<div class="thead">
			{#each visibleCols as c (c.key)}
				{@const def = TABLE_COLUMN_MAP[c.key]}
				<div class="th" style="width: {widthOf(c.key)}px;" class:num={def.align === 'right'}>
					<button class="th-label" class:sortable={def.sortable} class:sorted={sort?.field === c.key} onclick={() => toggleSort(c.key)}>
						<span>{def.label}</span>
						{#if sort?.field === c.key}
							<Icon name={sort.dir === 'asc' ? 'sort-asc' : 'sort-desc'} size={12} />
						{/if}
					</button>
					<button class="resize-handle" type="button" tabindex="-1" aria-label="Resize {def.label}" onpointerdown={(e) => startResize(e, c.key)}></button>
				</div>
			{/each}
		</div>

		{#if rows.length === 0}
			<div class="empty">
				<p>No issues match the current filters.</p>
				{#if oncreate}<button class="create-btn" onclick={oncreate}><Icon name="plus" size={13} /> New issue</button>{/if}
			</div>
		{:else}
			{#each rows as issue (issue.id)}
				<div
					class="tr"
					class:selected={issue.id === selectedId}
					class:closed={issue.status === 'closed'}
					role="button"
					tabindex="0"
					onclick={() => onselect(issue)}
					onkeydown={(e) => onRowKey(e, issue)}
				>
					{#each visibleCols as c (c.key)}
						{@const def = TABLE_COLUMN_MAP[c.key]}
						<div class="td" style="width: {widthOf(c.key)}px;" class:num={def.align === 'right'}>
							{#if c.key === 'seq'}
								<span class="mono muted" title={issue.id}>#{issue.seq}</span>
							{:else if c.key === 'title'}
								<span class="cell-title">{issue.title}</span>
							{:else if c.key === 'status'}
								{@const col = getIssueColumn(issue)}
								<span class="pill" style="--c: {col.accent};"><span class="dot"></span>{col.label}</span>
							{:else if c.key === 'priority'}
								{@const p = getPriorityConfig(issue.priority)}
								<span class="pill" style="--c: {p.color};"><span class="dot"></span>{p.label}</span>
							{:else if c.key === 'type'}
								<span class="type"><Icon name={getTypeIcon(issue.issue_type)} size={12} />{issue.issue_type}</span>
							{:else if c.key === 'assignee'}
								{#if issue.assignee}
									<span class="assignee" class:agent={isAgentAssignee(issue.assignee)}>{issue.assignee}</span>
								{:else}
									<span class="muted">—</span>
								{/if}
							{:else if c.key === 'labels'}
								{@const ls = issue.labels ?? []}
								{#if ls.length}
									<span class="tags">
										{#each ls.slice(0, 3) as l (l)}<span class="tag">{l}</span>{/each}
										{#if ls.length > 3}<span class="muted">+{ls.length - 3}</span>{/if}
									</span>
								{:else}
									<span class="muted">—</span>
								{/if}
							{:else if c.key === 'due'}
								{@const d = getDueInfo(issue.due_at)}
								{#if d}<span class="due {d.level}" title={d.absolute}>{d.label}</span>{:else}<span class="muted">—</span>{/if}
							{:else if c.key === 'estimate'}
								{@const m = formatMinutes(issue.estimated_minutes)}
								{#if m}<span class="mono">{m}</span>{:else}<span class="muted">—</span>{/if}
							{:else if c.key === 'dependents'}
								{@const n = issue.dependent_count ?? issue.dependents?.length ?? 0}
								{#if n > 0}<span class="mono">{n}</span>{:else}<span class="muted">—</span>{/if}
							{:else if c.key === 'impact'}
								{@const s = calculateImpactScore(issue)}
								<span class="mono" style="color: {getImpactLevel(s).color};">{s}</span>
							{:else if c.key === 'created'}
								{@const t = formatTimestamp(issue.created_at)}
								<span class="muted" title={t.absolute}>{t.relative}</span>
							{:else if c.key === 'updated'}
								{@const t = formatTimestamp(issue.updated_at)}
								<span class="muted" title={t.absolute}>{t.relative}</span>
							{/if}
						</div>
					{/each}
				</div>
			{/each}
		{/if}
	</div>
</div>

<svelte:window onclick={(e) => { if (showConfig && !(e.target as HTMLElement)?.closest('.config-wrap')) showConfig = false; }} />

<style>
	.table-view {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
		min-height: 0;
		background: var(--surface-panel);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	.table-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 1rem;
		flex-shrink: 0;
	}

	.row-count {
		font-size: 0.75rem;
		color: var(--text-tertiary);
	}

	.config-wrap {
		position: relative;
	}

	.tool-btn {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		height: 1.75rem;
		padding: 0 0.5rem;
		background: transparent;
		border: none;
		border-radius: var(--radius-xs);
		color: var(--text-tertiary);
		font-family: inherit;
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		transition: background var(--transition-fast), color var(--transition-fast);
	}

	.tool-btn:hover,
	.tool-btn.active {
		background: var(--bg-elevated);
		color: var(--text-primary);
	}

	.config-panel {
		position: absolute;
		top: calc(100% + 0.25rem);
		right: 0;
		width: 220px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-sm);
		box-shadow: var(--shadow-lg);
		z-index: 300;
		padding: 0.5rem;
	}

	.config-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.25rem 0.25rem 0.5rem;
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-tertiary);
		border-bottom: 1px solid var(--border-subtle);
		margin-bottom: 0.25rem;
	}

	.text-btn {
		background: transparent;
		border: none;
		color: var(--text-tertiary);
		font-family: inherit;
		font-size: 0.6875rem;
		cursor: pointer;
	}
	.text-btn:hover {
		color: var(--text-primary);
	}

	.config-list {
		max-height: 320px;
		overflow-y: auto;
	}

	.cfg-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.1875rem 0.25rem;
		border-radius: var(--radius-xs);
	}
	.cfg-item:hover {
		background: var(--bg-elevated);
	}

	.cfg-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.75rem;
		color: var(--text-secondary);
		cursor: pointer;
		flex: 1;
		min-width: 0;
	}
	.cfg-label span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.cfg-label input {
		accent-color: var(--accent-primary);
	}

	.cfg-move {
		display: flex;
		gap: 1px;
		flex-shrink: 0;
	}
	.cfg-move button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.125rem;
		height: 1.125rem;
		padding: 0;
		background: transparent;
		border: none;
		border-radius: var(--radius-xs);
		color: var(--text-tertiary);
		cursor: pointer;
	}
	.cfg-move button:hover:not(:disabled) {
		background: var(--surface-elevated);
		color: var(--text-primary);
	}
	.cfg-move button:disabled {
		opacity: 0.3;
		cursor: default;
	}

	.table-scroll {
		flex: 1;
		min-height: 0;
		overflow: auto;
	}

	.thead {
		display: flex;
		position: sticky;
		top: 0;
		z-index: 2;
		background: var(--surface-panel);
		border-bottom: 1px solid var(--border-default);
		min-width: min-content;
	}

	.th {
		position: relative;
		display: flex;
		align-items: center;
		flex-shrink: 0;
		padding: 0 0.75rem;
		height: 2.25rem;
	}
	.th.num {
		justify-content: flex-end;
	}

	.th-label {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		max-width: 100%;
		padding: 0;
		background: transparent;
		border: none;
		color: var(--text-tertiary);
		font-family: inherit;
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		cursor: default;
	}
	.th-label > span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.th-label.sortable {
		cursor: pointer;
	}
	.th-label.sortable:hover {
		color: var(--text-secondary);
	}
	.th-label.sorted {
		color: var(--accent-primary);
	}

	.resize-handle {
		position: absolute;
		top: 0;
		right: -3px;
		width: 7px;
		height: 100%;
		padding: 0;
		background: transparent;
		border: none;
		cursor: col-resize;
		z-index: 3;
	}
	.resize-handle:hover::after {
		content: '';
		position: absolute;
		top: 20%;
		right: 3px;
		width: 2px;
		height: 60%;
		background: var(--accent-primary);
		border-radius: 1px;
	}

	.tr {
		display: flex;
		width: 100%;
		min-width: min-content;
		text-align: left;
		background: transparent;
		border: none;
		border-bottom: 1px solid var(--border-subtle);
		cursor: pointer;
		transition: background var(--transition-fast);
	}
	.tr:hover {
		background: var(--bg-elevated);
	}
	.tr.selected {
		background: var(--accent-glow);
	}
	.tr.closed {
		opacity: 0.55;
	}

	.td {
		display: flex;
		align-items: center;
		flex-shrink: 0;
		gap: 0.375rem;
		padding: 0.5rem 0.75rem;
		font-size: 0.8125rem;
		color: var(--text-secondary);
		min-width: 0;
		overflow: hidden;
	}
	.td.num {
		justify-content: flex-end;
	}

	.cell-title {
		color: var(--text-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.mono {
		font-family: var(--font-mono);
		font-size: 0.75rem;
	}
	.muted {
		color: var(--text-muted);
	}

	.pill {
		display: inline-flex;
		align-items: center;
		gap: 0.3125rem;
		padding: 0.125rem 0.4375rem;
		border-radius: var(--radius-full);
		background: color-mix(in srgb, var(--c) 12%, transparent);
		color: var(--c);
		font-size: 0.6875rem;
		font-weight: 600;
		white-space: nowrap;
	}
	.pill .dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--c);
	}

	.type {
		display: inline-flex;
		align-items: center;
		gap: 0.3125rem;
		text-transform: capitalize;
	}
	.type :global(svg) {
		opacity: 0.7;
	}

	.assignee {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.assignee.agent {
		color: var(--accent-primary);
		font-family: var(--font-mono);
		font-size: 0.75rem;
	}

	.tags {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		overflow: hidden;
	}
	.tag {
		padding: 0.0625rem 0.3125rem;
		background: var(--bg-elevated);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-xs);
		font-size: 0.625rem;
		color: var(--text-tertiary);
		white-space: nowrap;
	}

	.due {
		font-size: 0.75rem;
		font-weight: 600;
	}
	.due.overdue {
		color: var(--state-blocked);
	}
	.due.soon {
		color: var(--state-in-progress);
	}
	.due.normal {
		color: var(--text-secondary);
	}

	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: 3rem 1rem;
		color: var(--text-tertiary);
		font-size: 0.875rem;
	}
	.create-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.75rem;
		background: var(--accent-glow);
		border: 1px solid color-mix(in srgb, var(--accent-primary) 30%, transparent);
		border-radius: var(--radius-sm);
		color: var(--accent-primary);
		font-family: inherit;
		font-size: 0.8125rem;
		font-weight: 500;
		cursor: pointer;
	}
</style>
