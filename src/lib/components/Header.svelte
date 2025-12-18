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
	}

	const activeFilterCount = $derived(
		(filterPriority !== 'all' ? 1 : 0) +
		(filterType !== 'all' ? 1 : 0) +
		(filterTime !== 'all' ? 1 : 0) +
		(filterStatus !== 'all' ? 1 : 0) +
		(filterLabel !== 'all' ? 1 : 0)
	);

	const hasActiveFilters = $derived(activeFilterCount > 0);
</script>

<header class="header">
	<div class="toolbar">
		<!-- Left: Logo -->
		<div class="toolbar-left">
			<button class="logo-lockup" onclick={oneditProject} title="Change project">
				<span class="logo-app">strandkanban</span>
				<span class="logo-divider">/</span>
				<span class="logo-project">{projectName}</span>
			</button>
		</div>

		<!-- Center: Views, Filters, Activity -->
		<div class="toolbar-center">
			<!-- View Toggle -->
			<div class="view-toggle">
				{#each viewModes as mode}
					<button
						class="view-btn"
						class:active={viewMode === mode.key}
						onclick={() => viewMode = mode.key}
						title={mode.label}
					>
						<Icon name={mode.icon} size={13} />
						<span class="view-label">{mode.label}</span>
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
					<Icon name="filter" size={13} />
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
				<Icon name="message" size={13} />
				<span>Chat</span>
				{#if agentPaneCount > 0}
					<span class="toolbar-badge">{agentPaneCount}</span>
				{/if}
			</button>
		</div>

		<!-- Right: Search, Create, Icons -->
		<div class="toolbar-right">
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
				<span class="btn-create-text">New</span>
				<kbd class="create-hotkey">N</kbd>
			</button>

			<span class="toolbar-sep"></span>

			<div class="help-wrapper">
				<button class="icon-btn" onclick={() => showHelpMenu = !showHelpMenu} aria-label="Help">
					<Icon name="help" size={15} />
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
					<Icon name="sun" size={15} />
				{:else}
					<Icon name="moon" size={15} />
				{/if}
			</button>
			<button class="icon-btn" onclick={onopenSettings} aria-label="Settings">
				<Icon name="settings" size={15} />
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
		gap: 0.375rem;
	}

	.toolbar-right {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		flex-shrink: 0;
	}

	.toolbar-sep {
		width: 1px;
		height: 1rem;
		background: rgba(255, 255, 255, 0.1);
		margin: 0 0.25rem;
	}

	:global(.app.light) .toolbar-sep {
		background: rgba(0, 0, 0, 0.1);
	}

	/* Toolbar button (Filters, Activity) */
	.toolbar-btn {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		height: 1.625rem;
		padding: 0 0.5rem;
		background: transparent;
		border: none;
		border-radius: 0.375rem;
		color: var(--text-secondary);
		font-family: inherit;
		font-size: 0.6875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.toolbar-btn :global(svg) {
		opacity: 0.7;
	}

	.toolbar-btn:hover {
		background: rgba(255, 255, 255, 0.06);
		color: var(--text-primary);
	}

	.toolbar-btn.active {
		background: rgba(59, 130, 246, 0.12);
		color: #60a5fa;
	}

	.toolbar-btn.active :global(svg) {
		opacity: 1;
	}

	:global(.app.light) .toolbar-btn:hover {
		background: rgba(0, 0, 0, 0.05);
	}

	:global(.app.light) .toolbar-btn.active {
		background: rgba(59, 130, 246, 0.1);
		color: #2563eb;
	}

	.toolbar-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 0.875rem;
		height: 0.875rem;
		padding: 0 0.1875rem;
		background: #3b82f6;
		border-radius: 999px;
		color: white;
		font-size: 0.5rem;
		font-weight: 600;
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

	.search-container {
		position: relative;
		display: flex;
		align-items: center;
		width: 160px;
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

	/* View toggle */
	.view-toggle {
		display: flex;
		align-items: center;
		height: 1.625rem;
		gap: 1px;
		padding: 0 2px;
		background: rgba(255, 255, 255, 0.04);
		border-radius: 0.375rem;
		border: 0.5px solid rgba(255, 255, 255, 0.1);
	}

	:global(.app.light) .view-toggle {
		background: rgba(0, 0, 0, 0.03);
		border-color: rgba(0, 0, 0, 0.1);
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
			padding: 0.5rem 0.75rem;
			padding-top: max(0.5rem, env(safe-area-inset-top));
			padding-left: max(0.75rem, env(safe-area-inset-left));
			padding-right: max(0.75rem, env(safe-area-inset-right));
			gap: 0.5rem;
		}

		.toolbar-left {
			display: none;
		}

		.toolbar-center {
			flex: 1;
			justify-content: center;
		}

		.toolbar-right {
			gap: 0.25rem;
		}

		.toolbar-sep {
			display: none;
		}

		.search-container {
			width: 120px;
		}

		.btn-create-text,
		.create-hotkey {
			display: none;
		}

		.btn-create {
			padding: 0 0.5rem;
			width: 1.75rem;
			justify-content: center;
		}

		.hotkey-hint {
			display: none;
		}

		.help-wrapper,
		.icon-btn:not(.pane-toggle) {
			display: none;
		}

		.view-label {
			display: none;
		}

		.toolbar-btn span:not(.toolbar-badge) {
			display: none;
		}

		.filters-popover {
			width: calc(100vw - 1.5rem);
			max-width: 320px;
		}
	}
</style>
