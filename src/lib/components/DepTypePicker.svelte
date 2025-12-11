<script lang="ts">
	interface Props {
		pendingDep: { fromId: string; toId: string } | null;
		onconfirm: (depType: string) => void;
		oncancel: () => void;
	}

	let { pendingDep, onconfirm, oncancel }: Props = $props();
</script>

{#if pendingDep}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="dep-type-overlay" onclick={oncancel}>
		<div class="dep-type-modal" onclick={(e) => e.stopPropagation()}>
			<h3>Link Type</h3>
			<p class="dep-type-hint">How does <strong>{pendingDep.fromId}</strong> relate to <strong>{pendingDep.toId}</strong>?</p>
			<div class="dep-type-options">
				<button class="dep-type-btn" onclick={() => onconfirm('blocks')}>
					<span class="dep-type-icon" style="color: #ef4444;">⊘</span>
					<span class="dep-type-label">Blocks</span>
					<span class="dep-type-desc">Must complete first</span>
				</button>
				<button class="dep-type-btn" onclick={() => onconfirm('related')}>
					<span class="dep-type-icon" style="color: #3b82f6;">↔</span>
					<span class="dep-type-label">Related</span>
					<span class="dep-type-desc">Connected but independent</span>
				</button>
				<button class="dep-type-btn" onclick={() => onconfirm('parent-child')}>
					<span class="dep-type-icon" style="color: #8b5cf6;">↳</span>
					<span class="dep-type-label">Parent-Child</span>
					<span class="dep-type-desc">Epic/subtask relationship</span>
				</button>
				<button class="dep-type-btn" onclick={() => onconfirm('discovered-from')}>
					<span class="dep-type-icon" style="color: #f59e0b;">◊</span>
					<span class="dep-type-label">Discovered From</span>
					<span class="dep-type-desc">Found during work</span>
				</button>
			</div>
			<button class="dep-type-cancel" onclick={oncancel}>Cancel</button>
		</div>
	</div>
{/if}

<style>
	.dep-type-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.dep-type-modal {
		background: var(--bg-secondary);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-lg);
		padding: 1.5rem;
		max-width: 320px;
		width: 90%;
	}

	.dep-type-modal h3 {
		font-size: 1rem;
		margin-bottom: 0.5rem;
		color: var(--text-primary);
	}

	.dep-type-hint {
		font-size: 0.75rem;
		color: var(--text-secondary);
		margin-bottom: 1rem;
	}

	.dep-type-hint strong {
		color: var(--accent-primary);
		font-family: ui-monospace, 'SF Mono', monospace;
	}

	.dep-type-options {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.dep-type-btn {
		display: grid;
		grid-template-columns: 24px 1fr;
		grid-template-rows: auto auto;
		gap: 0 0.5rem;
		padding: 0.75rem;
		background: var(--bg-elevated);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		text-align: left;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.dep-type-btn:hover {
		border-color: var(--accent-primary);
		background: var(--accent-glow);
	}

	.dep-type-icon {
		grid-row: span 2;
		font-size: 1.25rem;
		align-self: center;
	}

	.dep-type-label {
		font-weight: 600;
		font-size: 0.875rem;
		color: var(--text-primary);
	}

	.dep-type-desc {
		font-size: 0.75rem;
		color: var(--text-tertiary);
	}

	.dep-type-cancel {
		width: 100%;
		margin-top: 1rem;
		padding: 0.5rem;
		background: none;
		border: 1px solid var(--border-default);
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.dep-type-cancel:hover {
		background: var(--bg-tertiary);
	}
</style>
