<script lang="ts">
	interface Props {
		show: boolean;
	}

	let { show = $bindable() }: Props = $props();

	function handleClose() {
		show = false;
	}

	function handleOverlayClick() {
		handleClose();
	}

	function handleContentClick(e: MouseEvent) {
		e.stopPropagation();
	}
</script>

{#if show}
	<div class="keyboard-help-overlay" onclick={handleOverlayClick}>
		<div class="keyboard-help" onclick={handleContentClick}>
			<div class="keyboard-help-header">
				<h2>Keyboard Shortcuts</h2>
				<button class="keyboard-help-close" onclick={handleClose}>
					<kbd>esc</kbd>
				</button>
			</div>
			<div class="keyboard-help-content">
				<div class="shortcut-group">
					<h3>Navigation</h3>
					<div class="shortcut"><kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd><span>Navigate cards</span></div>
					<div class="shortcut"><kbd>h</kbd><kbd>j</kbd><kbd>k</kbd><kbd>l</kbd><span>Vim-style navigation</span></div>
					<div class="shortcut"><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd><kbd>4</kbd><span>Jump to column</span></div>
				</div>
				<div class="shortcut-group">
					<h3>Actions</h3>
					<div class="shortcut"><kbd>n</kbd><span>New issue</span></div>
					<div class="shortcut"><kbd>o</kbd> or <kbd>↵</kbd><span>Open issue</span></div>
					<div class="shortcut"><kbd>x</kbd><span>Delete issue</span></div>
					<div class="shortcut"><kbd>/</kbd><span>Focus search</span></div>
				</div>
				<div class="shortcut-group">
					<h3>General</h3>
					<div class="shortcut"><kbd>t</kbd><span>Toggle theme</span></div>
					<div class="shortcut"><kbd>?</kbd><span>Show this help</span></div>
					<div class="shortcut"><kbd>esc</kbd><span>Close / Cancel</span></div>
					<div class="shortcut"><kbd>⌥</kbd><span>Hold for hints</span></div>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.keyboard-help-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(8px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		animation: fadeIn 200ms ease-out;
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.keyboard-help {
		background: var(--bg-secondary);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-xl);
		padding: 1.5rem;
		max-width: 480px;
		width: 90%;
		box-shadow: var(--shadow-lg);
		animation: slideUp 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	@keyframes slideUp {
		from { opacity: 0; transform: translateY(20px) scale(0.95); }
		to { opacity: 1; transform: translateY(0) scale(1); }
	}

	.keyboard-help-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1.25rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid var(--border-subtle);
	}

	.keyboard-help-header h2 {
		font-size: 1rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.keyboard-help-close {
		background: transparent;
		border: none;
		cursor: pointer;
		padding: 0.25rem;
	}

	.keyboard-help-close kbd {
		font-size: 0.625rem;
	}

	.keyboard-help-content {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: 1.25rem;
	}

	.shortcut-group h3 {
		font-size: 0.625rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-tertiary);
		margin-bottom: 0.625rem;
	}

	.shortcut {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		margin-bottom: 0.5rem;
		font-size: 0.75rem;
	}

	.shortcut span {
		color: var(--text-secondary);
		margin-left: auto;
	}

	.shortcut kbd, .keyboard-help kbd {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.25rem;
		height: 1.25rem;
		padding: 0 0.375rem;
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 0.625rem;
		font-weight: 500;
		color: var(--text-primary);
		background: var(--bg-tertiary);
		border: 1px solid var(--border-default);
		border-radius: 4px;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
	}
</style>
