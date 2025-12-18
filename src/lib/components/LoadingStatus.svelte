<script lang="ts">
	import type { LoadingStatus } from '$lib/types';

	let { status }: { status: LoadingStatus } = $props();

	const phaseLabels: Record<string, string> = {
		disconnected: 'Offline',
		ready: 'Live',
		error: 'Error'
	};

	const phaseIcons: Record<string, string> = {
		disconnected: '○',
		ready: '●',
		error: '✕'
	};

	function formatAge(ts: number | null): string {
		if (!ts) return '—';
		const sec = Math.floor((Date.now() - ts) / 1000);
		if (sec < 5) return 'now';
		if (sec < 60) return `${sec}s ago`;
		const min = Math.floor(sec / 60);
		return `${min}m ago`;
	}

	let age = $derived(formatAge(status.lastUpdate));
</script>

<div class="loading-status" class:error={status.phase === 'error'}>
	<span class="phase">
		<span class="icon">{phaseIcons[status.phase]}</span>
		{phaseLabels[status.phase]}
	</span>

	{#if status.phase === 'ready'}
		<span class="sep">·</span>
		<span class="detail">{status.issueCount} issues</span>
		<span class="sep">·</span>
		<span class="detail">{age}</span>
		<span class="sep">·</span>
		<span class="detail poll">#{status.pollCount}</span>
	{/if}

	{#if status.phase === 'error' && status.errorMessage}
		<span class="sep">·</span>
		<span class="detail error-msg" title={status.errorMessage}>{status.errorMessage.slice(0, 40)}</span>
	{/if}
</div>

<style>
	.loading-status {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.7rem;
		font-family: ui-monospace, monospace;
		color: var(--text-secondary, #888);
		padding: 0.2rem 0.5rem;
		background: var(--bg-secondary, rgba(0,0,0,0.2));
		border-radius: 4px;
		white-space: nowrap;
	}

	.loading-status.error {
		background: rgba(220, 50, 50, 0.15);
		color: #f66;
	}

	.phase {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-weight: 500;
	}

	.icon {
		font-size: 0.6rem;
	}

	.sep {
		color: var(--text-tertiary, #555);
	}

	.detail {
		color: var(--text-tertiary, #666);
	}

	.detail.poll {
		opacity: 0.5;
	}

	.error-msg {
		color: #f88;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 150px;
	}
</style>
