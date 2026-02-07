<script lang="ts">
	import type { DiffResult, DiffChange } from '$lib/types';
	import { getDiffApi } from '$lib/api';
	import { getPriorityConfig } from '$lib/utils';
	import Icon from './Icon.svelte';

	let diffResult = $state<DiffResult | null>(null);
	let error = $state<string | null>(null);
	let loading = $state(false);
	let selectedRev = $state('HEAD~1');
	let customRev = $state('');

	const presets = [
		{ value: 'HEAD~1', label: '1 commit ago' },
		{ value: 'HEAD~3', label: '3 commits ago' },
		{ value: 'HEAD~5', label: '5 commits ago' },
		{ value: 'HEAD~10', label: '10 commits ago' }
	];

	const changeGroups: { key: DiffChange['changeType']; label: string; color: string; icon: string }[] = [
		{ key: 'added', label: 'New issues', color: '#10b981', icon: '+' },
		{ key: 'closed', label: 'Closed', color: '#6b7280', icon: '−' },
		{ key: 'reopened', label: 'Reopened', color: '#f59e0b', icon: '↺' },
		{ key: 'status_changed', label: 'Status changed', color: '#6366f1', icon: '→' },
		{ key: 'priority_changed', label: 'Priority changed', color: '#8b5cf6', icon: '⇅' }
	];

	async function loadDiff(rev: string) {
		loading = true;
		error = null;
		try {
			diffResult = await getDiffApi(rev);
		} catch (e) {
			error = (e as Error).message || 'Failed to load diff';
		} finally {
			loading = false;
		}
	}

	function selectPreset(rev: string) {
		selectedRev = rev;
		customRev = '';
		loadDiff(rev);
	}

	function selectCommit(hash: string) {
		selectedRev = hash;
		customRev = '';
		loadDiff(hash);
	}

	function applyCustomRev() {
		if (!customRev.trim()) return;
		selectedRev = customRev.trim();
		loadDiff(selectedRev);
	}

	function groupedChanges(changes: DiffChange[]): Map<DiffChange['changeType'], DiffChange[]> {
		const map = new Map<DiffChange['changeType'], DiffChange[]>();
		for (const c of changes) {
			const list = map.get(c.changeType) ?? [];
			list.push(c);
			map.set(c.changeType, list);
		}
		return map;
	}

	const priorityLabel = (p: string) => getPriorityConfig(Number(p)).label;
	const statusLabel = (s: string) => s.replace(/_/g, ' ');

	// Load on mount
	loadDiff('HEAD~1');
</script>

