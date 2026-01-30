<script lang="ts">
	import { toastQueue } from '$lib/notifications/toast-queue.svelte';
	import ToastNotification from './ToastNotification.svelte';
</script>

<div class="toast-container">
	{#each toastQueue.all as toast (toast.id)}
		<ToastNotification {toast} onDismiss={() => toastQueue.dismiss(toast.id)} />
	{/each}
</div>

<style>
	.toast-container {
		position: fixed;
		bottom: 1rem;
		right: 1rem;
		z-index: 9999;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		pointer-events: none;
	}

	.toast-container > :global(*) {
		pointer-events: auto;
	}

	@media (max-width: 640px) {
		.toast-container {
			left: 1rem;
			right: 1rem;
		}
	}
</style>
