<script lang="ts">
	import type { LoadingStatus } from '$lib/types';

	let {
		dataStatus,
		agentConnected,
		agentCount,
		unreadCount = 0,
		agentEnabled = true,
		light = false,
		onstartAgent,
		onrestartAgent
	}: {
		dataStatus: LoadingStatus;
		agentConnected: boolean;
		agentCount: number;
		unreadCount?: number;
		agentEnabled?: boolean;
		light?: boolean;
		onstartAgent?: () => void;
		onrestartAgent?: () => void;
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
			{#if unreadCount > 0}
				<span class="unread-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
			{/if}
			{#if !agentConnected && onstartAgent}
				<button class="action-btn start" onclick={onstartAgent}>
					<svg viewBox="0 0 12 12" width="10" height="10" fill="currentColor">
						<path d="M3 1.5v9l7-4.5-7-4.5z"/>
					</svg>
					<span>Start</span>
				</button>
			{:else if agentConnected && onrestartAgent}
				<button class="action-btn restart" onclick={onrestartAgent}>
					<svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.5">
						<path d="M1 6a5 5 0 019.5-1.5M11 6a5 5 0 01-9.5 1.5"/>
						<path d="M10.5 1v3.5H7M1.5 11V7.5H5" fill="none"/>
					</svg>
					<span>Restart</span>
				</button>
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
		background: var(--surface-panel, #eceef1);
		border-color: var(--border-default, rgba(60, 70, 80, 0.18));
	}

	.status-bar.light .item {
		color: var(--text-secondary, #4b5563);
	}

	.status-bar.light .dot {
		background: var(--text-muted, #9ca3af);
	}

	.status-bar.light .sep,
	.status-bar.light .age {
		color: #8e8e93;
	}

	.status-bar.light .divider {
		background: rgba(0,0,0,0.1);
	}

	/* Action buttons */
	.action-btn {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 3px 10px 3px 8px;
		margin-left: 8px;
		border: none;
		border-radius: 4px;
		font-family: 'IBM Plex Mono', ui-monospace, monospace;
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 0.02em;
		text-transform: uppercase;
		cursor: pointer;
		transition: all 0.12s ease;
	}

	.action-btn svg {
		flex-shrink: 0;
	}

	.action-btn.start {
		background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
		color: #fff;
		box-shadow: 0 1px 3px rgba(34, 197, 94, 0.3), inset 0 1px 0 rgba(255,255,255,0.15);
	}

	.action-btn.start:hover {
		background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
		transform: translateY(-1px);
		box-shadow: 0 2px 6px rgba(34, 197, 94, 0.4), inset 0 1px 0 rgba(255,255,255,0.15);
	}

	.action-btn.start:active {
		transform: translateY(0);
		box-shadow: 0 1px 2px rgba(34, 197, 94, 0.2);
	}

	.action-btn.restart {
		background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
		color: #fff;
		box-shadow: 0 1px 3px rgba(245, 158, 11, 0.3), inset 0 1px 0 rgba(255,255,255,0.15);
	}

	.action-btn.restart:hover {
		background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
		transform: translateY(-1px);
		box-shadow: 0 2px 6px rgba(245, 158, 11, 0.4), inset 0 1px 0 rgba(255,255,255,0.15);
	}

	.action-btn.restart:active {
		transform: translateY(0);
		box-shadow: 0 1px 2px rgba(245, 158, 11, 0.2);
	}

	/* Light theme adjustments */
	.status-bar.light .action-btn.start {
		background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
	}

	.status-bar.light .action-btn.restart {
		background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
	}

	/* Unread badge */
	.unread-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 16px;
		height: 16px;
		padding: 0 5px;
		margin-left: 4px;
		background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
		border-radius: 8px;
		font-family: 'IBM Plex Mono', ui-monospace, monospace;
		font-size: 9px;
		font-weight: 700;
		color: #fff;
		letter-spacing: -0.02em;
		box-shadow: 0 1px 3px rgba(239, 68, 68, 0.4);
		animation: unreadPulse 2s ease-in-out infinite;
	}

	@keyframes unreadPulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.8; }
	}

	.status-bar.light .unread-badge {
		box-shadow: 0 1px 4px rgba(239, 68, 68, 0.3);
	}
</style>
