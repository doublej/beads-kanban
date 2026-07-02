<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon, { type IconName } from '../Icon.svelte';

	interface Props {
		/** Lucide icon name for the illustration. */
		icon?: IconName;
		/** Primary message. */
		title: string;
		class?: string;
		/** Optional trailing content (e.g. an action button). */
		children?: Snippet;
	}

	let { icon, title, class: className = '', children }: Props = $props();
</script>

<div class="empty-state {className}">
	{#if icon}
		<div class="empty-icon"><Icon name={icon} size={24} /></div>
	{/if}
	<p>{title}</p>
	{@render children?.()}
</div>
