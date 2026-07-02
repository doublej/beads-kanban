<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { FilterState } from '$lib/filters';
	import { UNASSIGNED } from '$lib/filters';
	import { columns, getPriorityConfig, getTypeIcon } from '$lib/utils';
	import Icon from './Icon.svelte';
	import MultiSelectFilter from './MultiSelectFilter.svelte';

	interface Props {
		filters: FilterState;
		availableLabels: string[];
		availableAssignees: string[];
		availableTypes: string[];
		activeCount: number;
		collapsed: boolean;
		ontogglecollapse: () => void;
		onclear: () => void;
		queue?: Snippet;
	}

	let {
		filters,
		availableLabels,
		availableAssignees,
		availableTypes,
		activeCount,
		collapsed,
		ontogglecollapse,
		onclear,
		queue
	}: Props = $props();

	const KNOWN_TYPES = ['task', 'bug', 'feature', 'enhancement', 'epic', 'chore'];

	const priorityOptions = [0, 1, 2, 3, 4].map((p) => ({ value: p, ...getPriorityConfig(p) }));
	const timeOptions = [
		{ value: '1h', label: 'Last hour' },
		{ value: '24h', label: 'Last 24h' },
		{ value: 'today', label: 'Today' },
		{ value: 'week', label: 'This week' }
	];
	const dueOptions = [
		{ value: 'overdue', label: 'Overdue', dot: '#ef4444' },
		{ value: 'today', label: 'Due today', dot: '#f59e0b' },
		{ value: 'week', label: 'Due this week', dot: '#eab308' },
		{ value: 'has', label: 'Scheduled', dot: '#6366f1' }
	];
	const quickToggles = [
		{ key: 'actionable', label: 'Actionable only' },
		{ key: 'pinned', label: 'Pinned' },
		{ key: 'deferred', label: 'Deferred' },
		{ key: 'started', label: 'Started' }
	] as const;

	const typeOptions = $derived(availableTypes.length ? availableTypes : KNOWN_TYPES);
	const assigneeOptions = $derived([UNASSIGNED, ...availableAssignees]);

	function toggleStr(arr: string[], v: string): string[] {
		return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
	}
	function toggleNum(arr: number[], v: number): number[] {
		return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
	}
	function formatAssignee(v: string): string {
		return v === UNASSIGNED ? 'Unassigned' : v;
	}
</script>

