<script lang="ts">
	import type { Toast } from '$lib/notifications/types';

	let {
		toast,
		onDismiss
	}: {
		toast: Toast;
		onDismiss: () => void;
	} = $props();

	const typeStyles: Record<Toast['type'], string> = {
		info: 'bg-blue-500 border-blue-400',
		success: 'bg-green-500 border-green-400',
		warning: 'bg-yellow-500 border-yellow-400',
		error: 'bg-red-500 border-red-400'
	};

	const typeIcons: Record<Toast['type'], string> = {
		info: 'ℹ️',
		success: '✓',
		warning: '⚠',
		error: '✗'
	};
</script>

<div
	class="toast {typeStyles[toast.type]}"
	role="alert"
	onclick={onDismiss}
>
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
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		border-radius: 0.5rem;
		border-width: 1px;
		color: white;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
		min-width: 300px;
		max-width: 400px;
		cursor: pointer;
		animation: slideIn 0.3s ease-out;
	}

	@keyframes slideIn {
		from {
			transform: translateX(100%);
			opacity: 0;
		}
		to {
			transform: translateX(0);
			opacity: 1;
		}
	}

	.toast:hover {
		opacity: 0.95;
	}

	.toast-icon {
		font-size: 1.25rem;
		flex-shrink: 0;
	}

	.toast-content {
		flex: 1;
		min-width: 0;
	}

	.toast-title {
		font-weight: 600;
		font-size: 0.875rem;
		margin-bottom: 0.125rem;
	}

	.toast-message {
		font-size: 0.8125rem;
		opacity: 0.95;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.toast-action {
		padding: 0.25rem 0.75rem;
		border-radius: 0.25rem;
		background: rgba(255, 255, 255, 0.2);
		border: 1px solid rgba(255, 255, 255, 0.3);
		color: white;
		font-size: 0.8125rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.15s;
	}

	.toast-action:hover {
		background: rgba(255, 255, 255, 0.3);
	}

	.toast-dismiss {
		width: 1.5rem;
		height: 1.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 0.25rem;
		background: rgba(255, 255, 255, 0.1);
		border: none;
		color: white;
		font-size: 1.25rem;
		line-height: 1;
		cursor: pointer;
		transition: background 0.15s;
		flex-shrink: 0;
	}

	.toast-dismiss:hover {
		background: rgba(255, 255, 255, 0.2);
	}
</style>
