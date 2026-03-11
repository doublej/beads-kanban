<script lang="ts">
	import type { AgentSession } from '$lib/wsStore.svelte';
	import QueueItemCard from './QueueItemCard.svelte';
	import RunningAgentCard from './RunningAgentCard.svelte';

	interface AgentQueueItem {
		ticketId: string;
		agentName: string;
		cwd: string;
	}

	interface Props {
		show: boolean;
		queue: AgentQueueItem[];
		runningSessions: AgentSession[];
		onCancel: (ticketId: string) => void;
		onReorder: (fromIndex: number, toIndex: number) => void;
		onclose: () => void;
	}

	let { show, queue, runningSessions, onCancel, onReorder, onclose }: Props = $props();

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
</script>

{#if show}
	<div class="drawer">
		<div class="drawer-header">
			<h3>Agent Queue</h3>
			<button class="minimize-btn" onclick={onclose} title="Close">&times;</button>
		</div>

		<div class="drawer-body">
			{#if runningSessions.length > 0}
				<div class="section">
					<h4 class="section-title">Running ({runningSessions.length})</h4>
					<div class="section-content">
						{#each runningSessions as session (session.id)}
							<RunningAgentCard {session} />
						{/each}
					</div>
				</div>
			{/if}

			{#if queue.length > 0}
				<div class="section">
					<h4 class="section-title">Queued ({queue.length})</h4>
					<div class="section-content">
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
				</div>
			{:else if runningSessions.length === 0}
				<div class="empty-state">
					<p>Queue is empty</p>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.drawer {
		position: fixed;
		bottom: 56px;
		left: 8px;
		z-index: 9998;
		width: 340px;
		max-height: 70vh;
		background: var(--surface-panel);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-lg);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		animation: drawerSlideUp 150ms ease-out;
	}

	@keyframes drawerSlideUp {
		from { opacity: 0; transform: translateY(8px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.drawer-header {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.625rem 0.75rem;
		border-bottom: 1px solid var(--border-subtle);
		background: var(--surface-card);
	}

	.drawer-header h3 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font: 600 11px/1 var(--font-sans);
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		margin: 0;
	}

	.drawer-header h3::before {
		content: '';
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #f59e0b;
		box-shadow: 0 0 6px rgba(245, 158, 11, 0.4);
	}

	.minimize-btn {
		width: 1.25rem;
		height: 1.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		color: var(--text-tertiary);
		cursor: pointer;
		font-size: 1rem;
		line-height: 1;
		border-radius: var(--radius-xs);
		transition: all var(--transition-fast);
	}

	.minimize-btn:hover {
		background: var(--surface-elevated);
		color: var(--text-primary);
	}

	.drawer-body {
		flex: 1;
		overflow-y: auto;
		padding: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}

	.section {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.section-title {
		font: 500 9px/1 var(--font-sans);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-muted);
		margin: 0;
		padding: 0.25rem 0.5rem;
	}

	.section-content {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2rem 1rem;
		color: var(--text-tertiary);
		border: 1px dashed var(--border-subtle);
		border-radius: var(--radius-sm);
		margin: 0.25rem;
	}

	.empty-state p {
		font: 500 11px/1 var(--font-sans);
		margin: 0;
	}

	@media (max-width: 768px) {
		.drawer {
			width: calc(100vw - 16px);
			max-height: 50vh;
		}
	}
</style>
