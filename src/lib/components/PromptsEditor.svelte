<script lang="ts">
	import Icon from './Icon.svelte';
	import MarkdownContent from './MarkdownContent.svelte';

	interface Props {
		show: boolean;
		agentFirstMessage: string;
		agentSystemPrompt: string;
		agentWorkflow: string;
	}

	let {
		show = $bindable(),
		agentFirstMessage = $bindable(),
		agentSystemPrompt = $bindable(),
		agentWorkflow = $bindable()
	}: Props = $props();

	let activeTab = $state<'first' | 'system' | 'workflow'>('workflow');
	let showPreview = $state(false);

	const tabs = [
		{ id: 'first' as const, label: 'First Message', icon: 'message' as const },
		{ id: 'system' as const, label: 'System Prompt', icon: 'file' as const },
		{ id: 'workflow' as const, label: 'Workflow', icon: 'zap' as const }
	];

	const activeContent = $derived(
		activeTab === 'first' ? agentFirstMessage :
		activeTab === 'system' ? agentSystemPrompt :
		agentWorkflow
	);

	const placeholder = $derived(
		activeTab === 'first' ? 'You are an agent named "{name}". Await further instructions.' :
		activeTab === 'system' ? '# Agent Instructions\n\nAdd custom instructions, context, or guidelines for all agents...' :
		'# Ticket Workflow\n\nDefine the mandatory workflow steps for agents...'
	);

	const hint = $derived(
		activeTab === 'first' ? 'Initial briefing sent to new agents. Use {name} for agent name.' :
		activeTab === 'system' ? 'Additional context appended to agent system prompt. Use {name} for agent name.' :
		'Mandatory workflow injected into every agent session.'
	);

	function updateContent(value: string) {
		if (activeTab === 'first') agentFirstMessage = value;
		else if (activeTab === 'system') agentSystemPrompt = value;
		else agentWorkflow = value;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			show = false;
		}
	}
</script>

<svelte:window onkeydown={show ? handleKeydown : undefined} />

