<script lang="ts">
	import type { Issue } from '$lib/types'
	import { getPriorityConfig, getIssueColumn } from '$lib/utils'
	import Icon from './Icon.svelte'

	interface Props {
		issues: Issue[]
		excludeIds?: string[]
		placeholder?: string
		onselect: (issue: Issue) => void
	}

	let {
		issues,
		excludeIds = [],
		placeholder = 'Search issues...',
		onselect
	}: Props = $props()

	let query = $state('')
	let showResults = $state(false)
	let selectedIndex = $state(0)
	let inputEl: HTMLInputElement

	const filtered = $derived(() => {
		if (!query.trim()) return []
		const q = query.toLowerCase()
		return issues
			.filter(i => !excludeIds.includes(i.id))
			.filter(i => i.id.toLowerCase().includes(q) || i.title.toLowerCase().includes(q))
			.slice(0, 8)
	})

	function handleKeydown(e: KeyboardEvent) {
		const results = filtered()
		if (!results.length) return

		if (e.key === 'ArrowDown') {
			e.preventDefault()
			selectedIndex = Math.min(selectedIndex + 1, results.length - 1)
		} else if (e.key === 'ArrowUp') {
			e.preventDefault()
			selectedIndex = Math.max(selectedIndex - 1, 0)
		} else if (e.key === 'Enter' && results[selectedIndex]) {
			e.preventDefault()
			selectIssue(results[selectedIndex])
		} else if (e.key === 'Escape') {
			showResults = false
			inputEl?.blur()
		}
	}

	function selectIssue(issue: Issue) {
		onselect(issue)
		query = ''
		showResults = false
		selectedIndex = 0
	}

	function handleFocus() {
		showResults = true
		selectedIndex = 0
	}

	function handleBlur(e: FocusEvent) {
		// Delay to allow click on results
		setTimeout(() => {
			const related = e.relatedTarget as HTMLElement
			if (!related?.closest('.issue-search-results')) {
				showResults = false
			}
		}, 150)
	}

	$effect(() => {
		// Reset selection when query changes
		query
		selectedIndex = 0
	})
</script>

<div class="issue-search">
	<input
		bind:this={inputEl}
		type="text"
		bind:value={query}
		{placeholder}
		class="issue-search-input"
		onfocus={handleFocus}
		onblur={handleBlur}
		onkeydown={handleKeydown}
	/>
	{#if showResults && filtered().length > 0}
		<div class="issue-search-results">
			{#each filtered() as issue, i}
				{@const column = getIssueColumn(issue)}
				{@const priority = getPriorityConfig(issue.priority)}
				<button
					class="issue-search-item"
					class:selected={i === selectedIndex}
					onclick={() => selectIssue(issue)}
					onmouseenter={() => selectedIndex = i}
				>
					<span class="item-status" style="--status-color: {column.accent}" title={column.label}>
						<Icon name={column.icon} size={10} />
					</span>
					<span class="item-priority" style="background: {priority.color}"></span>
					<span class="item-id">{issue.id}</span>
					<span class="item-title">{issue.title}</span>
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.issue-search {
		position: relative;
	}

	.issue-search-input {
		width: 100%;
		padding: 0.5rem 0.75rem;
		background: var(--bg-elevated);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		font-family: inherit;
		font-size: 0.8125rem;
		transition: border-color 150ms ease;
	}

	.issue-search-input:focus {
		outline: none;
		border-color: var(--accent-primary);
	}

	.issue-search-input::placeholder {
		color: var(--text-tertiary);
	}

	.issue-search-results {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		background: var(--bg-secondary);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-md);
		margin-top: 0.25rem;
		max-height: 280px;
		overflow-y: auto;
		z-index: 100;
		box-shadow: var(--shadow-lg);
	}

	.issue-search-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.5rem 0.75rem;
		background: transparent;
		border: none;
		text-align: left;
		cursor: pointer;
		transition: background 100ms ease;
		color: var(--text-primary);
	}

	.issue-search-item:hover,
	.issue-search-item.selected {
		background: var(--bg-elevated);
	}

	.issue-search-item.selected {
		background: var(--accent-glow);
	}

	.item-status {
		display: flex;
		color: var(--status-color);
		flex-shrink: 0;
	}

	.item-priority {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.item-id {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.625rem;
		color: var(--text-tertiary);
		flex-shrink: 0;
	}

	.item-title {
		font-size: 0.75rem;
		color: var(--text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
