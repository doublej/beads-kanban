<script lang="ts">
	import { settings } from '$lib/stores/settings.svelte'

	const viewModes = [
		{ key: 'kanban', label: 'Board' },
		{ key: 'table', label: 'Table' },
		{ key: 'flow', label: 'Graph' }
	] as const

	const sortModes = [
		{ key: 'created', label: 'Newest' },
		{ key: 'priority', label: 'Priority' },
		{ key: 'title', label: 'Title' }
	] as const
</script>

<section class="settings-section">
	<h3 class="section-label">Board</h3>

	<div class="setting-row">
		<div class="setting-info">
			<span class="setting-name">Default view</span>
			<span class="setting-desc">Used when the board loads</span>
		</div>
	</div>
	<div class="segmented">
		{#each viewModes as mode}
			<button
				class="segment-option"
				class:active={settings.defaultViewMode === mode.key}
				onclick={() => settings.defaultViewMode = mode.key}
			>
				{mode.label}
			</button>
		{/each}
	</div>

	<div class="setting-row" style="margin-top: 0.75rem">
		<div class="setting-info">
			<span class="setting-name">Default column sort</span>
			<span class="setting-desc">Applies to all columns</span>
		</div>
	</div>
	<div class="segmented">
		{#each sortModes as mode}
			<button
				class="segment-option"
				class:active={settings.defaultColumnSort === mode.key}
				onclick={() => settings.defaultColumnSort = mode.key}
			>
				{mode.label}
			</button>
		{/each}
	</div>

	<div class="setting-row" style="margin-top: 0.75rem">
		<div class="setting-info">
			<span class="setting-name">Show column counts</span>
			<span class="setting-desc">Display totals in headers</span>
		</div>
		<button class="toggle-switch" onclick={() => settings.showColumnCounts = !settings.showColumnCounts} aria-label="Toggle column counts">
			<span class="toggle-track" class:active={settings.showColumnCounts}>
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

	.segmented {
		display: flex;
		gap: 0.375rem;
		margin-top: 0.5rem;
		flex-wrap: wrap;
	}

	.segment-option {
		padding: 0.375rem 0.75rem;
		border-radius: var(--radius-sm);
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: rgba(255, 255, 255, 0.04);
		color: var(--text-secondary);
		font-family: inherit;
		font-size: 0.6875rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 150ms ease;
	}

	.segment-option:hover {
		background: rgba(255, 255, 255, 0.08);
		border-color: rgba(255, 255, 255, 0.12);
	}

	.segment-option.active {
		background: rgba(99, 102, 241, 0.18);
		border-color: rgba(99, 102, 241, 0.35);
		color: var(--text-primary);
	}

	:global(.app.light) .segment-option {
		background: rgba(0, 0, 0, 0.03);
		border-color: rgba(0, 0, 0, 0.08);
	}

	:global(.app.light) .segment-option:hover {
		background: rgba(0, 0, 0, 0.06);
	}

	:global(.app.light) .segment-option.active {
		background: rgba(99, 102, 241, 0.12);
		border-color: rgba(99, 102, 241, 0.28);
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
</style>
