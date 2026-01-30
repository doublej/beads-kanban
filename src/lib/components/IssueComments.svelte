<script lang="ts">
	import type { Comment } from '$lib/types';
	import { formatTimestamp } from '$lib/utils';
	import Icon from './Icon.svelte';

	interface Props {
		comments: Comment[];
		newComment: string;
		loadingComments: boolean;
		onaddcomment: () => void;
		updatenewcomment: (value: string) => void;
	}

	let {
		comments,
		newComment = $bindable(),
		loadingComments,
		onaddcomment,
		updatenewcomment,
	}: Props = $props();
</script>

<section class="section">
	<span class="section-label">Comments {#if loadingComments}<span class="loading">...</span>{/if}</span>
	{#if comments.length > 0}
		<div class="comments">
			{#each comments as c}
				{@const ts = formatTimestamp(c.created_at)}
				<div class="comment">
					<div class="comment-head"><span class="comment-author">{c.author}</span><span class="comment-time" title="{ts.absolute}">{ts.relative}</span></div>
					<p class="comment-text">{c.text}</p>
				</div>
			{/each}
		</div>
	{:else if !loadingComments}
		<p class="empty">No comments</p>
	{/if}
	<div class="comment-input">
		<textarea bind:value={newComment} rows="2" placeholder="Add comment..." onkeydown={(e) => { if (e.key === 'Enter' && e.metaKey) onaddcomment(); }}></textarea>
		<button class="btn-send" onclick={onaddcomment} disabled={!newComment.trim()}><Icon name="send" size={14} /></button>
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

	.comments {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		max-height: 160px;
		overflow-y: auto;
		margin-bottom: 0.5rem;
	}

	.comment {
		padding: 0.5rem 0.625rem;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-subtle);
		border-radius: 8px;
	}

	.comment-head {
		display: flex;
		justify-content: space-between;
		margin-bottom: 0.1875rem;
	}

	.comment-author {
		font-size: 0.6875rem;
		font-weight: 600;
		color: var(--accent-primary);
	}

	.comment-time {
		font-size: 0.5625rem;
		color: var(--text-tertiary);
	}

	.comment-text {
		font-size: 0.75rem;
		color: var(--text-secondary);
		line-height: 1.45;
		white-space: pre-wrap;
	}

	.empty {
		font-size: 0.6875rem;
		color: var(--text-tertiary);
		text-align: center;
		padding: 0.75rem;
	}

	.comment-input {
		display: flex;
		gap: 0.375rem;
		align-items: flex-end;
	}

	.comment-input textarea {
		flex: 1;
		min-height: 48px;
		padding: 0.5rem 0.625rem;
		background: rgba(255,255,255,0.04);
		border: 1px solid var(--border-subtle);
		border-radius: 10px;
		color: var(--text-primary);
		font-family: inherit;
		font-size: 0.75rem;
		resize: none;
	}
	.comment-input textarea:focus {
		outline: none;
		border-color: var(--accent-primary);
	}

	.btn-send {
		width: 2rem;
		height: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--accent-primary);
		border: none;
		border-radius: 8px;
		color: white;
		cursor: pointer;
		flex-shrink: 0;
		transition: all 150ms ease;
	}
	.btn-send:hover:not(:disabled) { filter: brightness(1.1); }
	.btn-send:disabled { opacity: 0.4; cursor: not-allowed; }

	.loading { color: var(--text-tertiary); font-weight: 400; }

	:global(.app.light) .comment {
		background: rgba(0, 0, 0, 0.02);
		border-color: var(--border-subtle);
	}

	:global(.app.light) .comment-input textarea {
		background: rgba(0, 0, 0, 0.02);
		border-color: var(--border-subtle);
	}

	@media (max-width: 768px) {
		.comment { padding: 0.5rem; }
		.comment-author { font-size: 0.625rem; }
		.comment-time { font-size: 0.5rem; }
		.comment-text { font-size: 0.6875rem; }
	}
</style>
