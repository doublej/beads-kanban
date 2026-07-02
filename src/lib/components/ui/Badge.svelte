<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon, { type IconName } from '../Icon.svelte';

	type Variant = 'priority' | 'type' | 'deps' | 'dependents' | 'assignee';

	interface Props {
		variant?: Variant;
		icon?: IconName;
		title?: string;
		class?: string;
		children?: Snippet;
	}

	let { variant = 'type', icon, title, class: className = '', children }: Props = $props();
</script>

<span class="badge {variant} {className}" {title}>
	{#if icon}<Icon name={icon} size={10} class="badge-icon" />{/if}
	{@render children?.()}
</span>
