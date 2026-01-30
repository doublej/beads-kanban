<script lang="ts">
	import MarkdownContent from './MarkdownContent.svelte';

	interface Props {
		activeContent: string;
		placeholder: string;
		hint: string;
		showPreview: boolean;
		estimatedTokens: number;
		onupdate: (value: string) => void;
	}

	let {
		activeContent,
		placeholder,
		hint,
		showPreview,
		estimatedTokens,
		onupdate
	}: Props = $props();
</script>

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
					oninput={(e) => onupdate(e.currentTarget.value)}
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
			oninput={(e) => onupdate(e.currentTarget.value)}
			{placeholder}
			spellcheck="false"
		></textarea>
	{/if}
</div>

<footer class="editor-footer">
	<div class="footer-hint">
		<kbd>Esc</kbd> close
	</div>
	<div class="footer-stats">
		{activeContent.length} chars · ~{estimatedTokens} tokens
	</div>
</footer>

<style>
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
		font-size: 0.6875rem;
		line-height: 1.5;
		resize: none;
		white-space: pre;
		overflow-x: auto;
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

	@media (max-width: 768px) {
		.split-view {
			grid-template-columns: 1fr;
			grid-template-rows: 1fr 1fr;
		}
	}
</style>
