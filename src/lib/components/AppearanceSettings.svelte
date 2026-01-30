<script lang="ts">
	import Icon from './Icon.svelte';

	interface Props {
		isDarkMode: boolean;
		colorScheme: string;
		notificationsEnabled: boolean;
		ontoggleTheme: () => void;
		onsetColorScheme: (scheme: string) => void;
		ontoggleNotifications: () => void;
	}

	let {
		isDarkMode,
		colorScheme,
		notificationsEnabled,
		ontoggleTheme,
		onsetColorScheme,
		ontoggleNotifications
	}: Props = $props();

	const colorSchemes = [
		{ id: 'default', name: 'Default', accent: '#6366f1', bg: '#27272a' },
		{ id: 'ocean', name: 'Ocean', accent: '#0ea5e9', bg: '#0c4a6e' },
		{ id: 'forest', name: 'Forest', accent: '#22c55e', bg: '#14532d' },
		{ id: 'sunset', name: 'Sunset', accent: '#f97316', bg: '#431407' },
		{ id: 'rose', name: 'Rose', accent: '#f43f5e', bg: '#4c0519' }
	];
</script>

<section class="settings-section">
	<h3 class="section-label">Appearance</h3>
	<div class="setting-row">
		<div class="setting-info">
			<span class="setting-name">Theme</span>
			<span class="setting-desc">Toggle dark/light mode</span>
		</div>
		<button class="theme-toggle" onclick={ontoggleTheme}>
			<span class="theme-track" class:dark={isDarkMode}>
				<span class="theme-thumb">
					{#if isDarkMode}
						<Icon name="moon" size={12} />
					{:else}
						<Icon name="sun" size={12} />
					{/if}
				</span>
			</span>
		</button>
	</div>
	<div class="setting-row" style="margin-top: 0.75rem">
		<div class="setting-info">
			<span class="setting-name">Color Scheme</span>
			<span class="setting-desc">Accent color theme</span>
		</div>
	</div>
	<div class="color-scheme-selector">
		{#each colorSchemes as scheme}
			<button
				class="color-scheme-option"
				class:active={colorScheme === scheme.id}
				onclick={() => onsetColorScheme(scheme.id)}
				style="--scheme-accent: {scheme.accent}; --scheme-bg: {scheme.bg}"
			>
				<span class="scheme-preview">
					<span class="scheme-dot"></span>
				</span>
				<span class="scheme-name">{scheme.name}</span>
			</button>
		{/each}
	</div>
	<div class="setting-row" style="margin-top: 0.75rem">
		<div class="setting-info">
			<span class="setting-name">Notifications</span>
			<span class="setting-desc">Alert on blocking events</span>
		</div>
		<button class="toggle-switch" onclick={ontoggleNotifications}>
			<span class="toggle-track" class:active={notificationsEnabled}>
				<span class="toggle-thumb"></span>
			</span>
		</button>
	</div>
</section>

<style>
	.settings-section {
		padding: 0.75rem 1.25rem;
	}

	.section-label {
		font-size: 0.625rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--text-tertiary);
		margin: 0 0 0.625rem 0;
	}

	.setting-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.setting-info {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.setting-name {
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--text-primary);
	}

	.setting-desc {
		font-size: 0.6875rem;
		color: var(--text-tertiary);
	}

	/* Toggle Switch */
	.toggle-switch {
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
	}

	.toggle-track {
		display: flex;
		align-items: center;
		width: 36px;
		height: 20px;
		padding: 2px;
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 10px;
		transition: all 200ms ease;
	}

	.toggle-track.active {
		background: rgba(34, 211, 238, 0.2);
		border-color: rgba(34, 211, 238, 0.3);
	}

	:global(.app.light) .toggle-track {
		background: rgba(0, 0, 0, 0.06);
		border-color: rgba(0, 0, 0, 0.1);
	}

	:global(.app.light) .toggle-track.active {
		background: rgba(6, 182, 212, 0.15);
		border-color: rgba(6, 182, 212, 0.25);
	}

	.toggle-thumb {
		width: 14px;
		height: 14px;
		background: var(--text-tertiary);
		border-radius: 50%;
		transition: all 200ms ease;
	}

	.toggle-track.active .toggle-thumb {
		transform: translateX(16px);
		background: #22d3ee;
	}

	:global(.app.light) .toggle-track.active .toggle-thumb {
		background: #0891b2;
	}

	/* Theme Toggle */
	.theme-toggle {
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
	}

	.theme-track {
		display: flex;
		align-items: center;
		width: 44px;
		height: 24px;
		padding: 2px;
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 12px;
		transition: all 200ms ease;
	}

	.theme-track.dark {
		background: rgba(99, 102, 241, 0.2);
		border-color: rgba(99, 102, 241, 0.3);
	}

	:global(.app.light) .theme-track {
		background: rgba(0, 0, 0, 0.06);
		border-color: rgba(0, 0, 0, 0.1);
	}

	:global(.app.light) .theme-track.dark {
		background: rgba(99, 102, 241, 0.15);
	}

	.theme-thumb {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		background: var(--bg-elevated);
		border-radius: 50%;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
		transition: transform 200ms ease;
	}

	.theme-track.dark .theme-thumb {
		transform: translateX(20px);
		background: #818cf8;
	}

	.theme-thumb :global(svg) {
		width: 11px;
		height: 11px;
		color: var(--text-secondary);
	}

	.theme-track.dark .theme-thumb :global(svg) {
		color: white;
	}

	/* Color Scheme Selector */
	.color-scheme-selector {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		margin-top: 0.5rem;
	}

	.color-scheme-option {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.625rem;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		font-family: inherit;
		font-size: 0.6875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 150ms ease;
	}

	.color-scheme-option:hover {
		background: rgba(255, 255, 255, 0.08);
		border-color: rgba(255, 255, 255, 0.12);
	}

	.color-scheme-option.active {
		background: color-mix(in srgb, var(--scheme-accent) 15%, transparent);
		border-color: color-mix(in srgb, var(--scheme-accent) 30%, transparent);
		color: var(--text-primary);
	}

	:global(.app.light) .color-scheme-option {
		background: rgba(0, 0, 0, 0.03);
		border-color: rgba(0, 0, 0, 0.08);
	}

	:global(.app.light) .color-scheme-option:hover {
		background: rgba(0, 0, 0, 0.06);
	}

	.scheme-preview {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 14px;
		height: 14px;
		background: var(--scheme-bg);
		border-radius: 3px;
	}

	.scheme-dot {
		width: 8px;
		height: 8px;
		background: var(--scheme-accent);
		border-radius: 50%;
	}

	.scheme-name {
		font-size: 0.6875rem;
	}
</style>
