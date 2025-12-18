<script lang="ts">
	interface Props {
		active: boolean;
		toLight: boolean;
		onswitch: () => void;
		ondone: () => void;
	}

	let { active, toLight, onswitch, ondone }: Props = $props();

	const TOTAL_DURATION = 3600;
	const SWITCH_AT = 2880; // 80% - when fade out begins

	$effect(() => {
		if (active) {
			const switchTimer = setTimeout(onswitch, SWITCH_AT);
			const doneTimer = setTimeout(ondone, TOTAL_DURATION);
			return () => {
				clearTimeout(switchTimer);
				clearTimeout(doneTimer);
			};
		}
	});
</script>

{#if active}
<div class="transition-overlay" class:to-light={toLight}>
	<!-- Masked viewport for feathered horizon -->
	<div class="horizon-mask">
		<!-- Revolver disc - rotates around anchor point far right -->
		<div class="revolver" class:to-light={toLight}>
		<!-- Sun: solid disc -->
		<div class="celestial sun">
			<svg viewBox="0 0 100 100">
				<circle cx="50" cy="50" r="42" fill="currentColor"/>
			</svg>
		</div>

		<!-- Second sun: smaller, offset -->
		<div class="celestial sun-b">
			<svg viewBox="0 0 100 100">
				<circle cx="50" cy="50" r="42" fill="currentColor"/>
			</svg>
		</div>

		<!-- Moon: solid disc -->
		<div class="celestial moon">
			<svg viewBox="0 0 100 100">
				<circle cx="50" cy="50" r="42" fill="currentColor"/>
			</svg>
		</div>
	</div>
</div>
</div>
{/if}

<style>
	.transition-overlay {
		position: fixed;
		inset: 0;
		z-index: 10000;
		pointer-events: none;
		overflow: hidden;
		animation:
			overlayFade 3600ms ease-in-out forwards,
			bgToDark 3600ms ease-in-out forwards;
	}

	/* Going to dark: light → dark */
	.transition-overlay {
		background: #faf5f0;
	}

	/* Going to light: dark → light */
	.transition-overlay.to-light {
		background: #0c0f1a;
		animation:
			overlayFade 3600ms ease-in-out forwards,
			bgToLight 3600ms ease-in-out forwards;
	}

	@keyframes overlayFade {
		0% { opacity: 0; }
		10% { opacity: 1; }
		80% { opacity: 1; }
		100% { opacity: 0; }
	}

	@keyframes bgToDark {
		0% { background: #faf5f0; }
		50% { background: #1e293b; }
		100% { background: #0c0f1a; }
	}

	@keyframes bgToLight {
		0% { background: #0c0f1a; }
		50% { background: #fde68a; }
		100% { background: #faf5f0; }
	}

	/* Feathered horizon mask */
	.horizon-mask {
		position: absolute;
		inset: 0;
		-webkit-mask-image: linear-gradient(
			to bottom,
			black 0%,
			black 55%,
			transparent 75%
		);
		mask-image: linear-gradient(
			to bottom,
			black 0%,
			black 55%,
			transparent 75%
		);
	}

	/* The revolver disc */
	.revolver {
		position: absolute;
		/* Anchor point: far right of viewport, above center */
		top: 28%;
		right: -125vw;
		width: 240vw;
		height: 240vw;
		transform-origin: center center;
		/* Start with sun visible (moon is 180deg away, off-screen left) */
		transform: translateY(-50%) rotate(0deg);
		animation: revolverSpin 2400ms cubic-bezier(0.2, 0, 0.1, 1) forwards;
		animation-delay: 600ms;
	}

	/* When going to light, start with moon visible, rotate to sun */
	.revolver.to-light {
		transform: translateY(-50%) rotate(180deg);
		animation: revolverSpinReverse 2400ms cubic-bezier(0.2, 0, 0.1, 1) forwards;
		animation-delay: 600ms;
	}

	@keyframes revolverSpin {
		0% {
			transform: translateY(-50%) rotate(0deg);
		}
		100% {
			transform: translateY(-50%) rotate(180deg);
		}
	}

	@keyframes revolverSpinReverse {
		0% {
			transform: translateY(-50%) rotate(180deg);
		}
		100% {
			transform: translateY(-50%) rotate(360deg);
		}
	}

	/* Celestial bodies on the disc */
	.celestial {
		position: absolute;
		width: 43vw;
		height: 43vw;
		max-width: 500px;
		max-height: 500px;
		min-width: 240px;
		min-height: 240px;
	}

	.celestial svg {
		width: 100%;
		height: 100%;
	}

	/* Sun: solid disc */
	.sun {
		top: 50%;
		left: 32%;
		transform: translate(-50%, -50%);
		color: rgba(255, 255, 255, 0.5);
		filter: drop-shadow(0 0 80px rgba(255, 255, 255, 0.15));
	}

	/* Second sun: smaller, offset down-left, parallax depth */
	.sun-b {
		top: 52%;
		left: 22%;
		transform: translate(-50%, -50%) scale(0.55);
		color: rgba(255, 255, 255, 0.35);
		filter: drop-shadow(0 0 60px rgba(255, 255, 255, 0.1));
		animation: sunBParallax 2400ms cubic-bezier(0.2, 0, 0.1, 1) forwards;
		animation-delay: 600ms;
	}

	@keyframes sunBParallax {
		0% {
			transform: translate(-50%, -50%) scale(0.55) rotate(0deg);
		}
		100% {
			transform: translate(-50%, -50%) scale(0.55) rotate(-12deg);
		}
	}

	/* Moon: solid disc */
	.moon {
		top: 50%;
		right: 32%;
		transform: translate(50%, -50%) rotate(180deg);
		color: rgba(255, 255, 255, 0.5);
		filter: drop-shadow(0 0 60px rgba(255, 255, 255, 0.1));
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.transition-overlay,
		.revolver {
			animation-duration: 0.01ms !important;
			animation-delay: 0ms !important;
		}
	}
</style>
