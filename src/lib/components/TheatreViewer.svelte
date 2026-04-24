<script lang="ts">
	import type { Attachment } from '$lib/types';
	import Icon from './Icon.svelte';

	interface Props {
		issueId: string;
		attachments: Attachment[];
		initialIndex: number;
		onclose: () => void;
	}

	let { issueId, attachments, initialIndex, onclose }: Props = $props();

	let currentIndex = $state(0);
	$effect(() => { currentIndex = initialIndex; });
	let isAnimating = $state(true);
	let isExpanded = $state(false);
	let stageEl: HTMLDivElement | null = $state(null);

	const imageAttachments = $derived(
		attachments.filter(a => a.mimetype.startsWith('image/'))
	);

	const currentImage = $derived(imageAttachments[currentIndex]);

	function nextImage() {
		if (isAnimating) return;
		currentIndex = (currentIndex + 1) % imageAttachments.length;
	}

	function prevImage() {
		if (isAnimating) return;
		currentIndex = (currentIndex - 1 + imageAttachments.length) % imageAttachments.length;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') closeTheatre();
		if (e.key === 'ArrowRight') nextImage();
		if (e.key === 'ArrowLeft') prevImage();
	}

	function closeTheatre() {
		if (isAnimating) return;
		onclose();
	}

	function handleOverlayClick(e: MouseEvent) {
		if (e.target === e.currentTarget) closeTheatre();
	}

	$effect(() => {
		document.body.style.overflow = 'hidden';

		// Start expansion after initial render
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				isExpanded = true;
			});
		});

		setTimeout(() => { isAnimating = false; }, 1000);
		return () => { document.body.style.overflow = ''; };
	});
</script>

<svelte:window onkeydown={handleKeydown} />

<div
	class="theatre-overlay"
	onclick={handleOverlayClick}
	onkeydown={(e) => e.key === 'Escape' && closeTheatre()}
	role="button"
	tabindex="-1"
	aria-label="Close"
>
	<div class="theatre-stage" class:open={!isAnimating} class:expanded={isExpanded} bind:this={stageEl}>
		<div class="theatre-content">
			<button class="theatre-close" onclick={closeTheatre}>
				<Icon name="close" size={20} />
			</button>

			<div class="theatre-hero">
				{#if currentImage}
					{#key currentImage.filename}
						<img
							src="/api/issues/{issueId}/attachments/{currentImage.filename}"
							alt={currentImage.filename}
							class="theatre-image"
						/>
					{/key}
				{/if}
			</div>

			<div class="theatre-filmroll">
				{#each imageAttachments as img, i}
					<button
						class="filmroll-thumb"
						class:active={i === currentIndex}
						onclick={() => { currentIndex = i; }}
					>
						<img
							src="/api/issues/{issueId}/attachments/{img.filename}"
							alt={img.filename}
						/>
					</button>
				{/each}
			</div>
		</div>
	</div>
</div>

<style>
	.theatre-overlay {
		position: fixed;
		inset: 0;
		z-index: 1000;
		background: rgba(0, 0, 0, 0.95);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.theatre-stage {
		position: fixed;
		inset: 0;
		background: #141414;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		clip-path: inset(10% 45% 10% 45% round 8px);
	}

	.theatre-stage.expanded {
		animation: stageExpand 550ms cubic-bezier(0.32, 0.72, 0, 1) forwards;
	}

	/* Top arc */
	.theatre-stage::before {
		content: '';
		position: absolute;
		top: -50px;
		left: -5%;
		right: -5%;
		height: 80px;
		background: var(--surface-app, #fafafa);
		border-radius: 0 0 50% 50%;
		z-index: 2;
		transition: opacity 400ms ease;
	}

	/* Bottom arc */
	.theatre-stage::after {
		content: '';
		position: absolute;
		bottom: -50px;
		left: -5%;
		right: -5%;
		height: 80px;
		background: var(--surface-app, #fafafa);
		border-radius: 50% 50% 0 0;
		z-index: 2;
		transition: opacity 400ms ease;
	}

	.theatre-stage.open::before,
	.theatre-stage.open::after {
		opacity: 0;
	}

	@keyframes stageExpand {
		from {
			clip-path: inset(10% 45% 10% 45% round 8px);
		}
		to {
			clip-path: inset(0 0 0 0 round 0);
		}
	}

	.theatre-content {
		position: relative;
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		z-index: 3;
	}

	.theatre-close {
		position: absolute;
		top: 20px;
		right: 20px;
		background: rgba(0, 0, 0, 0.5);
		border: 1px solid rgba(255, 255, 255, 0.1);
		color: white;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 200ms ease;
		z-index: 10;
		opacity: 0;
		animation: fadeIn 400ms ease 300ms forwards;
	}

	.theatre-close:hover {
		background: rgba(0, 0, 0, 0.8);
		border-color: rgba(255, 255, 255, 0.3);
		transform: scale(1.1);
	}

	.theatre-hero {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 60px 24px 24px;
		overflow: hidden;
	}

	.theatre-image {
		max-width: 1400px;
		max-height: 100%;
		width: auto;
		height: auto;
		object-fit: contain;
		border-radius: 8px;
		opacity: 0;
		transform: scale(0.95);
		animation: imageEnter 400ms cubic-bezier(0.32, 0.72, 0, 1) 300ms forwards;
	}

	@keyframes imageEnter {
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	@keyframes fadeIn {
		to {
			opacity: 1;
		}
	}

	.theatre-filmroll {
		display: flex;
		gap: 8px;
		padding: 12px 24px;
		overflow-x: auto;
		justify-content: center;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
		flex-shrink: 0;
		opacity: 0;
		animation: fadeIn 400ms ease 600ms forwards;
	}

	.theatre-filmroll::-webkit-scrollbar {
		height: 6px;
	}

	.theatre-filmroll::-webkit-scrollbar-track {
		background: rgba(255, 255, 255, 0.05);
	}

	.theatre-filmroll::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.2);
		border-radius: 3px;
	}

	.theatre-filmroll::-webkit-scrollbar-thumb:hover {
		background: rgba(255, 255, 255, 0.3);
	}

	.filmroll-thumb {
		width: 100px;
		height: 65px;
		border: 2px solid transparent;
		border-radius: 6px;
		opacity: 0.4;
		transition: all 200ms ease;
		cursor: pointer;
		padding: 0;
		background: transparent;
		overflow: hidden;
		flex-shrink: 0;
	}

	.filmroll-thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.filmroll-thumb:hover {
		opacity: 0.7;
		transform: translateY(-2px);
	}

	.filmroll-thumb.active {
		opacity: 1;
		border-color: var(--accent-primary, #3b82f6);
	}

	@media (max-width: 768px) {
		.theatre-hero {
			padding: 40px 12px 12px;
		}

		.theatre-close {
			top: 12px;
			right: 12px;
			width: 36px;
			height: 36px;
		}

		.theatre-filmroll {
			padding: 8px 12px;
			gap: 6px;
		}

		.filmroll-thumb {
			width: 80px;
			height: 52px;
		}
	}
</style>
