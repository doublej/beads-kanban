import { MarkerType, type Node, type Edge } from '@xyflow/svelte';
import type { Issue } from '$lib/types';
import { columns, getPriorityConfig } from '$lib/utils';
import type { FlowLayout, GroupDim } from './flow-context';

// Shared geometry.
const X_GAP = 300;
const Y_GAP = 128;
const ISO_GAP = 64;
const NODE_H = 96;
const GROUP_PAD_X = 20;
const GROUP_HEAD = 44;
const GROUP_PAD_BOTTOM = 20;
const GROUP_W = 240 + GROUP_PAD_X * 2;
const GROUP_GAP = 56;

const PALETTE = [
	'#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6',
	'#06b6d4', '#ec4899', '#84cc16', '#f97316', '#14b8a6'
];
const paletteColor = (i: number) => PALETTE[i % PALETTE.length];
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

interface OrderedGroup {
	key: string;
	label: string;
	color: string;
	ids: string[];
}

/** Build the topology (edges) once — independent of the chosen layout. */
function buildEdges(list: Issue[]): { directed: { source: string; target: string }[]; edges: Edge[] } {
	const idSet = new Set(list.map((i) => i.id));
	const directed: { source: string; target: string }[] = [];
	const related: { source: string; target: string; type: string }[] = [];
	const relatedSeen = new Set<string>();

	for (const issue of list) {
		for (const dep of issue.dependencies ?? []) {
			if (!idSet.has(dep.id) || dep.id === issue.id) continue;
			if (dep.dependency_type === 'blocks') {
				directed.push({ source: dep.id, target: issue.id });
			} else {
				const key = [issue.id, dep.id].sort().join('~') + ':' + dep.dependency_type;
				if (relatedSeen.has(key)) continue;
				relatedSeen.add(key);
				related.push({ source: dep.id, target: issue.id, type: dep.dependency_type });
			}
		}
	}

	const edges: Edge[] = [
		...directed.map((e) => ({
			id: `b-${e.source}-${e.target}`,
			source: e.source,
			target: e.target,
			markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: '#7c8496' },
			style: 'stroke: #7c8496; stroke-width: 1.5;'
		})),
		...related.map((e) => ({
			id: `r-${e.source}-${e.target}-${e.type}`,
			source: e.source,
			target: e.target,
			style: 'stroke: #3b82f6; stroke-width: 1.25; stroke-dasharray: 4 4; opacity: 0.7;'
		}))
	];

	return { directed, edges };
}

/** Longest-path layering over the directed (blocks) subgraph (Kahn). */
function computeLayers(ids: Set<string>, edges: { source: string; target: string }[]): Map<string, number> {
	const adj = new Map<string, string[]>();
	const indeg = new Map<string, number>();
	for (const id of ids) {
		adj.set(id, []);
		indeg.set(id, 0);
	}
	for (const e of edges) {
		adj.get(e.source)!.push(e.target);
		indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
	}
	const layer = new Map<string, number>();
	const queue: string[] = [];
	for (const id of ids) {
		if ((indeg.get(id) ?? 0) === 0) {
			layer.set(id, 0);
			queue.push(id);
		}
	}
	while (queue.length) {
		const n = queue.shift()!;
		const ln = layer.get(n) ?? 0;
		for (const m of adj.get(n) ?? []) {
			layer.set(m, Math.max(layer.get(m) ?? 0, ln + 1));
			indeg.set(m, (indeg.get(m) ?? 0) - 1);
			if ((indeg.get(m) ?? 0) === 0) queue.push(m);
		}
	}
	for (const id of ids) if (!layer.has(id)) layer.set(id, 0);
	return layer;
}

/** Dependency layout: longest-path layered LR graph with isolated nodes below. */
function depsNodes(list: Issue[], directed: { source: string; target: string }[]): Node[] {
	const seqOf = new Map(list.map((i) => [i.id, i.seq]));
	const connected = new Set<string>();
	for (const e of directed) {
		connected.add(e.source);
		connected.add(e.target);
	}

	const layer = computeLayers(connected, directed);
	const byLayer = new Map<number, string[]>();
	let maxLayer = 0;
	for (const id of connected) {
		const l = layer.get(id) ?? 0;
		maxLayer = Math.max(maxLayer, l);
		if (!byLayer.has(l)) byLayer.set(l, []);
		byLayer.get(l)!.push(id);
	}

	const pos = new Map<string, { x: number; y: number }>();
	let maxRows = 0;
	for (const [l, colIds] of byLayer) {
		colIds.sort((a, b) => (seqOf.get(a) ?? 0) - (seqOf.get(b) ?? 0));
		maxRows = Math.max(maxRows, colIds.length);
		colIds.forEach((id, row) => pos.set(id, { x: l * X_GAP, y: row * Y_GAP }));
	}

	const isolated = list.filter((i) => !connected.has(i.id)).sort((a, b) => a.seq - b.seq);
	const perRow = Math.max(4, maxLayer + 1);
	const isoTop = connected.size ? maxRows * Y_GAP + ISO_GAP : 0;
	isolated.forEach((iss, idx) => {
		pos.set(iss.id, {
			x: (idx % perRow) * X_GAP,
			y: isoTop + Math.floor(idx / perRow) * Y_GAP
		});
	});

	return list.map((issue) => ({
		id: issue.id,
		type: 'ticket',
		position: pos.get(issue.id) ?? { x: 0, y: 0 },
		data: { issueId: issue.id }
	}));
}

