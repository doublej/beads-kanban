<script lang="ts">
	import type { Attachment } from '$lib/types';
	import { formatTimestamp } from '$lib/utils';
	import Icon from './Icon.svelte';

	interface Props {
		issueId: string;
		attachments: Attachment[];
		loadingAttachments: boolean;
		onuploadattachment: (file: File) => void;
		ondeleteattachment: (filename: string) => void;
	}

	let {
		issueId,
		attachments,
		loadingAttachments,
		onuploadattachment,
		ondeleteattachment,
	}: Props = $props();

	function formatFileSize(bytes: number): string {
		if (bytes < 1024) return bytes + ' B';
		if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
		return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
	}

	function isImageMimetype(mimetype: string): boolean {
		return mimetype.startsWith('image/');
	}

	function handleFileDrop(e: DragEvent) {
		e.preventDefault();
		const file = e.dataTransfer?.files[0];
		if (file) onuploadattachment(file);
	}

	function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			onuploadattachment(file);
			input.value = '';
		}
	}
</script>

<section class="section">
	<span class="section-label">Attachments {#if loadingAttachments}<span class="loading">...</span>{/if}</span>
	{#if attachments.length > 0}
		<div class="attachments">
			{#each attachments as a}
				{@const ts = formatTimestamp(a.created_at)}
				<div class="attachment">
					{#if isImageMimetype(a.mimetype)}
						<img src="/api/issues/{issueId}/attachments/{a.filename}" alt={a.filename} class="att-thumb" />
					{:else}
						<div class="att-icon"><Icon name="file" size={14} /></div>
					{/if}
					<div class="att-info">
						<a href="/api/issues/{issueId}/attachments/{a.filename}" download={a.filename} class="att-name">{a.filename}</a>
						<span class="att-meta">{formatFileSize(a.size)} · {ts.relative}</span>
					</div>
					<button class="att-x" onclick={() => { if (confirm('Delete?')) ondeleteattachment(a.filename); }}><Icon name="trash" size={11} /></button>
				</div>
			{/each}
		</div>
	{:else if !loadingAttachments}
		<p class="empty">No attachments</p>
	{/if}
	<div class="dropzone" ondragover={(e) => e.preventDefault()} ondrop={handleFileDrop}>
		<input type="file" id="att-input" class="dropzone-input" onchange={handleFileSelect} />
		<label for="att-input" class="dropzone-label"><Icon name="plus" size={14} /><span>Drop or click</span></label>
	</div>
</section>

<style>
	.section { margin-bottom: 1.25rem; }

	.section-label {
		display: block;
		font-size: 0.625rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-tertiary);
		margin-bottom: 0.375rem;
	}

	.attachments {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		max-height: 140px;
		overflow-y: auto;
		margin-bottom: 0.5rem;
	}

	.attachment {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		padding: 0.375rem 0.5rem;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-subtle);
		border-radius: 8px;
	}

	.att-thumb {
		width: 2rem;
		height: 2rem;
		object-fit: cover;
		border-radius: 6px;
		flex-shrink: 0;
	}

	.att-icon {
		width: 2rem;
		height: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-elevated);
		border-radius: 6px;
		color: var(--text-tertiary);
		flex-shrink: 0;
	}

	.att-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.0625rem;
	}

	.att-name {
		font-size: 0.75rem;
		color: var(--accent-primary);
		text-decoration: none;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.att-name:hover { text-decoration: underline; }

	.att-meta {
		font-size: 0.5625rem;
		color: var(--text-tertiary);
	}

	.att-x {
		background: transparent;
		border: none;
		color: var(--text-tertiary);
		cursor: pointer;
		padding: 0.25rem;
		border-radius: 4px;
		opacity: 0;
		transition: all 150ms ease;
	}
	.attachment:hover .att-x { opacity: 1; }
	.att-x:hover { color: #ef4444; background: rgba(239,68,68,0.1); }

	.dropzone {
		position: relative;
		border: 1px dashed var(--border-default);
		border-radius: var(--radius-sm);
		transition: all var(--transition-fast);
	}
	.dropzone:hover, .dropzone:focus-within {
		border-color: var(--accent-primary);
		border-style: solid;
		background: var(--accent-glow);
	}

	.dropzone-input {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
	}

	.dropzone-label {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		padding: 0.375rem 0.5rem;
		color: var(--text-muted);
		font-size: 0.625rem;
		font-weight: 500;
		cursor: pointer;
	}
	.dropzone:hover .dropzone-label { color: var(--accent-primary); }

	.empty {
		font-size: 0.6875rem;
		color: var(--text-tertiary);
		text-align: center;
		padding: 0.75rem;
	}

	.loading { color: var(--text-tertiary); font-weight: 400; }

	:global(.app.light) .attachment {
		background: rgba(0, 0, 0, 0.02);
		border-color: var(--border-subtle);
	}

	:global(.app.light) .dropzone { border-color: var(--border-default); }

	@media (max-width: 768px) {
		.attachments { gap: 0.25rem; }
		.attachment { padding: 0.25rem 0.375rem; }
		.att-name { font-size: 0.625rem; }
		.att-meta { font-size: 0.5rem; }
	}
</style>
