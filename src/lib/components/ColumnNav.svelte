<script lang="ts">
	import type { Column, Issue } from '$lib/types';
	import { getIssueColumn } from '$lib/utils';

	interface Props {
		columns: Column[];
		activeColumnIndex: number;
		issues: Issue[];
		filteredIssues: Issue[];
		hasActiveFilters: boolean;
	}

	let { columns, activeColumnIndex = $bindable(), issues, filteredIssues, hasActiveFilters }: Props = $props();
</script>

<nav class="column-nav">
	{#each columns as column, i}
		{@const totalInColumn = issues.filter((x) => getIssueColumn(x).key === column.key).length}
		{@const matchingInColumn = filteredIssues.filter((x) => getIssueColumn(x).key === column.key).length}
		<button
			class="column-tab"
			class:active={activeColumnIndex === i}
			onclick={() => (activeColumnIndex = i)}
			style="--accent: {column.accent}"
		>
			<span class="column-tab-icon">{column.icon}</span>
			<span class="column-tab-label">{column.label}</span>
			<span class="column-tab-count">{#if hasActiveFilters}{matchingInColumn}/{totalInColumn}{:else}{totalInColumn}{/if}</span>
		</button>
	{/each}
</nav>

<style>
	.column-nav {
		display: none;
		padding: 0.5rem 0.75rem;
		padding-left: max(0.75rem, env(safe-area-inset-left));
		padding-right: max(0.75rem, env(safe-area-inset-right));
		background: var(--bg-secondary);
		border-bottom: 1px solid var(--border-subtle);
		gap: 0.5rem;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		flex-shrink: 0;
		scroll-snap-type: x proximity;
		scrollbar-width: none;
	}

	.column-nav::-webkit-scrollbar {
		display: none;
	}

	.column-tab {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.625rem 1rem;
		min-height: 2.75rem;
		background: var(--bg-tertiary);
		border: 1px solid transparent;
		border-radius: var(--radius-lg);
		color: var(--text-secondary);
		font-family: inherit;
		font-size: 0.8125rem;
		font-weight: 500;
		cursor: pointer;
		white-space: nowrap;
		scroll-snap-align: start;
		transition: all 200ms cubic-bezier(0.25, 0.1, 0.25, 1);
	}

	.column-tab:active {
		transform: scale(0.97);
	}

	.column-tab.active {
		background: var(--accent);
		border-color: transparent;
		color: white;
		box-shadow: 0 2px 12px rgba(var(--accent-rgb, 10, 132, 255), 0.35);
	}

	.column-tab-icon {
		font-size: 0.6875rem;
	}

	.column-tab-count {
		padding: 0.0625rem 0.3125rem;
		background: rgba(255, 255, 255, 0.15);
		border-radius: 999px;
		font-size: 0.625rem;
	}

	.column-tab:not(.active) .column-tab-count {
		background: var(--bg-elevated);
	}

	@media (max-width: 1024px) {
		.column-nav {
			display: flex;
			padding: 0.375rem var(--mobile-padding);
			padding-left: max(var(--mobile-padding), env(safe-area-inset-left));
			padding-right: max(var(--mobile-padding), env(safe-area-inset-right));
			gap: 0.375rem;
			background: transparent;
			border: none;
			overflow-x: auto;
			scrollbar-width: none;
		}

		.column-nav::-webkit-scrollbar {
			display: none;
		}

		.column-tab {
			flex: 1;
			height: 2.5rem;
			min-height: 2.5rem;
			padding: 0 0.625rem;
			border-radius: var(--mobile-radius);
			font-size: 0.8125rem;
			background: var(--mobile-bg);
			border: none;
			box-shadow: none;
			justify-content: center;
		}

		.column-tab.active {
			background: var(--accent);
			box-shadow: none;
		}

		.column-tab-icon {
			font-size: 1rem;
		}

		.column-tab-label {
			display: none;
		}

		.column-tab-count {
			font-size: 0.75rem;
			padding: 0 0.25rem;
			background: rgba(255, 255, 255, 0.2);
			min-width: 1.25rem;
		}
	}

	/* ═══════════════════════════════════════════════════════════════
	   MOBILE - Compact column navigation (768px and below)
	   ═══════════════════════════════════════════════════════════════ */
	@media (max-width: 768px) {
		.column-nav {
			padding: 0.25rem var(--mobile-padding, 0.5rem);
			gap: 0.25rem;
		}

		.column-tab {
			height: 2rem;
			min-height: 2rem;
			padding: 0 0.375rem;
			border-radius: 0.5rem;
			gap: 0.25rem;
		}

		.column-tab-icon {
			font-size: 0.875rem;
		}

		.column-tab-count {
			font-size: 0.625rem;
			padding: 0 0.1875rem;
			min-width: 1rem;
		}
	}
</style>
