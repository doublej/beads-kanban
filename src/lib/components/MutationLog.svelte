<script lang="ts">
	import type { MutationEntry, MutationType } from '$lib/types';
	import { useMutations, formatMutation, clearMutations } from '$lib/mutationStore.svelte';

	interface Props {
		show: boolean;
		onclose: () => void;
		onticketclick?: (ticketId: string) => void;
	}

	let { show, onclose, onticketclick }: Props = $props();

	const store = useMutations();
	let filterType = $state<MutationType | 'all'>('all');
	let searchQuery = $state('');

	const filteredMutations = $derived(() => {
		let result = store.value;
		if (filterType !== 'all') {
			result = result.filter(m => m.mutationType === filterType);
		}
		if (searchQuery) {
			const q = searchQuery.toLowerCase();
			result = result.filter(m =>
				m.ticketId.toLowerCase().includes(q) ||
				m.ticketTitle.toLowerCase().includes(q)
			);
		}
		return result.slice().reverse();
	});

	const typeLabels: Record<MutationType | 'all', string> = {
		all: 'All',
		status: 'Status',
		closed: 'Closed',
		created: 'Created',
		priority: 'Priority',
		assignee: 'Assignee',
		comment: 'Comment',
		dependency: 'Deps',
		label: 'Label'
	};

	const typeColors: Record<string, string> = {
		status: '#38bdf8',
		closed: '#10b981',
		created: '#a78bfa',
		priority: '#f59e0b',
		assignee: '#ec4899',
		comment: '#6ee7b7',
		dependency: '#818cf8',
		label: '#60a5fa'
	};

	function formatTime(ts: number): string {
		const d = new Date(ts);
		const now = Date.now();
		const diffMs = now - ts;
		const diffMin = Math.floor(diffMs / 60000);
		const diffHr = Math.floor(diffMs / 3600000);

		if (diffMin < 1) return 'just now';
		if (diffMin < 60) return `${diffMin}m ago`;
		if (diffHr < 24) return `${diffHr}h ago`;
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	function formatFullTime(ts: number): string {
		return new Date(ts).toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if show}
<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="log-backdrop" onclick={onclose}></div>
<div class="log-panel" role="dialog" aria-label="Activity Log">
	<div class="log-header">
		<h3>Activity Log</h3>
		<div class="log-actions">
			<span class="log-count">{store.value.length} events</span>
			{#if store.value.length > 0}
				<button class="log-clear" onclick={() => { clearMutations(); }}>Clear</button>
			{/if}
			<button class="log-close" onclick={onclose} aria-label="Close">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M18 6L6 18M6 6l12 12"/>
				</svg>
			</button>
		</div>
	</div>

	<div class="log-filters">
		<input
			type="text"
			placeholder="Search by ticket..."
			bind:value={searchQuery}
			class="log-search"
		/>
		<div class="log-type-filters">
			{#each Object.entries(typeLabels) as [type, label]}
				<button
					class="type-chip"
					class:active={filterType === type}
					style="--chip-color: {typeColors[type] || 'var(--text-tertiary)'}"
					onclick={() => filterType = type as MutationType | 'all'}
				>
					{label}
				</button>
			{/each}
		</div>
	</div>

	<div class="log-list">
		{#each filteredMutations() as mutation (mutation.id)}
			<button
				class="log-item"
				style="--type-color: {typeColors[mutation.mutationType] || '#888'}"
				onclick={() => { onticketclick?.(mutation.ticketId); onclose(); }}
			>
				<span class="log-dot"></span>
				<span class="log-time" title={formatFullTime(mutation.timestamp)}>
					{formatTime(mutation.timestamp)}
				</span>
				<span class="log-ticket">#{mutation.ticketId.slice(0, 6)}</span>
				<span class="log-title">{mutation.ticketTitle}</span>
				<span class="log-change">{formatMutation(mutation).split(' ').slice(1).join(' ')}</span>
			</button>
		{:else}
			<div class="log-empty">
				{#if searchQuery || filterType !== 'all'}
					No matching events
				{:else}
					No activity yet
				{/if}
			</div>
		{/each}
	</div>
</div>
{/if}

<style>
	.log-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.3);
		z-index: 9990;
		animation: fade-in 150ms ease;
	}

	@keyframes fade-in {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.log-panel {
		position: fixed;
		top: 28px;
		left: 0;
		right: 0;
		max-height: 400px;
		background: var(--bg-secondary);
		border-bottom: 1px solid var(--border-default);
		box-shadow: var(--shadow-lg);
		z-index: 9991;
		display: flex;
		flex-direction: column;
		animation: slide-down 200ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	@keyframes slide-down {
		from { opacity: 0; transform: translateY(-10px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.log-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--border-subtle);
		flex-shrink: 0;
	}

	.log-header h3 {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0;
	}

	.log-actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.log-count {
		font-size: 0.6875rem;
		color: var(--text-tertiary);
	}

	.log-clear {
		font-size: 0.6875rem;
		padding: 0.25rem 0.5rem;
		background: transparent;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		color: var(--text-tertiary);
		cursor: pointer;
		transition: all 150ms ease;
	}

	.log-clear:hover {
		border-color: #ef4444;
		color: #ef4444;
	}

	.log-close {
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		color: var(--text-tertiary);
		cursor: pointer;
		transition: all 150ms ease;
	}

	.log-close:hover {
		background: var(--bg-elevated);
		color: var(--text-primary);
	}

	.log-close svg {
		width: 16px;
		height: 16px;
	}

	.log-filters {
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--border-subtle);
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	.log-search {
		width: 100%;
		padding: 0.375rem 0.625rem;
		background: var(--bg-primary);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		color: var(--text-primary);
		outline: none;
		transition: border-color 150ms ease;
	}

	.log-search:focus {
		border-color: var(--accent-primary);
	}

	.log-search::placeholder {
		color: var(--text-tertiary);
	}

	.log-type-filters {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}

	.type-chip {
		padding: 0.1875rem 0.5rem;
		font-size: 0.625rem;
		font-weight: 500;
		background: transparent;
		border: 1px solid var(--border-subtle);
		border-radius: 999px;
		color: var(--text-tertiary);
		cursor: pointer;
		transition: all 150ms ease;
	}

	.type-chip:hover {
		border-color: var(--chip-color);
		color: var(--chip-color);
	}

	.type-chip.active {
		background: var(--chip-color);
		border-color: var(--chip-color);
		color: #000;
	}

	.log-list {
		flex: 1;
		overflow-y: auto;
		padding: 0.5rem;
	}

	.log-item {
		display: grid;
		grid-template-columns: 8px 60px 70px 1fr auto;
		gap: 0.5rem;
		align-items: center;
		width: 100%;
		padding: 0.5rem 0.625rem;
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		text-align: left;
		cursor: pointer;
		transition: background 150ms ease;
		font-family: inherit;
	}

	.log-item:hover {
		background: var(--bg-elevated);
	}

	.log-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--type-color);
	}

	.log-time {
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 0.625rem;
		color: var(--text-tertiary);
	}

	.log-ticket {
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 0.6875rem;
		font-weight: 500;
		color: var(--type-color);
	}

	.log-title {
		font-size: 0.75rem;
		color: var(--text-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.log-change {
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 0.625rem;
		color: var(--text-secondary);
		white-space: nowrap;
	}

	.log-empty {
		padding: 2rem;
		text-align: center;
		color: var(--text-tertiary);
		font-size: 0.75rem;
	}

	.log-list::-webkit-scrollbar {
		width: 6px;
	}

	.log-list::-webkit-scrollbar-track {
		background: transparent;
	}

	.log-list::-webkit-scrollbar-thumb {
		background: var(--border-default);
		border-radius: 3px;
	}
</style>
