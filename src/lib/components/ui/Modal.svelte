<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import Icon from '../Icon.svelte';

	interface Props {
		open?: boolean;
		/** Header title. Omit and use the `header` snippet for custom headers. */
		title?: string;
		/** aria-label when no visible title is rendered. */
		label?: string;
		/** Max panel width, e.g. "32rem". */
		width?: string;
		closeOnBackdrop?: boolean;
		closeOnEsc?: boolean;
		/** Show the default close (×) button in the header. */
		showClose?: boolean;
		class?: string;
		onclose?: () => void;
		header?: Snippet;
		children: Snippet;
		footer?: Snippet;
	}

	let {
		open = $bindable(false),
		title,
		label,
		width = '32rem',
		closeOnBackdrop = true,
		closeOnEsc = true,
		showClose = true,
		class: className = '',
		onclose,
		header,
		children,
		footer
	}: Props = $props();

	let panel = $state<HTMLDivElement | null>(null);

	function close() {
		open = false;
		onclose?.();
	}

	function onBackdrop() {
		if (closeOnBackdrop) close();
	}

	function onKeydown(e: KeyboardEvent) {
		if (open && closeOnEsc && e.key === 'Escape') {
			e.stopPropagation();
			close();
		}
	}

	$effect(() => {
		if (open) panel?.focus();
	});
</script>

<svelte:window onkeydown={onKeydown} />

{#if open}
	<!-- Backdrop is a mouse affordance; keyboard users dismiss via Escape (window handler). -->
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div
		class="modal-overlay"
		onclick={onBackdrop}
		role="presentation"
		transition:fade={{ duration: 150 }}
	>
		<div
			bind:this={panel}
			class="modal-panel {className}"
			style:max-width={width}
			role="dialog"
			aria-modal="true"
			aria-label={title ?? label}
			tabindex="-1"
			onclick={(e) => e.stopPropagation()}
			transition:scale={{ duration: 150, start: 0.96 }}
		>
			{#if header}
				{@render header()}
			{:else if title || showClose}
				<header class="modal-header">
					{#if title}<h2 class="modal-title">{title}</h2>{/if}
					{#if showClose}
						<button class="modal-close" onclick={close} aria-label="Close">
							<Icon name="close" size={18} />
						</button>
					{/if}
				</header>
			{/if}

			<div class="modal-body">
				{@render children()}
			</div>

			{#if footer}
				<footer class="modal-footer">
					{@render footer()}
				</footer>
			{/if}
		</div>
	</div>
{/if}

<style>
	.modal-overlay {
		position: fixed;
		inset: 0;
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
		background: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(8px);
	}

	.modal-panel {
		width: 100%;
		max-height: calc(100vh - 3rem);
		display: flex;
		flex-direction: column;
		background: var(--surface-panel, var(--bg-elevated));
		border: 1px solid var(--border-default, var(--border-subtle));
		border-radius: var(--radius-lg, 0.75rem);
		box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
		outline: none;
		overflow: hidden;
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem 1.25rem;
		border-bottom: 1px solid var(--border-subtle);
	}

	.modal-title {
		margin: 0;
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.modal-close {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.25rem;
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		color: var(--text-tertiary);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.modal-close:hover {
		background: var(--surface-panel);
		color: var(--text-primary);
	}

	.modal-body {
		padding: 1.25rem;
		overflow-y: auto;
	}

	.modal-footer {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.5rem;
		padding: 1rem 1.25rem;
		border-top: 1px solid var(--border-subtle);
	}
</style>
