<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import Icon from '$lib/components/Icon.svelte';
	import { Kbd } from '$lib/components/ui';
	import { triageActions, findTriageSector, type TriageAction } from '$lib/zen-triage';

	interface Props {
		issueId: string;
		onselect: (action: TriageAction) => void;
		oncancel: () => void;
	}

	let { issueId, onselect, oncancel }: Props = $props();

	const reduced =
		typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

	// px of accumulated travel before a sector highlights / a settled gesture commits
	const HIGHLIGHT_AT = 40;
	const COMMIT_AT = 90;

	let highlighted = $state<number | null>(null);
	// Accumulated finger-movement vector for the current trackpad gesture.
	let swipe = $state({ x: 0, y: 0 });
	let settleTimer: ReturnType<typeof setTimeout> | undefined;

	// Full path of the current gesture as unitless dial factors (1 = petal
	// radius), seeded at the hub center. Drawn as a continuous line so each
	// swipe reads as center → direction; a settled gesture clears it and the
	// next one starts from scratch.
	let trail = $state<{ id: number; cx: number; cy: number }[]>([]);
	let trailId = 0;

	const magnitude = $derived(Math.hypot(swipe.x, swipe.y));
	/** 0..1 fill of the hub ring — how close the gesture is to committing. */
	const progress = $derived(Math.min(magnitude / COMMIT_AT, 1));
	/** Release past this point commits — the comet has visually reached the petal. */
	const armed = $derived(progress >= 1);
	const swipeAngle = $derived(Math.atan2(swipe.y, swipe.x));
	const head = $derived(trail.at(-1) ?? null);
	const activeTint = $derived(
		highlighted !== null ? triageActions[highlighted].color : 'var(--zen-accent)'
	);

	function commit(index: number | null) {
		if (index === null) return;
		onselect(triageActions[index]);
	}

	// Trackpad swipes arrive as wheel deltas. With natural scrolling (macOS
	// default) finger movement is the inverse of the scroll delta, so negate.
	// The gesture commits once it settles (no events for 160ms) above the
	// commit threshold — the hub needle and ring preview the pick before it lands.
	function onWheel(e: WheelEvent) {
		e.preventDefault();
		e.stopImmediatePropagation();
		swipe = { x: swipe.x - e.deltaX, y: swipe.y - e.deltaY };
		// COMMIT_AT of finger travel maps to exactly one petal radius on screen,
		// so the comet reaching the petal *is* the commit threshold.
		const travel = Math.min(magnitude, COMMIT_AT * 1.06) / COMMIT_AT;
		if (!trail.length) trail = [{ id: trailId++, cx: 0, cy: 0 }];
		trail = [
			...trail,
			{ id: trailId++, cx: Math.cos(swipeAngle) * travel, cy: Math.sin(swipeAngle) * travel }
		];
		// Wiggle guard: keep the origin + the recent path if a gesture runs long.
		if (trail.length > 240) trail = [trail[0], ...trail.slice(-200)];
		if (magnitude >= HIGHLIGHT_AT) {
			highlighted = findTriageSector(swipe.x, swipe.y);
		}
		clearTimeout(settleTimer);
		settleTimer = setTimeout(() => {
			if (Math.hypot(swipe.x, swipe.y) >= COMMIT_AT && highlighted !== null) {
				commit(highlighted);
			} else {
				swipe = { x: 0, y: 0 };
				trail = [];
			}
		}, 160);
	}

	// Capture-phase listener; ZenReview yields all keys while this is open.
	function onKey(e: KeyboardEvent) {
		if (e.metaKey || e.ctrlKey || e.altKey) return;
		const k = e.key;
		const num = parseInt(k, 10);
		let handled = true;
		if (num >= 1 && num <= triageActions.length) commit(num - 1);
		else if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'l' || k === 'j' || k === 'Tab')
			highlighted = highlighted === null ? 0 : (highlighted + 1) % triageActions.length;
		else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'h' || k === 'k')
			highlighted =
				highlighted === null
					? triageActions.length - 1
					: (highlighted + triageActions.length - 1) % triageActions.length;
		else if (k === 'Enter' || k === ' ') commit(highlighted);
		else if (k === 'Escape' || k === 'q' || k === 'Q') oncancel();
		else handled = false;
		e.stopImmediatePropagation();
		if (handled) e.preventDefault();
	}

	$effect(() => {
		window.addEventListener('keydown', onKey, true);
		window.addEventListener('wheel', onWheel, { capture: true, passive: false });
		return () => {
			window.removeEventListener('keydown', onKey, true);
			window.removeEventListener('wheel', onWheel, true);
			clearTimeout(settleTimer);
		};
	});
</script>

<div
	class="quick"
	class:reduced
	role="dialog"
	aria-modal="true"
	aria-label="Quick triage"
	transition:fade={{ duration: reduced ? 0 : 160 }}
