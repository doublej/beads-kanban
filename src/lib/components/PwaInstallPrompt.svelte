<script lang="ts">
	import { browser } from '$app/environment';
	import { settings } from '$lib/stores/settings.svelte';

	let dismissed = $state(true);
	let deferredPrompt = $state<Event | null>(null);
	let isInstalled = $state(false);

	const DISMISS_KEY = 'beads_pwa_dismissed';
	const DISMISS_DAYS = 7;

	// Check if already installed (standalone mode)
	if (browser) {
		isInstalled = window.matchMedia('(display-mode: standalone)').matches;

		// Check dismissal
		const dismissedAt = localStorage.getItem(DISMISS_KEY);
		if (dismissedAt) {
			const elapsed = Date.now() - Number(dismissedAt);
			dismissed = elapsed < DISMISS_DAYS * 24 * 60 * 60 * 1000;
		} else {
			dismissed = false;
		}
	}

	// Capture beforeinstallprompt event
	if (browser) {
		window.addEventListener('beforeinstallprompt', (e) => {
			e.preventDefault();
			deferredPrompt = e;
		});

		window.addEventListener('appinstalled', () => {
			isInstalled = true;
			deferredPrompt = null;
		});
	}

	function dismiss() {
		dismissed = true;
		if (browser) {
			localStorage.setItem(DISMISS_KEY, String(Date.now()));
		}
	}

	async function installPwa() {
		if (!deferredPrompt) return;
		(deferredPrompt as unknown as { prompt: () => void }).prompt();
		deferredPrompt = null;
	}

	let isIos = $derived(
		browser && /iPad|iPhone|iPod/.test(navigator.userAgent)
	);

	let showPrompt = $derived(
		settings.notificationMode === 'browser' &&
		!isInstalled &&
		!dismissed
	);
</script>

{#if showPrompt}
	<div class="pwa-prompt">
		<div class="pwa-content">
			{#if isIos}
				<div class="pwa-text">
					<strong>Install Beads Kanban</strong>
					<span>Tap <span class="ios-icon">Share</span> then <strong>Add to Home Screen</strong> for push notifications</span>
				</div>
			{:else if deferredPrompt}
				<div class="pwa-text">
					<strong>Install Beads Kanban</strong>
					<span>Install the app for push notifications</span>
				</div>
				<button class="pwa-install" onclick={installPwa}>Install</button>
			{:else}
				<div class="pwa-text">
					<strong>Enable Push Notifications</strong>
					<span>Install this app from your browser menu for push notifications</span>
				</div>
			{/if}
			<button class="pwa-dismiss" onclick={dismiss} aria-label="Dismiss">&times;</button>
		</div>
	</div>
{/if}

<style>
	.pwa-prompt {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		z-index: 9998;
		animation: slideDown 0.3s ease-out;
	}

	@keyframes slideDown {
		from {
			transform: translateY(-100%);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}

	.pwa-content {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.75rem 1rem;
		background: linear-gradient(135deg, #6366f1, #818cf8);
		color: white;
		font-size: 0.8125rem;
	}

	.pwa-text {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.pwa-text strong {
		font-weight: 600;
	}

	.pwa-text span {
		opacity: 0.9;
		font-size: 0.75rem;
	}

	.ios-icon {
		display: inline-block;
		padding: 0.125rem 0.375rem;
		background: rgba(255, 255, 255, 0.2);
		border-radius: 0.25rem;
		font-weight: 600;
		font-size: 0.6875rem;
	}

	.pwa-install {
		padding: 0.5rem 1rem;
		background: white;
		color: #6366f1;
		border: none;
		border-radius: 0.375rem;
		font-weight: 600;
		font-size: 0.8125rem;
		cursor: pointer;
		white-space: nowrap;
		transition: opacity 0.15s;
	}

	.pwa-install:hover {
		opacity: 0.9;
	}

	.pwa-dismiss {
		width: 2rem;
		height: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(255, 255, 255, 0.1);
		border: none;
		border-radius: 50%;
		color: white;
		font-size: 1.25rem;
		cursor: pointer;
		flex-shrink: 0;
		transition: background 0.15s;
	}

	.pwa-dismiss:hover {
		background: rgba(255, 255, 255, 0.2);
	}
</style>