{#if show}
<aside class="editor-window" role="dialog" aria-label="Prompts Editor" tabindex="-1">
		<header class="editor-header">
			<div class="header-left">
				<Icon name="sliders" size={16} />
				<h2>Agent Prompts</h2>
			</div>
			<div class="header-actions">
				<button
					class="preview-toggle"
					class:active={showPreview}
					onclick={() => showPreview = !showPreview}
				>
					<Icon name="view-board" size={14} />
					<span>Preview</span>
				</button>
				<button class="close-btn" onclick={() => show = false} aria-label="Close">
					<Icon name="close" size={16} />
				</button>
			</div>
		</header>

		<div class="editor-body">
			<nav class="editor-tabs">
				{#each tabs as tab}
					<button
						class="tab"
						class:active={activeTab === tab.id}
						onclick={() => activeTab = tab.id}
					>
						<Icon name={tab.icon} size={14} />
						<span class="tab-label">{tab.label}</span>
					</button>
				{/each}
			</nav>

			<div class="editor-content">
				<div class="content-header">
					<span class="content-hint">{hint}</span>
				</div>

				{#if showPreview}
					<div class="split-view">
						<div class="edit-pane">
							<textarea
								class="prompt-textarea"
								value={activeContent}
								oninput={(e) => updateContent(e.currentTarget.value)}
								{placeholder}
								spellcheck="false"
							></textarea>
						</div>
						<div class="preview-pane">
							<div class="preview-label">Preview</div>
							<div class="preview-content">
								<MarkdownContent content={activeContent || placeholder} />
							</div>
						</div>
					</div>
				{:else}
					<textarea
						class="prompt-textarea full"
						value={activeContent}
						oninput={(e) => updateContent(e.currentTarget.value)}
						{placeholder}
						spellcheck="false"
					></textarea>
				{/if}
			</div>
		</div>

	<footer class="editor-footer">
		<div class="footer-hint">
			<kbd>Esc</kbd> close
		</div>
		<div class="footer-stats">
			{activeContent.length} characters
		</div>
	</footer>
</aside>
{/if}

<style>
	.editor-window {
		position: absolute;
		top: 0;
		right: 340px; /* Position to left of settings pane */
		bottom: 0;
		width: 680px;
		max-width: calc(100vw - 340px);
		background: var(--bg-primary);
		border-right: 1px solid var(--border-subtle);
		display: flex;
		flex-direction: column;
		animation: slideIn 280ms cubic-bezier(0.32, 0.72, 0, 1);
		box-shadow: -8px 0 32px rgba(0, 0, 0, 0.3);
	}

	@keyframes slideIn {
		from { transform: translateX(100%); opacity: 0; }
		to { transform: translateX(0); opacity: 1; }
	}

	.editor-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.875rem 1.25rem;
		border-bottom: 1px solid var(--border-subtle);
		background: linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 100%);
	}

	:global(.app.light) .editor-header {
		background: linear-gradient(180deg, rgba(0,0,0,0.01) 0%, transparent 100%);
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		color: var(--text-tertiary);
	}

	.header-left h2 {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.preview-toggle {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.75rem;
		background: transparent;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: var(--radius-sm);
		color: var(--text-tertiary);
		font-family: inherit;
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 150ms ease;
	}

	.preview-toggle:hover {
		background: rgba(255, 255, 255, 0.04);
		color: var(--text-secondary);
	}

	.preview-toggle.active {
		background: rgba(59, 130, 246, 0.12);
		border-color: rgba(59, 130, 246, 0.25);
		color: #60a5fa;
	}

	:global(.app.light) .preview-toggle {
		border-color: rgba(0, 0, 0, 0.1);
	}

	:global(.app.light) .preview-toggle.active {
		background: rgba(59, 130, 246, 0.08);
		color: #2563eb;
	}

	.close-btn {
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

	.close-btn:hover {
		background: rgba(255, 255, 255, 0.06);
		color: var(--text-secondary);
	}

	:global(.app.light) .close-btn:hover {
		background: rgba(0, 0, 0, 0.06);
	}

	.editor-body {
		display: flex;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.editor-tabs {
		width: 180px;
		flex-shrink: 0;
		padding: 0.75rem;
		border-right: 1px solid var(--border-subtle);
		background: rgba(0, 0, 0, 0.15);
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	:global(.app.light) .editor-tabs {
		background: rgba(0, 0, 0, 0.02);
	}

	.tab {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		padding: 0.75rem 0.875rem;
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		font-family: inherit;
		font-size: 0.8125rem;
		font-weight: 500;
		text-align: left;
		cursor: pointer;
		transition: all 150ms ease;
	}

	.tab:hover {
		background: rgba(255, 255, 255, 0.04);
		color: var(--text-primary);
	}

	.tab.active {
		background: rgba(59, 130, 246, 0.12);
		color: #60a5fa;
	}

	:global(.app.light) .tab:hover {
		background: rgba(0, 0, 0, 0.04);
	}

	:global(.app.light) .tab.active {
		background: rgba(59, 130, 246, 0.1);
		color: #2563eb;
	}

	.tab-label {
		white-space: nowrap;
	}

	.editor-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
		padding: 1rem;
	}

	.content-header {
		margin-bottom: 0.75rem;
	}

	.content-hint {
		font-size: 0.75rem;
		color: var(--text-tertiary);
	}

	.prompt-textarea {
		width: 100%;
		height: 100%;
		padding: 1rem;
		background: rgba(0, 0, 0, 0.2);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		font-family: 'IBM Plex Mono', ui-monospace, 'SF Mono', monospace;
		font-size: 0.875rem;
		line-height: 1.6;
		resize: none;
	}

	.prompt-textarea:focus {
		outline: none;
		border-color: rgba(59, 130, 246, 0.5);
		box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
	}

	.prompt-textarea::placeholder {
		color: var(--text-tertiary);
		opacity: 0.5;
	}

	.prompt-textarea.full {
		flex: 1;
	}

	:global(.app.light) .prompt-textarea {
		background: rgba(0, 0, 0, 0.03);
	}

	.split-view {
		flex: 1;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		min-height: 0;
	}

	.edit-pane {
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.preview-pane {
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.preview-label {
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-tertiary);
		margin-bottom: 0.5rem;
	}

	.preview-content {
		flex: 1;
		padding: 1rem;
		background: rgba(0, 0, 0, 0.15);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		overflow-y: auto;
	}

	:global(.app.light) .preview-content {
		background: rgba(0, 0, 0, 0.02);
	}

	.editor-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1.25rem;
		border-top: 1px solid var(--border-subtle);
		background: rgba(0, 0, 0, 0.1);
	}

	:global(.app.light) .editor-footer {
		background: rgba(0, 0, 0, 0.02);
	}

	.footer-hint {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.6875rem;
		color: var(--text-tertiary);
	}

	.footer-hint kbd {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.25rem;
		height: 1.25rem;
		padding: 0 0.375rem;
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 0.5625rem;
		font-weight: 500;
		color: var(--text-secondary);
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 3px;
	}

	:global(.app.light) .footer-hint kbd {
		background: rgba(0, 0, 0, 0.04);
		border-color: rgba(0, 0, 0, 0.08);
	}

	.footer-stats {
		font-size: 0.6875rem;
		color: var(--text-tertiary);
		font-family: ui-monospace, 'SF Mono', monospace;
	}

	@media (max-width: 1020px) {
		.editor-window {
			right: 0;
			width: 100%;
			max-width: none;
			border-right: none;
		}
	}

	@media (max-width: 768px) {
		.editor-tabs {
			width: auto;
			flex-direction: row;
			border-right: none;
			border-bottom: 1px solid var(--border-subtle);
			overflow-x: auto;
		}

		.tab {
			flex-shrink: 0;
			padding: 0.625rem 0.75rem;
		}

		.tab-label {
			display: none;
		}

		.editor-body {
			flex-direction: column;
		}

		.split-view {
			grid-template-columns: 1fr;
			grid-template-rows: 1fr 1fr;
		}
	}
</style>