{#if collapsed}
	<aside class="filter-rail">
		<button class="rail-btn" onclick={ontogglecollapse} title="Show filters">
			<Icon name="sliders" size={16} />
			{#if activeCount > 0}<span class="rail-badge">{activeCount}</span>{/if}
		</button>
	</aside>
{:else}
	<div
		class="sidebar-backdrop"
		onclick={ontogglecollapse}
		role="presentation"
	></div>
	<aside class="filter-sidebar">
		<div class="sidebar-header">
			<div class="sidebar-title">
				<Icon name="sliders" size={14} />
				<span>Filters</span>
				{#if activeCount > 0}<span class="count-badge">{activeCount}</span>{/if}
			</div>
			<div class="header-actions">
				{#if activeCount > 0}
					<button class="text-btn" onclick={onclear}>Clear all</button>
				{/if}
				<button class="icon-btn" onclick={ontogglecollapse} title="Collapse sidebar" aria-label="Collapse sidebar">
					<Icon name="chevron-left" size={16} />
				</button>
			</div>
		</div>

		<div class="sidebar-body">
			<!-- Status -->
			<section class="section">
				<div class="section-label">Status</div>
				<div class="chips">
					{#each columns as c (c.key)}
						<button
							class="chip"
							class:active={filters.statuses.includes(c.status)}
							style="--dot: {c.accent}"
							onclick={() => (filters.statuses = toggleStr(filters.statuses, c.status))}
						>
							<span class="chip-dot"></span>{c.label}
						</button>
					{/each}
				</div>
			</section>

			<!-- Priority -->
			<section class="section">
				<div class="section-label">Priority</div>
				<div class="chips">
					{#each priorityOptions as p (p.value)}
						<button
							class="chip"
							class:active={filters.priorities.includes(p.value)}
							style="--dot: {p.color}"
							onclick={() => (filters.priorities = toggleNum(filters.priorities, p.value))}
						>
							<span class="chip-dot"></span>{p.label}
						</button>
					{/each}
				</div>
			</section>

			<!-- Type -->
			<section class="section">
				<div class="section-label">Type</div>
				<div class="chips">
					{#each typeOptions as t (t)}
						<button
							class="chip"
							class:active={filters.types.includes(t)}
							onclick={() => (filters.types = toggleStr(filters.types, t))}
						>
							<Icon name={getTypeIcon(t)} size={11} />{t}
						</button>
					{/each}
				</div>
			</section>

			<!-- Assignee -->
			<section class="section">
				<div class="section-label">Assignee</div>
				<MultiSelectFilter
					options={assigneeOptions}
					selected={filters.assignees}
					placeholder="Any assignee"
					formatOption={formatAssignee}
					onchange={(n) => (filters.assignees = n)}
				/>
			</section>

			<!-- Labels -->
			<section class="section">
				<div class="section-label-row">
					<span class="section-label">Labels</span>
					{#if filters.labels.length > 1}
						<div class="segmented">
							<button class:active={filters.labelMode === 'any'} onclick={() => (filters.labelMode = 'any')}>Any</button>
							<button class:active={filters.labelMode === 'all'} onclick={() => (filters.labelMode = 'all')}>All</button>
						</div>
					{/if}
				</div>
				<MultiSelectFilter
					options={availableLabels}
					selected={filters.labels}
					placeholder="Any label"
					onchange={(n) => (filters.labels = n)}
				/>
				{#if availableLabels.length > 0}
					<div class="exclude-label">Exclude</div>
					<MultiSelectFilter
						options={availableLabels}
						selected={filters.excludeLabels}
						placeholder="Hide labels…"
						onchange={(n) => (filters.excludeLabels = n)}
					/>
				{/if}
			</section>

			<!-- Due -->
			<section class="section">
				<div class="section-label">Due date</div>
				<div class="chips">
					{#each dueOptions as d (d.value)}
						<button
							class="chip"
							class:active={filters.due === d.value}
							style="--dot: {d.dot}"
							onclick={() => (filters.due = filters.due === d.value ? 'all' : d.value)}
						>
							<span class="chip-dot"></span>{d.label}
						</button>
					{/each}
				</div>
			</section>

			<!-- Updated -->
			<section class="section">
				<div class="section-label">Updated</div>
				<div class="chips">
					{#each timeOptions as t (t.value)}
						<button
							class="chip"
							class:active={filters.time === t.value}
							onclick={() => (filters.time = filters.time === t.value ? 'all' : t.value)}
						>
							{t.label}
						</button>
					{/each}
				</div>
			</section>

			<!-- Created -->
			<section class="section">
				<div class="section-label">Created</div>
				<div class="chips">
					{#each timeOptions as t (t.value)}
						<button
							class="chip"
							class:active={filters.created === t.value}
							onclick={() => (filters.created = filters.created === t.value ? 'all' : t.value)}
						>
							{t.label}
						</button>
					{/each}
				</div>
			</section>

			<!-- Quick -->
			<section class="section">
				<div class="section-label">Quick filters</div>
				<div class="chips">
					{#each quickToggles as q (q.key)}
						<button
							class="chip"
							class:active={filters[q.key]}
							onclick={() => (filters[q.key] = !filters[q.key])}
						>
							{q.label}
						</button>
					{/each}
				</div>
			</section>
		</div>

		{@render queue?.()}
	</aside>
{/if}

<style>
	.filter-sidebar {
		display: flex;
		flex-direction: column;
		flex: 0 0 260px;
		width: 260px;
		min-height: 0;
		margin: 1.25rem 0 1.25rem 1.25rem;
		background: var(--surface-panel);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	.filter-rail {
		display: flex;
		flex-direction: column;
		align-items: center;
		flex: 0 0 44px;
		width: 44px;
		padding-top: 0.5rem;
		margin: 1.25rem 0 1.25rem 1.25rem;
		background: var(--surface-panel);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
	}

	.rail-btn {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		cursor: pointer;
		transition: background var(--transition-fast), color var(--transition-fast);
	}

	.rail-btn:hover {
		background: var(--bg-elevated);
		color: var(--text-primary);
	}

	.rail-badge {
		position: absolute;
		top: -2px;
		right: -2px;
		min-width: 14px;
		height: 14px;
		padding: 0 3px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: var(--accent-primary);
		border-radius: var(--radius-full);
		color: #fff;
		font-size: 0.5625rem;
		font-weight: 700;
	}

	.sidebar-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.625rem 0.75rem;
		border-bottom: 1px solid var(--border-subtle);
		flex-shrink: 0;
	}

	.sidebar-title {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		color: var(--text-primary);
		font-size: 0.8125rem;
		font-weight: 600;
	}

	.count-badge {
		min-width: 1rem;
		height: 1rem;
		padding: 0 0.25rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: var(--accent-primary);
		border-radius: var(--radius-full);
		color: #fff;
		font-size: 0.625rem;
		font-weight: 700;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.text-btn {
		padding: 0.1875rem 0.375rem;
		background: transparent;
		border: none;
		border-radius: var(--radius-xs);
		color: var(--text-tertiary);
		font-family: inherit;
		font-size: 0.6875rem;
		cursor: pointer;
		transition: color var(--transition-fast);
	}

	.text-btn:hover {
		color: var(--text-primary);
	}

	.icon-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		background: transparent;
		border: none;
		border-radius: var(--radius-xs);
		color: var(--text-tertiary);
		cursor: pointer;
		transition: background var(--transition-fast), color var(--transition-fast);
	}

	.icon-btn:hover {
		background: var(--bg-elevated);
		color: var(--text-primary);
	}

	.sidebar-body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.section-label,
	.section-label-row {
		margin-bottom: 0.5rem;
	}

	.section-label,
	.section-label-row .section-label {
		display: block;
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-tertiary);
	}

	.section-label-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.section-label-row .section-label {
		margin-bottom: 0;
	}

	.exclude-label {
		margin: 0.5rem 0 0.375rem;
		font-size: 0.625rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-tertiary);
	}

	.segmented {
		display: flex;
		gap: 1px;
		background: var(--border-subtle);
		border-radius: var(--radius-xs);
		overflow: hidden;
	}

	.segmented button {
		padding: 0.125rem 0.375rem;
		background: var(--bg-elevated);
		border: none;
		color: var(--text-tertiary);
		font-family: inherit;
		font-size: 0.625rem;
		font-weight: 600;
		cursor: pointer;
	}

	.segmented button.active {
		background: var(--accent-primary);
		color: #fff;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.3125rem;
		padding: 0.3125rem 0.5rem;
		background: var(--bg-elevated);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		font-family: inherit;
		font-size: 0.6875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.chip :global(svg) {
		flex-shrink: 0;
		opacity: 0.75;
	}

	.chip:hover {
		border-color: var(--border-strong);
		color: var(--text-primary);
	}

	.chip.active {
		background: var(--accent-glow);
		border-color: color-mix(in srgb, var(--accent-primary) 40%, transparent);
		color: var(--text-primary);
	}

	.chip-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--dot, var(--text-tertiary));
		flex-shrink: 0;
	}

	.sidebar-backdrop {
		display: none;
	}

	@media (max-width: 768px) {
		.filter-rail {
			display: none;
		}

		.sidebar-backdrop {
			display: block;
			position: fixed;
			inset: 0;
			background: rgba(0, 0, 0, 0.5);
			z-index: 900;
		}

		.filter-sidebar {
			position: fixed;
			top: 0;
			left: 0;
			bottom: 0;
			z-index: 901;
			margin: 0;
			border-radius: 0;
			flex: 0 0 82vw;
			width: 82vw;
			max-width: 320px;
			box-shadow: var(--shadow-elevated);
		}
	}
</style>
