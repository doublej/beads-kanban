<script lang="ts">
	type Kind = 'priority' | 'assignee';

	interface Props {
		kind?: Kind;
		/** Overrides the dot colour (else uses the CSS-var default for the kind). */
		color?: string;
		title?: string;
		class?: string;
	}

	let { kind = 'priority', color, title, class: className = '' }: Props = $props();
</script>

<span
	class="{kind}-dot {className}"
	style:background={color}
	{title}
	aria-hidden={title ? undefined : true}
></span>
