<script lang="ts">
	import type { AgentSession } from '$lib/wsStore.svelte';
	import { formatCwdForDisplay } from '$lib/utils/agent-queue-helpers';

	interface Props {
		session: AgentSession;
	}

	let { session }: Props = $props();
</script>

<div class="running-agent">
	<div class="running-indicator"></div>
	<div class="running-content">
		<div class="running-header">
			<span class="ticket-id">{session.ticketId || 'No ticket'}</span>
		</div>
		<div class="agent-name">{session.name}</div>
		<div class="cwd" title={session.cwd}>{formatCwdForDisplay(session.cwd)}</div>
		<div class="progress-bar">
			<div class="progress-pulse"></div>
		</div>
	</div>
</div>

<style>
	.running-agent {
		position: relative;
		display: flex;
		gap: 0.625rem;
		padding: 0.5rem 0.625rem;
		background: var(--surface-card);
		border: 1px solid rgba(16, 185, 129, 0.2);
		border-radius: var(--radius-sm);
		transition: all var(--transition-fast);
	}

	.running-agent::before {
		content: '';
		position: absolute;
		top: 0.5rem;
		left: 0;
		width: 2px;
		height: calc(100% - 1rem);
		border-radius: 0 1px 1px 0;
		background: #10b981;
	}

	.running-indicator {
		flex-shrink: 0;
		width: 6px;
		height: 6px;
		background: #10b981;
		border-radius: 50%;
		margin-top: 0.25rem;
		box-shadow: 0 0 6px rgba(16, 185, 129, 0.5);
		animation: pulse 1.5s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.6;
			transform: scale(0.85);
		}
	}

	.running-content {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.running-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.ticket-id {
		font: 550 12px/1.2 var(--font-sans);
		color: var(--text-primary);
	}

	.agent-name {
		font: 500 10px/1.2 var(--font-mono);
		color: var(--text-tertiary);
	}

	.cwd {
		font: 400 9px/1.3 var(--font-mono);
		color: var(--text-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.progress-bar {
		margin-top: 0.375rem;
		height: 2px;
		background: var(--border-subtle);
		border-radius: 1px;
		overflow: hidden;
		position: relative;
	}

	.progress-pulse {
		position: absolute;
		top: 0;
		left: 0;
		height: 100%;
		width: 25%;
		background: linear-gradient(90deg, transparent, #10b981, transparent);
		border-radius: 1px;
		animation: progress-sweep 1.8s ease-in-out infinite;
	}

	@keyframes progress-sweep {
		0% {
			left: -25%;
			opacity: 0;
		}
		20% {
			opacity: 1;
		}
		80% {
			opacity: 1;
		}
		100% {
			left: 100%;
			opacity: 0;
		}
	}

	/* Light theme adjustments */
	:global(.app.light) .running-agent {
		box-shadow: var(--shadow-sm);
		border-color: rgba(16, 185, 129, 0.25);
	}
</style>
