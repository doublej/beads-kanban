<script lang="ts">
	import type { Issue } from '$lib/types';
	import { getPriorityConfig } from '$lib/utils';

	interface Props {
		issues: Issue[];
		selectedId: string | null;
		onselect: (issue: Issue) => void;
	}

	let { issues, selectedId, onselect }: Props = $props();

	interface Node {
		id: string;
		title: string;
		status: string;
		priority: number;
		level: number;
		deps: string[];
	}

	const graph = $derived.by(() => {
		const nodes = new Map<string, Node>();
		const edges: [string, string][] = [];

		for (const issue of issues) {
			nodes.set(issue.id, {
				id: issue.id,
				title: issue.title.slice(0, 24) + (issue.title.length > 24 ? '...' : ''),
				status: issue.status,
				priority: issue.priority,
				level: 0,
				deps: []
			});
		}

		for (const issue of issues) {
			for (const dep of issue.dependencies || []) {
				if (dep.dependency_type === 'blocks' && nodes.has(dep.id)) {
					edges.push([dep.id, issue.id]);
					nodes.get(issue.id)!.deps.push(dep.id);
				}
			}
		}

		// Topological sort to assign levels
		const visited = new Set<string>();
		const levels = new Map<string, number>();

		function getLevel(id: string): number {
			if (levels.has(id)) return levels.get(id)!;
			if (visited.has(id)) return 0;
			visited.add(id);
			const node = nodes.get(id);
			if (!node || node.deps.length === 0) {
				levels.set(id, 0);
				return 0;
			}
			const maxDep = Math.max(...node.deps.map(d => getLevel(d)));
			levels.set(id, maxDep + 1);
			return maxDep + 1;
		}

		for (const id of nodes.keys()) getLevel(id);
		for (const [id, level] of levels) {
			const node = nodes.get(id);
			if (node) node.level = level;
		}

		return { nodes: [...nodes.values()], edges };
	});

	const ascii = $derived.by(() => {
		const { nodes, edges } = graph;
		if (nodes.length === 0) return '  No issues with dependencies';

		const levels = new Map<number, Node[]>();
		for (const n of nodes) {
			if (!levels.has(n.level)) levels.set(n.level, []);
			levels.get(n.level)!.push(n);
		}

		const maxLevel = Math.max(...levels.keys(), 0);
		const lines: string[] = [];
		const nodePositions = new Map<string, { row: number; col: number }>();

		// Build the ASCII graph
		for (let lvl = 0; lvl <= maxLevel; lvl++) {
			const levelNodes = levels.get(lvl) || [];
			levelNodes.sort((a, b) => a.priority - b.priority);

			if (lvl > 0) {
				// Draw connection lines
				const connLine = levelNodes.map((n, i) => {
					const hasIncoming = n.deps.length > 0;
					return hasIncoming ? '     │     ' : '           ';
				}).join('  ');
				lines.push(connLine);
				const arrowLine = levelNodes.map((n) => {
					const hasIncoming = n.deps.length > 0;
					return hasIncoming ? '     ▼     ' : '           ';
				}).join('  ');
				lines.push(arrowLine);
			}

			// Draw nodes
			const row = lines.length;
			const nodeLine = levelNodes.map((n, i) => {
				const statusChar = { open: '○', in_progress: '◐', hooked: '◑', blocked: '◉', closed: '●' }[n.status] || '○';
				const box = `[${statusChar} #${n.id.slice(0, 4)}]`;
				nodePositions.set(n.id, { row, col: i });
				return box.padEnd(11);
			}).join('  ');
			lines.push(nodeLine);

			// Draw titles
			const titleLine = levelNodes.map((n) => {
				return n.title.slice(0, 11).padEnd(11);
			}).join('  ');
			lines.push(titleLine);
		}

		return lines.join('\n');
	});

	const statusColors: Record<string, string> = {
		open: '#6366f1',
		in_progress: '#f59e0b',
		hooked: '#8b5cf6',
		blocked: '#ef4444',
		closed: '#10b981'
	};
</script>

