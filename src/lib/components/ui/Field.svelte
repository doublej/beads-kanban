<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		label?: string;
		/** Associates the label with a control by id. */
		for?: string;
		hint?: string;
		class?: string;
		children: Snippet;
	}

	let { label, for: htmlFor, hint, class: className = '', children }: Props = $props();
</script>

<div class="form-group {className}">
	{#if label}<label for={htmlFor}>{label}</label>{/if}
	{@render children()}
	{#if hint}<p class="field-hint">{hint}</p>{/if}
</div>

<style>
	.field-hint {
		margin: 0.375rem 0 0;
		font-size: 0.6875rem;
		color: var(--text-tertiary);
	}
</style>
