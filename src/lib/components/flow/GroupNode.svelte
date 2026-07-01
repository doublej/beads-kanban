<script lang="ts">
	import type { NodeProps } from '@xyflow/svelte';

	let { data }: NodeProps = $props();
	const d = $derived(
		data as { label: string; count: number; color: string; width: number; height: number }
	);
</script>

<div class="group" style="width: {d.width}px; height: {d.height}px; --gc: {d.color}">
	<div class="group-head">
		<span class="dot"></span>
		<span class="lbl" title={d.label}>{d.label}</span>
		<span class="cnt">{d.count}</span>
	</div>
</div>

<style>
	.group {
		box-sizing: border-box;
		border: 1px solid color-mix(in srgb, var(--gc) 40%, transparent);
		border-radius: var(--radius-lg, 12px);
		background: color-mix(in srgb, var(--gc) 7%, transparent);
		pointer-events: none;
	}

	.group-head {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.5rem 0.75rem;
		font: 600 11px/1 var(--font-sans, system-ui);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-secondary, #aaa);
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--gc);
		flex-shrink: 0;
	}

	.lbl {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.cnt {
		margin-left: auto;
		padding: 0.0625rem 0.375rem;
		border-radius: var(--radius-full, 999px);
		background: color-mix(in srgb, var(--gc) 18%, transparent);
		color: var(--text-primary, #eee);
		font-size: 10px;
		flex-shrink: 0;
	}
</style>