>
	<div
		class="dial"
		class:armed
		in:scale={{ start: 0.96, duration: reduced ? 0 : 240, easing: cubicOut }}
	>
		{#each triageActions as action, i (action.value)}
			<span
				class="spoke"
				class:lit={highlighted === i}
				style:--angle="{action.angle}deg"
				style:--tint={action.color}
			></span>
		{/each}

		{#each triageActions as action, i (action.value)}
			<button
				class="petal"
				class:active={highlighted === i}
				style:--angle="{action.angle}deg"
				style:--tint={action.color}
				style:animation-delay="{i * 26}ms"
				onclick={() => commit(i)}
				onmouseenter={() => (highlighted = i)}
				onmouseleave={() => (highlighted = highlighted === i ? null : highlighted)}
			>
				<span class="petal-icon"><Icon name={action.icon} size={17} /></span>
				<span class="petal-label">{action.label}</span>
				<span class="petal-hint">{action.hint}</span>
				<span class="petal-key"><Kbd>{i + 1}</Kbd></span>
			</button>
		{/each}

		<div class="hub">
			<!-- Ring fills as the swipe approaches the commit threshold, in the
			     color of the sector it is pointing at. -->
			<svg class="hub-ring" viewBox="0 0 148 148" aria-hidden="true">
				<circle class="ring-track" cx="74" cy="74" r="71" />
				<circle
					class="ring-fill"
					cx="74"
					cy="74"
					r="71"
					pathLength="100"
					style:stroke-dashoffset={100 - progress * 100}
					style:stroke={activeTint}
				/>
			</svg>
			<span class="hub-eyebrow">Triage</span>
			<span class="hub-id mono">{issueId}</span>
			<span class="hub-hint">swipe · 1–5 · esc</span>
		</div>

		{#if head}
			<div class="swipe-layer" style:color={activeTint} aria-hidden="true">
				<!-- 1 viewBox unit = one petal radius, so points are the dial factors. -->
				<svg class="swipe-path" viewBox="-1.1 -1.1 2.2 2.2">
					<polyline
						points={trail.map((p) => `${p.cx.toFixed(3)},${p.cy.toFixed(3)}`).join(' ')}
						vector-effect="non-scaling-stroke"
					/>
				</svg>
				<span class="swipe-dot" class:armed style:--tx={head.cx} style:--ty={head.cy}></span>
			</div>
		{/if}
	</div>
</div>

<style>
	.quick {
		position: fixed;
		inset: 0;
		z-index: 1010;
		/* Layered like .zen: solid-ish scrim + accent bloom pulled from the same
		   --zen-accent the backdrop uses, so the overlay reads as part of it. */
		background-color: color-mix(in srgb, var(--surface-app, #18181b) 72%, transparent);
		background-image: radial-gradient(
			85% 70% at 50% 50%,
			color-mix(in srgb, var(--zen-accent, var(--accent-primary)) 10%, transparent),
			transparent 65%
		);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
	}
	.dial {
		--radius: clamp(160px, 27vh, 225px);
		--hub-r: 74px;
		position: absolute;
		inset: 0;
	}

	/* Spokes ------------------------------------------------------------ */
	.spoke {
		position: absolute;
		left: 50%;
		top: 50%;
		width: calc(var(--radius) - var(--hub-r) - 18px);
		height: 1px;
		transform-origin: 0 50%;
		transform: rotate(var(--angle)) translateX(calc(var(--hub-r) + 8px));
		background: linear-gradient(90deg, transparent, var(--border-subtle));
		opacity: 0.6;
		transition: opacity 160ms ease, background 160ms ease;
		pointer-events: none;
	}
	.spoke.lit {
		background: linear-gradient(
			90deg,
			transparent,
			color-mix(in srgb, var(--tint) 65%, transparent)
		);
		opacity: 1;
	}

	/* Hub ---------------------------------------------------------------- */
	.hub {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		width: calc(var(--hub-r) * 2);
		height: calc(var(--hub-r) * 2);
		border-radius: 50%;
		background: color-mix(in srgb, var(--surface-app, #18181b) 55%, transparent);
	}
	.hub-ring {
		position: absolute;
		inset: 0;
		transform: rotate(-90deg);
		pointer-events: none;
	}
	.hub-ring circle {
		fill: none;
		stroke-width: 2;
	}
	.ring-track {
		stroke: var(--border-subtle);
	}
	.ring-fill {
		stroke-dasharray: 100 100;
		stroke-linecap: round;
		transition: stroke-dashoffset 90ms linear, stroke 160ms ease;
	}
	.hub-eyebrow {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--text-tertiary);
	}
	.hub-id {
		max-width: 116px;
		font-size: 12px;
		font-weight: 600;
		color: var(--text-primary);
		text-align: center;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.hub-hint {
		font-size: 10px;
		color: var(--text-muted);
	}

	/* Swipe comet ---------------------------------------------------------- */
	/* Mirrors the trackpad gesture 1:1: the head dot travels from the hub
	   toward a petal as the fingers move; the trail is the finger's path. */
	.swipe-layer {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 2;
	}
	.swipe-path {
		position: absolute;
		left: 50%;
		top: 50%;
		width: calc(var(--radius) * 2.2);
		height: calc(var(--radius) * 2.2);
		transform: translate(-50%, -50%);
		overflow: visible;
	}
	.swipe-path polyline {
		fill: none;
		stroke: currentColor;
		stroke-width: 2.5px;
		stroke-linecap: round;
		stroke-linejoin: round;
		opacity: 0.45;
	}
	.swipe-dot {
		position: absolute;
		left: 50%;
		top: 50%;
		border-radius: 50%;
		background: currentColor;
		transform: translate(-50%, -50%)
			translate(calc(var(--tx) * var(--radius)), calc(var(--ty) * var(--radius)));
		width: 12px;
		height: 12px;
		box-shadow: 0 0 14px 2px currentColor;
		transition: transform 60ms linear, width 120ms ease, height 120ms ease, box-shadow 120ms ease;
	}
	.swipe-dot.armed {
		width: 17px;
		height: 17px;
		box-shadow: 0 0 26px 6px currentColor;
	}

	/* Petals -------------------------------------------------------------- */
	.petal {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%)
			translate(calc(cos(var(--angle)) * var(--radius)), calc(sin(var(--angle)) * var(--radius)));
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		width: 178px;
		padding: 14px 12px 11px;
		border-radius: 16px;
		border: 1px solid transparent;
		background: transparent;
		color: var(--text-secondary);
		cursor: pointer;
		z-index: 3;
		animation: petal-in 280ms cubic-bezier(0.22, 1, 0.36, 1) backwards;
		transition:
			transform 160ms cubic-bezier(0.22, 1, 0.36, 1),
			border-color 160ms ease,
			background 160ms ease,
			box-shadow 160ms ease;
	}
	@keyframes petal-in {
		from {
			opacity: 0;
			transform: translate(-50%, -50%)
				translate(
					calc(cos(var(--angle)) * var(--radius) * 0.8),
					calc(sin(var(--angle)) * var(--radius) * 0.8)
				);
		}
	}
	.quick.reduced .petal {
		animation: none;
	}
	.petal-icon {
		display: flex;
		color: var(--tint);
		margin-bottom: 3px;
		filter: drop-shadow(0 0 10px color-mix(in srgb, var(--tint) 45%, transparent));
	}
	.petal-label {
		font-family: var(--font-display);
		font-size: 15px;
		font-weight: 600;
		letter-spacing: -0.01em;
		color: var(--text-primary);
		text-align: center;
		line-height: 1.25;
		text-wrap: balance;
	}
	.petal-hint {
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-tertiary);
	}
	.petal-key {
		margin-top: 6px;
		opacity: 0.55;
		transition: opacity 160ms ease;
	}
	.petal.active {
		/* Nudged outward along its own spoke — the dial "reaches" toward the pick. */
		transform: translate(-50%, -50%)
			translate(
				calc(cos(var(--angle)) * (var(--radius) + 10px)),
				calc(sin(var(--angle)) * (var(--radius) + 10px))
			);
		border-color: color-mix(in srgb, var(--tint) 45%, transparent);
		background: color-mix(in srgb, var(--tint) 9%, transparent);
		box-shadow: 0 8px 40px color-mix(in srgb, var(--tint) 20%, transparent);
	}
	.petal.active .petal-key {
		opacity: 1;
	}
	/* Comet reached the petal — releasing now commits. */
	.dial.armed .petal.active {
		border-color: color-mix(in srgb, var(--tint) 75%, transparent);
		background: color-mix(in srgb, var(--tint) 14%, transparent);
		box-shadow: 0 10px 52px color-mix(in srgb, var(--tint) 32%, transparent);
	}

	:global(.app.light) .quick {
		background-color: color-mix(in srgb, var(--surface-app, #fafafa) 72%, transparent);
	}
	:global(.app.light) .hub {
		background: color-mix(in srgb, var(--surface-app, #fafafa) 55%, transparent);
	}

	@media (max-width: 700px), (max-height: 560px) {
		.dial {
			--radius: clamp(120px, 34vw, 165px);
			--hub-r: 56px;
		}
		.petal { width: 128px; padding: 10px 8px 8px; }
		.petal-hint, .petal-key { display: none; }
		.hub-id { max-width: 88px; }
		.hub-hint { display: none; }
	}
</style>
