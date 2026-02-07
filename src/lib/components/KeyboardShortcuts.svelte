<script lang="ts">
	import { settings } from '$lib/stores/settings.svelte'
</script>

<section class="settings-section">
	<h3 class="section-label">Keyboard</h3>
	<div class="setting-row">
		<div class="setting-info">
			<span class="setting-name">Always show key hints</span>
			<span class="setting-desc">Keep shortcut hints visible</span>
		</div>
		<button class="toggle-switch" onclick={() => settings.alwaysShowHotkeys = !settings.alwaysShowHotkeys}>
			<span class="toggle-track" class:active={settings.alwaysShowHotkeys}>
				<span class="toggle-thumb"></span>
			</span>
		</button>
	</div>
	{#if !settings.alwaysShowHotkeys}
		<div class="setting-hint">Hold <kbd>Alt</kbd> to preview hints on the board</div>
	{/if}
	<div class="shortcuts-preview">
		<div class="shortcut-row">
			<kbd>?</kbd>
			<span>Show all shortcuts</span>
		</div>
		<div class="shortcut-row">
			<kbd>N</kbd>
			<span>New issue</span>
		</div>
		<div class="shortcut-row">
			<kbd>T</kbd>
			<span>Toggle theme</span>
		</div>
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
		margin-bottom: 0.5rem;
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

	.setting-hint {
		font-size: 0.625rem;
		color: var(--text-tertiary);
		margin-bottom: 0.75rem;
	}

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

	.shortcuts-preview {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.shortcut-row {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		font-size: 0.75rem;
		color: var(--text-secondary);
	}

	.shortcut-row kbd {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.375rem;
		height: 1.375rem;
		padding: 0 0.375rem;
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 0.625rem;
		font-weight: 500;
		color: var(--text-primary);
		background: var(--bg-tertiary);
		border: 1px solid var(--border-default);
		border-radius: 4px;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
	}
</style>
