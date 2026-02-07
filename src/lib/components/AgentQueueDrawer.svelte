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
		width: 360px;
		max-height: 70vh;
		background: var(--bg-primary);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 8px;
		box-shadow:
			0 0 0 0.5px rgba(0, 0, 0, 0.4),
			0 4px 16px rgba(0, 0, 0, 0.35),
			0 8px 32px rgba(0, 0, 0, 0.2);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		animation: drawerSlideUp 150ms ease-out;
	}

	:global(.app.light) .drawer {
		background: var(--bg-primary);
		border-color: rgba(0, 0, 0, 0.08);
		box-shadow:
			0 0 0 0.5px rgba(0, 0, 0, 0.06),
			0 4px 16px rgba(0, 0, 0, 0.1),
			0 8px 32px rgba(0, 0, 0, 0.08);
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
		padding: 0.75rem 1rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	}

	:global(.app.light) .drawer-header {
		border-bottom-color: rgba(0, 0, 0, 0.06);
	}

	.drawer-header h3 {
		font: 600 12px/1 system-ui, -apple-system, sans-serif;
		color: var(--text-primary);
		margin: 0;
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
		border-radius: 3px;
		transition: all 100ms ease;
	}

	.minimize-btn:hover {
		background: rgba(255, 255, 255, 0.08);
		color: var(--text-primary);
	}

	:global(.app.light) .minimize-btn:hover {
		background: rgba(0, 0, 0, 0.05);
	}

	.drawer-body {
		flex: 1;
		overflow-y: auto;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.section-title {
		font: 600 10px/1 system-ui, -apple-system, sans-serif;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-tertiary);
		margin: 0;
		padding: 0 0.25rem;
	}

	.section-content {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.empty-state {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
	}

	.empty-state p {
		color: var(--text-tertiary);
		font-size: 0.75rem;
		margin: 0;
	}

	@media (max-width: 768px) {
		.drawer {
			width: calc(100vw - 16px);
			max-height: 50vh;
		}
	}
</style>
