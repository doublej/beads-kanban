<script lang="ts">
	type Props = { name: string; size?: number; class?: string };
	let { name, size = 14, class: cls = '' }: Props = $props();
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	viewBox="0 0 16 16"
	width={size}
	height={size}
	fill="none"
	stroke="currentColor"
	stroke-width="1.5"
	stroke-linecap="round"
	stroke-linejoin="round"
	class={cls}
	aria-hidden="true"
>
	{#if name === 'circle'}
		<circle cx="8" cy="8" r="5.5" />
	{:else if name === 'circle-dot'}
		<circle cx="8" cy="8" r="5.5" />
		<circle cx="8" cy="8" r="1.5" fill="currentColor" />
	{:else if name === 'circle-slash'}
		<circle cx="8" cy="8" r="5.5" />
		<path d="M4 4l8 8" />
	{:else if name === 'check-circle'}
		<circle cx="8" cy="8" r="5.5" />
		<path d="M5.5 8.2l1.8 1.8 3.2-3.5" />
	{:else if name === 'check'}
		<path d="M3 8.5l3 3 7-7" />
	{:else if name === 'x'}
		<path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
	{:else if name === 'plus'}
		<path d="M8 3v10M3 8h10" />
	{:else if name === 'chevron-down'}
		<path d="M3 6l5 5 5-5" />
	{:else if name === 'chevron-right'}
		<path d="M6 3l5 5-5 5" />
	{:else if name === 'pin'}
		<path d="M9.5 2l4.5 4.5-2 1.5-1 4-4-4 4-1L7 4z" fill="currentColor" stroke="none" />
		<path d="M7 9l-4 4" />
	{:else if name === 'copy'}
		<rect x="5" y="5" width="9" height="9" rx="1.5" />
		<path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" />
	{:else if name === 'lightning'}
		<path d="M9 1.5L3 9h4l-1 5.5L13 7H9l1-5.5z" fill="currentColor" stroke="none" />
	{:else if name === 'link'}
		<path d="M7 9a3 3 0 0 0 4.2 0l1.8-1.8a3 3 0 1 0-4.2-4.2L7.8 4" />
		<path d="M9 7a3 3 0 0 0-4.2 0L3 8.8a3 3 0 1 0 4.2 4.2L8.2 12" />
	{:else if name === 'unlink'}
		<path d="M11 3l2 2M3 11l2 2" />
		<path d="M7 9a3 3 0 0 0 4.2 0l1.8-1.8a3 3 0 1 0-4.2-4.2L7.8 4" />
	{:else if name === 'tree'}
		<circle cx="4" cy="4" r="1.5" />
		<circle cx="4" cy="12" r="1.5" />
		<circle cx="12" cy="8" r="1.5" />
		<path d="M5.5 4h2A2.5 2.5 0 0 1 10 6.5v0A1.5 1.5 0 0 0 11.5 8h-1M5.5 12h2A2.5 2.5 0 0 0 10 9.5v0A1.5 1.5 0 0 1 11.5 8" />
	{:else if name === 'dep-blocks'}
		<path d="M2.5 8a3 3 0 0 1 3-3h2v1.5h-2a1.5 1.5 0 0 0 0 3h2V11h-2a3 3 0 0 1-3-3z" fill="currentColor" stroke="none" />
		<path d="M13.5 8a3 3 0 0 0-3-3h-2v1.5h2a1.5 1.5 0 0 1 0 3h-2V11h2a3 3 0 0 0 3-3z" fill="currentColor" stroke="none" />
		<path d="M11.5 3.5l-7 9" />
	{:else if name === 'dep-related'}
		<circle cx="5" cy="8" r="2.5" />
		<circle cx="11" cy="8" r="2.5" />
	{:else if name === 'task'}
		<rect x="2.5" y="2.5" width="11" height="11" rx="2" />
		<path d="M5.5 8l2 2 3-4" />
	{:else if name === 'bug'}
		<path d="M5 5.5C5 3.5 6 2.5 8 2.5s3 1 3 3" />
		<rect x="4" y="5.5" width="8" height="7" rx="3.5" />
		<path d="M4 8H2M14 8h-2M4 11H2M14 11h-2M4 5L2.5 3.5M12 5l1.5-1.5M8 12.5v1.5" />
	{:else if name === 'feature'}
		<path d="M8 2l1.6 4.4L14 8l-4.4 1.6L8 14l-1.6-4.4L2 8l4.4-1.6z" />
	{:else if name === 'epic'}
		<path d="M3 13V5l5-2.5L13 5v8" />
		<path d="M3 13h10M6 13V8h4v5" />
	{:else if name === 'chore'}
		<path d="M10.5 3.5l2 2-7 7-3 1 1-3z" />
		<path d="M9 5l2 2" />
	{:else if name === 'send'}
		<path d="M2 8l12-5-5 12-1.5-4.5z" />
	{:else if name === 'trash'}
		<path d="M3 4h10M6 4V2.5h4V4M5 4l.5 9h5L11 4" />
		<path d="M6.5 6.5v4M9.5 6.5v4" />
	{:else if name === 'image'}
		<rect x="2.5" y="2.5" width="11" height="11" rx="1.5" />
		<circle cx="6" cy="6" r="1.2" />
		<path d="M2.5 11l3-3 3 3 2-2 3 3" />
	{:else if name === 'file'}
		<path d="M4 2.5h5L12 5.5V13a.5.5 0 0 1-.5.5h-7A.5.5 0 0 1 4 13V3a.5.5 0 0 1 .5-.5z" />
		<path d="M9 2.5V5.5h3" />
	{:else if name === 'search'}
		<circle cx="7" cy="7" r="4" />
		<path d="M10 10l3 3" />
	{:else if name === 'agent'}
		<rect x="3" y="4" width="10" height="8" rx="2" />
		<circle cx="6.5" cy="8" r="0.7" fill="currentColor" stroke="none" />
		<circle cx="9.5" cy="8" r="0.7" fill="currentColor" stroke="none" />
		<path d="M8 2v2M5 12v1.5M11 12v1.5" />
	{:else if name === 'edit'}
		<path d="M11 2.5l2.5 2.5-7.5 7.5L2 13l.5-4z" />
	{:else if name === 'eye'}
		<path d="M1.5 8s2.5-5 6.5-5 6.5 5 6.5 5-2.5 5-6.5 5-6.5-5-6.5-5z" />
		<circle cx="8" cy="8" r="2" />
	{:else if name === 'message'}
		<path d="M2.5 3.5h11v7H6l-3 2.5v-2.5H2.5z" />
	{:else if name === 'paperclip'}
		<path d="M12 7l-5 5a2.5 2.5 0 0 1-3.5-3.5l6-6a4 4 0 0 1 5.5 5.5l-6 6" />
	{:else if name === 'command'}
		<path d="M4.5 2.5a2 2 0 1 0 2 2v7a2 2 0 1 0 2-2v-7a2 2 0 1 1 2 2H4.5a2 2 0 1 1 2-2" />
	{:else if name === 'return'}
		<path d="M13 4v3.5a2 2 0 0 1-2 2H3M3 9.5L5.5 12M3 9.5L5.5 7" />
	{:else if name === 'sparkles'}
		<path d="M8 2l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" />
		<path d="M13 9l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5z" />
	{:else if name === 'play'}
		<path d="M5 3.5L12 8l-7 4.5z" fill="currentColor" />
	{:else if name === 'circle-pulse'}
		<circle cx="8" cy="8" r="2" fill="currentColor" stroke="none" />
		<circle cx="8" cy="8" r="5" opacity="0.4" />
	{/if}
</svg>
