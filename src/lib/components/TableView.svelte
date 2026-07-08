<script lang="ts">
	import type { Issue, TableColumnConfig, TableColumnKey, TableSortState } from '$lib/types';
	import { TABLE_COLUMN_MAP, defaultTableColumns } from '$lib/table-columns';
	import {
		columns as statusColumns,
		getIssueColumn,
		getPriorityConfig,
		getTypeIcon,
		getDueInfo,
		formatMinutes,
		formatTimestamp,
		calculateImpactScore,
		getImpactLevel,
		isAgentAssignee,
		copyToClipboard
	} from '$lib/utils';
	import Icon from './Icon.svelte';

	interface Props {
		issues: Issue[];
		columnConfig: TableColumnConfig[];
		sort: TableSortState | null;
		selectedId: string | null;
		selectedIds: string[];
		onselect: (issue: Issue) => void;
		onselectionchange: (ids: string[]) => void;
		oncolumnschange: (cols: TableColumnConfig[]) => void;
		onsortchange: (sort: TableSortState | null) => void;
		onbulkupdate: (ids: string[], updates: Partial<Issue>) => void;
		onbulkdelete: (ids: string[]) => void;
		onupdate: (id: string, updates: Partial<Issue>) => void;
		oncreate?: () => void;
	}

	let {
		issues,
		columnConfig,
		sort,
		selectedId,
		selectedIds,
		onselect,
		onselectionchange,
		oncolumnschange,
		onsortchange,
		onbulkupdate,
		onbulkdelete,
		onupdate,
		oncreate
	}: Props = $props();

	const PRIORITY_OPTS = [0, 1, 2, 3, 4].map((p) => ({ value: p, label: getPriorityConfig(p).label }));

	const visibleCols = $derived(columnConfig.filter((c) => c.visible));
	// Parent (+page) pre-sorts `issues` by `sort`, so the row order here matches
	// keyboard next/prev navigation. `sort` is used only for the header indicator.
	const rows = $derived(issues);

	// --- Multi-select for bulk actions (shift-click range, ctrl/cmd-click toggle) ---
	// Selection is controlled by the parent so a sibling grid can share it.
	const selectedSet = $derived(new Set(selectedIds));
	let anchorId: string | null = null;

	// Drop selections that scroll out of the current filtered/sorted view.
	$effect(() => {
		const present = new Set(issues.map((i) => i.id));
		if (selectedIds.some((id) => !present.has(id))) {
			onselectionchange(selectedIds.filter((id) => present.has(id)));
		}
	});

	function onRowClick(e: MouseEvent, issue: Issue, index: number) {
		if (e.shiftKey) {
			const anchorIdx = anchorId ? rows.findIndex((r) => r.id === anchorId) : -1;
			if (anchorIdx === -1) {
				onselectionchange([issue.id]);
				anchorId = issue.id;
			} else {
				const [lo, hi] = anchorIdx <= index ? [anchorIdx, index] : [index, anchorIdx];
				const next: string[] = [];
				for (let k = lo; k <= hi; k++) next.push(rows[k].id);
				onselectionchange(next);
			}
			return;
		}
		if (e.metaKey || e.ctrlKey) {
			const next = new Set(selectedIds);
			if (next.has(issue.id)) next.delete(issue.id);
			else next.add(issue.id);
			onselectionchange([...next]);
			anchorId = issue.id;
			return;
		}
		onselectionchange([]);
		anchorId = issue.id;
		onselect(issue);
	}

	function clearSelection() {
		onselectionchange([]);
		anchorId = null;
	}
	function applyBulkStatus(e: Event) {
		const el = e.currentTarget as HTMLSelectElement;
		if (el.value) onbulkupdate(selectedIds, { status: el.value as Issue['status'] });
		el.value = '';
	}
	function applyBulkPriority(e: Event) {
		const el = e.currentTarget as HTMLSelectElement;
		if (el.value !== '') onbulkupdate(selectedIds, { priority: Number(el.value) as Issue['priority'] });
		el.value = '';
	}
	function bulkDelete() {
		if (selectedIds.length === 0) return;
		onbulkdelete(selectedIds);
		clearSelection();
	}

	// --- Copy selected rows (IDs, or full details) in visible order ---
	let copiedKind = $state<'ids' | 'details' | null>(null);
	let copiedTimer: ReturnType<typeof setTimeout> | null = null;

	function selectedInOrder(): Issue[] {
		return rows.filter((r) => selectedSet.has(r.id));
	}

	function flashCopied(kind: 'ids' | 'details') {
		if (copiedTimer) clearTimeout(copiedTimer);
		copiedKind = kind;
		copiedTimer = setTimeout(() => (copiedKind = null), 1500);
	}

	function formatFull(issue: Issue): string {
		const lines = [`${issue.id}  ${issue.title}`];
		const meta = [`status: ${issue.status}`, `priority: ${getPriorityConfig(issue.priority).label}`, `type: ${issue.issue_type}`];
		if (issue.assignee) meta.push(`assignee: ${issue.assignee}`);
		if (issue.labels?.length) meta.push(`labels: ${issue.labels.join(', ')}`);
		lines.push(meta.join('  |  '));
		if (issue.description?.trim()) lines.push('', issue.description.trim());
		return lines.join('\n');
	}

	async function copyIds() {
		const sel = selectedInOrder();
		if (sel.length === 0) return;
		await copyToClipboard(sel.map((i) => i.id).join('\n'));
		flashCopied('ids');
	}

	async function copyDetails() {
		const sel = selectedInOrder();
		if (sel.length === 0) return;
		await copyToClipboard(sel.map(formatFull).join('\n\n---\n\n'));
		flashCopied('details');
	}

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

	// --- Reorder columns by dragging their headers ---
	let dragColKey = $state<string | null>(null);
	let dragOverKey = $state<string | null>(null);

	function startColDrag(e: DragEvent, key: TableColumnKey) {
		// Don't start a column drag from the resize handle.
		if ((e.target as HTMLElement)?.classList.contains('resize-handle')) {
			e.preventDefault();
			return;
		}
		dragColKey = key;
		if (e.dataTransfer) {
			e.dataTransfer.setData('text/plain', key);
			e.dataTransfer.effectAllowed = 'move';
		}
	}
	function onColDragOver(e: DragEvent, key: TableColumnKey) {
		if (!dragColKey || dragColKey === key) return;
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
		dragOverKey = key;
	}
	function onColDrop(e: DragEvent, key: TableColumnKey) {
		e.preventDefault();
		const from = dragColKey;
		dragColKey = null;
		dragOverKey = null;
		if (!from || from === key) return;
		const fromIdx = columnConfig.findIndex((c) => c.key === from);
		const toIdx = columnConfig.findIndex((c) => c.key === key);
		if (fromIdx === -1 || toIdx === -1) return;
		const next = [...columnConfig];
		const [moved] = next.splice(fromIdx, 1);
		next.splice(toIdx, 0, moved);
		oncolumnschange(next);
	}
	function endColDrag() {
		dragColKey = null;
		dragOverKey = null;
	}

	// --- Inline cell editing ---
	type EditableColumn = 'title' | 'status' | 'priority' | 'type' | 'assignee';
	const EDITABLE_COLUMNS: Set<TableColumnKey> = new Set(['title', 'status', 'priority', 'type', 'assignee']);
	const TYPE_OPTS = ['task', 'bug', 'feature', 'epic', 'chore'];

	let editCell = $state<{ issueId: string; column: EditableColumn } | null>(null);
	let editValue = $state<string>('');

	function isEditing(issueId: string, column: TableColumnKey): boolean {
		return editCell?.issueId === issueId && editCell?.column === column;
	}

	function startEdit(issue: Issue, column: EditableColumn) {
		// Get current value based on column
		let value: string;
		switch (column) {
			case 'title':
				value = issue.title;
				break;
			case 'status':
				value = issue.status;
				break;
			case 'priority':
				value = String(issue.priority);
				break;
			case 'type':
				value = issue.issue_type;
				break;
			case 'assignee':
				value = issue.assignee ?? '';
				break;
		}
		editCell = { issueId: issue.id, column };
		editValue = value;
	}

	function cancelEdit() {
		editCell = null;
		editValue = '';
	}

	function commitEdit() {
		if (!editCell) return;
		const issue = issues.find((i) => i.id === editCell!.issueId);
		if (!issue) {
			cancelEdit();
			return;
		}

		let updates: Partial<Issue> = {};
		const col = editCell.column;

		switch (col) {
			case 'title':
				if (editValue.trim() && editValue !== issue.title) {
					updates.title = editValue.trim();
				}
				break;
			case 'status':
				if (editValue !== issue.status) {
					updates.status = editValue as Issue['status'];
				}
				break;
			case 'priority':
				const newPriority = Number(editValue) as Issue['priority'];
				if (newPriority !== issue.priority) {
					updates.priority = newPriority;
				}
				break;
			case 'type':
				if (editValue !== issue.issue_type) {
					updates.issue_type = editValue;
				}
				break;
			case 'assignee':
				const newAssignee = editValue.trim() || undefined;
				if (newAssignee !== issue.assignee) {
					updates.assignee = newAssignee;
				}
				break;
		}

		if (Object.keys(updates).length > 0) {
			onupdate(editCell.issueId, updates);
		}

		cancelEdit();
	}

	function onCellDblClick(e: MouseEvent, issue: Issue, column: TableColumnKey) {
		if (!EDITABLE_COLUMNS.has(column)) return;
		e.stopPropagation();
		startEdit(issue, column as EditableColumn);
	}

	function onEditKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			e.stopPropagation();
			cancelEdit();
		} else if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			e.stopPropagation();
			commitEdit();
		}
	}

	function onEditBlur() {
		// Small delay to allow click on dropdown options to register
		setTimeout(() => {
			if (editCell) commitEdit();
		}, 150);
	}

	function onRowKey(e: KeyboardEvent, issue: Issue) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			// Opening one ticket exits multi-select (mirror onRowClick), otherwise the
			// selection grid would keep preempting the detail panel we just opened.
			onselectionchange([]);
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
				<div
					class="th"
					role="columnheader"
					tabindex="-1"
					style="width: {widthOf(c.key)}px;"
					class:num={def.align === 'right'}
					class:dragging={dragColKey === c.key}
					class:drag-over={dragOverKey === c.key}
					draggable="true"
					ondragstart={(e) => startColDrag(e, c.key)}
					ondragover={(e) => onColDragOver(e, c.key)}
					ondragleave={() => { if (dragOverKey === c.key) dragOverKey = null; }}
					ondrop={(e) => onColDrop(e, c.key)}
					ondragend={endColDrag}
				>
					<button class="th-label" class:sortable={def.sortable} class:sorted={sort?.field === c.key} onclick={() => toggleSort(c.key)}>
						<span>{def.label}</span>
						{#if sort?.field === c.key}
							<Icon name={sort.dir === 'asc' ? 'sort-asc' : 'sort-desc'} size={12} />
						{/if}
					</button>
					<button class="resize-handle" type="button" tabindex="-1" draggable="false" aria-label="Resize {def.label}" onpointerdown={(e) => startResize(e, c.key)}></button>
				</div>
			{/each}
		</div>

		{#if rows.length === 0}
			<div class="empty">
				<p>No issues match the current filters.</p>
				{#if oncreate}<button class="create-btn" onclick={oncreate}><Icon name="plus" size={13} /> New issue</button>{/if}
			</div>
		{:else}
			{#each rows as issue, i (issue.id)}
				<div
					class="tr"
					class:selected={issue.id === selectedId}
					class:bulk-selected={selectedSet.has(issue.id)}
					class:closed={issue.status === 'closed'}
					role="button"
					tabindex="0"
					onclick={(e) => onRowClick(e, issue, i)}
					onkeydown={(e) => onRowKey(e, issue)}
				>
					{#each visibleCols as c (c.key)}
						{@const def = TABLE_COLUMN_MAP[c.key]}
						{@const editable = EDITABLE_COLUMNS.has(c.key)}
						{@const editing = isEditing(issue.id, c.key)}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="td"
							style="width: {widthOf(c.key)}px;"
							class:num={def.align === 'right'}
							class:editable
							class:editing
							ondblclick={(e) => editable && onCellDblClick(e, issue, c.key)}
						>
							{#if c.key === 'seq'}
								<span class="mono muted" title={issue.id}>#{issue.seq}</span>
							{:else if c.key === 'title'}
								{#if editing}
									<input
										type="text"
										class="edit-input"
										bind:value={editValue}
										onkeydown={onEditKeydown}
										onblur={onEditBlur}
										autofocus
									/>
								{:else}
									<span class="cell-title">{issue.title}</span>
								{/if}
							{:else if c.key === 'status'}
								{#if editing}
									<select class="edit-select" bind:value={editValue} onkeydown={onEditKeydown} onblur={onEditBlur} autofocus>
										{#each statusColumns as col (col.status)}
											<option value={col.status}>{col.label}</option>
										{/each}
									</select>
								{:else}
									{@const col = getIssueColumn(issue)}
									<span class="pill" style="--c: {col.accent};"><span class="dot"></span>{col.label}</span>
								{/if}
							{:else if c.key === 'priority'}
								{#if editing}
									<select class="edit-select" bind:value={editValue} onkeydown={onEditKeydown} onblur={onEditBlur} autofocus>
										{#each PRIORITY_OPTS as p (p.value)}
											<option value={p.value}>{p.label}</option>
										{/each}
									</select>
								{:else}
									{@const p = getPriorityConfig(issue.priority)}
									<span class="pill" style="--c: {p.color};"><span class="dot"></span>{p.label}</span>
								{/if}
							{:else if c.key === 'type'}
								{#if editing}
									<select class="edit-select" bind:value={editValue} onkeydown={onEditKeydown} onblur={onEditBlur} autofocus>
										{#each TYPE_OPTS as t (t)}
											<option value={t}>{t}</option>
										{/each}
									</select>
								{:else}
									<span class="type"><Icon name={getTypeIcon(issue.issue_type)} size={12} />{issue.issue_type}</span>
								{/if}
							{:else if c.key === 'assignee'}
								{#if editing}
									<input
										type="text"
										class="edit-input"
										bind:value={editValue}
										onkeydown={onEditKeydown}
										onblur={onEditBlur}
										placeholder="Unassigned"
										autofocus
									/>
								{:else if issue.assignee}
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

	{#if selectedIds.length > 0}
		<div class="bulk-bar">
			<span class="bulk-count">{selectedIds.length} selected</span>
			<div class="bulk-actions">
				<select class="bulk-select" onchange={applyBulkStatus} aria-label="Set status for selected">
					<option value="">Set status…</option>
					{#each statusColumns as c (c.key)}<option value={c.status}>{c.label}</option>{/each}
				</select>
				<select class="bulk-select" onchange={applyBulkPriority} aria-label="Set priority for selected">
					<option value="">Set priority…</option>
					{#each PRIORITY_OPTS as p (p.value)}<option value={p.value}>{p.label}</option>{/each}
				</select>
				<button class="bulk-btn" onclick={copyIds} title="Copy selected IDs">
					<Icon name={copiedKind === 'ids' ? 'check' : 'copy'} size={13} /> {copiedKind === 'ids' ? 'Copied' : 'IDs'}
				</button>
				<button class="bulk-btn" onclick={copyDetails} title="Copy selected issue details">
					<Icon name={copiedKind === 'details' ? 'check' : 'copy'} size={13} /> {copiedKind === 'details' ? 'Copied' : 'Details'}
				</button>
				<button class="bulk-btn danger" onclick={bulkDelete}><Icon name="trash" size={13} /> Delete</button>
				<button class="bulk-btn" onclick={clearSelection}>Clear</button>
			</div>
		</div>
	{/if}
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
		cursor: grab;
	}
	.th:active {
		cursor: grabbing;
	}
	.th.num {
		justify-content: flex-end;
	}
	.th.dragging {
		opacity: 0.4;
	}
	.th.drag-over {
		box-shadow: inset 2px 0 0 var(--accent-primary);
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
		user-select: none;
		transition: background var(--transition-fast);
	}
	.tr:hover {
		background: var(--bg-elevated);
	}
	.tr.bulk-selected {
		background: color-mix(in srgb, var(--accent-primary) 14%, transparent);
		box-shadow: inset 2px 0 0 var(--accent-primary);
	}
	.tr.selected {
		background: var(--accent-glow);
	}
	.tr.bulk-selected.selected {
		background: color-mix(in srgb, var(--accent-primary) 20%, transparent);
	}
	.tr.closed {
		opacity: 0.55;
	}

	.bulk-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		flex-wrap: wrap;
		flex-shrink: 0;
		padding: 0.5rem 0.75rem;
		border-top: 1px solid var(--border-default);
		background: var(--surface-elevated);
	}
	.bulk-count {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-primary);
	}
	.bulk-actions {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		flex-wrap: wrap;
	}
	.bulk-select {
		height: 1.75rem;
		padding: 0 0.375rem;
		background: var(--bg-elevated);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-xs);
		color: var(--text-secondary);
		font-family: inherit;
		font-size: 0.75rem;
		cursor: pointer;
	}
	.bulk-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		height: 1.75rem;
		padding: 0 0.5rem;
		background: var(--bg-elevated);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-xs);
		color: var(--text-secondary);
		font-family: inherit;
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		transition: background var(--transition-fast), color var(--transition-fast);
	}
	.bulk-btn:hover {
		background: var(--surface-elevated);
		color: var(--text-primary);
	}
	.bulk-btn.danger:hover {
		background: color-mix(in srgb, var(--state-blocked) 15%, transparent);
		color: var(--state-blocked);
		border-color: color-mix(in srgb, var(--state-blocked) 40%, transparent);
	}

	.td {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.5rem 0.75rem;
		font-size: 0.8125rem;
		color: var(--text-secondary);
		flex-shrink: 0;
		overflow: hidden;
	}
	.td.num {
		justify-content: flex-end;
	}
	.td.editable {
		cursor: default;
	}
	.td.editable:hover:not(.editing) {
		background: var(--bg-elevated);
	}
	.td.editing {
		padding: 0.25rem 0.375rem;
	}

	.edit-input,
	.edit-select {
		width: 100%;
		height: 1.75rem;
		padding: 0 0.5rem;
		background: var(--surface-panel);
		border: 1px solid var(--accent-primary);
		border-radius: var(--radius-xs);
		color: var(--text-primary);
		font-family: inherit;
		font-size: 0.8125rem;
		outline: none;
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-primary) 20%, transparent);
	}
	.edit-input::placeholder {
		color: var(--text-muted);
	}
	.edit-select {
		cursor: pointer;
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
