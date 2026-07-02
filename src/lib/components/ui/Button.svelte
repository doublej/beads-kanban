<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import Icon, { type IconName } from '../Icon.svelte';

	type Variant = 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'danger';
	type Size = 'sm' | 'md' | 'lg';

	interface Props extends HTMLButtonAttributes {
		variant?: Variant;
		size?: Size;
		/** Leading icon (lucide name). */
		icon?: IconName;
		/** Trailing icon (lucide name). */
		iconRight?: IconName;
		/** Icon-only button: hides text, squares the padding. */
		iconOnly?: boolean;
		loading?: boolean;
		class?: string;
		children?: Snippet;
	}

	let {
		variant = 'secondary',
		size = 'md',
		icon,
		iconRight,
		iconOnly = false,
		loading = false,
		type = 'button',
		disabled,
		class: className = '',
		children,
		...rest
	}: Props = $props();

	const iconSize = $derived(size === 'sm' ? 14 : size === 'lg' ? 18 : 16);
</script>

<button
	{type}
	class="btn btn-{variant} {size !== 'md' ? `btn-${size}` : ''} {iconOnly ? 'btn-icon' : ''} {className}"
	disabled={disabled || loading}
	{...rest}
>
	{#if loading}
		<Icon name="loader" size={iconSize} class="btn-spin" />
	{:else if icon}
		<Icon name={icon} size={iconSize} />
	{/if}
	{#if !iconOnly}{@render children?.()}{/if}
	{#if iconRight && !loading}
		<Icon name={iconRight} size={iconSize} />
	{/if}
</button>

<style>
	.btn :global(.btn-spin) {
		animation: btn-spin 0.7s linear infinite;
	}
	@keyframes btn-spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
