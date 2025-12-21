<script lang="ts">
	import Icon from './Icon.svelte';

	interface Props {
		pendingDep: { fromId: string; toId: string } | null;
		onconfirm: (depType: string) => Promise<void>;
		oncancel: () => void;
	}

	let { pendingDep, onconfirm, oncancel }: Props = $props();

	let isSubmitting = $state(false);
	let selectedType = $state<string | null>(null);
	let feedback = $state<{ type: 'success' | 'error'; message: string } | null>(null);

	async function handleSelect(depType: string) {
		if (isSubmitting) return;
		isSubmitting = true;
		selectedType = depType;
		feedback = null;

		try {
			await onconfirm(depType);
			feedback = { type: 'success', message: 'Link created' };
			setTimeout(() => {
				oncancel();
			}, 400);
		} catch {
			feedback = { type: 'error', message: 'Failed to create link' };
			isSubmitting = false;
			selectedType = null;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && !isSubmitting) {
			oncancel();
		}
	}

	const depTypes = [
		{ id: 'blocks', icon: 'dep-blocks' as const, label: 'Blocks', desc: 'Must complete first', color: '#ef4444' },
		{ id: 'related', icon: 'dep-related' as const, label: 'Related', desc: 'Connected but independent', color: '#3b82f6' },
		{ id: 'parent-child', icon: 'dep-parent' as const, label: 'Parent-Child', desc: 'Epic/subtask relationship', color: '#8b5cf6' },
		{ id: 'discovered-from', icon: 'dep-discovered' as const, label: 'Discovered', desc: 'Found during work', color: '#f59e0b' }
	];
</script>

<svelte:window onkeydown={handleKeydown} />

