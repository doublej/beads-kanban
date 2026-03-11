<script lang="ts">
	import { toastQueue } from '$lib/notifications/toast-queue.svelte';
	import ToastNotification from './ToastNotification.svelte';
</script>

{#if toastQueue.all.length > 0}
	<div class="toast-container">
		{#each toastQueue.all as toast (toast.id)}
			<ToastNotification {toast} onDismiss={() => toastQueue.dismiss(toast.id)} />
		{/each}
	</div>
{/if}

<style>
	.toast-container {
		position: fixed;
		bottom: 64px;
		right: 12px;
		z-index: 9998;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		pointer-events: none;
	}

	.toast-container > :global(*) {
		pointer-events: auto;
	}

	@media (max-width: 640px) {
		.toast-container {
			left: 12px;
			right: 12px;
			bottom: 72px;
		}
	}
</style>
