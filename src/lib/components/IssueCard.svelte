<script lang="ts">
	import type { Issue } from '$lib/types';
	import { getPriorityConfig, getTypeIcon, getDepTypeConfig, formatTimestamp, formatDuration, calculateImpactScore, getImpactLevel } from '$lib/utils';
	import Icon from './Icon.svelte';

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
	const impactScore = $derived(calculateImpactScore(issue));
	const impactLevel = $derived(getImpactLevel(impactScore));

	// Check if assignee is an agent (contains "agent" in name or matches known agent patterns)
	const isAgentAssignee = $derived(issue.assignee && (
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
		<div class="card-header">
			<span class="card-id-wrap">
				<span class="priority-dot" title="{priorityConfig.label}"></span>
				<span class="card-id">{issue.id}</span>
				<button
					class="btn-copy"
					class:copied={copiedId === issue.id}
					onclick={(e) => { e.stopPropagation(); oncopyid(issue.id); }}
					aria-label="Copy ID"
				>
					{#if copiedId === issue.id}
						<Icon name="check" size={10} />
					{:else}
						<Icon name="copy" size={10} />
					{/if}
				</button>
			</span>
			{#if showImpact && impactScore >= 40}
				<span class="impact-badge" class:critical={impactLevel.level === 'critical'} class:high={impactLevel.level === 'high'} style="--impact-color: {impactLevel.color}" title="{impactLevel.label} (Score: {impactScore})">
					<Icon name="zap" size={10} />
					<span class="impact-score">{impactScore}</span>
				</span>
			{/if}
			{#if hasOpenBlockers}
				<span class="blocked-indicator" title="Blocked by open dependencies"><Icon name="dep-blocks" size={14} /></span>
			{/if}
			{#if (issue.dependencies && issue.dependencies.length > 0) || (issue.dependents && issue.dependents.length > 0)}
				{@const totalDeps = (issue.dependencies?.length || 0) + (issue.dependents?.length || 0)}
				<span class="deps-indicator" title="{issue.dependencies?.length || 0} dependencies, {issue.dependents?.length || 0} dependents">
					<Icon name="link" size={10} />
					<span class="count">{totalDeps}</span>
				</span>
			{/if}
		</div>
		{#if issue.assignee && isAgentAssignee}
			<div class="agent-chip" class:working={issue.status === 'in_progress'} class:idle={issue.status !== 'in_progress' && issue.status !== 'closed'} class:done={issue.status === 'closed'}>
				{#if issue.status === 'in_progress'}
					<span class="agent-pulse"></span>
				{/if}
				<span class="agent-icon">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
						<circle cx="12" cy="12" r="3"/>
						<path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
					</svg>
				</span>
				<span class="agent-name">{issue.assignee}</span>
				{#if issue.status === 'in_progress'}
					<span class="agent-status">working</span>
				{:else if issue.status === 'closed'}
					<span class="agent-status done">done</span>
				{:else}
					<span class="agent-status">assigned</span>
				{/if}
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
		{#if issue.assignee && !isAgentAssignee}
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
								<span class="dep-type-indicator" style="color: {depConfig.color}"><Icon name={depConfig.icon} size={10} /></span>{dep.id}
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
								<span class="dep-type-indicator" style="color: {depConfig.color}"><Icon name={depConfig.icon} size={10} /></span>{dep.id}
							</span>
						{/each}
						{#if issue.dependents.length > 3}
							<span class="link-more">+{issue.dependents.length - 3}</span>
						{/if}
					</div>
				{/if}
			</div>
		{/if}
		<div class="card-meta">
			{#if issue.created_at}
				{@const created = formatTimestamp(issue.created_at)}
				{@const closed = issue.closed_at ? formatTimestamp(issue.closed_at) : null}
				{@const duration = issue.closed_at ? formatDuration(issue.created_at, issue.closed_at) : null}
				<span class="meta-item" title="Created {created.absolute} at {created.time}">
					{created.relative}
				</span>
				{#if closed}
					<span class="meta-sep">→</span>
					<span class="meta-item closed" title="Closed {closed.absolute} at {closed.time} ({duration})">
						{closed.relative}
					</span>
				{/if}
			{/if}
			<span class="meta-type"><Icon name={getTypeIcon(issue.issue_type)} size={10} /> {issue.issue_type}</span>
		</div>
	</div>
</article>

<style>
	/* Card - Clean, minimal design */
	.card {
		position: relative;
		display: flex;
		flex-shrink: 0;
		margin: 2px 4px;
		background: var(--bg-secondary);
		border-radius: var(--radius-md);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
		cursor: pointer;
		transition:
			transform 180ms ease-out,
			box-shadow 180ms ease-out,
			background 150ms ease-out;
		overflow: hidden;
	}

	.card:hover {
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}

	.card:active {
		transform: translateY(0) scale(0.995);
		transition: transform 80ms ease-out;
	}

	.card-content {
		flex: 1;
		padding: 0.75rem 0.875rem;
		min-width: 0;
		overflow: hidden;
	}

	.card.selected {
		box-shadow: 0 0 0 1.5px var(--accent-primary), 0 4px 12px rgba(0, 0, 0, 0.1);
	}

	.card.dragging {
		opacity: 0.7;
		transform: rotate(2deg) scale(1.02);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
		cursor: grabbing;
	}

	.card.animating {
		animation: cardPulse 350ms ease-out;
		z-index: 10;
	}

	@keyframes cardPulse {
		0% { box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.6), 0 4px 16px rgba(16, 185, 129, 0.2); }
		100% { box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08); }
	}

	.card.editing {
		box-shadow: 0 0 0 1.5px var(--accent-primary), 0 4px 16px rgba(10, 132, 255, 0.12);
		z-index: 5;
	}

	.card.filter-dimmed {
		opacity: 0.2;
		pointer-events: none;
		transform: scale(0.98);
		filter: grayscale(0.4);
	}

	.card.flying-hidden {
		opacity: 0;
		pointer-events: none;
	}

	.card.has-blockers {
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), inset 0 0 0 1px rgba(239, 68, 68, 0.15);
	}

	/* Priority dot - elegant inline indicator */
	.priority-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--priority-color);
		flex-shrink: 0;
	}

	.card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.375rem;
		gap: 0.5rem;
	}

	/* Dependency indicator badge */
	.deps-indicator {
		display: flex;
		align-items: center;
		gap: 0.125rem;
		padding: 0.125rem 0.25rem;
		background: rgba(99, 102, 241, 0.1);
		border-radius: 3px;
		font-size: 0.5625rem;
		color: var(--text-tertiary);
	}

	.deps-indicator :global(svg) {
		width: 10px;
		height: 10px;
		opacity: 0.7;
	}

	.deps-indicator .count {
		font-family: ui-monospace, 'SF Mono', monospace;
		font-weight: 500;
	}

	.card-id-wrap {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
	}

	.card-id {
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 0.625rem;
		font-weight: 500;
		color: var(--text-tertiary);
		letter-spacing: 0.02em;
	}

	.btn-copy {
		width: 16px;
		height: 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		border-radius: 3px;
		color: var(--text-tertiary);
		cursor: pointer;
		opacity: 0;
		transition: opacity 120ms ease, color 120ms ease;
	}

	.btn-copy :global(svg) {
		width: 10px;
		height: 10px;
	}

	.card:hover .btn-copy {
		opacity: 0.5;
	}

	.btn-copy:hover {
		opacity: 1 !important;
		color: var(--text-secondary);
	}

	.btn-copy.copied {
		opacity: 1 !important;
		color: #34c759;
	}

	.blocked-indicator {
		display: flex;
		color: #ef4444;
		margin-left: 0.25rem;
		cursor: help;
	}

	/* Impact Badge */
	.impact-badge {
		display: flex;
		align-items: center;
		gap: 0.125rem;
		padding: 0.125rem 0.3rem;
		background: rgba(var(--impact-color), 0.12);
		border-radius: 4px;
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 0.5625rem;
		font-weight: 600;
		color: var(--impact-color);
		cursor: help;
	}

	.impact-badge.critical {
		background: rgba(239, 68, 68, 0.15);
		color: #ef4444;
		animation: impactPulse 2s ease-in-out infinite;
	}

	.impact-badge.high {
		background: rgba(245, 158, 11, 0.12);
		color: #f59e0b;
	}

	.impact-badge :global(svg) {
		width: 10px;
		height: 10px;
	}

	.impact-score {
		letter-spacing: 0.02em;
	}

	@keyframes impactPulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.7; }
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

	/* Idle state - muted appearance */
	.agent-chip.idle {
		background: linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(139, 92, 246, 0.08) 100%);
		border-color: rgba(99, 102, 241, 0.2);
	}

	.agent-chip.idle .agent-icon {
		color: #8b5cf6;
		animation: none;
	}

	.agent-chip.idle .agent-name {
		color: #8b5cf6;
	}

	.agent-chip.idle .agent-status {
		color: rgba(139, 92, 246, 0.6);
		border-left-color: rgba(139, 92, 246, 0.15);
	}

	/* Done state - completed appearance */
	.agent-chip.done {
		background: linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(6, 182, 212, 0.06) 100%);
		border-color: rgba(16, 185, 129, 0.15);
		opacity: 0.7;
	}

	.agent-chip.done .agent-icon {
		animation: none;
	}

	.agent-status.done {
		color: #10b981 !important;
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
		display: flex;
		color: #10b981;
		flex-shrink: 0;
	}

	.agent-chip.working .agent-icon {
		animation: agent-icon-spin 8s linear infinite;
	}

	@keyframes agent-icon-spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}

	.agent-name {
		font-size: 0.6875rem;
		font-weight: 600;
		color: #10b981;
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
		font-family: ui-monospace, 'SF Mono', monospace;
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
		display: inline-flex;
		margin-right: 0.125rem;
	}

	/* Card Meta (footer row) */
	.card-meta {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		margin-top: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid var(--border-subtle);
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 0.5625rem;
		color: var(--text-tertiary);
	}

	.meta-item {
		letter-spacing: 0.01em;
	}

	.meta-item.closed {
		color: #10b981;
	}

	.meta-sep {
		opacity: 0.4;
	}

	.meta-type {
		margin-left: auto;
		text-transform: uppercase;
		letter-spacing: 0.02em;
		opacity: 0.6;
	}

	/* ═══════════════════════════════════════════════════════════════
	   MOBILE - Compact card styles
	   ═══════════════════════════════════════════════════════════════ */
	@media (max-width: 768px) {
		.card {
			margin: 1px 2px;
		}

		.card-content {
			padding: 0.625rem 0.75rem;
		}

		.card-header {
			margin-bottom: 0.25rem;
			gap: 0.375rem;
		}

		.card-id {
			font-size: 0.5625rem;
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

		.card-labels {
			gap: 0.125rem;
			margin-bottom: 0.375rem;
		}

		.label {
			padding: 0.0625rem 0.25rem;
			font-size: 0.5rem;
		}

		/* Compact agent chip */
		.agent-chip {
			padding: 0.125rem 0.375rem 0.125rem 0.25rem;
			margin-bottom: 0.375rem;
			gap: 0.25rem;
		}

		.agent-chip .agent-icon svg {
			width: 12px;
			height: 12px;
		}

		.agent-name {
			font-size: 0.625rem;
		}

		.agent-status {
			font-size: 0.5rem;
			padding-left: 0.125rem;
		}

		/* Compact links */
		.card-links {
			margin-top: 0.375rem;
			padding-top: 0.375rem;
			gap: 0.25rem;
		}

		.link-group {
			font-size: 0.5rem;
			gap: 0.125rem;
		}

		.link-id {
			padding: 0.0625rem 0.1875rem;
		}

		/* Compact meta */
		.card-meta {
			margin-top: 0.375rem;
			padding-top: 0.375rem;
			gap: 0.25rem;
			font-size: 0.5rem;
		}

		.priority-label {
			font-size: 0.375rem;
		}

		.deps-indicator {
			padding: 0.0625rem 0.1875rem;
			font-size: 0.5rem;
		}

		.impact-badge {
			padding: 0.0625rem 0.1875rem;
			font-size: 0.5rem;
		}

		.badge {
			padding: 0.125rem 0.25rem;
			font-size: 0.5625rem;
		}

		.btn-copy {
			width: 14px;
			height: 14px;
		}

		.btn-copy :global(svg) {
			width: 8px;
			height: 8px;
		}
	}
</style>
