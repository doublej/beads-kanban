<script lang="ts">
	import { marked } from 'marked';
	import hljs from 'highlight.js';

	interface Props {
		content: string;
		maxLength?: number;
	}

	let { content, maxLength }: Props = $props();

	const renderer = new marked.Renderer();

	renderer.code = ({ text, lang }) => {
		const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
		const highlighted = hljs.highlight(text, { language }).value;
		const escapedCode = text.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
		return `<div class="code-block">
			<div class="code-header">
				<span class="code-lang">${language}</span>
				<button class="copy-btn" data-code="${escapedCode}" onclick="this.getRootNode().host?.dispatchEvent(new CustomEvent('copycode', {detail: this.dataset.code})) || navigator.clipboard.writeText(this.dataset.code.replace(/&quot;/g, '\"').replace(/&#39;/g, \"'\")).then(() => { this.textContent = '✓'; setTimeout(() => this.textContent = 'copy', 1500) })">copy</button>
			</div>
			<pre><code class="hljs language-${language}">${highlighted}</code></pre>
		</div>`;
	};

	marked.setOptions({ renderer, gfm: true, breaks: true });

	let html = $derived.by(() => {
		const text = maxLength && content.length > maxLength
			? content.slice(0, maxLength) + '…'
			: content;
		return marked.parse(text) as string;
	});
</script>

<div class="markdown-content">
	{@html html}
</div>

<style>
	.markdown-content {
		flex: 1;
		margin: 0;
		color: var(--text-primary);
		word-break: break-word;
		font: inherit;
		line-height: 1.5;
	}

	.markdown-content :global(p) {
		margin: 0 0 0.5em 0;
	}

	.markdown-content :global(p:last-child) {
		margin-bottom: 0;
	}

	.markdown-content :global(ul),
	.markdown-content :global(ol) {
		margin: 0.25em 0;
		padding-left: 1.5em;
	}

	.markdown-content :global(li) {
		margin: 0.15em 0;
	}

	.markdown-content :global(code) {
		background: rgba(255, 255, 255, 0.08);
		padding: 0.1em 0.3em;
		border-radius: 3px;
		font-size: 0.9em;
	}

	.markdown-content :global(.code-block) {
		margin: 0.5em 0;
		border-radius: 6px;
		overflow: hidden;
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid rgba(255, 255, 255, 0.1);
	}

	.markdown-content :global(.code-header) {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.3em 0.6em;
		background: rgba(255, 255, 255, 0.05);
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		font-size: 0.75em;
	}

	.markdown-content :global(.code-lang) {
		color: var(--text-secondary, #888);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.markdown-content :global(.copy-btn) {
		background: transparent;
		border: 1px solid rgba(255, 255, 255, 0.2);
		color: var(--text-secondary, #888);
		padding: 0.15em 0.5em;
		border-radius: 3px;
		cursor: pointer;
		font-size: inherit;
		font-family: inherit;
		transition: all 0.15s;
	}

	.markdown-content :global(.copy-btn:hover) {
		background: rgba(255, 255, 255, 0.1);
		color: var(--text-primary, #fff);
		border-color: rgba(255, 255, 255, 0.3);
	}

	.markdown-content :global(.code-block pre) {
		margin: 0;
		padding: 0.6em;
		overflow-x: auto;
	}

	.markdown-content :global(.code-block code) {
		background: transparent;
		padding: 0;
		font-size: 0.85em;
		line-height: 1.4;
	}

	/* highlight.js theme overrides for dark mode */
	.markdown-content :global(.hljs) {
		color: #e6e6e6;
		background: transparent;
	}

	.markdown-content :global(.hljs-keyword),
	.markdown-content :global(.hljs-selector-tag) {
		color: #c792ea;
	}

	.markdown-content :global(.hljs-string),
	.markdown-content :global(.hljs-addition) {
		color: #c3e88d;
	}

	.markdown-content :global(.hljs-number),
	.markdown-content :global(.hljs-literal) {
		color: #f78c6c;
	}

	.markdown-content :global(.hljs-comment) {
		color: #676e95;
		font-style: italic;
	}

	.markdown-content :global(.hljs-function),
	.markdown-content :global(.hljs-title) {
		color: #82aaff;
	}

	.markdown-content :global(.hljs-variable),
	.markdown-content :global(.hljs-attr) {
		color: #ffcb6b;
	}

	.markdown-content :global(.hljs-built_in) {
		color: #89ddff;
	}

	.markdown-content :global(.hljs-deletion) {
		color: #ff5370;
	}

	.markdown-content :global(.hljs-type),
	.markdown-content :global(.hljs-class) {
		color: #ffcb6b;
	}

	.markdown-content :global(blockquote) {
		margin: 0.5em 0;
		padding-left: 0.75em;
		border-left: 3px solid rgba(255, 255, 255, 0.2);
		color: var(--text-secondary, #888);
	}

	.markdown-content :global(a) {
		color: #82aaff;
		text-decoration: none;
	}

	.markdown-content :global(a:hover) {
		text-decoration: underline;
	}

	.markdown-content :global(strong) {
		color: var(--text-primary, #fff);
	}

	.markdown-content :global(h1),
	.markdown-content :global(h2),
	.markdown-content :global(h3),
	.markdown-content :global(h4) {
		margin: 0.75em 0 0.25em 0;
		font-weight: 600;
		line-height: 1.3;
	}

	.markdown-content :global(h1) { font-size: 1.3em; }
	.markdown-content :global(h2) { font-size: 1.15em; }
	.markdown-content :global(h3) { font-size: 1.05em; }
	.markdown-content :global(h4) { font-size: 1em; }

	.markdown-content :global(hr) {
		border: none;
		border-top: 1px solid rgba(255, 255, 255, 0.15);
		margin: 0.75em 0;
	}

	.markdown-content :global(table) {
		border-collapse: collapse;
		margin: 0.5em 0;
		font-size: 0.9em;
	}

	.markdown-content :global(th),
	.markdown-content :global(td) {
		border: 1px solid rgba(255, 255, 255, 0.15);
		padding: 0.3em 0.6em;
	}

	.markdown-content :global(th) {
		background: rgba(255, 255, 255, 0.05);
	}
</style>