<div class="graph-view">
	<div class="graph-header">
		<span class="graph-count">{graph.nodes.length} nodes, {graph.edges.length} edges</span>
	</div>

	<div class="graph-content">
		<pre class="ascii-graph">{ascii}</pre>

		<div class="graph-legend">
			<span class="legend-title">Legend:</span>
			<span class="legend-item"><span class="legend-icon">○</span> Open</span>
			<span class="legend-item"><span class="legend-icon">◐</span> In Progress</span>
			<span class="legend-item"><span class="legend-icon">◑</span> Hooked</span>
			<span class="legend-item"><span class="legend-icon">◉</span> Blocked</span>
			<span class="legend-item"><span class="legend-icon">●</span> Closed</span>
			<span class="legend-item"><span class="legend-arrow">│▼</span> Blocks</span>
		</div>
	</div>

	<div class="graph-list">
		<div class="list-title">All Dependencies</div>
		{#each graph.edges as [from, to]}
			{@const fromIssue = issues.find(i => i.id === from)}
			{@const toIssue = issues.find(i => i.id === to)}
			{#if fromIssue && toIssue}
				<div class="dep-row">
					<button
						class="dep-node"
						class:selected={selectedId === from}
						onclick={() => onselect(fromIssue)}
						style="--status-color: {statusColors[fromIssue.status]}"
					>
						<span class="dep-id">#{from}</span>
						<span class="dep-title">{fromIssue.title.slice(0, 20)}</span>
					</button>
					<span class="dep-arrow">→</span>
					<button
						class="dep-node"
						class:selected={selectedId === to}
						onclick={() => onselect(toIssue)}
						style="--status-color: {statusColors[toIssue.status]}"
					>
						<span class="dep-id">#{to}</span>
						<span class="dep-title">{toIssue.title.slice(0, 20)}</span>
					</button>
				</div>
			{/if}
		{/each}
		{#if graph.edges.length === 0}
			<div class="empty-state">No blocking dependencies found</div>
		{/if}
	</div>
</div>

<style>
	.graph-view {
		flex: 1;
		display: flex;
		flex-direction: column;
		padding: 1rem 1.5rem;
		overflow: hidden;
		gap: 1rem;
	}

	.graph-header {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	}

	.graph-count {
		font-size: 0.75rem;
		color: var(--text-tertiary);
	}

	.graph-content {
		background: rgba(0, 0, 0, 0.2);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: var(--radius-md);
		padding: 1.5rem;
		overflow: auto;
	}

	.ascii-graph {
		font-family: 'IBM Plex Mono', ui-monospace, monospace;
		font-size: 0.8125rem;
		line-height: 1.4;
		color: var(--text-secondary);
		margin: 0;
		white-space: pre;
		overflow-x: auto;
	}

	.graph-legend {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		margin-top: 1.5rem;
		padding-top: 1rem;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
		font-size: 0.75rem;
		color: var(--text-tertiary);
	}

	.legend-title {
		font-weight: 600;
		color: var(--text-secondary);
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	.legend-icon {
		font-family: 'IBM Plex Mono', monospace;
	}

	.legend-arrow {
		font-family: 'IBM Plex Mono', monospace;
		letter-spacing: -0.2em;
	}

	.graph-list {
		flex: 1;
		overflow-y: auto;
	}

	.list-title {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--text-secondary);
		margin-bottom: 0.75rem;
	}

	.dep-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.375rem;
	}

	.dep-node {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.25rem 0.5rem;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-left: 2px solid var(--status-color);
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		font-size: 0.75rem;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.dep-node:hover {
		background: rgba(255, 255, 255, 0.06);
		color: var(--text-primary);
	}

	.dep-node.selected {
		background: rgba(99, 102, 241, 0.15);
		border-color: rgba(99, 102, 241, 0.3);
	}

	.dep-id {
		font-family: 'IBM Plex Mono', monospace;
		color: var(--text-tertiary);
	}

	.dep-title {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 150px;
	}

	.dep-arrow {
		color: var(--text-tertiary);
		font-size: 0.875rem;
	}

	.empty-state {
		padding: 1rem;
		text-align: center;
		color: var(--text-tertiary);
		font-size: 0.8125rem;
	}
</style>
