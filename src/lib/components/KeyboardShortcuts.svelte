<script lang="ts">
	// Keyboard shortcuts preview for the settings pane
</script>

<section class="settings-section">
	<h3 class="section-label">Keyboard</h3>
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
