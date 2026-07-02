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
		draggedOverColumn: string | null;
		onCancel: (ticketId: string) => void;
		onReorder: (fromIndex: number, toIndex: number) => void;
		ondragover: (e: DragEvent) => void;
		ondragleave: (e: DragEvent) => void;
		ondrop: (e: DragEvent) => void;
	}

	let {
		queue,
		runningSessions,
		draggedOverColumn,
		onCancel,
		onReorder,
		ondragover,
		ondragleave,
		ondrop
	}: Props = $props();

	let draggedIndex = $state<number | null>(null);

	function handleDragStart(e: DragEvent, index: number, ticketId: string) {
		draggedIndex = index;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			// Set both index (for reorder) and ticket ID (for cross-column drops)
			e.dataTransfer.setData('text/plain', ticketId);
			e.dataTransfer.setData('application/x-queue-index', index.toString());
		}
	}

	function handleItemDragOver(e: DragEvent) {
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
	}

	function handleItemDrop(e: DragEvent, targetIndex: number) {
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
	class="queue-panel"
	class:drag-over={draggedOverColumn === 'queue'}
	data-column-key="queue"
	{ondragover}
	{ondragleave}
	{ondrop}
>
	<header class="queue-header">
		<span class="queue-icon"><Icon name="agent" size={13} /></span>
		<h3>Queue</h3>
		{#if totalCount > 0}
			<span class="queue-count">{totalCount}</span>
		{/if}
	</header>

	<div class="cards">
		{#if runningSessions.length > 0}
			<div class="section">
				<div class="section-label"><span class="live-dot"></span>Running</div>
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
						ondragstart={(e) => handleDragStart(e, i, item.ticketId)}
						ondragover={handleItemDragOver}
						ondrop={(e) => handleItemDrop(e, i)}
						ondragend={handleDragEnd}
						onCancel={() => onCancel(item.ticketId)}
					/>
				{/each}
			</div>
		{/if}

		{#if totalCount === 0}
			<div class="empty-state">
				<div class="empty-icon"><Icon name="agent" size={18} /></div>
				<p>No agents — drop a card here to start one</p>
			</div>
		{/if}
	</div>
</section>

<style>
	.queue-panel {
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		min-height: 0;
		max-height: 42%;
		border-top: 1px solid var(--border-subtle);
		transition: background var(--transition-fast);
	}

	.queue-panel.drag-over {
		background: linear-gradient(180deg, rgba(245, 158, 11, 0.1) 0%, transparent 100%);
	}

	.queue-header {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.625rem 0.75rem 0.5rem;
	}

	.queue-icon {
		color: #f59e0b;
		display: flex;
		align-items: center;
	}

	.queue-header h3 {
		margin: 0;
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-tertiary);
	}

	.queue-count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.125rem;
		height: 1.0625rem;
		padding: 0 0.375rem;
		background: rgba(245, 158, 11, 0.15);
		color: #f59e0b;
		border-radius: var(--radius-xs);
		font: 600 10px/1 var(--font-mono);
	}

	.cards {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0 0.75rem 0.75rem;
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overflow-x: hidden;
	}

	.cards::-webkit-scrollbar {
		width: 4px;
	}
	.cards::-webkit-scrollbar-thumb {
		background: var(--border-subtle);
		border-radius: 2px;
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
		padding: 0.125rem 0;
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
		gap: 0.375rem;
		padding: 1rem 0.75rem;
		color: var(--text-muted);
		text-align: center;
		border: 1px dashed var(--border-subtle);
		border-radius: var(--radius-sm);
	}

	.empty-icon {
		opacity: 0.3;
		color: #f59e0b;
	}

	.empty-state p {
		margin: 0;
		font-size: 0.6875rem;
		font-weight: 500;
		line-height: 1.3;
	}
</style>
