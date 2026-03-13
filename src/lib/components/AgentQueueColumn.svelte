<script lang="ts">
	import type { AgentSession } from '$lib/wsStore.svelte';
	import QueueItemCard from './QueueItemCard.svelte';
	import RunningAgentCard from './RunningAgentCard.svelte';
	import Icon from './Icon.svelte';

	interface AgentQueueItem {
		ticketId: string;
		title: string;
		description?: string;
		agentName: string;
		cwd: string;
	}

	interface Props {
		queue: AgentQueueItem[];
		runningSessions: AgentSession[];
		isCollapsed: boolean;
		activeColumnIndex: number;
		columnIndex: number;
		draggedOverColumn: string | null;
		onCancel: (ticketId: string) => void;
		onReorder: (fromIndex: number, toIndex: number) => void;
		onToggleCollapse: () => void;
		ondragover: (e: DragEvent) => void;
		ondragleave: (e: DragEvent) => void;
		ondrop: (e: DragEvent) => void;
	}

	let {
		queue,
		runningSessions,
		isCollapsed,
		activeColumnIndex,
		columnIndex,
		draggedOverColumn,
		onCancel,
		onReorder,
		onToggleCollapse,
		ondragover,
		ondragleave,
		ondrop
	}: Props = $props();

	let draggedIndex = $state<number | null>(null);

	function handleDragStart(e: DragEvent, index: number) {
		draggedIndex = index;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', index.toString());
		}
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'move';
		}
	}

	function handleDrop(e: DragEvent, targetIndex: number) {
		e.preventDefault();
		if (draggedIndex !== null && draggedIndex !== targetIndex) {
			onReorder(draggedIndex, targetIndex);
		}
		draggedIndex = null;
	}

	function handleDragEnd() {
		draggedIndex = null;
	}

	const totalCount = $derived(queue.length + runningSessions.length);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<section
	class="column"
	class:mobile-active={activeColumnIndex === columnIndex}
	class:collapsed={isCollapsed}
	class:drag-over={draggedOverColumn === 'queue'}
	data-column-key="queue"
	ondragover={ondragover}
	ondragleave={ondragleave}
	ondrop={ondrop}
