<script lang="ts">
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import Icon from '$lib/components/Icon.svelte';
	import { Button, Kbd } from '$lib/components/ui';
	import MarkdownContent from '$lib/components/MarkdownContent.svelte';
	import { getIssueColumn, getPriorityConfig, getTypeIcon } from '$lib/utils';
	import type { Issue } from '$lib/types';

	interface Props {
		ids: string[];
		index: number;
		issues: Issue[];
		onnav: (index: number) => void;
		onclose: () => void;
		onopendetail: (issue: Issue) => void;
	}

	let { ids, index, issues, onnav, onclose, onopendetail }: Props = $props();

	const total = $derived(ids.length);
	const safeIndex = $derived(Math.min(Math.max(index, 0), Math.max(total - 1, 0)));
	const currentId = $derived(ids[safeIndex]);
	const current = $derived(issues.find((i) => i.id === currentId) ?? null);
	const column = $derived(current ? getIssueColumn(current) : null);
	const priority = $derived(current ? getPriorityConfig(current.priority) : null);
	const atStart = $derived(safeIndex <= 0);
	const atEnd = $derived(safeIndex >= total - 1);

	const reduced =
		typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

	function go(delta: number) {
		const next = safeIndex + delta;
		if (next < 0 || next > total - 1) return;
		onnav(next);
	}

	function openDetail() {
		if (current) onopendetail(current);
	}

	// Capture-phase listener so Zen owns the keyboard while open and the
	// board's window keydown handler never fires behind it.
	function onKey(e: KeyboardEvent) {
		if (e.metaKey || e.ctrlKey || e.altKey) return;
		const k = e.key;
		let handled = true;
		if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'l' || k === 'j' || k === ' ') go(1);
		else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'h' || k === 'k') go(-1);
		else if (k === 'Enter' || k === 'o') openDetail();
		else if (k === 'Escape' || k === 'z' || k === 'Z' || k === 'q') onclose();
		else handled = false;
		e.stopImmediatePropagation();
		if (handled) e.preventDefault();
	}

	$effect(() => {
		window.addEventListener('keydown', onKey, true);
		return () => window.removeEventListener('keydown', onKey, true);
	});
</script>

<div
	class="zen"
	role="dialog"
	aria-modal="true"
	aria-label="Focus review"
	class:reduced
	style="--zen-fill: {Math.round(((safeIndex + 1) / Math.max(total, 1)) * 100)}%;"
