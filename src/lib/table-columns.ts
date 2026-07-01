import type { TableColumnKey, TableColumnConfig } from './types';

export interface TableColumnDef {
	key: TableColumnKey;
	label: string;
	sortable: boolean;
	defaultWidth: number;
	align: 'left' | 'right' | 'center';
	defaultVisible: boolean;
}

/** Registry of every column the table view can render, in default order. */
export const TABLE_COLUMNS: TableColumnDef[] = [
	{ key: 'seq', label: 'ID', sortable: true, defaultWidth: 64, align: 'left', defaultVisible: true },
	{ key: 'title', label: 'Title', sortable: true, defaultWidth: 380, align: 'left', defaultVisible: true },
	{ key: 'status', label: 'Status', sortable: true, defaultWidth: 130, align: 'left', defaultVisible: true },
	{ key: 'priority', label: 'Priority', sortable: true, defaultWidth: 110, align: 'left', defaultVisible: true },
	{ key: 'type', label: 'Type', sortable: true, defaultWidth: 110, align: 'left', defaultVisible: true },
	{ key: 'assignee', label: 'Assignee', sortable: true, defaultWidth: 150, align: 'left', defaultVisible: true },
	{ key: 'labels', label: 'Labels', sortable: true, defaultWidth: 220, align: 'left', defaultVisible: false },
	{ key: 'due', label: 'Due', sortable: true, defaultWidth: 100, align: 'left', defaultVisible: false },
	{ key: 'estimate', label: 'Estimate', sortable: true, defaultWidth: 100, align: 'right', defaultVisible: false },
	{ key: 'dependents', label: 'Blocks', sortable: true, defaultWidth: 80, align: 'right', defaultVisible: false },
	{ key: 'impact', label: 'Impact', sortable: true, defaultWidth: 100, align: 'right', defaultVisible: false },
	{ key: 'created', label: 'Created', sortable: true, defaultWidth: 110, align: 'left', defaultVisible: false },
	{ key: 'updated', label: 'Updated', sortable: true, defaultWidth: 110, align: 'left', defaultVisible: true }
];

export const TABLE_COLUMN_MAP = Object.fromEntries(
	TABLE_COLUMNS.map((c) => [c.key, c])
) as Record<TableColumnKey, TableColumnDef>;

export function defaultTableColumns(): TableColumnConfig[] {
	return TABLE_COLUMNS.map((c) => ({ key: c.key, visible: c.defaultVisible, width: c.defaultWidth }));
}

/**
 * Merge a persisted config with the current registry: drop unknown/duplicate
 * keys and append columns added to the registry after the config was saved.
 * Guarantees every registry column appears exactly once.
 */
export function reconcileTableColumns(saved: TableColumnConfig[] | undefined | null): TableColumnConfig[] {
	if (!saved || saved.length === 0) return defaultTableColumns();
	const seen = new Set<TableColumnKey>();
	const out: TableColumnConfig[] = [];
	for (const col of saved) {
		const def = TABLE_COLUMN_MAP[col.key];
		if (!def || seen.has(col.key)) continue;
		seen.add(col.key);
		out.push({ key: col.key, visible: col.visible, width: col.width ?? def.defaultWidth });
	}
	for (const c of TABLE_COLUMNS) {
		if (!seen.has(c.key)) out.push({ key: c.key, visible: c.defaultVisible, width: c.defaultWidth });
	}
	return out;
}
