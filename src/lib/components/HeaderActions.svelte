<script lang="ts">
	import Icon from './Icon.svelte';

	interface Props {
		isDarkMode: boolean;
		agentPaneCount: number;
		showAgentPanes: boolean;
		ontoggleTheme: () => void;
		onopenKeyboardHelp: () => void;
		onopenSettings?: () => void;
		onopenPrompts?: () => void;
		ontoggleAgentPanes?: () => void;
	}

	let {
		isDarkMode,
		agentPaneCount = 0,
		showAgentPanes = true,
		ontoggleTheme,
		onopenKeyboardHelp,
		onopenSettings,
		onopenPrompts,
		ontoggleAgentPanes
	}: Props = $props();

	let showHelpMenu = $state(false);
</script>

<!-- Chat UI Toggle -->
<button
	class="toolbar-btn"
	class:active={showAgentPanes}
	onclick={ontoggleAgentPanes}
	title="Toggle chat UI"
>
	<Icon name="message" size={14} />
	<span>Chat</span>
	{#if agentPaneCount > 0}
		<span class="toolbar-badge">{agentPaneCount}</span>
	{/if}
</button>

<span class="toolbar-sep"></span>

<!-- Icon buttons group -->
<button class="toolbar-btn" onclick={ontoggleTheme} aria-label="Toggle theme">
	{#if isDarkMode}
		<Icon name="sun" size={14} />
	{:else}
		<Icon name="moon" size={14} />
	{/if}
</button>
<div class="help-wrapper">
	<button class="toolbar-btn" onclick={() => showHelpMenu = !showHelpMenu} aria-label="Help">
		<Icon name="help" size={14} />
	</button>
	{#if showHelpMenu}
		<div class="dropdown-menu" role="menu">
			<a href="/about" class="dropdown-item" onclick={() => showHelpMenu = false}>
				<Icon name="info" size={14} />
				About
			</a>
			<button class="dropdown-item" onclick={() => { showHelpMenu = false; onopenPrompts?.(); }}>
				<Icon name="message" size={14} />
				Prompts
			</button>
			<button class="dropdown-item" onclick={() => { showHelpMenu = false; onopenKeyboardHelp(); }}>
				<Icon name="keyboard" size={14} />
				Keyboard Shortcuts
				<kbd>?</kbd>
			</button>
		</div>
	{/if}
</div>
<button class="toolbar-btn" onclick={onopenSettings} aria-label="Settings">
	<Icon name="settings" size={14} />
</button>

<style>
	.toolbar-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		height: 1.75rem;
		min-width: 1.75rem;
		padding: 0 0.5rem;
		background: transparent;
		border: none;
		border-radius: 0.25rem;
		color: var(--text-tertiary);
		font-family: inherit;
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.1s, color 0.1s;
	}

	.toolbar-btn :global(svg) {
		flex-shrink: 0;
	}

	.toolbar-btn:hover {
		background: rgba(255, 255, 255, 0.06);
		color: var(--text-primary);
	}

	.toolbar-btn.active {
		background: rgba(255, 255, 255, 0.1);
		color: var(--text-primary);
	}

	:global(.app.light) .toolbar-btn:hover {
		background: rgba(0, 0, 0, 0.04);
	}

	:global(.app.light) .toolbar-btn.active {
		background: rgba(0, 0, 0, 0.06);
	}

	.toolbar-badge {
		min-width: 1rem;
		height: 1rem;
		padding: 0 0.25rem;
		background: var(--text-tertiary);
		border-radius: 0.25rem;
		color: var(--bg-primary);
		font-size: 0.625rem;
		font-weight: 600;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.toolbar-sep {
		width: 1px;
		height: 0.75rem;
		background: rgba(255, 255, 255, 0.08);
		margin: 0 0.375rem;
	}

	:global(.app.light) .toolbar-sep {
		background: rgba(0, 0, 0, 0.08);
	}

	.help-wrapper {
		position: relative;
	}

	.dropdown-menu {
		position: absolute;
		top: calc(100% + 0.375rem);
		right: 0;
		min-width: 200px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
		padding: 0.375rem;
		z-index: 1000;
		animation: dropdownFadeIn 0.12s ease-out;
	}

	@keyframes dropdownFadeIn {
		from { opacity: 0; transform: translateY(-4px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.dropdown-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.625rem;
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		font-family: inherit;
		font-size: 0.8125rem;
		text-decoration: none;
		cursor: pointer;
		transition: all var(--transition-fast);
		text-align: left;
		width: 100%;
	}

	.dropdown-item:hover {
		background: rgba(255, 255, 255, 0.06);
		color: var(--text-primary);
	}

	.dropdown-item :global(svg) {
		width: 0.875rem;
		height: 0.875rem;
		flex-shrink: 0;
		opacity: 0.7;
	}

	.dropdown-item kbd {
		margin-left: auto;
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 0.625rem;
		color: var(--text-tertiary);
		background: rgba(255, 255, 255, 0.04);
		padding: 0.125rem 0.375rem;
		border-radius: 3px;
	}

	@media (max-width: 768px) {
		.toolbar-btn {
			height: 1.5rem;
			min-width: 1.5rem;
			padding: 0 0.375rem;
		}

		.toolbar-btn span:not(.toolbar-badge) {
			display: none;
		}

		.toolbar-badge {
			min-width: 0.75rem;
			height: 0.75rem;
			font-size: 0.5rem;
		}

		.toolbar-sep {
			display: none;
		}
	}
</style>
