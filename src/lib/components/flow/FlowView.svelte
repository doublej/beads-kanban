<script lang="ts">
	import {
		SvelteFlow,
		Background,
		Controls,
		MiniMap,
		type Node,
		type Edge,
		type ColorMode
	} from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import { setContext } from 'svelte';
	import type { Issue } from '$lib/types';
	import TicketNode from './TicketNode.svelte';
	import GroupNode from './GroupNode.svelte';
	import FlowControls from './FlowControls.svelte';
	import { buildFlow } from './flow-layout';
	import { FLOW_CTX, type FlowContext, type FlowLayout, type GroupDim } from './flow-context';

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

	const nodeTypes = { ticket: TicketNode, group: GroupNode };

	let layout = $state<FlowLayout>('deps');
	let groupDim = $state<GroupDim>('label');

	// In 'deps' mode node positions depend only on topology, so status/title edits
	// don't disturb the graph. Grouped/timeline layouts also key on the grouping
	// field so re-clustering happens when an issue's label/status/etc. changes.
	const buildSig = $derived.by(() => {
		const topo = issues
			.map(
				(i) =>
					`${i.id}#${(i.dependencies ?? [])
						.map((d) => `${d.id}:${d.dependency_type}`)
						.sort()
						.join(',')}`
			)
			.sort()
			.join('|');
		if (layout === 'deps') return `deps|${topo}`;
		const field =
			layout === 'timeline'
				? issues.map((i) => `${i.id}:${i.created_at ?? ''}`).sort().join(',')
				: issues.map((i) => `${i.id}:${clusterField(i)}`).sort().join(',');
		return `${layout}:${groupDim}|${topo}|${field}`;
	});

	function clusterField(i: Issue): string {
		switch (groupDim) {
			case 'status': return i.status;
			case 'priority': return String(i.priority);
			case 'type': return i.issue_type;
			case 'assignee': return i.assignee ?? '';
			case 'label': return (i.labels ?? []).slice().sort().join('+');
		}
	}

	let nodes = $state.raw<Node[]>([]);
	let edges = $state.raw<Edge[]>([]);
	let lastSig = '';

	$effect(() => {
		const sig = buildSig;
		if (sig === lastSig) return;
		lastSig = sig;
		const built = buildFlow(issues, layout, groupDim);
		nodes = built.nodes;
		edges = built.edges;
	});

	function handleNodeClick({ node }: { node: Node }) {
		if (node.type === 'group') return;
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
			<FlowControls
				{layout}
				{groupDim}
				layoutSig={buildSig}
				onlayout={(l) => (layout = l)}
				ondim={(d) => (groupDim = d)}
			/>
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