>
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<header
		class="column-header"
		onclick={isCollapsed ? onToggleCollapse : undefined}
	>
		<div class="column-title">
			<span class="column-icon"><Icon name="agent" size={14} /></span>
			<h2>Queue</h2>
			{#if totalCount > 0}
				<span class="column-count">{totalCount}</span>
			{/if}
		</div>
		<div class="column-header-actions">
			<button
				class="column-collapse-btn"
				onclick={(e) => { e.stopPropagation(); onToggleCollapse(); }}
				title={isCollapsed ? 'Expand column' : 'Collapse column'}
			>
				<Icon name={isCollapsed ? 'chevron-right' : 'chevron-left'} size={10} />
			</button>
		</div>
	</header>

	{#if !isCollapsed}
		<div class="cards">
			{#if runningSessions.length > 0}
				<div class="section">
					<div class="section-label">
						<span class="live-dot"></span>
						Running
					</div>
					{#each runningSessions as session (session.id)}
						<RunningAgentCard {session} />
					{/each}
				</div>
			{/if}

			{#if queue.length > 0}
				<div class="section">
					<div class="section-label">Queued</div>
					{#each queue as item, i (item.ticketId)}
						<QueueItemCard
							{item}
							position={i + 1}
							draggable={true}
							ondragstart={(e) => handleDragStart(e, i)}
							ondragover={handleDragOver}
							ondrop={(e) => handleDrop(e, i)}
							ondragend={handleDragEnd}
							onCancel={() => onCancel(item.ticketId)}
						/>
					{/each}
				</div>
			{/if}

			{#if totalCount === 0}
				<div class="empty-state">
					<div class="empty-icon"><Icon name="agent" size={24} /></div>
					<p>No agents</p>
				</div>
			{/if}
		</div>
	{/if}
</section>

<style>
	.column {
		flex: 0 0 280px;
		min-width: 240px;
		max-width: 320px;
		min-height: 0;
		align-self: stretch;
		display: flex;
		flex-direction: column;
		background: var(--surface-panel);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		overflow: hidden;
		transition: border-color var(--transition-fast);
	}

	.column.drag-over {
		border-color: #f59e0b;
		background: linear-gradient(180deg, rgba(245, 158, 11, 0.08) 0%, var(--surface-panel) 100%);
	}

	.column.collapsed {
		flex: 0 0 40px;
		min-width: 40px;
		max-width: 40px;
	}

	.column-header {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.625rem 0.75rem;
		border-bottom: 1px solid var(--border-subtle);
		background: var(--surface-panel);
	}

	.column.collapsed .column-header {
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		padding: 0.75rem 0.25rem;
		height: 100%;
		cursor: pointer;
		gap: 0.5rem;
	}

	.column-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.column.collapsed .column-title {
		flex-direction: column;
		align-items: center;
		writing-mode: vertical-rl;
		text-orientation: mixed;
		gap: 0.375rem;
	}

	.column-icon {
		color: #f59e0b;
		display: flex;
		align-items: center;
	}

	.column-title h2 {
		font: 600 11px/1 var(--font-sans);
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		margin: 0;
	}

	.column.collapsed .column-title h2 {
		font-size: 0.625rem;
		letter-spacing: 0.06em;
	}

	.column-count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.25rem;
		height: 1.125rem;
		padding: 0 0.375rem;
		background: rgba(245, 158, 11, 0.15);
		color: #f59e0b;
		border-radius: var(--radius-xs);
		font: 600 10px/1 var(--font-mono);
	}

	.column.collapsed .column-count {
		padding: 0.125rem 0.25rem;
		font-size: 0.5625rem;
		min-width: 1.25rem;
		text-align: center;
	}

	.column-header-actions {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.column.collapsed .column-header-actions {
		flex-direction: column;
		align-items: center;
		gap: 0.375rem;
		margin-top: auto;
	}

	.column-collapse-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.25rem;
		height: 1.25rem;
		background: transparent;
		border: none;
		border-radius: var(--radius-xs);
		color: var(--text-tertiary);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.column-collapse-btn:hover {
		background: var(--surface-elevated);
		color: var(--text-primary);
	}

	.column.collapsed .column-collapse-btn {
		opacity: 0.6;
		width: 1.5rem;
		height: 1.5rem;
	}

	.column.collapsed:hover .column-collapse-btn {
		opacity: 1;
	}

	.cards {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.5rem;
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		min-height: 0;
	}

	.cards::-webkit-scrollbar {
		width: 4px;
	}

	.cards::-webkit-scrollbar-track {
		background: transparent;
	}

	.cards::-webkit-scrollbar-thumb {
		background: var(--border-subtle);
		border-radius: 2px;
	}

	.cards::-webkit-scrollbar-thumb:hover {
		background: var(--border-default);
	}

	.section {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.section-label {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font: 500 9px/1 var(--font-sans);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-muted);
		padding: 0.25rem 0.5rem;
	}

	.live-dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: #10b981;
		box-shadow: 0 0 6px rgba(16, 185, 129, 0.5);
		animation: pulse 1.5s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 1.5rem 1rem;
		color: var(--text-muted);
		text-align: center;
		border: 1px dashed var(--border-subtle);
		border-radius: var(--radius-sm);
		margin: 0.25rem;
		flex: 1;
	}

	.empty-icon {
		margin-bottom: 0.25rem;
		opacity: 0.25;
		color: #f59e0b;
	}

	.empty-state p {
		font-size: 0.6875rem;
		font-weight: 500;
	}

	@media (max-width: 1023px) {
		.column {
			display: none;
			width: 100%;
			max-width: 100%;
		}

		.column.mobile-active {
			display: flex;
		}
	}

	:global(.app.light) .column {
		box-shadow: var(--shadow-sm);
	}
</style>