/** Turn ordered buckets into a row of labelled group containers + child ticket nodes. */
function columnNodes(groups: OrderedGroup[]): Node[] {
	const parents: Node[] = [];
	const children: Node[] = [];
	let x = 0;
	for (const g of groups) {
		if (g.ids.length === 0) continue;
		const count = g.ids.length;
		const height = GROUP_HEAD + (count - 1) * Y_GAP + NODE_H + GROUP_PAD_BOTTOM;
		const groupId = `group-${g.key}`;
		parents.push({
			id: groupId,
			type: 'group',
			position: { x, y: 0 },
			width: GROUP_W,
			height,
			draggable: false,
			selectable: false,
			zIndex: 0,
			data: { label: g.label, count, color: g.color, width: GROUP_W, height }
		});
		g.ids.forEach((id, row) => {
			children.push({
				id,
				type: 'ticket',
				parentId: groupId,
				extent: 'parent',
				position: { x: GROUP_PAD_X, y: GROUP_HEAD + row * Y_GAP },
				zIndex: 1,
				data: { issueId: id }
			});
		});
		x += GROUP_W + GROUP_GAP;
	}
	// Parents must precede their children in the node array.
	return [...parents, ...children];
}

/** Order issues within a column: highest priority first, then by seq. */
const byPriorityThenSeq = (a: Issue, b: Issue) => a.priority - b.priority || a.seq - b.seq;

/** Cluster issues by the chosen dimension into ordered, coloured buckets. */
function dimGroups(list: Issue[], dim: GroupDim): OrderedGroup[] {
	const map = new Map<string, Issue[]>();
	const put = (key: string, iss: Issue) => {
		const arr = map.get(key);
		if (arr) arr.push(iss);
		else map.set(key, [iss]);
	};

	const keyOf = (iss: Issue): string => {
		switch (dim) {
			case 'status': return iss.status;
			case 'priority': return String(iss.priority);
			case 'type': return iss.issue_type || 'untyped';
			case 'assignee': return iss.assignee || '__unassigned';
			case 'label': return (iss.labels?.slice().sort()[0]) ?? '__untagged';
		}
	};
	for (const iss of list) put(keyOf(iss), iss);

	const toGroup = (key: string, label: string, color: string): OrderedGroup => ({
		key,
		label,
		color,
		ids: (map.get(key) ?? []).slice().sort(byPriorityThenSeq).map((i) => i.id)
	});

	// Fixed-order dimensions.
	if (dim === 'status') {
		return columns.filter((c) => map.has(c.status)).map((c) => toGroup(c.status, c.label, c.accent));
	}
	if (dim === 'priority') {
		return [0, 1, 2, 3, 4]
			.map(String)
			.filter((k) => map.has(k))
			.map((k) => {
				const cfg = getPriorityConfig(Number(k));
				return toGroup(k, cfg.label, cfg.color);
			});
	}

	// Dynamic dimensions: most-populous first; the "none" bucket sinks to the end.
	const noneKey = dim === 'assignee' ? '__unassigned' : dim === 'label' ? '__untagged' : null;
	const keys = [...map.keys()].sort((a, b) => {
		if (a === noneKey) return 1;
		if (b === noneKey) return -1;
		return map.get(b)!.length - map.get(a)!.length;
	});
	return keys.map((k, i) => {
		const label = k === '__unassigned' ? 'Unassigned' : k === '__untagged' ? 'Untagged' : cap(k);
		const color = k === noneKey ? '#475569' : paletteColor(i);
		return toGroup(k, label, color);
	});
}

const DAY_MS = 24 * 60 * 60 * 1000;
const AGE_BUCKETS: { key: string; label: string; color: string }[] = [
	{ key: 'older', label: 'Older', color: '#475569' },
	{ key: 'quarter', label: 'This quarter', color: '#3b82f6' },
	{ key: 'month', label: 'This month', color: '#6366f1' },
	{ key: 'week', label: 'This week', color: '#f59e0b' },
	{ key: 'today', label: 'Today', color: '#10b981' },
	{ key: 'undated', label: 'Undated', color: '#334155' }
];

function ageKey(iss: Issue): string {
	if (!iss.created_at) return 'undated';
	const created = new Date(iss.created_at);
	const now = new Date();
	const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	if (created >= startOfToday) return 'today';
	const days = (now.getTime() - created.getTime()) / DAY_MS;
	if (days <= 7) return 'week';
	if (days <= 30) return 'month';
	if (days <= 90) return 'quarter';
	return 'older';
}

/** Timeline layout: buckets by creation age, oldest → newest left-to-right. */
function ageGroups(list: Issue[]): OrderedGroup[] {
	const map = new Map<string, Issue[]>();
	for (const iss of list) {
		const k = ageKey(iss);
		const arr = map.get(k);
		if (arr) arr.push(iss);
		else map.set(k, [iss]);
	}
	const byCreatedDesc = (a: Issue, b: Issue) =>
		new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
	return AGE_BUCKETS.filter((b) => map.has(b.key)).map((b) => ({
		key: b.key,
		label: b.label,
		color: b.color,
		ids: (map.get(b.key) ?? []).slice().sort(byCreatedDesc).map((i) => i.id)
	}));
}

/** Build nodes + edges for the requested layout. Edges are constant across layouts. */
export function buildFlow(
	list: Issue[],
	layout: FlowLayout,
	groupDim: GroupDim
): { nodes: Node[]; edges: Edge[] } {
	const { directed, edges } = buildEdges(list);
	if (layout === 'deps') return { nodes: depsNodes(list, directed), edges };
	const groups = layout === 'timeline' ? ageGroups(list) : dimGroups(list, groupDim);
	return { nodes: columnNodes(groups), edges };
}