<div class="diff-view">
	<div class="diff-controls">
		<div class="presets">
			{#each presets as preset}
				<button
					class="preset-btn"
					class:active={selectedRev === preset.value}
					onclick={() => selectPreset(preset.value)}
				>{preset.label}</button>
			{/each}
		</div>
		<div class="custom-rev">
			<input
				type="text"
				placeholder="commit hash or rev..."
				bind:value={customRev}
				onkeydown={(e) => e.key === 'Enter' && applyCustomRev()}
			/>
			<button class="apply-btn" onclick={applyCustomRev} disabled={!customRev.trim()}>Compare</button>
		</div>
	</div>

	{#if loading}
		<div class="loading">
			<Icon name="loader" size={20} />
			<span>Comparing revisions...</span>
		</div>
	{:else if error}
		<div class="error-msg">{error}</div>
	{:else if diffResult}
		<div class="diff-summary">
			<span class="summary-label">Comparing against <code>{diffResult.rev}</code></span>
			<span class="summary-counts">
				{diffResult.historicalCount} then → {diffResult.currentCount} now
				({diffResult.changes.length} change{diffResult.changes.length !== 1 ? 's' : ''})
			</span>
		</div>

		{#if diffResult.changes.length === 0}
			<div class="no-changes">No changes detected between revisions.</div>
		{:else}
			{@const grouped = groupedChanges(diffResult.changes)}
			<div class="change-groups">
				{#each changeGroups as group}
					{@const items = grouped.get(group.key) ?? []}
					{#if items.length > 0}
						<div class="change-group">
							<div class="group-header" style="--accent: {group.color}">
								<span class="group-icon">{group.icon}</span>
								<span class="group-label">{group.label}</span>
								<span class="group-count">{items.length}</span>
							</div>
							<div class="group-items">
								{#each items as change}
									<div class="change-item">
										<span class="change-id">{change.issue.id}</span>
										<span class="change-title">{change.issue.title}</span>
										{#if change.oldValue && change.newValue}
											<span class="change-detail">
												{#if change.changeType === 'priority_changed'}
													{priorityLabel(change.oldValue)} → {priorityLabel(change.newValue)}
												{:else}
													{statusLabel(change.oldValue)} → {statusLabel(change.newValue)}
												{/if}
											</span>
										{/if}
									</div>
								{/each}
							</div>
						</div>
					{/if}
				{/each}
			</div>
		{/if}

		{#if diffResult.commits.length > 0}
			<div class="commits-section">
				<div class="commits-header">Recent commits touching issues</div>
				<div class="commits-list">
					{#each diffResult.commits as commit}
						<button
							class="commit-row"
							class:active={selectedRev === commit.hash}
							onclick={() => selectCommit(commit.hash)}
						>
							<code class="commit-hash">{commit.hash.slice(0, 7)}</code>
							<span class="commit-msg">{commit.message}</span>
						</button>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>

<style>
	.diff-view {
		flex: 1;
		display: flex;
		flex-direction: column;
		padding: 1rem 1.5rem;
		overflow: auto;
		gap: 1rem;
	}

	.diff-controls {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		flex-wrap: wrap;
	}

	.presets {
		display: flex;
		gap: 4px;
	}

	.preset-btn {
		padding: 0.375rem 0.75rem;
		border: 1px solid var(--border-subtle, rgba(255,255,255,0.08));
		border-radius: 0.25rem;
		background: transparent;
		color: var(--text-secondary);
		font-size: 0.75rem;
		font-family: inherit;
		cursor: pointer;
		transition: all 0.1s;
	}

	.preset-btn:hover {
		background: rgba(255,255,255,0.06);
		color: var(--text-primary);
	}

	.preset-btn.active {
		background: rgba(99,102,241,0.15);
		border-color: rgba(99,102,241,0.3);
		color: #818cf8;
	}

	:global(.app.light) .preset-btn:hover { background: rgba(0,0,0,0.04); }
	:global(.app.light) .preset-btn.active {
		background: rgba(99,102,241,0.1);
		border-color: rgba(99,102,241,0.2);
	}

	.custom-rev {
		display: flex;
		gap: 4px;
	}

	.custom-rev input {
		padding: 0.375rem 0.5rem;
		border: 1px solid var(--border-subtle, rgba(255,255,255,0.08));
		border-radius: 0.25rem;
		background: transparent;
		color: var(--text-primary);
		font-size: 0.75rem;
		font-family: 'SF Mono', monospace;
		width: 180px;
	}

	.custom-rev input::placeholder { color: var(--text-tertiary); }

	.apply-btn {
		padding: 0.375rem 0.75rem;
		border: 1px solid rgba(99,102,241,0.3);
		border-radius: 0.25rem;
		background: rgba(99,102,241,0.1);
		color: #818cf8;
		font-size: 0.75rem;
		font-family: inherit;
		cursor: pointer;
	}

	.apply-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.loading {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--text-tertiary);
		font-size: 0.8rem;
		padding: 2rem 0;
	}

	.loading :global(svg) { animation: spin 1s linear infinite; }
	@keyframes spin { to { transform: rotate(360deg); } }

	.error-msg {
		color: #ef4444;
		font-size: 0.8rem;
		padding: 0.75rem;
		background: rgba(239,68,68,0.08);
		border-radius: 0.375rem;
	}

	.diff-summary {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--border-subtle, rgba(255,255,255,0.06));
		font-size: 0.8rem;
	}

	.summary-label { color: var(--text-secondary); }
	.summary-label code {
		background: rgba(255,255,255,0.06);
		padding: 0.125rem 0.375rem;
		border-radius: 0.25rem;
		font-size: 0.75rem;
	}
	.summary-counts { color: var(--text-tertiary); font-size: 0.75rem; }

	.no-changes {
		color: var(--text-tertiary);
		font-size: 0.8rem;
		padding: 2rem;
		text-align: center;
	}

	.change-groups {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.change-group {
		border: 1px solid var(--border-subtle, rgba(255,255,255,0.06));
		border-radius: 0.5rem;
		overflow: hidden;
	}

	.group-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		background: rgba(255,255,255,0.02);
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--accent);
	}

	:global(.app.light) .group-header { background: rgba(0,0,0,0.02); }

	.group-icon {
		font-size: 0.9rem;
		width: 1.25rem;
		text-align: center;
		color: var(--accent);
	}

	.group-label { color: var(--text-primary); }

	.group-count {
		margin-left: auto;
		font-size: 0.7rem;
		color: var(--text-tertiary);
		background: rgba(255,255,255,0.06);
		padding: 0.125rem 0.5rem;
		border-radius: 999px;
	}

	.group-items {
		display: flex;
		flex-direction: column;
	}

	.change-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.375rem 0.75rem;
		font-size: 0.75rem;
		border-top: 1px solid var(--border-subtle, rgba(255,255,255,0.04));
	}

	.change-id {
		color: var(--text-tertiary);
		font-family: 'SF Mono', monospace;
		font-size: 0.7rem;
		flex-shrink: 0;
	}

	.change-title {
		color: var(--text-primary);
		flex: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.change-detail {
		color: var(--text-tertiary);
		font-size: 0.7rem;
		flex-shrink: 0;
		font-family: 'SF Mono', monospace;
	}

	.commits-section {
		margin-top: 0.5rem;
	}

	.commits-header {
		font-size: 0.75rem;
		color: var(--text-tertiary);
		margin-bottom: 0.375rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.commits-list {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--border-subtle, rgba(255,255,255,0.06));
		border-radius: 0.5rem;
		overflow: hidden;
		max-height: 240px;
		overflow-y: auto;
	}

	.commit-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.375rem 0.75rem;
		border: none;
		background: transparent;
		color: var(--text-secondary);
		font-size: 0.75rem;
		font-family: inherit;
		cursor: pointer;
		text-align: left;
		transition: background 0.1s;
	}

	.commit-row:not(:first-child) {
		border-top: 1px solid var(--border-subtle, rgba(255,255,255,0.04));
	}

	.commit-row:hover { background: rgba(255,255,255,0.04); }
	:global(.app.light) .commit-row:hover { background: rgba(0,0,0,0.03); }

	.commit-row.active {
		background: rgba(99,102,241,0.1);
	}

	.commit-hash {
		color: #818cf8;
		font-size: 0.7rem;
		flex-shrink: 0;
	}

	.commit-msg {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
