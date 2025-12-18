<script lang="ts">
	import type { ViewMode } from '$lib/types';
	import Icon from './Icon.svelte';

	interface Props {
		searchQuery: string;
		filterPriority: number | 'all';
		filterType: string;
		filterTime: string;
		viewMode: ViewMode;
		isDarkMode: boolean;
		totalIssues: number;
		projectName: string;
		ontoggleTheme: () => void;
		onopenKeyboardHelp: () => void;
		onopenCreatePanel: () => void;
		onopenSettings?: () => void;
		onpreviewchange?: (previewing: boolean) => void;
		oneditProject?: () => void;
	}

	let {
		searchQuery = $bindable(),
		filterPriority = $bindable(),
		filterType = $bindable(),
		filterTime = $bindable(),
		viewMode = $bindable(),
		isDarkMode,
		totalIssues,
		projectName,
		ontoggleTheme,
		onopenKeyboardHelp,
		onopenCreatePanel,
		onopenSettings,
		onpreviewchange,
		oneditProject
	}: Props = $props();

	let showHelpMenu = $state(false);
	let showFilters = $state(false);
	let isSearchFocused = $state(false);
	let isFilterHovering = $state(false);

	$effect(() => {
		onpreviewchange?.(isSearchFocused || isFilterHovering);
	});

	const viewModes: { key: ViewMode; icon: 'view-board' | 'view-tree' | 'view-graph' | 'view-stats'; label: string }[] = [
		{ key: 'kanban', icon: 'view-board', label: 'Board' },
		{ key: 'tree', icon: 'view-tree', label: 'Tree' },
		{ key: 'graph', icon: 'view-graph', label: 'Graph' },
		{ key: 'stats', icon: 'view-stats', label: 'Stats' }
	];

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

	function clearFilters() {
		filterPriority = 'all';
		filterType = 'all';
		filterTime = 'all';
	}

	const activeFilterCount = $derived(
		(filterPriority !== 'all' ? 1 : 0) +
		(filterType !== 'all' ? 1 : 0) +
		(filterTime !== 'all' ? 1 : 0)
	);

	const hasActiveFilters = $derived(activeFilterCount > 0);
</script>

