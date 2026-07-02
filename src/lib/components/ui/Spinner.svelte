<script lang="ts">
	import Icon from '../Icon.svelte';

	interface Props {
		size?: number;
		class?: string;
		/** Accessible label; falls back to a visually-hidden "Loading". */
		label?: string;
	}

	let { size = 16, class: className = '', label = 'Loading' }: Props = $props();
</script>

<span class="spinner {className}" role="status" aria-label={label}>
	<Icon name="loader" {size} class="spinner-icon" />
</span>

<style>
	.spinner {
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
	.spinner :global(.spinner-icon) {
		animation: spinner-rotate 0.7s linear infinite;
	}
	@keyframes spinner-rotate {
		to {
			transform: rotate(360deg);
		}
	}
</style>
