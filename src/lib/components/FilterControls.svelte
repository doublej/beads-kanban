<script lang="ts">
	import Icon from './Icon.svelte';

	interface Props {
		filterPriority: number | 'all';
		filterType: string;
		filterTime: string;
		filterStatus: string;
		filterLabel: string;
		filterActionable: boolean;
		availableLabels: string[];
		onhoverchange?: (hovering: boolean) => void;
	}

	let {
		filterPriority = $bindable(),
		filterType = $bindable(),
		filterTime = $bindable(),
		filterStatus = $bindable(),
		filterLabel = $bindable(),
		filterActionable = $bindable(),
		availableLabels,
		onhoverchange
	}: Props = $props();

	let showFilters = $state(false);

	const priorityOptions = [
		{ value: 'all' as const, label: 'All' },
		{ value: 0 as const, label: 'Critical' },
		{ value: 1 as const, label: 'High' },
		{ value: 2 as const, label: 'Medium' },
		{ value: 3 as const, label: 'Low' },
		{ value: 4 as const, label: 'Backlog' }
	];

	const typeOptions = [
		{ value: 'all', label: 'All' },
		{ value: 'task', label: 'Task' },
		{ value: 'bug', label: 'Bug' },
		{ value: 'feature', label: 'Feature' },
		{ value: 'enhancement', label: 'Enhancement' },
		{ value: 'epic', label: 'Epic' },
		{ value: 'chore', label: 'Chore' }
	];

	const timeOptions = [
		{ value: 'all', label: 'Any Time' },
		{ value: '1h', label: 'Last Hour' },
		{ value: '24h', label: 'Last 24h' },
		{ value: 'today', label: 'Today' },
		{ value: 'week', label: 'This Week' }
	];

	const statusOptions = [
		{ value: 'all', label: 'All' },
		{ value: 'open', label: 'Open' },
		{ value: 'in_progress', label: 'In Progress' },
		{ value: 'blocked', label: 'Blocked' },
		{ value: 'closed', label: 'Closed' },
		{ value: '!closed', label: 'Not Closed' }
	];

	function clearFilters() {
		filterPriority = 'all';
		filterType = 'all';
		filterTime = 'all';
		filterStatus = 'all';
		filterLabel = 'all';
		filterActionable = false;
	}

	const activeFilterCount = $derived(
		(filterPriority !== 'all' ? 1 : 0) +
		(filterType !== 'all' ? 1 : 0) +
		(filterTime !== 'all' ? 1 : 0) +
		(filterStatus !== 'all' ? 1 : 0) +
		(filterLabel !== 'all' ? 1 : 0) +
		(filterActionable ? 1 : 0)
	);

	const hasActiveFilters = $derived(activeFilterCount > 0);
</script>

<div
	class="filters-wrapper"
	onmouseenter={() => onhoverchange?.(true)}
	onmouseleave={() => onhoverchange?.(false)}