{#if pendingDep}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="dep-overlay" onclick={() => !isSubmitting && oncancel()} role="presentation">
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div class="dep-modal" class:submitting={isSubmitting} onclick={(e) => e.stopPropagation()} role="dialog" aria-label="Link issues" tabindex="-1">
			<header class="dep-header">
				<div class="dep-title-row">
					<span class="dep-title-icon"><Icon name="link" size={16} /></span>
					<h3>Link Issues</h3>
				</div>
				<button
					class="dep-close"
					onclick={oncancel}
					disabled={isSubmitting}
					aria-label="Close"
				>
					<Icon name="close" size={14} />
				</button>
			</header>

			<p class="dep-hint">
				How does <code>{pendingDep.fromId}</code> relate to <code>{pendingDep.toId}</code>?
			</p>

			<div class="dep-options">
				{#each depTypes as dep}
					<button
						class="dep-btn"
						class:selected={selectedType === dep.id}
						class:loading={isSubmitting && selectedType === dep.id}
						onclick={() => handleSelect(dep.id)}
						disabled={isSubmitting}
						style="--dep-color: {dep.color}"
					>
						<span class="dep-icon">
							{#if isSubmitting && selectedType === dep.id}
								<Icon name="loader" size={18} />
							{:else}
								<Icon name={dep.icon} size={18} />
							{/if}
						</span>
						<span class="dep-label">{dep.label}</span>
						<span class="dep-desc">{dep.desc}</span>
					</button>
				{/each}
			</div>

			{#if feedback}
				<div class="dep-feedback" class:success={feedback.type === 'success'} class:error={feedback.type === 'error'}>
					<Icon name={feedback.type === 'success' ? 'check-circle' : 'alert-circle'} size={14} />
					<span>{feedback.message}</span>
				</div>
			{/if}

			<button class="dep-cancel" onclick={oncancel} disabled={isSubmitting}>
				<kbd>esc</kbd>
				<span>Cancel</span>
			</button>
		</div>
	</div>
{/if}

<style>
	.dep-overlay {
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

	.dep-modal {
		background: var(--bg-primary);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-xl);
		padding: 0;
		max-width: 340px;
		width: 90%;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
		animation: modalSlideUp 280ms cubic-bezier(0.34, 1.56, 0.64, 1);
		overflow: hidden;
	}

	.dep-modal.submitting {
		pointer-events: none;
	}

	@keyframes modalSlideUp {
		from { opacity: 0; transform: translateY(16px) scale(0.96); }
		to { opacity: 1; transform: translateY(0) scale(1); }
	}

	/* Header */
	.dep-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.875rem 1rem;
		border-bottom: 1px solid var(--border-subtle);
		background: linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 100%);
	}

	:global(.app.light) .dep-header {
		background: linear-gradient(180deg, rgba(0,0,0,0.01) 0%, transparent 100%);
	}

	.dep-title-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.dep-title-icon {
		color: var(--text-tertiary);
	}

	.dep-header h3 {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0;
		letter-spacing: -0.01em;
	}

	.dep-close {
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

	.dep-close:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.06);
		color: var(--text-secondary);
	}

	.dep-close:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	:global(.app.light) .dep-close:hover:not(:disabled) {
		background: rgba(0, 0, 0, 0.06);
	}

	/* Hint */
	.dep-hint {
		font-size: 0.75rem;
		color: var(--text-secondary);
		margin: 0;
		padding: 0.75rem 1rem;
		line-height: 1.5;
	}

	.dep-hint code {
		color: var(--accent-primary);
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 0.6875rem;
		font-weight: 600;
		background: rgba(99, 102, 241, 0.1);
		padding: 0.125rem 0.375rem;
		border-radius: 4px;
	}

	/* Options */
	.dep-options {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding: 0 0.75rem;
	}

	.dep-btn {
		display: grid;
		grid-template-columns: 32px 1fr;
		grid-template-rows: auto auto;
		gap: 0 0.5rem;
		padding: 0.625rem 0.75rem;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: var(--radius-md);
		text-align: left;
		cursor: pointer;
		transition: all 180ms ease;
	}

	.dep-btn:hover:not(:disabled) {
		background: color-mix(in srgb, var(--dep-color) 10%, transparent);
		border-color: color-mix(in srgb, var(--dep-color) 30%, transparent);
		transform: translateX(4px);
	}

	.dep-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.dep-btn.selected {
		background: color-mix(in srgb, var(--dep-color) 15%, transparent);
		border-color: color-mix(in srgb, var(--dep-color) 40%, transparent);
	}

	.dep-btn.loading .dep-icon :global(svg) {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}

	:global(.app.light) .dep-btn {
		background: rgba(0, 0, 0, 0.02);
		border-color: rgba(0, 0, 0, 0.06);
	}

	.dep-icon {
		grid-row: span 2;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--dep-color);
	}

	.dep-label {
		font-weight: 600;
		font-size: 0.8125rem;
		color: var(--text-primary);
		line-height: 1.3;
	}

	.dep-desc {
		font-size: 0.6875rem;
		color: var(--text-tertiary);
		line-height: 1.4;
	}

	/* Feedback */
	.dep-feedback {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0.75rem 0.75rem 0;
		padding: 0.5rem 0.75rem;
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		font-weight: 500;
		animation: feedbackSlide 200ms ease-out;
	}

	@keyframes feedbackSlide {
		from { opacity: 0; transform: translateY(-4px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.dep-feedback.success {
		background: rgba(34, 197, 94, 0.1);
		border: 1px solid rgba(34, 197, 94, 0.2);
		color: #22c55e;
	}

	.dep-feedback.error {
		background: rgba(239, 68, 68, 0.1);
		border: 1px solid rgba(239, 68, 68, 0.2);
		color: #ef4444;
	}

	:global(.app.light) .dep-feedback.success {
		color: #16a34a;
	}

	:global(.app.light) .dep-feedback.error {
		color: #dc2626;
	}

	/* Cancel */
	.dep-cancel {
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

	.dep-cancel:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.04);
		border-color: rgba(255, 255, 255, 0.12);
		color: var(--text-secondary);
	}

	.dep-cancel:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	:global(.app.light) .dep-cancel {
		border-color: rgba(0, 0, 0, 0.08);
	}

	:global(.app.light) .dep-cancel:hover:not(:disabled) {
		background: rgba(0, 0, 0, 0.04);
	}

	.dep-cancel kbd {
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
