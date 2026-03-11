<script lang="ts">
	import type { Toast } from '$lib/notifications/types';

	let {
		toast,
		onDismiss
	}: {
		toast: Toast;
		onDismiss: () => void;
	} = $props();

	const typeIcons: Record<Toast['type'], string> = {
		info: '◉',
		success: '✓',
		warning: '⚠',
		error: '✕'
	};
</script>

<div
	class="toast toast-{toast.type}"
	role="alert"
	onclick={onDismiss}
>
	<div class="toast-indicator"></div>
	<div class="toast-icon">{typeIcons[toast.type]}</div>
	<div class="toast-content">
		<div class="toast-title">{toast.title}</div>
		<div class="toast-message">{toast.message}</div>
	</div>
	{#if toast.action}
		<button
			class="toast-action"
			onclick={(e) => {
				e.stopPropagation();
				toast.action?.handler();
				onDismiss();
			}}
		>
			{toast.action.label}
		</button>
	{/if}
	<button class="toast-dismiss" onclick={onDismiss} aria-label="Dismiss">×</button>
</div>

<style>
	.toast {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		padding: 0.625rem 0.75rem;
		background: var(--surface-elevated);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		box-shadow: var(--shadow-lg);
		min-width: 280px;
		max-width: 360px;
		cursor: pointer;
		animation: toastSlideIn 200ms cubic-bezier(0.25, 0.1, 0.25, 1);
		backdrop-filter: saturate(180%) blur(20px);
		-webkit-backdrop-filter: saturate(180%) blur(20px);
		position: relative;
		overflow: hidden;
	}

	@keyframes toastSlideIn {
		from {
			opacity: 0;
			transform: translateX(16px) scale(0.96);
		}
		to {
			opacity: 1;
			transform: translateX(0) scale(1);
		}
	}

	.toast:hover {
		border-color: var(--border-strong);
	}

	/* Type indicator strip */
	.toast-indicator {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 3px;
		border-radius: var(--radius-md) 0 0 var(--radius-md);
	}

	.toast-info .toast-indicator { background: #3b82f6; }
	.toast-success .toast-indicator { background: #10b981; }
	.toast-warning .toast-indicator { background: #f59e0b; }
	.toast-error .toast-indicator { background: #ef4444; }

	.toast-icon {
		flex-shrink: 0;
		width: 1.25rem;
		height: 1.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.75rem;
		font-weight: 600;
		border-radius: var(--radius-sm);
	}

	.toast-info .toast-icon {
		background: rgba(59, 130, 246, 0.15);
		color: #3b82f6;
	}

	.toast-success .toast-icon {
		background: rgba(16, 185, 129, 0.15);
		color: #10b981;
	}

	.toast-warning .toast-icon {
		background: rgba(245, 158, 11, 0.15);
		color: #f59e0b;
	}

	.toast-error .toast-icon {
		background: rgba(239, 68, 68, 0.15);
		color: #ef4444;
	}

	.toast-content {
		flex: 1;
		min-width: 0;
	}

	.toast-title {
		font-weight: 600;
		font-size: 0.8125rem;
		line-height: 1.3;
		color: var(--text-primary);
	}

	.toast-message {
		font-size: 0.75rem;
		line-height: 1.4;
		color: var(--text-secondary);
		overflow: hidden;
		text-overflow: ellipsis;
		margin-top: 0.125rem;
	}

	.toast-action {
		padding: 0.25rem 0.625rem;
		border-radius: var(--radius-sm);
		background: var(--accent-glow);
		border: 1px solid var(--border-default);
		color: var(--accent-primary);
		font-size: 0.6875rem;
		font-weight: 600;
		cursor: pointer;
		transition: all var(--transition-fast);
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.toast-action:hover {
		background: var(--accent-primary);
		border-color: var(--accent-primary);
		color: white;
	}

	.toast-dismiss {
		width: 1.25rem;
		height: 1.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-sm);
		background: transparent;
		border: none;
		color: var(--text-tertiary);
		font-size: 1rem;
		line-height: 1;
		cursor: pointer;
		transition: all var(--transition-fast);
		flex-shrink: 0;
	}

	.toast-dismiss:hover {
		background: var(--surface-panel);
		color: var(--text-primary);
	}

	/* Light mode */
	:global(.app.light) .toast {
		background: rgba(255, 255, 255, 0.92);
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 0 0 0.5px rgba(0, 0, 0, 0.06);
	}

	:global(.app.light) .toast-dismiss:hover {
		background: rgba(0, 0, 0, 0.05);
	}

	:global(.app.light) .toast-action:hover {
		background: var(--accent-primary);
		color: white;
	}
</style>
