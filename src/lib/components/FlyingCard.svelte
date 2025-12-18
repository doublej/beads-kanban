<script lang="ts">
	interface CardPosition {
		x: number;
		y: number;
		w: number;
		h: number;
	}

	interface Teleport {
		id: string;
		from: CardPosition;
		to: CardPosition;
		startTime: number;
	}

	interface Props {
		teleports: Teleport[];
	}

	let { teleports }: Props = $props();
</script>

<!-- Teleport Ghost Strobe Effects -->
{#each teleports as teleport}
	{@const dx = teleport.to.x - teleport.from.x}
	{@const dy = teleport.to.y - teleport.from.y}
	{#each [0, 1, 2, 3, 4] as i}
		<div
			class="teleport-ghost"
			style="
				--from-x: {teleport.from.x}px;
				--from-y: {teleport.from.y}px;
				--to-x: {teleport.to.x}px;
				--to-y: {teleport.to.y}px;
				--ghost-w: {teleport.from.w}px;
				--ghost-h: {teleport.from.h}px;
				--delay: {i * 40}ms;
				--opacity: {0.6 - i * 0.1};
			"
		></div>
	{/each}
{/each}

<!-- Flying Cards hidden - only ghost strobe effect shown, card appears at destination when data updates -->

<style>
	.teleport-ghost {
		position: fixed;
		top: 0;
		left: 0;
		width: var(--ghost-w);
		height: var(--ghost-h);
		background: linear-gradient(135deg, rgba(59, 130, 246, 0.3) 0%, rgba(99, 102, 241, 0.2) 100%);
		border: 2px solid rgba(59, 130, 246, 0.6);
		border-radius: var(--radius-md);
		pointer-events: none;
		z-index: 9999;
		opacity: var(--opacity);
		animation: teleportStrobe 600ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
		animation-delay: var(--delay);
		box-shadow:
			0 0 20px rgba(59, 130, 246, 0.4),
			0 0 40px rgba(99, 102, 241, 0.2),
			inset 0 0 20px rgba(59, 130, 246, 0.1);
	}

	@keyframes teleportStrobe {
		0% {
			transform: translate(var(--from-x), var(--from-y));
			opacity: var(--opacity);
			filter: blur(0px);
		}
		20% {
			opacity: calc(var(--opacity) * 1.2);
			filter: blur(1px);
		}
		80% {
			opacity: calc(var(--opacity) * 0.8);
			filter: blur(2px);
		}
		100% {
			transform: translate(var(--to-x), var(--to-y));
			opacity: 0;
			filter: blur(4px);
		}
	}
</style>