>
	<button
		class="toolbar-btn"
		class:active={hasActiveFilters}
		onclick={() => showFilters = !showFilters}
	>
		<Icon name="filter" size={14} />
		<span>Filters</span>
		{#if hasActiveFilters}
			<span class="toolbar-badge">{activeFilterCount}</span>
		{/if}
	</button>
	{#if showFilters}
		<div class="filters-popover">
			<div class="filter-section">
				<label class="filter-label">Status</label>
				<div class="filter-chips">
					{#each statusOptions as opt}
						<button
							class="filter-chip"
							class:active={filterStatus === opt.value}
							onclick={() => filterStatus = opt.value}
						>
							{opt.label}
						</button>
					{/each}
				</div>
			</div>
			<div class="filter-section">
				<label class="filter-label">Priority</label>
				<div class="filter-chips">
					{#each priorityOptions as opt}
						<button
							class="filter-chip"
							class:active={filterPriority === opt.value}
							onclick={() => filterPriority = opt.value}
						>
							{opt.label}
						</button>
					{/each}
				</div>
			</div>
			<div class="filter-section">
				<label class="filter-label">Type</label>
				<div class="filter-chips">
					{#each typeOptions as opt}
						<button
							class="filter-chip"
							class:active={filterType === opt.value}
							onclick={() => filterType = opt.value}
						>
							{opt.label}
						</button>
					{/each}
				</div>
			</div>
			{#if availableLabels.length > 0}
			<div class="filter-section">
				<label class="filter-label">Label</label>
				<div class="filter-chips">
					<button
						class="filter-chip"
						class:active={filterLabel === 'all'}
						onclick={() => filterLabel = 'all'}
					>
						All
					</button>
					{#each availableLabels as label}
						<button
							class="filter-chip"
							class:active={filterLabel === label}
							onclick={() => filterLabel = label}
						>
							{label}
						</button>
					{/each}
				</div>
			</div>
			{/if}
			<div class="filter-section">
				<label class="filter-label">Time</label>
				<div class="filter-chips">
					{#each timeOptions as opt}
						<button
							class="filter-chip"
							class:active={filterTime === opt.value}
							onclick={() => filterTime = opt.value}
						>
							{opt.label}
						</button>
					{/each}
				</div>
			</div>
			<div class="filter-section">
				<label class="filter-label">Quick Filters</label>
				<div class="filter-chips">
					<button
						class="filter-chip"
						class:active={filterActionable}
						onclick={() => filterActionable = !filterActionable}
					>
						Actionable
					</button>
				</div>
			</div>
			{#if hasActiveFilters}
				<div class="filter-actions">
					<button class="clear-filters-btn" onclick={clearFilters}>
						Clear all filters
					</button>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.filters-wrapper {
		position: relative;
	}

	.toolbar-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		height: 1.75rem;
		min-width: 1.75rem;
		padding: 0 0.5rem;
		background: transparent;
		border: none;
		border-radius: 0.25rem;
		color: var(--text-tertiary);
		font-family: inherit;
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.1s, color 0.1s;
	}

	.toolbar-btn :global(svg) {
		flex-shrink: 0;
	}

	.toolbar-btn:hover {
		background: rgba(255, 255, 255, 0.06);
		color: var(--text-primary);
	}

	.toolbar-btn.active {
		background: rgba(255, 255, 255, 0.1);
		color: var(--text-primary);
	}

	:global(.app.light) .toolbar-btn:hover {
		background: rgba(0, 0, 0, 0.04);
	}

	:global(.app.light) .toolbar-btn.active {
		background: rgba(0, 0, 0, 0.06);
	}

	.toolbar-badge {
		min-width: 1rem;
		height: 1rem;
		padding: 0 0.25rem;
		background: var(--text-tertiary);
		border-radius: 0.25rem;
		color: var(--bg-primary);
		font-size: 0.625rem;
		font-weight: 600;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.filters-popover {
		position: absolute;
		top: calc(100% + 0.5rem);
		right: 0;
		width: 280px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
		padding: 0.75rem;
		z-index: 1000;
		animation: dropdownFadeIn 0.12s ease-out;
	}

	@keyframes dropdownFadeIn {
		from { opacity: 0; transform: translateY(-4px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.filter-section {
		margin-bottom: 0.75rem;
	}

	.filter-section:last-of-type {
		margin-bottom: 0;
	}

	.filter-label {
		display: block;
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-tertiary);
		margin-bottom: 0.375rem;
	}

	.filter-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	.filter-chip {
		padding: 0.3125rem 0.5rem;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		font-family: inherit;
		font-size: 0.6875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.filter-chip:hover {
		background: rgba(255, 255, 255, 0.08);
		border-color: rgba(255, 255, 255, 0.12);
	}

	.filter-chip.active {
		background: rgba(59, 130, 246, 0.15);
		border-color: rgba(59, 130, 246, 0.3);
		color: #60a5fa;
	}

	:global(.app.light) .filter-chip {
		background: rgba(0, 0, 0, 0.03);
		border-color: rgba(0, 0, 0, 0.08);
	}

	:global(.app.light) .filter-chip:hover {
		background: rgba(0, 0, 0, 0.06);
	}

	:global(.app.light) .filter-chip.active {
		background: rgba(59, 130, 246, 0.1);
		color: #2563eb;
	}

	.filter-actions {
		margin-top: 0.75rem;
		padding-top: 0.625rem;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
	}

	:global(.app.light) .filter-actions {
		border-top-color: rgba(0, 0, 0, 0.06);
	}

	.clear-filters-btn {
		width: 100%;
		padding: 0.375rem;
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		color: var(--text-tertiary);
		font-family: inherit;
		font-size: 0.75rem;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.clear-filters-btn:hover {
		background: rgba(255, 255, 255, 0.04);
		color: var(--text-secondary);
	}

	@media (max-width: 768px) {
		.toolbar-btn {
			height: 1.5rem;
			min-width: 1.5rem;
			padding: 0 0.375rem;
		}

		.toolbar-btn span:not(.toolbar-badge) {
			display: none;
		}

		.toolbar-badge {
			min-width: 0.75rem;
			height: 0.75rem;
			font-size: 0.5rem;
		}

		.filters-popover {
			width: calc(100vw - 1rem);
			max-width: 320px;
		}
	}
</style>
