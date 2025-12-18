<script lang="ts">
	import type { MutationEntry } from '$lib/types';
	import { useMutations, formatMutation } from '$lib/mutationStore.svelte';

	interface Props {
		onticketclick?: (ticketId: string) => void;
		onopenlog?: () => void;
		rangeMinutes?: number;
	}

	let { onticketclick, onopenlog, rangeMinutes = 60 * 24 * 7 }: Props = $props();

	const store = useMutations();
	let isPaused = $state(false);
	let hoveredId = $state<string | null>(null);

	const filtered = $derived.by(() => {
		const cutoff = Date.now() - rangeMinutes * 60 * 1000;
		return store.recent.filter((m) => m.timestamp >= cutoff);
	});

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

	function handleClick(m: MutationEntry) {
		onticketclick?.(m.ticketId);
	}

	function formatRelativeTime(ts: number): string {
		const diff = Date.now() - ts;
		const mins = Math.floor(diff / 60000);
		if (mins < 1) return 'now';
		if (mins < 60) return `${mins}m`;
		const hrs = Math.floor(mins / 60);
		if (hrs < 24) return `${hrs}h`;
		return `${Math.floor(hrs / 24)}d`;
	}

	function formatFullTime(ts: number): string {
		const d = new Date(ts);
		return d.toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
	}
</script>

{#if filtered.length > 0}
<div
	class="ticker-tape"
	onmouseenter={() => isPaused = true}
	onmouseleave={() => { isPaused = false; hoveredId = null; }}
	role="log"
	aria-label="Activity feed"
>
	<div class="ticker-track" class:paused={isPaused}>
		{#each filtered as mutation (mutation.id)}
			<button
				class="ticker-item"
				class:hovered={hoveredId === mutation.id}
				style="--type-color: {typeColors[mutation.mutationType] || '#888'}"
				onclick={() => handleClick(mutation)}
				onmouseenter={() => hoveredId = mutation.id}
				onmouseleave={() => hoveredId = null}
			>
				<span class="ticker-time">{formatRelativeTime(mutation.timestamp)}</span>
				<span class="ticker-dot"></span>
				<span class="ticker-text">{formatMutation(mutation)}</span>
				{#if hoveredId === mutation.id}
					<div class="ticker-tooltip">
						<div class="tooltip-title">{mutation.ticketTitle}</div>
						<div class="tooltip-time">{formatFullTime(mutation.timestamp)}</div>
						<div class="tooltip-hint">Click to view</div>
					</div>
				{/if}
			</button>
		{/each}
	</div>

	<div class="ticker-fade-left"></div>
	<div class="ticker-fade-right"></div>

	<button class="ticker-log-btn" onclick={onopenlog} title="View full activity log">
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<path d="M3 12h18M3 6h18M3 18h18"/>
		</svg>
	</button>
</div>
{/if}

<style>
	.ticker-tape {
		position: relative;
		height: 28px;
		background: var(--bg-secondary);
		border-bottom: 1px solid var(--border-subtle);
		overflow: hidden;
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 0.6875rem;
		display: flex;
		align-items: center;
	}

	.ticker-track {
		display: flex;
		gap: 2rem;
		padding: 0 40px;
		animation: ticker-scroll 180s linear infinite;
		white-space: nowrap;
	}

	.ticker-track.paused {
		animation-play-state: paused;
	}

	@keyframes ticker-scroll {
		from { transform: translateX(0); }
		to { transform: translateX(-50%); }
	}

	.ticker-item {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.25rem 0.5rem;
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		cursor: pointer;
		transition: all 150ms ease;
		position: relative;
		font-family: inherit;
		font-size: inherit;
	}

	.ticker-item:hover,
	.ticker-item.hovered {
		background: rgba(255, 255, 255, 0.06);
		color: var(--text-primary);
	}

	:global(.app.light) .ticker-item:hover,
	:global(.app.light) .ticker-item.hovered {
		background: rgba(0, 0, 0, 0.04);
	}

	.ticker-time {
		color: var(--text-tertiary);
		font-size: 0.625rem;
		min-width: 2ch;
		text-align: right;
	}

	.ticker-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--type-color);
		flex-shrink: 0;
	}

	.ticker-text {
		opacity: 0.85;
	}

	.ticker-item:hover .ticker-text {
		opacity: 1;
	}

	.ticker-tooltip {
		position: absolute;
		bottom: calc(100% + 8px);
		left: 50%;
		transform: translateX(-50%);
		background: var(--bg-elevated);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-md);
		padding: 0.5rem 0.75rem;
		min-width: 160px;
		max-width: 280px;
		box-shadow: var(--shadow-md);
		z-index: 100;
		text-align: left;
		white-space: normal;
		animation: tooltip-in 150ms ease;
	}

	@keyframes tooltip-in {
		from { opacity: 0; transform: translateX(-50%) translateY(4px); }
		to { opacity: 1; transform: translateX(-50%) translateY(0); }
	}

	.tooltip-title {
		font-family: var(--font-sans, system-ui);
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--text-primary);
		margin-bottom: 0.25rem;
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
	}

	.tooltip-time {
		font-size: 0.625rem;
		color: var(--text-tertiary);
		margin-bottom: 0.25rem;
	}

	.tooltip-hint {
		font-size: 0.5625rem;
		color: var(--text-tertiary);
		opacity: 0.7;
	}

	.ticker-fade-left,
	.ticker-fade-right {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 40px;
		pointer-events: none;
		z-index: 1;
	}

	.ticker-fade-left {
		left: 0;
		background: linear-gradient(to right, var(--bg-secondary), transparent);
	}

	.ticker-fade-right {
		right: 32px;
		background: linear-gradient(to left, var(--bg-secondary), transparent);
	}

	.ticker-log-btn {
		position: absolute;
		right: 0;
		top: 0;
		bottom: 0;
		width: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-secondary);
		border: none;
		border-left: 1px solid var(--border-subtle);
		color: var(--text-tertiary);
		cursor: pointer;
		transition: all 150ms ease;
		z-index: 2;
	}

	.ticker-log-btn:hover {
		background: var(--bg-elevated);
		color: var(--text-primary);
	}

	.ticker-log-btn svg {
		width: 14px;
		height: 14px;
	}
</style>