<header class="header">
	<!-- Row 1: Global Top Bar -->
	<div class="global-bar">
		<div class="global-left">
			<button class="logo-lockup" onclick={oneditProject} title="Change project">
				<span class="logo-app">strandkanban</span>
				<span class="logo-divider">/</span>
				<span class="logo-project">{projectName}</span>
			</button>
		</div>

		<div class="global-center">
			<div class="search-container">
				<span class="search-icon"><Icon name="search" size={14} /></span>
				<input
					type="text"
					placeholder="Search issues..."
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
				<span class="btn-create-text">New Issue</span>
				<kbd class="create-hotkey">N</kbd>
			</button>
		</div>

		<div class="global-right">
			<div class="help-wrapper">
				<button class="icon-btn" onclick={() => showHelpMenu = !showHelpMenu} aria-label="Help">
					<Icon name="help" size={16} />
				</button>
				{#if showHelpMenu}
					<div class="dropdown-menu" role="menu">
						<a href="/about" class="dropdown-item" onclick={() => showHelpMenu = false}>
							<Icon name="info" size={14} />
							About
						</a>
						<a href="/prompts" class="dropdown-item" onclick={() => showHelpMenu = false}>
							<Icon name="message" size={14} />
							Prompts
						</a>
						<button class="dropdown-item" onclick={() => { showHelpMenu = false; onopenKeyboardHelp(); }}>
							<Icon name="keyboard" size={14} />
							Keyboard Shortcuts
							<kbd>?</kbd>
						</button>
					</div>
				{/if}
			</div>
			<button class="icon-btn" onclick={ontoggleTheme} aria-label="Toggle theme">
				{#if isDarkMode}
					<Icon name="sun" size={16} />
				{:else}
					<Icon name="moon" size={16} />
				{/if}
			</button>
			<button class="icon-btn" onclick={onopenSettings} aria-label="Settings">
				<Icon name="settings" size={16} />
			</button>
		</div>
	</div>

	<!-- Row 2: Page Controls -->
	<div class="page-controls">
		<div class="view-toggle">
				{#each viewModes as mode}
					<button
						class="view-btn"
						class:active={viewMode === mode.key}
						onclick={() => viewMode = mode.key}
						title={mode.label}
					>
						<span class="view-icon"><Icon name={mode.icon} size={14} /></span>
						<span class="view-label">{mode.label}</span>
					</button>
				{/each}
			</div>

			<div class="filters-wrapper" onmouseenter={() => isFilterHovering = true} onmouseleave={() => isFilterHovering = false}>
				<button
					class="filters-btn"
					class:active={hasActiveFilters}
					onclick={() => showFilters = !showFilters}
				>
					<Icon name="filter" size={14} />
					<span>Filters</span>
					{#if hasActiveFilters}
						<span class="filter-badge">{activeFilterCount}</span>
					{/if}
				</button>
				{#if showFilters}
					<div class="filters-popover">
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
	</div>
</header>

<style>
	/* Header - Two Row Layout */
	.header {
		display: flex;
		flex-direction: column;
		gap: 0;
		z-index: 100;
		flex-shrink: 0;
	}

	/* Row 1: Global Bar */
	.global-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.625rem 1.5rem;
		gap: 1.5rem;
	}

	.global-left {
		flex-shrink: 0;
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

	:global(.app.light) .logo-app {
		color: rgba(0, 0, 0, 0.4);
	}

	:global(.app.light) .logo-divider {
		color: rgba(0, 0, 0, 0.15);
	}

	:global(.app.light) .logo-project {
		color: rgba(0, 0, 0, 0.9);
	}

	.global-center {
		flex: 1;
		max-width: 480px;
		display: flex;
		align-items: center;
		gap: 0.625rem;
	}

	.search-container {
		position: relative;
		display: flex;
		align-items: center;
		flex: 1;
	}

	.search-icon {
		position: absolute;
		left: 0.75rem;
		display: flex;
		align-items: center;
		color: var(--text-tertiary);
		pointer-events: none;
	}

	.search-input {
		width: 100%;
		height: 2.125rem;
		padding: 0 3rem 0 2.25rem;
		background: rgba(255, 255, 255, 0.04);
		border: 0.5px solid rgba(255, 255, 255, 0.12);
		border-radius: 0.5rem;
		color: var(--text-primary);
		font-family: inherit;
		font-size: 0.8125rem;
		transition: all var(--transition-fast);
	}

	.search-input::placeholder {
		color: var(--text-tertiary);
	}

	.search-input:focus {
		outline: none;
		background: rgba(255, 255, 255, 0.06);
		border-color: rgba(59, 130, 246, 0.4);
		box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
	}

	:global(.app.light) .search-input {
		background: rgba(0, 0, 0, 0.03);
		border-color: rgba(0, 0, 0, 0.12);
	}

	:global(.app.light) .search-input:focus {
		background: rgba(0, 0, 0, 0.04);
	}

	.search-clear {
		position: absolute;
		right: 0.5rem;
		width: 1.125rem;
		height: 1.125rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-elevated);
		border: none;
		border-radius: 50%;
		color: var(--text-tertiary);
		font-size: 0.75rem;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.search-clear:hover {
		background: var(--text-tertiary);
		color: var(--bg-primary);
	}

	.hotkey-hint {
		position: absolute;
		right: 0.625rem;
		top: 50%;
		transform: translateY(-50%);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.125rem 0.375rem;
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 0.625rem;
		font-weight: 500;
		color: var(--text-tertiary);
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 4px;
		opacity: 0.6;
	}

	:global(.app.light) .hotkey-hint {
		background: rgba(0, 0, 0, 0.04);
		border-color: rgba(0, 0, 0, 0.08);
	}

	.btn-create {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.375rem;
		height: 2.125rem;
		padding: 0 0.875rem;
		background:
			linear-gradient(180deg,
				rgba(255, 255, 255, 0.18) 0%,
				rgba(255, 255, 255, 0.05) 50%,
				transparent 50%,
				rgba(0, 0, 0, 0.05) 100%
			),
			linear-gradient(180deg, #4a9fff 0%, #3b82f6 40%, #2563eb 100%);
		border: none;
		border-radius: 0.5rem;
		font-family: inherit;
		font-size: 0.8125rem;
		font-weight: 500;
		cursor: pointer;
		transition: all var(--transition-fast);
		white-space: nowrap;
		box-shadow:
			/* outer glow */
			0 0 12px rgba(59, 130, 246, 0.25),
			/* bottom edge */
			0 2px 0 #1e40af,
			0 3px 3px rgba(30, 64, 175, 0.4),
			/* specular top highlight */
			inset 0 1px 0 rgba(255, 255, 255, 0.35),
			/* inner top glow */
			inset 0 0 8px rgba(255, 255, 255, 0.1),
			/* bottom inner shadow for depth */
			inset 0 -1px 1px rgba(0, 0, 0, 0.1);
		backdrop-filter: saturate(120%);
	}

	/* Gradient border via pseudo-element */
	.btn-create::before {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		padding: 0.5px;
		background: linear-gradient(
			180deg,
			rgba(255, 255, 255, 0.5) 0%,
			rgba(255, 255, 255, 0.15) 50%,
			rgba(0, 0, 0, 0.1) 100%
		);
		-webkit-mask:
			linear-gradient(#fff 0 0) content-box,
			linear-gradient(#fff 0 0);
		mask:
			linear-gradient(#fff 0 0) content-box,
			linear-gradient(#fff 0 0);
		-webkit-mask-composite: xor;
		mask-composite: exclude;
		pointer-events: none;
	}

	.btn-create:hover {
		background:
			linear-gradient(180deg,
				rgba(255, 255, 255, 0.25) 0%,
				rgba(255, 255, 255, 0.08) 50%,
				transparent 50%,
				rgba(0, 0, 0, 0.03) 100%
			),
			linear-gradient(180deg, #5ea8ff 0%, #4a90f7 40%, #3b82f6 100%);
		box-shadow:
			0 0 16px rgba(59, 130, 246, 0.35),
			0 2px 0 #1e40af,
			0 4px 6px rgba(30, 64, 175, 0.35),
			inset 0 1px 0 rgba(255, 255, 255, 0.4),
			inset 0 0 12px rgba(255, 255, 255, 0.15),
			inset 0 -1px 1px rgba(0, 0, 0, 0.08);
	}

	.btn-create:active {
		transform: translateY(1px);
		background:
			linear-gradient(180deg,
				rgba(255, 255, 255, 0.08) 0%,
				transparent 50%,
				rgba(0, 0, 0, 0.08) 100%
			),
			linear-gradient(180deg, #3b82f6 0%, #2563eb 40%, #1d4ed8 100%);
		box-shadow:
			0 0 8px rgba(59, 130, 246, 0.2),
			0 1px 0 #1e40af,
			inset 0 1px 2px rgba(0, 0, 0, 0.15),
			inset 0 0 4px rgba(0, 0, 0, 0.05);
	}

	:global(.app.light) .btn-create {
		background:
			linear-gradient(180deg,
				rgba(255, 255, 255, 0.3) 0%,
				rgba(255, 255, 255, 0.1) 50%,
				transparent 50%,
				rgba(0, 0, 0, 0.05) 100%
			),
			linear-gradient(180deg, #4a9fff 0%, #3b82f6 40%, #2563eb 100%);
		box-shadow:
			0 0 10px rgba(59, 130, 246, 0.2),
			0 2px 0 #1d4ed8,
			0 3px 4px rgba(29, 78, 216, 0.25),
			inset 0 1px 0 rgba(255, 255, 255, 0.45),
			inset 0 0 8px rgba(255, 255, 255, 0.15),
			inset 0 -1px 1px rgba(0, 0, 0, 0.08);
	}

	:global(.app.light) .btn-create:hover {
		background:
			linear-gradient(180deg,
				rgba(255, 255, 255, 0.35) 0%,
				rgba(255, 255, 255, 0.12) 50%,
				transparent 50%,
				rgba(0, 0, 0, 0.03) 100%
			),
			linear-gradient(180deg, #5ea8ff 0%, #4a90f7 40%, #3b82f6 100%);
		box-shadow:
			0 0 14px rgba(59, 130, 246, 0.3),
			0 2px 0 #1d4ed8,
			0 4px 6px rgba(29, 78, 216, 0.2),
			inset 0 1px 0 rgba(255, 255, 255, 0.5),
			inset 0 0 12px rgba(255, 255, 255, 0.2),
			inset 0 -1px 1px rgba(0, 0, 0, 0.06);
	}

	.btn-create-icon,
	.btn-create-text {
		color: rgba(255, 255, 255, 0.75);
		text-shadow:
			0 -1px 0 rgba(0, 0, 0, 0.35),
			0 1px 0 rgba(255, 255, 255, 0.15);
	}

	.btn-create-icon {
		font-size: 1rem;
		line-height: 1;
	}

	.btn-create-text {
		font-weight: 600;
	}

	.create-hotkey {
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 0.625rem;
		font-weight: 600;
		padding: 0.125rem 0.3rem;
		background: rgba(0, 0, 0, 0.2);
		border: 0.5px solid rgba(255, 255, 255, 0.15);
		border-radius: 3px;
		margin-left: 0.5rem;
		color: rgba(255, 255, 255, 0.6);
		text-shadow: none;
	}

	:global(.app.light) .create-hotkey {
		background: rgba(0, 0, 0, 0.12);
		border-color: rgba(0, 0, 0, 0.15);
		color: rgba(0, 0, 0, 0.5);
	}

	.global-right {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		flex-shrink: 0;
	}

	/* Icon buttons (Help, Theme, Settings) */
	.icon-btn {
		width: 2rem;
		height: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		color: var(--text-tertiary);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.icon-btn :global(svg) {
		width: 1rem;
		height: 1rem;
	}

	.icon-btn:hover {
		background: rgba(255, 255, 255, 0.06);
		color: var(--text-secondary);
	}

	:global(.app.light) .icon-btn:hover {
		background: rgba(0, 0, 0, 0.06);
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

	/* Row 2: Page Controls */
	.page-controls {
		display: flex;
		align-items: center;
		padding: 0.25rem 1rem;
		gap: 0.5rem;
	}

	/* View toggle */
	.view-toggle {
		display: flex;
		align-items: center;
		height: 1.625rem;
		gap: 1px;
		padding: 0 2px;
		margin-left: auto;
		background: rgba(255, 255, 255, 0.04);
		border-radius: 0.375rem;
		border: 0.5px solid rgba(255, 255, 255, 0.12);
	}

	:global(.app.light) .view-toggle {
		background: rgba(0, 0, 0, 0.03);
		border-color: rgba(0, 0, 0, 0.12);
	}

	.view-btn {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		height: 1.25rem;
		padding: 0 0.375rem;
		background: transparent;
		border: none;
		border-radius: 0.25rem;
		color: var(--text-secondary);
		font-family: inherit;
		font-size: 0.6875rem;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.view-btn:hover {
		color: var(--text-secondary);
		background: rgba(255, 255, 255, 0.06);
	}

	.view-btn.active {
		color: var(--text-primary);
		background: rgba(255, 255, 255, 0.1);
	}

	:global(.app.light) .view-btn:hover {
		background: rgba(0, 0, 0, 0.04);
	}

	:global(.app.light) .view-btn.active {
		background: rgba(0, 0, 0, 0.08);
	}

	.view-icon {
		font-size: 0.75rem;
		line-height: 1;
	}

	.view-btn :global(svg) {
		width: 0.75rem;
		height: 0.75rem;
	}

	.view-label {
		font-weight: 400;
	}

	/* Filters */
	.filters-wrapper {
		position: relative;
	}

	.filters-btn {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		height: 1.625rem;
		padding: 0 0.5rem;
		background: rgba(255, 255, 255, 0.04);
		border: 0.5px solid rgba(255, 255, 255, 0.12);
		border-radius: 0.375rem;
		color: var(--text-secondary);
		font-family: inherit;
		font-size: 0.6875rem;
		font-weight: 400;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.filters-btn :global(svg) {
		width: 0.75rem;
		height: 0.75rem;
		opacity: 0.7;
	}

	.filters-btn:hover {
		background: rgba(255, 255, 255, 0.06);
		border-color: rgba(255, 255, 255, 0.16);
	}

	.filters-btn.active {
		background: rgba(59, 130, 246, 0.1);
		border-color: rgba(59, 130, 246, 0.25);
		color: #60a5fa;
	}

	.filters-btn.active svg {
		opacity: 1;
	}

	:global(.app.light) .filters-btn {
		background: rgba(0, 0, 0, 0.03);
		border-color: rgba(0, 0, 0, 0.12);
	}

	:global(.app.light) .filters-btn:hover {
		background: rgba(0, 0, 0, 0.05);
		border-color: rgba(0, 0, 0, 0.16);
	}

	:global(.app.light) .filters-btn.active {
		background: rgba(59, 130, 246, 0.08);
		color: #2563eb;
	}

	.filter-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 0.875rem;
		height: 0.875rem;
		padding: 0 0.1875rem;
		background: #3b82f6;
		border-radius: 999px;
		color: white;
		font-size: 0.5625rem;
		font-weight: 600;
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
		.global-bar {
			padding: 0.625rem 0.75rem;
			padding-top: max(0.625rem, env(safe-area-inset-top));
			padding-left: max(0.75rem, env(safe-area-inset-left));
			padding-right: max(0.75rem, env(safe-area-inset-right));
		}

		.global-left {
			display: none;
		}

		.global-center {
			flex: 1;
			max-width: none;
		}

		.global-right {
			gap: 0.125rem;
		}

		.btn-create-text,
		.create-hotkey {
			display: none;
		}

		.btn-create {
			padding: 0.5rem;
		}

		.btn-create-icon {
			font-size: 1.125rem;
		}

		.hotkey-hint {
			display: none;
		}

		.help-wrapper,
		.icon-btn:not(.pane-toggle) {
			display: none;
		}

		.page-controls {
			padding: 0.25rem 0.5rem;
			padding-left: max(0.5rem, env(safe-area-inset-left));
			padding-right: max(0.5rem, env(safe-area-inset-right));
		}

		.page-title {
			font-size: 0.875rem;
		}

		.page-meta {
			font-size: 0.6875rem;
		}

		.view-label {
			display: none;
		}

		.view-btn {
			padding: 0.25rem 0.375rem;
		}

		.filters-popover {
			width: calc(100vw - 1.5rem);
			max-width: 320px;
		}
	}
</style>
