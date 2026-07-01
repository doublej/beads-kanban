<script lang="ts">
	import {
		SvelteFlow,
		Background,
		Controls,
		MiniMap,
		MarkerType,
		type Node,
		type Edge,
		type ColorMode
	} from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import { setContext } from 'svelte';
	import type { Issue } from '$lib/types';
	import { getIssueColumn } from '$lib/utils';
	import TicketNode from './TicketNode.svelte';
	import { FLOW_CTX, type FlowContext } from './flow-context';

	interface Props {
		issues: Issue[];
		selectedId?: string | null;
		isDark?: boolean;
		onselect?: (issue: Issue) => void;
	}

	let { issues, selectedId = null, isDark = true, onselect }: Props = $props();

	const issueMap = $derived(new Map(issues.map((i) => [i.id, i])));

	setContext<FlowContext>(FLOW_CTX, {
		getIssue: (id) => issueMap.get(id),
		getSelectedId: () => selectedId
	});

	const nodeTypes = { ticket: TicketNode };

	// Layout constants (LR layered graph).
	const X_GAP = 300;
	const Y_GAP = 128;
	const ISO_GAP = 64;

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
		// Nodes trapped in a dependency cycle never drain to 0 — anchor them at layer 0.
		for (const id of ids) if (!layer.has(id)) layer.set(id, 0);
		return layer;
	}

	function buildGraph(list: Issue[]): { nodes: Node[]; edges: Edge[] } {
		const idSet = new Set(list.map((i) => i.id));
		const seqOf = new Map(list.map((i) => [i.id, i.seq]));

		const directed: { source: string; target: string }[] = [];
		const related: { source: string; target: string; type: string }[] = [];
		const relatedSeen = new Set<string>();

		for (const issue of list) {
			for (const dep of issue.dependencies ?? []) {
				if (!idSet.has(dep.id) || dep.id === issue.id) continue;
				if (dep.dependency_type === 'blocks') {
					// dep.id must be done before issue.id → arrow points at the dependent.
					directed.push({ source: dep.id, target: issue.id });
				} else {
					const key = [issue.id, dep.id].sort().join('~') + ':' + dep.dependency_type;
					if (relatedSeen.has(key)) continue;
					relatedSeen.add(key);
					related.push({ source: dep.id, target: issue.id, type: dep.dependency_type });
				}
			}
		}

		const connected = new Set<string>();
		for (const e of directed) {
			connected.add(e.source);
			connected.add(e.target);
		}

		const layer = computeLayers(connected, directed);

		// Bucket connected nodes by layer, ordered by seq within each layer.
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

		// Isolated nodes (no blocks edges) → compact grid below the graph.
		const isolated = list.filter((i) => !connected.has(i.id)).sort((a, b) => a.seq - b.seq);
		const perRow = Math.max(4, maxLayer + 1);
		const isoTop = connected.size ? maxRows * Y_GAP + ISO_GAP : 0;
		isolated.forEach((iss, idx) => {
			pos.set(iss.id, {
				x: (idx % perRow) * X_GAP,
				y: isoTop + Math.floor(idx / perRow) * Y_GAP
			});
		});

		const nodes: Node[] = list.map((issue) => ({
			id: issue.id,
			type: 'ticket',
			position: pos.get(issue.id) ?? { x: 0, y: 0 },
			data: { issueId: issue.id }
		}));

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

		return { nodes, edges };
	}

	// Rebuild layout only when the graph topology changes; status/priority/title
	// edits flow through the reactive context without disturbing node positions.
	const topoSig = $derived(
		issues
			.map(
				(i) =>
					`${i.id}#${(i.dependencies ?? [])
						.map((d) => `${d.id}:${d.dependency_type}`)
						.sort()
						.join(',')}`
			)
			.sort()
			.join('|')
	);

	let nodes = $state.raw<Node[]>([]);
	let edges = $state.raw<Edge[]>([]);
	let lastSig = '';

	$effect(() => {
		const sig = topoSig;
		if (sig === lastSig) return;
		lastSig = sig;
		const built = buildGraph(issues);
		nodes = built.nodes;
		edges = built.edges;
	});

	function handleNodeClick({ node }: { node: Node }) {
		const issue = issueMap.get(node.id);
		if (issue) onselect?.(issue);
	}

	const colorMode: ColorMode = $derived(isDark ? 'dark' : 'light');
</script>

<div class="flow-wrap">
	{#if issues.length === 0}
		<div class="flow-empty">No tickets to graph</div>
	{:else}
		<SvelteFlow
			bind:nodes
			bind:edges
			{nodeTypes}
			{colorMode}
			onnodeclick={handleNodeClick}
			nodesConnectable={false}
			minZoom={0.1}
			fitView
		>
			<Background gap={20} />
			<Controls showLock={false} />
			<MiniMap pannable zoomable />
		</SvelteFlow>
	{/if}
</div>

<style>
	.flow-wrap {
		flex: 1;
		min-width: 0;
		min-height: 0;
		position: relative;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		overflow: hidden;
		background: var(--surface-base, var(--surface-panel));
	}

	.flow-empty {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-tertiary);
		font-size: 0.8125rem;
	}

	/* Match app chrome to the design tokens. */
	.flow-wrap :global(.svelte-flow) {
		background: transparent;
	}

	.flow-wrap :global(.svelte-flow__controls-button) {
		background: var(--surface-panel);
		border-bottom: 1px solid var(--border-subtle);
		color: var(--text-secondary);
		fill: var(--text-secondary);
	}

	.flow-wrap :global(.svelte-flow__controls-button:hover) {
		background: var(--surface-elevated);
	}

	.flow-wrap :global(.svelte-flow__minimap) {
		background: var(--surface-panel);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
	}
</style>