>
	<header class="zen-top">
		<span class="zen-eyebrow">Focus review</span>
		<span class="zen-count mono">{String(safeIndex + 1).padStart(2, '0')} <span class="sep">/</span> {String(total).padStart(2, '0')}</span>
		<Button variant="ghost" iconOnly icon="close" class="zen-exit" onclick={onclose} title="Exit (Esc)" />
		<div class="zen-track"><span class="zen-fill"></span></div>
	</header>

	<div class="zen-stage">
		{#key safeIndex}
			<article
				class="reader"
				in:fly={{ y: 16, duration: reduced ? 0 : 360, easing: cubicOut, opacity: 0 }}
			>
				{#if current && column && priority}
					<div class="meta">
						<span class="dot" style="background: {column.accent};"></span>
						<span class="id mono">{current.id}</span>
						<span class="meta-rest">
							{column.label}
							<span class="meta-sep">·</span>
							<span style="color: {priority.color};">{priority.label}</span>
							<span class="meta-sep">·</span>
							<span class="type"><Icon name={getTypeIcon(current.issue_type)} size={12} />{current.issue_type}</span>
						</span>
					</div>

					<h1 class="title">{current.title}</h1>

					<div class="desc">
						{#if current.description?.trim()}
							<MarkdownContent content={current.description} />
						{:else}
							<p class="empty">No description.</p>
						{/if}
					</div>
				{:else}
					<div class="missing">
						<Icon name="alert-circle" size={20} />
						<p>Issue <span class="mono">{currentId}</span> is no longer available.</p>
					</div>
				{/if}
			</article>
		{/key}
	</div>

	<footer class="zen-foot">
		<Button variant="ghost" class="nav" onclick={() => go(-1)} disabled={atStart}>
			<Icon name="chevron-left" size={16} />
			<span>Prev</span>
		</Button>

		<div class="foot-center">
			<Button variant="secondary" class="open" onclick={openDetail} disabled={!current}>
				<Icon name="external-link" size={14} />
				<span>Open details</span>
				<Kbd>↵</Kbd>
			</Button>
			<div class="hints">
				<span><Kbd>←</Kbd><Kbd>→</Kbd> cycle</span>
				<span><Kbd>Esc</Kbd> exit</span>
			</div>
		</div>

		<Button variant="ghost" class="nav" onclick={() => go(1)} disabled={atEnd}>
			<span>Next</span>
			<Icon name="chevron-right" size={16} />
		</Button>
	</footer>
</div>

<style>
	.zen {
		--zen-accent: var(--project-color, var(--accent-primary));
		--zen-vignette: rgba(0, 0, 0, 0.55);
		position: fixed;
		inset: 0;
		z-index: 1000;
		display: flex;
		flex-direction: column;
		/* Solid fill is its own property so it always paints, even if a
		   gradient/color-mix layer below is rejected by the parser. */
		background-color: var(--surface-app, #18181b);
		background-image:
			radial-gradient(125% 90% at 50% -10%, color-mix(in srgb, var(--zen-accent) 24%, transparent), transparent 60%),
			radial-gradient(110% 85% at 50% 118%, color-mix(in srgb, var(--zen-accent) 11%, transparent), transparent 55%);
		animation: zen-in 320ms cubic-bezier(0.22, 1, 0.36, 1);
	}
	.zen.reduced {
		animation: none;
	}
	.zen::after {
		content: '';
		position: absolute;
		inset: 0;
		pointer-events: none;
		background: radial-gradient(130% 95% at 50% 42%, transparent 52%, var(--zen-vignette) 100%);
	}
	:global(.app.light) .zen {
		--zen-vignette: rgba(40, 50, 60, 0.1);
	}

	@keyframes zen-in {
		from { opacity: 0; transform: scale(1.012); }
		to { opacity: 1; transform: scale(1); }
	}

	/* Top bar ---------------------------------------------------------- */
	.zen-top {
		position: relative;
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 18px 24px;
		flex: 0 0 auto;
	}
	.zen-eyebrow {
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 500;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--text-tertiary);
	}
	.zen-count {
		margin-left: auto;
		font-size: 12px;
		font-weight: 500;
		color: var(--text-secondary);
		letter-spacing: 0.05em;
	}
	.zen-count .sep {
		color: var(--text-muted);
		margin: 0 2px;
	}
	/* :global() so the rule reaches the <button> rendered inside the Button atom. */
	.zen-top :global(.zen-exit) {
		color: var(--text-tertiary);
	}
	.zen-track {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 2px;
		background: var(--border-subtle);
	}
	.zen-fill {
		display: block;
		height: 100%;
		width: var(--zen-fill, 0%);
		background: linear-gradient(90deg, transparent, var(--zen-accent));
		transition: width 360ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	/* Stage ------------------------------------------------------------ */
	.zen-stage {
		flex: 1 1 auto;
		min-height: 0;
		display: flex;
		justify-content: center;
		position: relative;
	}
	.reader {
		width: 100%;
		max-width: 720px;
		padding: clamp(24px, 6vh, 72px) 32px 48px;
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: var(--border-strong) transparent;
	}
	.reader::-webkit-scrollbar { width: 8px; }
	.reader::-webkit-scrollbar-thumb { background: var(--border-default); border-radius: 4px; }

	.meta {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 11px;
		font-weight: 500;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--text-tertiary);
		margin-bottom: 18px;
	}
	.meta .dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex: 0 0 8px;
	}
	.meta .id {
		color: var(--text-secondary);
		text-transform: none;
		letter-spacing: 0.02em;
	}
	.meta-rest {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		color: var(--text-secondary);
	}
	.meta-sep { opacity: 0.5; }
	.meta .type {
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}

	.title {
		font-family: var(--font-display);
		font-size: clamp(1.7rem, 3.4vw, 2.5rem);
		font-weight: 600;
		line-height: 1.14;
		letter-spacing: -0.022em;
		color: var(--text-primary);
		margin: 0 0 24px;
		text-wrap: balance;
	}

	.desc {
		font-size: 1.0625rem;
		line-height: 1.65;
		color: color-mix(in srgb, var(--text-primary) 88%, transparent);
	}
	.desc :global(.markdown-content) {
		line-height: 1.65;
		overflow: visible;
	}
	.desc :global(.markdown-content p) {
		margin: 0 0 1em;
	}
	.desc .empty {
		font-style: italic;
		color: var(--text-muted);
	}

	.missing {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding-top: 12vh;
		color: var(--text-tertiary);
		text-align: center;
	}

	/* Footer ----------------------------------------------------------- */
	.zen-foot {
		flex: 0 0 auto;
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 16px;
		padding: 16px 24px 24px;
	}
	.zen-foot :global(.nav) {
		color: var(--text-secondary);
	}
	.zen-foot :global(.nav):first-child { justify-self: start; }
	.zen-foot :global(.nav):last-child { justify-self: end; }

	.foot-center {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
	}
	.foot-center :global(.open) {
		gap: 8px;
	}
	.hints {
		display: flex;
		gap: 14px;
		font-size: 11px;
		color: var(--text-tertiary);
	}
	.hints span {
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}

	@media (max-width: 640px) {
		.hints { display: none; }
		.reader { padding-left: 20px; padding-right: 20px; }
		.zen-foot :global(.nav span) { display: none; }
	}
</style>
