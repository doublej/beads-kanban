<script lang="ts">
	interface Props {
		ropeDrag: { fromId: string; startX: number; startY: number; currentX: number; currentY: number; targetId: string | null } | null;
	}

	let { ropeDrag }: Props = $props();
</script>

{#if ropeDrag}
	{@const dx = ropeDrag.currentX - ropeDrag.startX}
	{@const dy = ropeDrag.currentY - ropeDrag.startY}
	{@const length = Math.sqrt(dx * dx + dy * dy)}
	{@const hasTarget = !!ropeDrag.targetId}
	{@const midX = ropeDrag.startX + dx * 0.5}
	{@const midY = ropeDrag.startY + dy * 0.5 - Math.min(length * 0.15, 40)}
	{@const pathD = `M ${ropeDrag.startX} ${ropeDrag.startY} Q ${midX} ${midY} ${ropeDrag.currentX} ${ropeDrag.currentY}`}
	<svg class="link-beam" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 9999;">
		<defs>
			<linearGradient id="energyGrad" x1="0%" y1="0%" x2="100%" y2="0%">
				<stop offset="0%" stop-color={hasTarget ? "#22d3ee" : "#64748b"} stop-opacity="0.2" />
				<stop offset="50%" stop-color={hasTarget ? "#06b6d4" : "#94a3b8"} stop-opacity="1" />
				<stop offset="100%" stop-color={hasTarget ? "#22d3ee" : "#64748b"} stop-opacity="0.2" />
			</linearGradient>
			<filter id="energyGlow" x="-50%" y="-50%" width="200%" height="200%">
				<feGaussianBlur stdDeviation="3" result="blur" />
				<feMerge>
					<feMergeNode in="blur" />
					<feMergeNode in="blur" />
					<feMergeNode in="SourceGraphic" />
				</feMerge>
			</filter>
			<filter id="nodeGlow" x="-100%" y="-100%" width="300%" height="300%">
				<feGaussianBlur stdDeviation="8" result="blur" />
				<feMerge>
					<feMergeNode in="blur" />
					<feMergeNode in="blur" />
					<feMergeNode in="SourceGraphic" />
				</feMerge>
			</filter>
		</defs>

		<!-- Ambient glow path -->
		<path
			d={pathD}
			fill="none"
			stroke={hasTarget ? "rgba(34, 211, 238, 0.15)" : "rgba(148, 163, 184, 0.1)"}
			stroke-width="12"
			stroke-linecap="round"
		/>

		<!-- Main energy beam -->
		<path
			d={pathD}
			fill="none"
			stroke={hasTarget ? "#06b6d4" : "#64748b"}
			stroke-width="2"
			stroke-linecap="round"
			filter="url(#energyGlow)"
		/>

		<!-- Flowing particles -->
		<path
			d={pathD}
			fill="none"
			stroke={hasTarget ? "#22d3ee" : "#94a3b8"}
			stroke-width="2"
			stroke-linecap="round"
			stroke-dasharray="4 12"
			class="energy-flow"
		/>

		<!-- Origin node -->
		<g filter="url(#energyGlow)">
			<circle
				cx={ropeDrag.startX}
				cy={ropeDrag.startY}
				r="6"
				fill={hasTarget ? "#06b6d4" : "#64748b"}
				opacity="0.8"
			/>
			<circle
				cx={ropeDrag.startX}
				cy={ropeDrag.startY}
				r="3"
				fill="white"
				opacity="0.9"
			/>
		</g>

		<!-- Target node -->
		<g filter={hasTarget ? "url(#nodeGlow)" : "url(#energyGlow)"}>
			<circle
				cx={ropeDrag.currentX}
				cy={ropeDrag.currentY}
				r={hasTarget ? "14" : "8"}
				fill="none"
				stroke={hasTarget ? "#22d3ee" : "#94a3b8"}
				stroke-width="2"
				class="target-ring"
				class:locked={hasTarget}
			/>
			<circle
				cx={ropeDrag.currentX}
				cy={ropeDrag.currentY}
				r={hasTarget ? "8" : "4"}
				fill={hasTarget ? "#06b6d4" : "#64748b"}
				class="target-core"
				class:locked={hasTarget}
			/>
			<circle
				cx={ropeDrag.currentX}
				cy={ropeDrag.currentY}
				r="2"
				fill="white"
				opacity="0.9"
			/>
		</g>

		<!-- Target label -->
		{#if hasTarget}
			<g class="target-label-energy">
				<text
					x={ropeDrag.currentX}
					y={ropeDrag.currentY - 26}
					text-anchor="middle"
					fill="#22d3ee"
					font-size="11"
					font-weight="600"
					font-family="ui-monospace, 'SF Mono', monospace"
					filter="url(#energyGlow)"
				>{ropeDrag.targetId}</text>
			</g>
		{/if}
	</svg>
{/if}

<style>
	.energy-flow {
		animation: energyFlow 0.8s linear infinite;
	}

	@keyframes energyFlow {
		from { stroke-dashoffset: 0; }
		to { stroke-dashoffset: -16; }
	}

	.target-ring {
		transition: r 0.2s ease-out, stroke 0.2s ease-out;
	}

	.target-ring.locked {
		animation: ringPulse 1.2s ease-in-out infinite;
	}

	.target-core.locked {
		animation: corePulse 1.2s ease-in-out infinite;
	}

	@keyframes ringPulse {
		0%, 100% { stroke-opacity: 0.8; }
		50% { stroke-opacity: 1; }
	}

	@keyframes corePulse {
		0%, 100% { transform: scale(1); }
		50% { transform: scale(1.1); }
	}

	.target-label-energy {
		animation: labelGlow 0.2s ease-out;
	}

	@keyframes labelGlow {
		from { opacity: 0; }
		to { opacity: 1; }
	}
</style>
