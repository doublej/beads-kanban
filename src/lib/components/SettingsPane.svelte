<script lang="ts">
	import Icon from './Icon.svelte';
	import PromptsWindow from './PromptsWindow.svelte';
	import PromptsEditor from './PromptsEditor.svelte';
	import ProjectSettings from './ProjectSettings.svelte';
	import AgentSettings from './AgentSettings.svelte';
	import AppearanceSettings from './AppearanceSettings.svelte';
	import NotificationSettings from './NotificationSettings.svelte';
	import KeyboardShortcuts from './KeyboardShortcuts.svelte';

	interface Props {
		show: boolean;
		showPrompts: boolean;
		showPromptsEditor: boolean;
		isDarkMode: boolean;
		agentEnabled: boolean;
		agentHost: string;
		agentPort: number;
		agentFirstMessage: string;
		agentSystemPrompt: string;
		agentWorkflow: string;
		agentTicketDelivery: string;
		agentTicketNotification: string;
		agentToolsExpanded: boolean;
		colorScheme: string;
		ontoggleTheme: () => void;
		onsetColorScheme: (scheme: string) => void;
	}

	let {
		show = $bindable(),
		showPrompts = $bindable(),
		showPromptsEditor = $bindable(),
		isDarkMode,
		agentEnabled = $bindable(),
		agentHost = $bindable(),
		agentPort = $bindable(),
		agentFirstMessage = $bindable(),
		agentSystemPrompt = $bindable(),
		agentWorkflow = $bindable(),
		agentTicketDelivery = $bindable(),
		agentTicketNotification = $bindable(),
		agentToolsExpanded = $bindable(),
		colorScheme,
		ontoggleTheme,
		onsetColorScheme
	}: Props = $props();

	function handleOverlayClick() {
		show = false;
	}

	function handlePanelClick(e: MouseEvent) {
		e.stopPropagation();
	}
</script>

{#if show}
<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="settings-overlay" onclick={handleOverlayClick} role="presentation">
	<PromptsWindow bind:show={showPrompts} />
	<PromptsEditor
		bind:show={showPromptsEditor}
		bind:agentFirstMessage
		bind:agentSystemPrompt
		bind:agentWorkflow
		bind:agentTicketDelivery
		bind:agentTicketNotification
	/>
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions a11y_click_events_have_key_events -->
	<aside class="settings-pane" onclick={handlePanelClick} role="dialog" aria-label="Settings">
		<header class="settings-header">
			<div class="settings-title-row">
				<span class="settings-icon"><Icon name="settings" size={18} /></span>
				<h2>Settings</h2>
			</div>
			<button class="settings-close" onclick={() => show = false} aria-label="Close settings">
				<Icon name="close" size={16} />
			</button>
		</header>

		<div class="settings-body">
			<ProjectSettings />

			<AgentSettings
				bind:agentEnabled
				bind:agentHost
				bind:agentPort
				bind:agentToolsExpanded
				onopenPromptsEditor={() => showPromptsEditor = true}
			/>

			<AppearanceSettings
				{isDarkMode}
				{colorScheme}
				{ontoggleTheme}
				{onsetColorScheme}
			/>

			<NotificationSettings />

			<KeyboardShortcuts />
		</div>

		<footer class="settings-footer">
			<div class="footer-brand">
				<span class="brand-name">strandkanban</span>
				<span class="brand-version">v0.1.0</span>
			</div>
		</footer>
	</aside>
</div>
{/if}

<style>
	.settings-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(4px);
		z-index: 10000;
		animation: overlayFadeIn 200ms ease-out;
	}

	@keyframes overlayFadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.settings-pane {
		position: absolute;
		top: 0;
		right: 0;
		bottom: 0;
		width: 340px;
		max-width: 90vw;
		background: var(--bg-primary);
		border-left: 1px solid var(--border-subtle);
		display: flex;
		flex-direction: column;
		animation: slideIn 280ms cubic-bezier(0.32, 0.72, 0, 1);
		box-shadow: -8px 0 32px rgba(0, 0, 0, 0.3);
	}

	@keyframes slideIn {
		from { transform: translateX(100%); }
		to { transform: translateX(0); }
	}

	/* Header */
	.settings-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1.25rem;
		border-bottom: 1px solid var(--border-subtle);
		background: linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 100%);
	}

	:global(.app.light) .settings-header {
		background: linear-gradient(180deg, rgba(0,0,0,0.01) 0%, transparent 100%);
	}

	.settings-title-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.settings-icon {
		font-size: 1rem;
		opacity: 0.6;
	}

	.settings-header h2 {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0;
		letter-spacing: -0.01em;
	}

	.settings-close {
		width: 1.75rem;
		height: 1.75rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		color: var(--text-tertiary);
		cursor: pointer;
		transition: all 150ms ease;
	}

	.settings-close :global(svg) {
		width: 1rem;
		height: 1rem;
	}

	.settings-close:hover {
		background: rgba(255, 255, 255, 0.06);
		color: var(--text-secondary);
	}

	:global(.app.light) .settings-close:hover {
		background: rgba(0, 0, 0, 0.06);
	}

	/* Body */
	.settings-body {
		flex: 1;
		overflow-y: auto;
		padding: 0.5rem 0;
	}

	.settings-body > :global(section + section) {
		border-top: 1px solid rgba(255, 255, 255, 0.04);
	}

	:global(.app.light) .settings-body > :global(section + section) {
		border-top-color: rgba(0, 0, 0, 0.04);
	}

	/* Footer */
	.settings-footer {
		padding: 1rem 1.25rem;
		border-top: 1px solid var(--border-subtle);
		background: rgba(0, 0, 0, 0.1);
	}

	:global(.app.light) .settings-footer {
		background: rgba(0, 0, 0, 0.02);
	}

	.footer-brand {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}

	.brand-name {
		font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif;
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: -0.01em;
		color: var(--text-tertiary);
		text-transform: lowercase;
	}

	.brand-version {
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 0.625rem;
		color: var(--text-tertiary);
		opacity: 0.6;
	}
</style>
