<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		active?: boolean;
		accent?: string;
		size?: 'sm' | 'md';
		title?: string;
		onclick?: () => void;
		children: Snippet;
	};

	let {
		active = false,
		accent = 'transparent',
		size = 'md',
		title,
		onclick,
		children
	}: Props = $props();
</script>

<button
	type="button"
	class="pill"
	class:active
	class:sm={size === 'sm'}
	style="--accent: {accent};"
	{title}
	{onclick}
>
	{@render children()}
</button>

<style>
	.pill {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px;
		height: 26px;
		border: 1px solid var(--dd-border-1);
		border-radius: var(--dd-r-2);
		color: var(--dd-fg-2);
		background: var(--dd-bg-1);
		font-size: 12px;
		letter-spacing: -0.005em;
		white-space: nowrap;
		transition: background 80ms, color 80ms, border-color 80ms;
	}

	.pill.sm {
		height: 22px;
		padding: 2px 8px;
		font-size: 11px;
	}

	.pill:hover {
		background: var(--dd-bg-3);
		color: var(--dd-fg-1);
	}

	.pill.active {
		color: var(--dd-fg-1);
		background: color-mix(in srgb, var(--accent) 18%, var(--dd-bg-2));
		border-color: color-mix(in srgb, var(--accent) 55%, var(--dd-border-2));
	}
</style>
