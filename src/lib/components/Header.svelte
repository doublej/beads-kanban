<script lang="ts">
	import type { ViewMode } from '$lib/types';
	import Icon from './Icon.svelte';

	interface Props {
		searchQuery: string;
		filterPriority: number | 'all';
		filterType: string;
		filterTime: string;
		filterStatus: string;
		filterLabel: string;
		filterActionable: boolean;
		availableLabels: string[];
		viewMode: ViewMode;
		isDarkMode: boolean;
		totalIssues: number;
		projectName: string;
		agentPaneCount: number;
		showAgentPanes: boolean;
		ontoggleTheme: () => void;
		onopenKeyboardHelp: () => void;
		onopenCreatePanel: () => void;
		onopenSettings?: () => void;
		onopenPrompts?: () => void;
		onpreviewchange?: (previewing: boolean) => void;
		oneditProject?: () => void;
		ontoggleAgentPanes?: () => void;
	}

	let {
		searchQuery = $bindable(),
		filterPriority = $bindable(),
		filterType = $bindable(),
		filterTime = $bindable(),
		filterStatus = $bindable(),
		filterLabel = $bindable(),
		filterActionable = $bindable(),
		availableLabels,
		viewMode = $bindable(),
		isDarkMode,
		totalIssues,
		projectName,
		agentPaneCount = 0,
		showAgentPanes = true,
		ontoggleTheme,
		onopenKeyboardHelp,
		onopenCreatePanel,
		onopenSettings,
		onopenPrompts,
		onpreviewchange,
		oneditProject,
		ontoggleAgentPanes
	}: Props = $props();

	let showHelpMenu = $state(false);
	let showFilters = $state(false);
	let isSearchFocused = $state(false);
	let isFilterHovering = $state(false);

	$effect(() => {
		onpreviewchange?.(isSearchFocused || isFilterHovering);
	});

	const viewModes: { key: ViewMode; icon: 'view-board' | 'view-tree' | 'view-graph' | 'view-stats'; label: string }[] = [
		{ key: 'kanban', icon: 'view-board', label: 'board' },
		{ key: 'tree', icon: 'view-tree', label: 'tree' },
		{ key: 'graph', icon: 'view-graph', label: 'dependency graph' },
		{ key: 'stats', icon: 'view-stats', label: 'stats' }
	];

	const activeViewLabel = $derived(viewModes.find(m => m.key === viewMode)?.label ?? 'board');

	const priorityOptions = [
		{ value: 'all', label: 'All' },
		{ value: 0, label: 'Critical' },
		{ value: 1, label: 'High' },
		{ value: 2, label: 'Medium' },
		{ value: 3, label: 'Low' },
		{ value: 4, label: 'Backlog' }
	];

	const typeOptions = [
		{ value: 'all', label: 'All' },
		{ value: 'task', label: 'Task' },
		{ value: 'bug', label: 'Bug' },
		{ value: 'feature', label: 'Feature' },
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

<header class="header">
	<div class="toolbar">
		<!-- Left: Logo -->
		<div class="toolbar-left">
			<button class="logo-lockup" onclick={oneditProject} title="Change project">
				<span class="logo-app">blabla</span>
				<span class="logo-divider">/</span>
				<span class="logo-project">{projectName}</span>
				<span class="logo-divider">/</span>
				<span class="logo-view">{activeViewLabel}</span>
			</button>
		</div>

		<!-- Center: Search + New -->
		<div class="toolbar-center">
			<div class="search-container">
				<span class="search-icon"><Icon name="search" size={13} /></span>
				<input
					type="text"
					placeholder="Search..."
					bind:value={searchQuery}
					class="search-input"
					onfocus={() => isSearchFocused = true}
					onblur={() => isSearchFocused = false}
				/>
				{#if searchQuery}
					<button class="search-clear" onclick={() => searchQuery = ''}>×</button>
				{:else}
					<kbd class="hotkey-hint">⌘K</kbd>
				{/if}
			</div>

			<button class="btn-create" onclick={onopenCreatePanel}>
				<Icon name="plus" size={13} />
				<span class="btn-create-text">New</span>
				<kbd class="create-hotkey">N</kbd>
			</button>
		</div>

		<!-- Right: Views, Filters, Chat, Theme, Settings, Help -->
		<div class="toolbar-right">
			<!-- View Toggle -->
			<div class="btn-group">
				{#each viewModes as mode}
					<button
						class="toolbar-btn"
						class:active={viewMode === mode.key}
						onclick={() => viewMode = mode.key}
						title={mode.label}
					>
						<Icon name={mode.icon} size={14} />
					</button>
				{/each}
			</div>

			<span class="toolbar-sep"></span>

			<!-- Filters -->
			<div class="filters-wrapper" onmouseenter={() => isFilterHovering = true} onmouseleave={() => isFilterHovering = false}>
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

			<!-- Chat UI Toggle -->
			<button
				class="toolbar-btn"
				class:active={showAgentPanes}
				onclick={ontoggleAgentPanes}
				title="Toggle chat UI"
			>
				<Icon name="message" size={14} />
				<span>Chat</span>
				{#if agentPaneCount > 0}
					<span class="toolbar-badge">{agentPaneCount}</span>
				{/if}
			</button>

			<span class="toolbar-sep"></span>

			<!-- Icon buttons group -->
			<button class="toolbar-btn" onclick={ontoggleTheme} aria-label="Toggle theme">
				{#if isDarkMode}
					<Icon name="sun" size={14} />
				{:else}
					<Icon name="moon" size={14} />
				{/if}
			</button>
			<div class="help-wrapper">
				<button class="toolbar-btn" onclick={() => showHelpMenu = !showHelpMenu} aria-label="Help">
					<Icon name="help" size={14} />
				</button>
				{#if showHelpMenu}
					<div class="dropdown-menu" role="menu">
						<a href="/about" class="dropdown-item" onclick={() => showHelpMenu = false}>
							<Icon name="info" size={14} />
							About
						</a>
						<button class="dropdown-item" onclick={() => { showHelpMenu = false; onopenPrompts?.(); }}>
							<Icon name="message" size={14} />
							Prompts
						</button>
						<button class="dropdown-item" onclick={() => { showHelpMenu = false; onopenKeyboardHelp(); }}>
							<Icon name="keyboard" size={14} />
							Keyboard Shortcuts
							<kbd>?</kbd>
						</button>
					</div>
				{/if}
			</div>
			<button class="toolbar-btn" onclick={onopenSettings} aria-label="Settings">
				<Icon name="settings" size={14} />
			</button>
		</div>
	</div>
</header>

<style>
	/* Header - Single Row Unified Toolbar */
	.header {
		z-index: 100;
		flex-shrink: 0;
	}

	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 1rem;
		gap: 1rem;
	}

	.toolbar-left {
		flex-shrink: 0;
	}

	.toolbar-center {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		flex: 1;
	}

	.toolbar-right {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		flex-shrink: 0;
	}

	.toolbar-sep {
		width: 1px;
		height: 0.75rem;
		background: rgba(255, 255, 255, 0.08);
		margin: 0 0.375rem;
	}

	:global(.app.light) .toolbar-sep {
		background: rgba(0, 0, 0, 0.08);
	}

	/* Button group for view toggle */
	.btn-group {
		display: flex;
		gap: 2px;
	}

	/* Unified toolbar button */
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

	.logo-lockup {
		display: flex;
		align-items: baseline;
		gap: 0.25rem;
		padding: 0.25rem 0.5rem;
		margin: -0.25rem -0.5rem;
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: background var(--transition-fast);
	}

	.logo-lockup:hover {
		background: rgba(255, 255, 255, 0.06);
	}

	:global(.app.light) .logo-lockup:hover {
		background: rgba(0, 0, 0, 0.04);
	}

	.logo-app {
		font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif;
		font-size: 1.1rem;
		font-weight: 800;
		letter-spacing: -0.02em;
		color: rgba(255, 255, 255, 0.5);
		text-transform: lowercase;
	}

	.logo-divider {
		font-size: 1rem;
		font-weight: 300;
		color: rgba(255, 255, 255, 0.2);
		margin: 0 0.125rem;
	}

	.logo-project {
		font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif;
		font-size: 1.1rem;
		font-weight: 700;
		letter-spacing: -0.01em;
		color: rgba(255, 255, 255, 0.95);
	}

	.logo-view {
		font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif;
		font-size: 1.1rem;
		font-weight: 400;
		letter-spacing: -0.01em;
		color: rgba(255, 255, 255, 0.5);
	}

	:global(.app.light) .logo-view {
		color: rgba(0, 0, 0, 0.4);
	}

	:global(.app.light) .logo-app {
		color: rgba(0, 0, 0, 0.4);
	}

	:global(.app.light) .logo-divider {
		color: rgba(0, 0, 0, 0.15);
	}

	:global(.app.light) .logo-project {
		color: rgba(0, 0, 0, 0.9);
	}

	/* Search */
	.search-container {
		position: relative;
		display: flex;
		align-items: center;
		width: 180px;
	}

	.search-icon {
		position: absolute;
		left: 0.625rem;
		display: flex;
		color: var(--text-tertiary);
		pointer-events: none;
	}

	.search-input {
		width: 100%;
		height: 1.75rem;
		padding: 0 2.5rem 0 2rem;
		background: rgba(255, 255, 255, 0.04);
		border: none;
		border-radius: 0.25rem;
		color: var(--text-primary);
		font-family: inherit;
		font-size: 0.75rem;
	}

	.search-input::placeholder {
		color: var(--text-tertiary);
	}

	.search-input:focus {
		outline: none;
		background: rgba(255, 255, 255, 0.08);
	}

	:global(.app.light) .search-input {
		background: rgba(0, 0, 0, 0.03);
	}

	:global(.app.light) .search-input:focus {
		background: rgba(0, 0, 0, 0.05);
	}

	.search-clear {
		position: absolute;
		right: 0.375rem;
		width: 1rem;
		height: 1rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		border-radius: 0.125rem;
		color: var(--text-tertiary);
		font-size: 0.75rem;
		cursor: pointer;
	}

	.search-clear:hover {
		color: var(--text-primary);
	}

	.hotkey-hint {
		position: absolute;
		right: 0.375rem;
		font-family: ui-monospace, monospace;
		font-size: 0.625rem;
		color: var(--text-tertiary);
		opacity: 0.5;
	}

	/* Create button - styled like toolbar-btn but primary */
	.btn-create {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		height: 1.75rem;
		padding: 0 0.625rem;
		background: rgba(59, 130, 246, 0.12);
		border: none;
		border-radius: 0.25rem;
		font-family: inherit;
		font-size: 0.75rem;
		font-weight: 500;
		color: #60a5fa;
		cursor: pointer;
		transition: background 0.1s;
	}

	.btn-create:hover {
		background: rgba(59, 130, 246, 0.18);
	}

	:global(.app.light) .btn-create {
		background: rgba(59, 130, 246, 0.08);
		color: #2563eb;
	}

	:global(.app.light) .btn-create:hover {
		background: rgba(59, 130, 246, 0.12);
	}

	.btn-create-text {
		font-weight: 500;
	}

	.create-hotkey {
		font-family: ui-monospace, monospace;
		font-size: 0.5625rem;
		opacity: 0.5;
	}

	/* Dropdown menus (Help, Settings) */
	.help-wrapper,
	.settings-wrapper {
		position: relative;
	}

	.dropdown-menu {
		position: absolute;
		top: calc(100% + 0.375rem);
		right: 0;
		min-width: 200px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
		padding: 0.375rem;
		z-index: 1000;
		animation: dropdownFadeIn 0.12s ease-out;
	}

	@keyframes dropdownFadeIn {
		from { opacity: 0; transform: translateY(-4px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.dropdown-section {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.dropdown-label {
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-tertiary);
		padding: 0.375rem 0.5rem 0.25rem;
	}

	.dropdown-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.625rem;
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		font-family: inherit;
		font-size: 0.8125rem;
		text-decoration: none;
		cursor: pointer;
		transition: all var(--transition-fast);
		text-align: left;
		width: 100%;
	}

	.dropdown-item:hover {
		background: rgba(255, 255, 255, 0.06);
		color: var(--text-primary);
	}

	.dropdown-item :global(svg) {
		width: 0.875rem;
		height: 0.875rem;
		flex-shrink: 0;
		opacity: 0.7;
	}

	.dropdown-item kbd {
		margin-left: auto;
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 0.625rem;
		color: var(--text-tertiary);
		background: rgba(255, 255, 255, 0.04);
		padding: 0.125rem 0.375rem;
		border-radius: 3px;
	}

	.dropdown-item-danger {
		color: #ef4444;
	}

	.dropdown-item-danger:hover {
		background: rgba(239, 68, 68, 0.1);
		color: #f87171;
	}

	/* Filters */
	.filters-wrapper {
		position: relative;
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

	/* Mobile responsive styles */
	@media (max-width: 768px) {
		.toolbar {
			padding: 0.375rem 0.5rem;
			padding-top: max(0.375rem, env(safe-area-inset-top));
			padding-left: max(0.5rem, env(safe-area-inset-left));
			padding-right: max(0.5rem, env(safe-area-inset-right));
			gap: 0.375rem;
		}

		.toolbar-left {
			display: none;
		}

		.toolbar-center {
			flex: 1;
			justify-content: flex-start;
			gap: 0.25rem;
		}

		.toolbar-right {
			gap: 0.125rem;
		}

		.toolbar-sep,
		.btn-group {
			display: none;
		}

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

		.search-container {
			width: 100px;
		}

		.search-input {
			height: 1.5rem;
			padding: 0 1.5rem 0 1.75rem;
		}

		.search-icon {
			left: 0.5rem;
		}

		.btn-create-text,
		.create-hotkey,
		.hotkey-hint {
			display: none;
		}

		.btn-create {
			padding: 0;
			width: 1.5rem;
			height: 1.5rem;
		}

		.filters-popover {
			width: calc(100vw - 1rem);
			max-width: 320px;
		}
	}
</style>
