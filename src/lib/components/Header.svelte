<script lang="ts">
	import type { ViewMode, ViewRecipe } from '$lib/types';
	import SearchBar from './SearchBar.svelte';
	import Icon from './Icon.svelte';
	import ViewSwitcher from './ViewSwitcher.svelte';
	import RecipePicker from './RecipePicker.svelte';
	import HeaderActions from './HeaderActions.svelte';

	interface Props {
		searchQuery: string;
		filterCount: number;
		ontogglefilters: () => void;
		viewMode: ViewMode;
		isDarkMode: boolean;
		totalIssues: number;
		projectName: string;
		agentPaneCount: number;
		showAgentPanes: boolean;
		recipes: ViewRecipe[];
		currentRecipeId: string | null;
		hasUnsavedChanges: boolean;
		ontoggleTheme: () => void;
		onopenKeyboardHelp: () => void;
		onopenCreatePanel: () => void;
		onopenSettings?: () => void;
		onopenPrompts?: () => void;
		onpreviewchange?: (previewing: boolean) => void;
		oneditProject?: () => void;
		ontoggleAgentPanes?: () => void;
		onsaverecipe?: (name: string) => void;
		onapplyrecipe?: (recipe: ViewRecipe) => void;
		ondeleterecipe?: (id: string) => void;
		onrenamerecipe?: (id: string, newName: string) => void;
	}

	let {
		searchQuery = $bindable(),
		filterCount,
		ontogglefilters,
		viewMode = $bindable(),
		isDarkMode,
		totalIssues,
		projectName,
		agentPaneCount = 0,
		showAgentPanes = true,
		recipes,
		currentRecipeId = $bindable(),
		hasUnsavedChanges,
		ontoggleTheme,
		onopenKeyboardHelp,
		onopenCreatePanel,
		onopenSettings,
		onopenPrompts,
		onpreviewchange,
		oneditProject,
		ontoggleAgentPanes,
		onsaverecipe,
		onapplyrecipe,
		ondeleterecipe,
		onrenamerecipe
	}: Props = $props();

	let isSearchFocused = $state(false);

	$effect(() => {
		onpreviewchange?.(isSearchFocused);
	});

	const viewModes: { key: ViewMode; label: string }[] = [
		{ key: 'kanban', label: 'board' },
		{ key: 'table', label: 'table' },
		{ key: 'flow', label: 'graph' }
	];

	const activeViewLabel = $derived(viewModes.find(m => m.key === viewMode)?.label ?? 'board');
</script>

<header class="header">
	<div class="toolbar">
		<!-- Left: Logo -->
		<div class="toolbar-left">
			<button class="logo-lockup" onclick={oneditProject} title="Change project">
				<span class="logo-app">strandkanban</span>
				<span class="logo-divider">/</span>
				<span class="logo-project">{projectName}</span>
				<span class="logo-divider">/</span>
				<span class="logo-view">{activeViewLabel}</span>
			</button>
		</div>

		<!-- Center: Search + New -->
		<div class="toolbar-center">
			<SearchBar
				bind:searchQuery
				{onopenCreatePanel}
				onfocuschange={(focused) => isSearchFocused = focused}
			/>
		</div>

		<!-- Right: Views, Filters, Recipes, Chat, Theme, Settings, Help -->
		<div class="toolbar-right">
			<ViewSwitcher bind:viewMode />

			<span class="toolbar-sep"></span>

			<RecipePicker
				{recipes}
				bind:currentRecipeId
				{hasUnsavedChanges}
				onsave={onsaverecipe || (() => {})}
				onapply={onapplyrecipe || (() => {})}
				ondelete={ondeleterecipe || (() => {})}
				onrename={onrenamerecipe || (() => {})}
			/>

			<span class="toolbar-sep"></span>

			<button
				class="filter-toggle"
				class:active={filterCount > 0}
				onclick={ontogglefilters}
				title="Toggle filter sidebar"
			>
				<Icon name="sliders" size={14} />
				<span class="filter-toggle-label">Filters</span>
				{#if filterCount > 0}
					<span class="filter-toggle-badge">{filterCount}</span>
				{/if}
			</button>

			<HeaderActions
				{isDarkMode}
				{agentPaneCount}
				{showAgentPanes}
				{ontoggleTheme}
				{onopenKeyboardHelp}
				{onopenSettings}
				{onopenPrompts}
				{ontoggleAgentPanes}
			/>
		</div>
	</div>
</header>

<style>
	.header {
		z-index: 100;
		flex-shrink: 0;
	}

	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.875rem 1.5rem 0.5rem;
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

	.filter-toggle {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		height: 1.75rem;
		min-width: 1.75rem;
		padding: 0 0.625rem;
		background: transparent;
		border: none;
		border-radius: var(--radius-full);
		color: var(--text-tertiary);
		font-family: inherit;
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.1s, color 0.1s;
	}

	.filter-toggle :global(svg) {
		flex-shrink: 0;
	}

	.filter-toggle:hover {
		background: rgba(255, 255, 255, 0.06);
		color: var(--text-primary);
	}

	.filter-toggle.active {
		background: rgba(255, 255, 255, 0.1);
		color: var(--text-primary);
	}

	:global(.app.light) .filter-toggle:hover {
		background: rgba(0, 0, 0, 0.04);
	}

	:global(.app.light) .filter-toggle.active {
		background: rgba(0, 0, 0, 0.06);
	}

	.filter-toggle-badge {
		min-width: 1.25rem;
		height: 1.25rem;
		padding: 0 0.25rem;
		margin-right: -0.375rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: var(--accent-primary);
		border-radius: var(--radius-full);
		color: #fff;
		font-size: 0.625rem;
		font-weight: 600;
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

		.filter-toggle-label {
			display: none;
		}

		.toolbar-sep {
			display: none;
		}
	}
</style>
