<script lang="ts">
	import type { Issue } from '$lib/types';
	import { getPriorityConfig, getTypeIcon, getDepTypeConfig, formatDate } from '$lib/utils';

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
		registerCard,
		onclick,
		ondragstart,
		ondragend,
		oncontextmenu,
		oncopyid
	}: Props = $props();

	const priorityConfig = $derived(getPriorityConfig(issue.priority));
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
	draggable="true"
	ondragstart={ondragstart}
	ondragend={ondragend}
	onclick={onclick}
	oncontextmenu={oncontextmenu}
	use:registerCard={issue.id}
>
	<div class="card-priority-bar" style="--priority-bar-color: {priorityConfig.color}">
		<span class="priority-label">{priorityConfig.label}</span>
	</div>
	<span class="type-indicator" title={issue.issue_type}>{getTypeIcon(issue.issue_type)} {issue.issue_type}</span>
	<div class="card-content">
		<div class="card-header">
			<span class="card-id-wrap">
				<span class="card-id">{issue.id}</span>
				<button
					class="btn-copy"
					class:copied={copiedId === issue.id}
					onclick={(e) => { e.stopPropagation(); oncopyid(issue.id); }}
					aria-label="Copy ID"
				>
					{#if copiedId === issue.id}
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>
					{:else}
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
					{/if}
				</button>
			</span>
			{#if hasOpenBlockers}
				<span class="blocked-indicator" title="Blocked by open dependencies">⊘</span>
			{/if}
		</div>
		{#if issue.status === 'in_progress' && issue.assignee}
			<div class="agent-chip">
				<span class="agent-pulse"></span>
				<svg class="agent-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="3"/>
					<path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
				</svg>
				<span class="agent-name">{issue.assignee}</span>
				<span class="agent-status">working</span>
			</div>
		{/if}
		<h3 class="card-title">{issue.title}</h3>
		{#if issue.description}
			<p class="card-description">{issue.description}</p>
		{/if}
		{#if issue.labels && issue.labels.length > 0}
			<div class="card-labels">
				{#each issue.labels.slice(0, 3) as label}
					<span class="label">{label}</span>
				{/each}
				{#if issue.labels.length > 3}
					<span class="label more">+{issue.labels.length - 3}</span>
				{/if}
			</div>
		{/if}
		{#if issue.assignee && !(issue.assignee.toLowerCase() === 'claude' || issue.assignee.toLowerCase().includes('agent'))}
		<div class="card-footer">
			<span class="badge assignee">
				<span class="assignee-dot"></span>
				{issue.assignee}
			</span>
		</div>
		{/if}
		{#if (issue.dependencies && issue.dependencies.length > 0) || (issue.dependents && issue.dependents.length > 0)}
			<div class="card-links">
				{#if issue.dependencies && issue.dependencies.length > 0}
					<div class="link-group blocked-by" title="Blocked by: {issue.dependencies.map(d => `${getDepTypeConfig(d.dependency_type).label}: ${d.title}`).join(', ')}">
						<span class="link-arrow">←</span>
						{#each issue.dependencies.slice(0, 3) as dep}
							{@const depConfig = getDepTypeConfig(dep.dependency_type)}
							<span class="link-id" class:open={dep.status === 'open'} class:in-progress={dep.status === 'in_progress'} class:blocked={dep.status === 'blocked'} class:closed={dep.status === 'closed'} title="{depConfig.label}: {dep.title}">
								<span class="dep-type-indicator" style="color: {depConfig.color}">{depConfig.icon}</span>{dep.id}
							</span>
						{/each}
						{#if issue.dependencies.length > 3}
							<span class="link-more">+{issue.dependencies.length - 3}</span>
						{/if}
					</div>
				{/if}
				{#if issue.dependents && issue.dependents.length > 0}
					<div class="link-group blocking" title="Blocking: {issue.dependents.map(d => `${getDepTypeConfig(d.dependency_type).label}: ${d.title}`).join(', ')}">
						<span class="link-arrow">→</span>
						{#each issue.dependents.slice(0, 3) as dep}
							{@const depConfig = getDepTypeConfig(dep.dependency_type)}
							<span class="link-id" class:open={dep.status === 'open'} class:in-progress={dep.status === 'in_progress'} class:blocked={dep.status === 'blocked'} class:closed={dep.status === 'closed'} title="{depConfig.label}: {dep.title}">
								<span class="dep-type-indicator" style="color: {depConfig.color}">{depConfig.icon}</span>{dep.id}
							</span>
						{/each}
						{#if issue.dependents.length > 3}
							<span class="link-more">+{issue.dependents.length - 3}</span>
						{/if}
					</div>
				{/if}
			</div>
		{/if}
		{#if issue.created_at}
			<div class="card-meta">
				<span class="meta-item" title="Created {new Date(issue.created_at).toLocaleString()}">
					{formatDate(issue.created_at)}
				</span>
				{#if issue.closed_at}
					<span class="meta-separator">→</span>
					<span class="meta-item closed" title="Closed {new Date(issue.closed_at).toLocaleString()}">
						{formatDate(issue.closed_at)}
					</span>
				{/if}
			</div>
		{/if}
	</div>
</article>

<style>
	/* Card */
	.card {
		position: relative;
		display: flex;
		flex-shrink: 0;
		margin: 2px 4px;
		background: var(--bg-secondary);
		border: none;
		border-radius: var(--radius-md);
		box-shadow:
			0 4px 12px -2px rgba(0, 0, 0, 0.08),
			0 2px 6px -1px rgba(0, 0, 0, 0.04),
			inset 0 1px 0 rgba(255, 255, 255, 0.12),
			inset 0 -1px 0 rgba(0, 0, 0, 0.2);
		cursor: pointer;
		transition:
			transform 200ms cubic-bezier(0.34, 1.4, 0.64, 1),
			box-shadow 250ms cubic-bezier(0, 0, 0.2, 1),
			background 200ms ease-out;
		overflow: hidden;
	}

	.card:hover {
		transform: translateY(-3px) scale(1.005);
		box-shadow:
			0 8px 20px -4px rgba(0, 0, 0, 0.15),
			0 4px 10px -2px rgba(0, 0, 0, 0.08),
			inset 0 1px 0 rgba(255, 255, 255, 0.15),
			inset 0 -1px 0 rgba(0, 0, 0, 0.2);
	}

	.card:active {
		transform: translateY(-1px) scale(0.995);
		transition:
			transform 100ms cubic-bezier(0.4, 0, 0.2, 1),
			box-shadow 100ms ease-out;
	}

	.card-priority-bar {
		width: 3px;
		flex-shrink: 0;
		position: relative;
		display: flex;
		align-items: flex-start;
		background: var(--priority-bar-color);
	}

	.priority-label {
		position: absolute;
		left: 6px;
		top: 4px;
		writing-mode: vertical-rl;
		text-orientation: mixed;
		font-family: ui-monospace, 'SF Mono', 'Cascadia Code', monospace;
		font-size: 0.4375rem;
		font-weight: 500;
		color: var(--priority-bar-color);
		letter-spacing: 0.02em;
		text-transform: uppercase;
		transform: rotate(180deg);
		white-space: nowrap;
		opacity: 0;
		transition: opacity var(--transition-fast);
	}

	.card:hover .priority-label,
	.card.selected .priority-label {
		opacity: 1;
	}

	.type-indicator {
		position: absolute;
		bottom: 0.5rem;
		right: 0.625rem;
		font-size: 0.5625rem;
		font-family: ui-monospace, 'SF Mono', monospace;
		text-transform: uppercase;
		letter-spacing: 0.02em;
		color: var(--text-tertiary);
		opacity: 0.5;
		z-index: 1;
	}

	.card:hover .type-indicator {
		opacity: 0.8;
	}

	.card-content {
		flex: 1;
		padding: 0.875rem;
		min-width: 0;
		overflow: hidden;
		border-radius: 0 var(--radius-md) var(--radius-md) 0;
	}

	.card::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: linear-gradient(135deg, rgba(255,255,255,0.02) 0%, transparent 50%);
		pointer-events: none;
	}

	.card:active {
		transform: translateY(0);
		transition: transform 100ms ease-out;
	}

	.card.selected {
		box-shadow:
			0 0 0 2px var(--accent-primary),
			var(--shadow-md);
	}

	.card.dragging {
		opacity: 0.7;
		transform: rotate(3deg) scale(1.05);
		box-shadow: var(--shadow-lg);
		cursor: grabbing;
	}

	.card.animating {
		animation: cardEnter 600ms cubic-bezier(0.34, 1.56, 0.64, 1);
		z-index: 10;
	}

	.card.editing {
		box-shadow:
			0 0 0 1px var(--accent-primary),
			inset 0 0 0 1px rgba(10, 132, 255, 0.2),
			var(--shadow-lg);
		z-index: 5;
	}

	.card.filter-dimmed {
		opacity: 0.25;
		pointer-events: none;
		transform: scale(0.98);
		filter: grayscale(0.5);
	}

	.card.flying-hidden {
		opacity: 0;
		pointer-events: none;
	}

	.card.has-blockers {
		border-left: 3px solid #ef4444;
	}

	.card.has-blockers .card-priority-bar {
		background: linear-gradient(180deg, #ef4444 0%, var(--priority-bar-color, #ef4444) 100%) !important;
	}

	.card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.375rem;
		gap: 0.5rem;
	}

	.card-id-wrap {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
	}

	.card-id {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.625rem;
		font-weight: 500;
		color: var(--text-tertiary);
		letter-spacing: 0.02em;
	}

	.btn-copy {
		width: 1.5rem;
		height: 1.5rem;
		min-width: 2.75rem; /* 44px touch target */
		min-height: 2.75rem;
		margin: -0.625rem; /* Expand touch area without visual change */
		padding: 0.625rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		color: var(--text-tertiary);
		cursor: pointer;
		opacity: 0;
		transition: all var(--transition-fast);
		padding: 0;
	}

	.btn-copy svg {
		width: 0.75rem;
		height: 0.75rem;
		transition: transform 150ms ease-out;
	}

	.card:hover .btn-copy {
		opacity: 0.6;
	}

	.btn-copy:hover {
		opacity: 1 !important;
		color: var(--text-secondary);
		background: var(--bg-elevated);
	}

	.btn-copy:hover svg {
		transform: scale(1.1);
	}

	.btn-copy:active svg {
		transform: scale(0.9);
	}

	.btn-copy.copied {
		opacity: 1 !important;
		color: #34c759;
		animation: copySuccess 400ms ease-out;
	}

	@keyframes copySuccess {
		0% { transform: scale(1); }
		50% { transform: scale(1.2); }
		100% { transform: scale(1); }
	}

	.blocked-indicator {
		color: #ef4444;
		font-size: 0.875rem;
		margin-left: 0.25rem;
		cursor: help;
	}

	/* Agent Chip - Prominent AI worker indicator */
	.agent-chip {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.25rem 0.5rem 0.25rem 0.375rem;
		background: linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(6, 182, 212, 0.12) 100%);
		border: 1px solid rgba(16, 185, 129, 0.25);
		border-radius: 1rem;
		margin-bottom: 0.5rem;
		position: relative;
		overflow: hidden;
		width: fit-content;
	}

	.agent-pulse {
		position: absolute;
		inset: 0;
		background: linear-gradient(90deg, transparent 0%, rgba(16, 185, 129, 0.1) 50%, transparent 100%);
		animation: agent-pulse-sweep 2.5s ease-in-out infinite;
	}

	@keyframes agent-pulse-sweep {
		0%, 100% { transform: translateX(-100%); opacity: 0; }
		50% { transform: translateX(100%); opacity: 1; }
	}

	.agent-icon {
		width: 14px;
		height: 14px;
		color: #10b981;
		animation: agent-icon-spin 8s linear infinite;
		flex-shrink: 0;
	}

	@keyframes agent-icon-spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}

	.agent-name {
		font-size: 0.6875rem;
		font-weight: 600;
		color: #10b981;
		text-transform: capitalize;
		letter-spacing: 0.01em;
	}

	.agent-status {
		font-size: 0.5625rem;
		font-weight: 500;
		color: rgba(16, 185, 129, 0.7);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding-left: 0.25rem;
		border-left: 1px solid rgba(16, 185, 129, 0.2);
	}

	.card-title {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text-primary);
		line-height: 1.35;
		margin-bottom: 0.25rem;
	}

	.card-description {
		font-size: 0.6875rem;
		color: var(--text-tertiary);
		line-height: 1.4;
		margin-bottom: 0.5rem;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.card-labels {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		margin-bottom: 0.5rem;
	}

	.label {
		padding: 0.125rem 0.375rem;
		background: var(--bg-elevated);
		border-radius: var(--radius-sm);
		font-size: 0.5625rem;
		font-weight: 500;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}

	.label.more {
		background: var(--accent-glow);
		color: var(--accent-primary);
	}

	.card-footer {
		display: flex;
		gap: 0.3125rem;
		flex-wrap: wrap;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		gap: 0.1875rem;
		padding: 0.1875rem 0.375rem;
		border-radius: var(--radius-sm);
		font-size: 0.625rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.badge.assignee {
		margin-left: auto;
		background: rgba(99, 102, 241, 0.12);
		color: var(--text-secondary);
	}

	.assignee-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: currentColor;
	}

	/* Card Links (dependencies/dependents) */
	.card-links {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		margin-top: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid var(--border-subtle);
	}

	.link-group {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.5625rem;
	}

	.link-group.blocked-by .link-arrow { color: #ef4444; }
	.link-group.blocking .link-arrow { color: #10b981; }

	.link-arrow {
		font-weight: 600;
		opacity: 0.7;
	}

	.link-id {
		font-family: 'JetBrains Mono', monospace;
		padding: 0.125rem 0.25rem;
		background: var(--bg-elevated);
		border-radius: 3px;
		border-left: 2px solid var(--text-tertiary);
	}

	.link-id.open { border-left-color: #6366f1; }
	.link-id.in-progress { border-left-color: #f59e0b; }
	.link-id.blocked { border-left-color: #ef4444; }
	.link-id.closed { border-left-color: #10b981; opacity: 0.6; }

	.link-more {
		font-size: 0.5rem;
		color: var(--text-tertiary);
		padding: 0.125rem 0.25rem;
	}

	.dep-type-indicator {
		font-size: 0.625rem;
		margin-right: 0.125rem;
	}

	/* Card Meta (timestamps) */
	.card-meta {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		margin-top: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid var(--border-subtle);
		font-size: 0.625rem;
		color: var(--text-tertiary);
	}

	.meta-item {
		display: flex;
		align-items: center;
		gap: 0.1875rem;
	}

	.meta-item.closed {
		color: #10b981;
	}

	.meta-separator {
		opacity: 0.5;
	}
</style>
