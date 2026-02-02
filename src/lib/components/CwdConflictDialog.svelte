<script lang="ts">
	import Icon from './Icon.svelte';

	interface ConflictData {
		ticketId: string;
		agentName: string;
		conflicts: string[];
		cwd: string;
		issue: { id: string; title: string };
		briefing: string;
	}

	interface Props {
		conflict: ConflictData | null;
		onresolve: (action: 'worktree' | 'queue' | 'same') => void;
		ondismiss: () => void;
	}

	let { conflict, onresolve, ondismiss }: Props = $props();

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') ondismiss();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if conflict}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="conflict-overlay" onclick={ondismiss} role="presentation">
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div class="conflict-modal" onclick={(e) => e.stopPropagation()} role="dialog" aria-label="CWD conflict" tabindex="-1">
			<header class="conflict-header">
				<div class="conflict-title-row">
					<span class="conflict-title-icon"><Icon name="alert-circle" size={16} /></span>
					<h3>Directory Conflict</h3>
				</div>
				<button class="conflict-close" onclick={ondismiss} aria-label="Close">
					<Icon name="close" size={14} />
				</button>
			</header>

			<div class="conflict-body">
				<p class="conflict-hint">
					{conflict.conflicts.length === 1 ? 'An agent is' : `${conflict.conflicts.length} agents are`} already running in this directory:
				</p>
				<ul class="conflict-list">
					{#each conflict.conflicts as name}
						<li><code>{name}</code></li>
					{/each}
				</ul>
				<p class="conflict-hint">Starting <code>{conflict.agentName}</code> in the same CWD may cause file conflicts.</p>
				<p class="conflict-hint">You can queue this ticket to start when the active agent finishes.</p>
			</div>

			<div class="conflict-actions">
				<button class="conflict-btn primary" onclick={() => onresolve('worktree')}>
					<span class="btn-label">Use worktree</span>
					<span class="btn-desc">Isolated copy (recommended)</span>
				</button>
				<button class="conflict-btn secondary" onclick={() => onresolve('queue')}>
					<span class="btn-label">Queue next</span>
					<span class="btn-desc">Start after active agents finish</span>
				</button>
				<button class="conflict-btn secondary" onclick={() => onresolve('same')}>
					<span class="btn-label">Use same CWD</span>
					<span class="btn-desc">Shared directory, risk of conflicts</span>
				</button>
			</div>

			<button class="conflict-cancel" onclick={ondismiss}>
				<kbd>esc</kbd>
				<span>Cancel</span>
			</button>
		</div>
	</div>
{/if}

<style>
	.conflict-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 10000;
		animation: overlayFadeIn 200ms ease-out;
	}

	@keyframes overlayFadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.conflict-modal {
		background: var(--bg-primary);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-xl);
		max-width: 380px;
		width: 90%;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
		animation: modalSlideUp 280ms cubic-bezier(0.34, 1.56, 0.64, 1);
		overflow: hidden;
	}

	@keyframes modalSlideUp {
		from { opacity: 0; transform: translateY(16px) scale(0.96); }
		to { opacity: 1; transform: translateY(0) scale(1); }
	}

	.conflict-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.875rem 1rem;
		border-bottom: 1px solid var(--border-subtle);
	}

	.conflict-title-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.conflict-title-icon { color: #fb923c; }

	.conflict-header h3 {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0;
	}

	.conflict-close {
		width: 1.5rem;
		height: 1.5rem;
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

	.conflict-close:hover {
		background: rgba(255, 255, 255, 0.06);
		color: var(--text-secondary);
	}

	:global(.app.light) .conflict-close:hover { background: rgba(0, 0, 0, 0.06); }

	.conflict-body { padding: 0.75rem 1rem; }

	.conflict-hint {
		font-size: 0.75rem;
		color: var(--text-secondary);
		margin: 0 0 0.5rem;
		line-height: 1.5;
	}

	.conflict-hint code {
		color: var(--accent-primary);
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 0.6875rem;
		font-weight: 600;
		background: rgba(99, 102, 241, 0.1);
		padding: 0.125rem 0.375rem;
		border-radius: 4px;
	}

	.conflict-list {
		margin: 0 0 0.5rem;
		padding: 0 0 0 1.25rem;
		font-size: 0.75rem;
		color: var(--text-secondary);
	}

	.conflict-list code {
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 0.6875rem;
		font-weight: 600;
		color: #fb923c;
	}

	.conflict-actions {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding: 0 0.75rem;
	}

	.conflict-btn {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 0.625rem 0.75rem;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: var(--radius-md);
		text-align: left;
		cursor: pointer;
		transition: all 180ms ease;
	}

	.conflict-btn.primary {
		border-color: rgba(34, 197, 94, 0.25);
		background: rgba(34, 197, 94, 0.06);
	}

	.conflict-btn.primary:hover {
		background: rgba(34, 197, 94, 0.12);
		border-color: rgba(34, 197, 94, 0.4);
	}

	.conflict-btn.secondary:hover {
		background: rgba(255, 255, 255, 0.06);
		border-color: rgba(255, 255, 255, 0.12);
	}

	:global(.app.light) .conflict-btn {
		background: rgba(0, 0, 0, 0.02);
		border-color: rgba(0, 0, 0, 0.06);
	}

	:global(.app.light) .conflict-btn.primary {
		border-color: rgba(22, 163, 74, 0.25);
		background: rgba(22, 163, 74, 0.06);
	}

	:global(.app.light) .conflict-btn.primary:hover {
		background: rgba(22, 163, 74, 0.12);
	}

	:global(.app.light) .conflict-btn.secondary:hover {
		background: rgba(0, 0, 0, 0.04);
	}

	.btn-label {
		font-weight: 600;
		font-size: 0.8125rem;
		color: var(--text-primary);
	}

	.btn-desc {
		font-size: 0.6875rem;
		color: var(--text-tertiary);
	}

	.conflict-cancel {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		width: calc(100% - 1.5rem);
		margin: 0.75rem;
		padding: 0.5rem;
		background: transparent;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: var(--radius-sm);
		color: var(--text-tertiary);
		font-family: inherit;
		font-size: 0.75rem;
		cursor: pointer;
		transition: all 150ms ease;
	}

	.conflict-cancel:hover {
		background: rgba(255, 255, 255, 0.04);
		border-color: rgba(255, 255, 255, 0.12);
		color: var(--text-secondary);
	}

	:global(.app.light) .conflict-cancel { border-color: rgba(0, 0, 0, 0.08); }
	:global(.app.light) .conflict-cancel:hover { background: rgba(0, 0, 0, 0.04); }

	.conflict-cancel kbd {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.25rem;
		height: 1.125rem;
		padding: 0 0.375rem;
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 0.5625rem;
		font-weight: 500;
		color: var(--text-tertiary);
		background: var(--bg-tertiary);
		border: 1px solid var(--border-default);
		border-radius: 3px;
	}
</style>
