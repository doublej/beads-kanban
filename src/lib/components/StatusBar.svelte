<script lang="ts">
	import type { LoadingStatus } from '$lib/types';

	let {
		dataStatus,
		agentConnected,
		agentCount,
		agentEnabled = true,
		light = false,
		onstartAgent
	}: {
		dataStatus: LoadingStatus;
		agentConnected: boolean;
		agentCount: number;
		agentEnabled?: boolean;
		light?: boolean;
		onstartAgent?: () => void;
	} = $props();

	function formatAge(ts: number | null): string {
		if (!ts) return '';
		const sec = Math.floor((Date.now() - ts) / 1000);
		if (sec < 5) return 'just now';
		if (sec < 60) return `${sec}s ago`;
		return `${Math.floor(sec / 60)}m ago`;
	}

	let age = $state('');
	$effect(() => {
		age = formatAge(dataStatus.lastUpdate);
		const id = setInterval(() => {
			age = formatAge(dataStatus.lastUpdate);
		}, 5000);
		return () => clearInterval(id);
	});

	const hasError = $derived(dataStatus.phase === 'error');
</script>

<div class="status-bar" class:light>
	<div class="item" class:error={hasError}>
		<span class="dot" class:active={!hasError && dataStatus.phase !== 'disconnected'} class:error={hasError}></span>
		<span class="label">{dataStatus.issueCount} issues</span>
		{#if age}
			<span class="sep">·</span>
			<span class="age">{age}</span>
		{/if}
	</div>

	{#if agentEnabled}
		<div class="divider"></div>

		<div class="item">
			<span class="dot" class:active={agentConnected}></span>
			<span class="label">
				{#if agentConnected}
					{agentCount > 0 ? `${agentCount} agent${agentCount > 1 ? 's' : ''}` : 'Agent ready'}
				{:else}
					Agent offline
				{/if}
			</span>
			{#if !agentConnected && onstartAgent}
				<button class="start-btn" onclick={onstartAgent}>Start</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.status-bar {
		display: flex;
		align-items: center;
		gap: 0;
		font-family: 'Inter', -apple-system, sans-serif;
		font-size: 11px;
		background: var(--bg-secondary, #27272a);
		border: 1px solid var(--border-subtle, rgba(255,255,255,0.08));
		border-radius: 6px;
		overflow: hidden;
	}

	.item {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 10px;
		color: var(--text-secondary, #98989d);
	}

	.item.error .label {
		color: #ef4444;
	}

	.dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--text-tertiary, #636366);
		transition: background 0.2s ease;
	}

	.dot.active {
		background: #22c55e;
	}

	.dot.error {
		background: #ef4444;
	}

	.label {
		font-weight: 500;
	}

	.sep {
		color: var(--text-tertiary, #636366);
	}

	.age {
		color: var(--text-tertiary, #636366);
	}

	.divider {
		width: 1px;
		height: 16px;
		background: var(--border-subtle, rgba(255,255,255,0.08));
	}

	/* Light theme */
	.status-bar.light {
		background: #ffffff;
		border-color: rgba(0,0,0,0.1);
	}

	.status-bar.light .item {
		color: #3c3c43;
	}

	.status-bar.light .dot {
		background: #8e8e93;
	}

	.status-bar.light .sep,
	.status-bar.light .age {
		color: #8e8e93;
	}

	.status-bar.light .divider {
		background: rgba(0,0,0,0.1);
	}

	.start-btn {
		padding: 2px 8px;
		margin-left: 6px;
		background: rgba(99, 102, 241, 0.15);
		border: 1px solid rgba(99, 102, 241, 0.3);
		border-radius: 4px;
		color: var(--text-primary, #fff);
		font-size: 10px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.start-btn:hover {
		background: rgba(99, 102, 241, 0.25);
		border-color: rgba(99, 102, 241, 0.5);
	}

	.status-bar.light .start-btn {
		background: rgba(99, 102, 241, 0.1);
		border-color: rgba(99, 102, 241, 0.2);
		color: #3c3c43;
	}
</style>
