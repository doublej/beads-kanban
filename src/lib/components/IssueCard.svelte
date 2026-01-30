<script lang="ts">
	import type { Issue } from '$lib/types';
	import { getPriorityConfig } from '$lib/utils';
	import IssueCardBadges from './IssueCardBadges.svelte';
	import IssueCardMeta from './IssueCardMeta.svelte';

	interface Props {
		issue: Issue;
		selected: boolean;
		dragging: boolean;
		animating: boolean;
		hasOpenBlockers: boolean;
		copiedId: string | null;
		editing?: boolean;
		filterDimmed?: boolean;
		flyingHidden?: boolean;
		showImpact?: boolean;
		registerCard: (node: HTMLElement, id: string) => void;
		onclick: () => void;
		ondragstart: (e: DragEvent) => void;
		ondragend: () => void;
		oncontextmenu: (e: MouseEvent) => void;
		oncopyid: (id: string) => void;
	}

	let {
		issue,
		selected,
		dragging,
		animating,
		hasOpenBlockers,
		copiedId,
		editing = false,
		filterDimmed = false,
		flyingHidden = false,
		showImpact = true,
		registerCard,
		onclick,
		ondragstart,
		ondragend,
		oncontextmenu,
		oncopyid
	}: Props = $props();

	const priorityConfig = $derived(getPriorityConfig(issue.priority));

	const isAgentAssignee = $derived(issue.assignee != null && (
		issue.assignee.toLowerCase().includes('agent') ||
		issue.assignee.toLowerCase() === 'claude' ||
		issue.assignee.startsWith('@')
	));
</script>

<article
	class="card"
	class:animating={animating}
	class:selected={selected}
	class:editing={editing}
	class:dragging={dragging}
	class:has-blockers={hasOpenBlockers}
	class:filter-dimmed={filterDimmed}
	class:flying-hidden={flyingHidden}
	style="--priority-color: {priorityConfig.color}"
	draggable="true"
	ondragstart={ondragstart}
	ondragend={ondragend}
	onclick={onclick}
	oncontextmenu={oncontextmenu}
	use:registerCard={issue.id}
>
	<div class="card-content">
		<IssueCardBadges {issue} {copiedId} {hasOpenBlockers} {showImpact} {isAgentAssignee} {oncopyid} />
		<h3 class="card-title">{issue.title}</h3>
		{#if issue.description}
			<p class="card-description">{issue.description}</p>
		{/if}
		<IssueCardMeta {issue} {isAgentAssignee} />
	</div>
</article>

<style>
	.card {
		position: relative;
		display: flex;
		flex-shrink: 0;
		margin: 2px 4px;
		background: var(--surface-card);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition:
			transform var(--transition-fast),
			box-shadow var(--transition-fast),
			border-color var(--transition-fast);
		overflow: hidden;
	}

	.card::before {
		content: '';
		position: absolute;
		top: 0.5rem;
		left: 0;
		width: 3px;
		height: 3px;
		border-radius: 0 50% 50% 0;
		background: var(--priority-color, var(--text-tertiary));
		opacity: 0.8;
	}

	.card:hover {
		border-color: var(--border-default);
		transform: translateY(-1px);
	}

	.card:active {
		transform: translateY(0) scale(0.995);
		transition: transform 80ms ease-out;
	}

	.card-content {
		flex: 1;
		padding: 0.625rem 0.75rem;
		min-width: 0;
		overflow: hidden;
	}

	.card.selected {
		border-color: var(--accent-primary);
		box-shadow: 0 0 0 1px var(--accent-primary);
	}

	.card.dragging {
		opacity: 0.85;
		transform: rotate(1deg) scale(1.01);
		box-shadow: var(--shadow-lg);
		cursor: grabbing;
		z-index: 100;
	}

	.card.animating {
		animation: cardPulse 300ms ease-out;
		z-index: 10;
	}

	@keyframes cardPulse {
		0% { box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.5); }
		100% { box-shadow: none; }
	}

	.card.editing {
		border-color: var(--accent-primary);
		box-shadow: 0 0 0 1px var(--accent-primary);
		z-index: 5;
	}

	.card.filter-dimmed {
		opacity: 0.15;
		pointer-events: none;
		transform: scale(0.98);
		filter: grayscale(0.5);
	}

	.card.flying-hidden {
		opacity: 0;
		pointer-events: none;
	}

	.card.has-blockers {
		border-color: rgba(239, 68, 68, 0.3);
	}

	.card.has-blockers::before {
		background: var(--state-blocked);
		opacity: 1;
	}

	.card-title {
		font-size: 0.8125rem;
		font-weight: 550;
		color: var(--text-primary);
		line-height: 1.35;
		margin-bottom: 0.25rem;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.card-description {
		font-size: 0.6875rem;
		color: var(--text-tertiary);
		line-height: 1.4;
		margin-bottom: 0.375rem;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	/* Mobile */
	@media (max-width: 768px) {
		.card {
			margin: 1px 2px;
		}

		.card-content {
			padding: 0.625rem 0.75rem;
		}

		.card-title {
			font-size: 0.8125rem;
			line-height: 1.3;
			margin-bottom: 0.125rem;
		}

		.card-description {
			font-size: 0.625rem;
			margin-bottom: 0.375rem;
			-webkit-line-clamp: 1;
			line-clamp: 1;
		}
	}

	/* Light theme */
	:global(.app.light) .card {
		box-shadow: var(--shadow-sm);
	}

	:global(.app.light) .card:hover {
		box-shadow: var(--shadow-md);
	}

	:global(.app.light) .card.selected {
		box-shadow: 0 0 0 1px var(--accent-primary), var(--shadow-sm);
	}

	:global(.app.light) .card.dragging {
		box-shadow: var(--shadow-lg);
	}
</style>
