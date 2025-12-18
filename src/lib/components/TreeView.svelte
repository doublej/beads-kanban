<script lang="ts">
	import type { Issue } from '$lib/types';
	import { getPriorityConfig, getTypeIcon, formatTimestamp } from '$lib/utils';

	interface Props {
		issues: Issue[];
		selectedId: string | null;
		onselect: (issue: Issue) => void;
		oncreate?: () => void;
	}

	let { issues, selectedId, onselect, oncreate }: Props = $props();
	let expandedIds = $state<Set<string>>(new Set());

	interface TreeNode {
		issue: Issue;
		children: TreeNode[];
		depth: number;
	}

	const tree = $derived.by(() => {
		const childMap = new Map<string, string[]>();
		const hasParent = new Set<string>();

		for (const issue of issues) {
			const deps = issue.dependents || [];
			for (const dep of deps) {
				if (dep.dependency_type === 'parent-child' || dep.dependency_type === 'blocks') {
					if (!childMap.has(issue.id)) childMap.set(issue.id, []);
					childMap.get(issue.id)!.push(dep.id);
					hasParent.add(dep.id);
				}
			}
		}

		const issueMap = new Map(issues.map(i => [i.id, i]));

		function buildNode(id: string, depth: number, visited: Set<string>): TreeNode | null {
			if (visited.has(id)) return null;
			const issue = issueMap.get(id);
			if (!issue) return null;
			visited.add(id);
			const childIds = childMap.get(id) || [];
			const children = childIds
				.map(cid => buildNode(cid, depth + 1, visited))
				.filter((n): n is TreeNode => n !== null);
			return { issue, children, depth };
		}

		const roots: TreeNode[] = [];
		for (const issue of issues) {
			if (!hasParent.has(issue.id)) {
				const node = buildNode(issue.id, 0, new Set());
				if (node) roots.push(node);
			}
		}
		return roots.sort((a, b) => a.issue.priority - b.issue.priority);
	});

	function toggle(id: string) {
		if (expandedIds.has(id)) expandedIds.delete(id);
		else expandedIds.add(id);
		expandedIds = new Set(expandedIds);
	}

	const statusIcons: Record<string, string> = {
		open: '○', in_progress: '◐', blocked: '◉', closed: '●'
	};
</script>

{#snippet node(n: TreeNode)}
	{@const p = getPriorityConfig(n.issue.priority)}
	{@const ts = formatTimestamp(n.issue.created_at)}
	{@const hasChildren = n.children.length > 0}
	{@const isExpanded = expandedIds.has(n.issue.id)}
	<div class="tree-node" style="--depth: {n.depth}">
		<div
			class="tree-row"
			class:selected={selectedId === n.issue.id}
			class:closed={n.issue.status === 'closed'}
			role="button"
			tabindex="0"
			onclick={() => onselect(n.issue)}
			onkeydown={(e) => e.key === 'Enter' && onselect(n.issue)}
		>
			{#if hasChildren}
				<button class="expand-btn" onclick={(e) => { e.stopPropagation(); toggle(n.issue.id); }}>
					<span class="expand-icon" class:expanded={isExpanded}>▸</span>
				</button>
			{:else}
				<span class="expand-spacer"></span>
			{/if}
			<span class="priority-dot" style="background: {p.color}"></span>
			<span class="status-icon">{statusIcons[n.issue.status]}</span>
			<span class="type-icon">{getTypeIcon(n.issue.issue_type)}</span>
			<span class="issue-id">#{n.issue.id}</span>
			<span class="issue-title">{n.issue.title}</span>
			<span class="issue-time" title="{ts.absolute} {ts.time}">{ts.relative}</span>
		</div>
		{#if hasChildren && isExpanded}
			<div class="children">
				{#each n.children as child}
					{@render node(child)}
				{/each}
			</div>
		{/if}
	</div>
{/snippet}

<div class="tree-view">
	<div class="tree-header">
		<span class="tree-count">{issues.length} issues</span>
		{#if oncreate}
			<button class="create-btn" onclick={oncreate}>
				<span>New Issue</span>
				<kbd class="create-hotkey">N</kbd>
			</button>
		{/if}
	</div>
	<div class="tree-content">
		{#each tree as root}
			{@render node(root)}
		{/each}
		{#if tree.length === 0}
			<div class="empty-state">No issues found</div>
		{/if}
	</div>
</div>

<style>
	.tree-view {
		flex: 1;
		display: flex;
		flex-direction: column;
		padding: 1rem 1.5rem;
		overflow: hidden;
	}

	.tree-header {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
		margin-bottom: 1rem;
	}

	.create-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-left: auto;
		padding: 0.375rem 0.75rem;
		background: rgba(99, 102, 241, 0.15);
		border: 1px solid rgba(99, 102, 241, 0.3);
		border-radius: var(--radius-sm);
		color: var(--text-primary);
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.create-btn:hover {
		background: rgba(99, 102, 241, 0.25);
		border-color: rgba(99, 102, 241, 0.5);
	}

	.create-hotkey {
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 0.5625rem;
		font-weight: 600;
		padding: 0.0625rem 0.25rem;
		background: rgba(99, 102, 241, 0.2);
		border: 0.5px solid rgba(99, 102, 241, 0.3);
		border-radius: 3px;
		color: var(--text-secondary);
	}

	.tree-count {
		font-size: 0.75rem;
		color: var(--text-tertiary);
	}

	.tree-content {
		flex: 1;
		overflow-y: auto;
		font-family: 'IBM Plex Mono', ui-monospace, monospace;
		font-size: 0.8125rem;
	}

	.tree-node {
		padding-left: calc(var(--depth) * 1.25rem);
	}

	.tree-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.375rem 0.5rem;
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		cursor: pointer;
		transition: all var(--transition-fast);
		text-align: left;
	}

	.tree-row:hover {
		background: rgba(255, 255, 255, 0.04);
		color: var(--text-primary);
	}

	.tree-row.selected {
		background: rgba(99, 102, 241, 0.15);
		color: var(--text-primary);
	}

	.tree-row.closed {
		opacity: 0.5;
	}

	.expand-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1rem;
		height: 1rem;
		padding: 0;
		background: none;
		border: none;
		color: var(--text-tertiary);
		cursor: pointer;
	}

	.expand-icon {
		transition: transform 0.15s ease;
	}

	.expand-icon.expanded {
		transform: rotate(90deg);
	}

	.expand-spacer {
		width: 1rem;
	}

	.priority-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.status-icon {
		font-size: 0.75rem;
		opacity: 0.7;
	}

	.type-icon {
		font-size: 0.6875rem;
		opacity: 0.5;
	}

	.issue-id {
		color: var(--text-tertiary);
		font-size: 0.75rem;
	}

	.issue-title {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.issue-time {
		font-size: 0.6875rem;
		color: var(--text-tertiary);
		margin-left: auto;
	}

	.children {
		border-left: 1px solid rgba(255, 255, 255, 0.06);
		margin-left: 0.5rem;
	}

	.empty-state {
		padding: 2rem;
		text-align: center;
		color: var(--text-tertiary);
	}
</style>
