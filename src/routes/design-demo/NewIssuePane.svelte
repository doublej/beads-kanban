<script lang="ts">
	import { getPriorityConfig, getTypeIcon } from '$lib/utils';
	import { demoIssues } from './fixtures';
	import Icon from './Icon.svelte';
	import Pill from './Pill.svelte';

	type Props = { open: boolean; onclose: () => void; agentMode?: boolean };
	let { open, onclose, agentMode = true }: Props = $props();

	let title = $state('');
	let description = $state('');
	let priority = $state<0 | 1 | 2 | 3 | 4>(2);
	let issueType = $state<'task' | 'bug' | 'feature' | 'epic' | 'chore'>('task');
	let blockedSearch = $state('');
	let blockedBy = $state<{ id: string; title: string }[]>([]);

	const priorities = [0, 1, 2, 3, 4] as const;
	const priorityLabels = ['P0', 'P1', 'P2', 'P3', 'P4'];
	const types = ['task', 'bug', 'feature', 'epic', 'chore'] as const;

	const searchResults = $derived(
		blockedSearch.trim().length === 0
			? []
			: demoIssues
					.filter(
						(i) =>
							!blockedBy.some((b) => b.id === i.id) &&
							(i.id.toLowerCase().includes(blockedSearch.toLowerCase()) ||
								i.title.toLowerCase().includes(blockedSearch.toLowerCase()))
					)
					.slice(0, 4)
	);

	function addBlocker(id: string, t: string) {
		blockedBy = [...blockedBy, { id, title: t }];
		blockedSearch = '';
	}
	function removeBlocker(id: string) {
		blockedBy = blockedBy.filter((b) => b.id !== id);
	}
</script>

{#if open}
	<aside class="panel" aria-label="New issue">
		<header class="head">
			<div class="head-left">
				<span class="head-eyebrow">CREATE</span>
				<h2 class="head-title">New Issue</h2>
			</div>
			<button class="icon-btn" title="Close" onclick={onclose}><Icon name="x" size={14} /></button>
		</header>

		<div class="body scrollarea">
			<label class="block">
				<span class="field-label">Title</span>
				<input
					class="title-input"
					type="text"
					placeholder="What needs to be done?"
					bind:value={title}
					autofocus
				/>
			</label>

			<label class="block">
				<span class="field-label">Description</span>
				<textarea
					class="desc-input"
					rows="4"
					placeholder="Add details…"
					bind:value={description}
				></textarea>
			</label>

			<div class="row-2">
				<div class="block">
					<span class="field-label">Priority</span>
					<div class="pill-row five">
						{#each priorities as p, i}
							<Pill
								active={priority === p}
								accent={getPriorityConfig(p).color}
								onclick={() => (priority = p)}
							>
								<span class="dot" style="background: {getPriorityConfig(p).color};"></span>
								<span class="mono">{priorityLabels[i]}</span>
							</Pill>
						{/each}
					</div>
				</div>

				<div class="block">
					<span class="field-label">Type</span>
					<div class="pill-row five">
						{#each types as t}
							<Pill active={issueType === t} accent="var(--dd-fg-2)" onclick={() => (issueType = t)}>
								<Icon name={getTypeIcon(t)} size={11} />
								<span>{t}</span>
							</Pill>
						{/each}
					</div>
				</div>
			</div>

			<div class="block">
				<span class="field-label">Blocked by <span class="hint">(optional — link existing issues)</span></span>
				<div class="search">
					<Icon name="search" size={13} class="search-icon" />
					<input
						class="search-input"
						type="text"
						placeholder="Search issues by ID or title…"
						bind:value={blockedSearch}
					/>
				</div>

				{#if searchResults.length > 0}
					<div class="search-results">
						{#each searchResults as r}
							<button class="search-result" type="button" onclick={() => addBlocker(r.id, r.title)}>
								<span class="dot" style="background: {getPriorityConfig(r.priority).color};"></span>
								<span class="mono result-id">#{r.seq}</span>
								<span class="result-title">{r.title}</span>
								<Icon name="plus" size={11} />
							</button>
						{/each}
					</div>
				{/if}

				{#if blockedBy.length > 0}
					<div class="chips">
						{#each blockedBy as b (b.id)}
							<span class="chip">
								<span class="mono chip-id">{b.id.replace('bk-', '#')}</span>
								<span class="chip-title">{b.title}</span>
								<button class="chip-x" title="Remove" onclick={() => removeBlocker(b.id)}>
									<Icon name="x" size={10} />
								</button>
							</span>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<footer class="foot">
			<button class="btn ghost" onclick={onclose}>Cancel</button>
			<span class="foot-spacer"></span>
			{#if agentMode}
				<button class="btn agent">
					<Icon name="sparkles" size={12} />
					<span>Create + Agent</span>
				</button>
			{/if}
			<button class="btn primary">
				<span>Create</span>
				<span class="kbd-row">
					<span class="kbd"><Icon name="command" size={10} /></span>
					<span class="kbd"><Icon name="return" size={10} /></span>
				</span>
			</button>
		</footer>
	</aside>
{/if}

<style>
	.panel {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		width: min(520px, 100vw);
		background: var(--dd-bg-1);
		border-left: 1px solid var(--dd-border-2);
		box-shadow: var(--dd-shadow-3);
		display: flex;
		flex-direction: column;
		z-index: 50;
		animation: slide-in 180ms cubic-bezier(0.2, 0.6, 0.2, 1);
	}

	@keyframes slide-in {
		from { transform: translateX(20px); opacity: 0; }
		to { transform: translateX(0); opacity: 1; }
	}

	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 18px 12px;
		border-bottom: 1px solid var(--dd-border-1);
	}
	.head-left {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.head-eyebrow {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--dd-agent);
		font-weight: 500;
	}
	.head-title {
		margin: 0;
		font-size: 17px;
		font-weight: 600;
		letter-spacing: -0.015em;
	}
	.icon-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		border-radius: var(--dd-r-2);
		color: var(--dd-fg-3);
		transition: background 80ms, color 80ms;
	}
	.icon-btn:hover {
		color: var(--dd-fg-1);
		background: var(--dd-bg-3);
	}

	.body {
		flex: 1;
		overflow-y: auto;
		padding: 18px;
		display: flex;
		flex-direction: column;
		gap: 18px;
	}

	.block {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.field-label {
		font-size: 10.5px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--dd-fg-3);
		font-weight: 500;
	}
	.hint {
		text-transform: none;
		letter-spacing: 0;
		color: var(--dd-fg-4);
		font-weight: 400;
		margin-left: 4px;
	}

	.title-input {
		font-size: 19px;
		font-weight: 500;
		letter-spacing: -0.015em;
		padding: 10px 12px;
		background: transparent;
		border-color: var(--dd-border-1);
	}
	.title-input::placeholder {
		color: var(--dd-fg-4);
	}

	.desc-input {
		resize: vertical;
		min-height: 90px;
		line-height: 1.55;
	}

	.row-2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 18px;
	}

	.pill-row {
		display: flex;
		gap: 4px;
	}
	.pill-row.five > :global(.pill) {
		flex: 1;
		justify-content: center;
		padding-left: 6px;
		padding-right: 6px;
	}

	.dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		display: inline-block;
	}

	.search {
		position: relative;
	}
	.search :global(.search-icon) {
		position: absolute;
		left: 9px;
		top: 50%;
		transform: translateY(-50%);
		color: var(--dd-fg-3);
		pointer-events: none;
	}
	.search-input {
		padding-left: 30px;
		width: 100%;
	}

	.search-results {
		display: flex;
		flex-direction: column;
		gap: 1px;
		margin-top: 6px;
		background: var(--dd-bg-2);
		border: 1px solid var(--dd-border-1);
		border-radius: var(--dd-r-2);
		overflow: hidden;
	}
	.search-result {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 10px;
		text-align: left;
		color: var(--dd-fg-2);
		transition: background 80ms;
	}
	.search-result:hover {
		background: var(--dd-bg-3);
		color: var(--dd-fg-1);
	}
	.result-id {
		font-size: 11px;
		color: var(--dd-fg-3);
		min-width: 36px;
	}
	.result-title {
		flex: 1;
		font-size: 12px;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
		margin-top: 8px;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 3px 4px 3px 8px;
		background: var(--dd-bg-3);
		border: 1px solid var(--dd-border-2);
		border-radius: var(--dd-r-2);
		font-size: 11.5px;
		color: var(--dd-fg-2);
	}
	.chip-id {
		font-size: 10.5px;
		color: var(--dd-fg-3);
	}
	.chip-title {
		max-width: 240px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.chip-x {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		border-radius: 3px;
		color: var(--dd-fg-3);
	}
	.chip-x:hover {
		color: var(--dd-fg-1);
		background: var(--dd-bg-4);
	}

	.foot {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 18px;
		border-top: 1px solid var(--dd-border-1);
		background: var(--dd-bg-1);
	}
	.foot-spacer { flex: 1; }

	.btn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		border-radius: var(--dd-r-2);
		font-size: 12.5px;
		font-weight: 500;
		transition: background 80ms, color 80ms, border-color 80ms;
	}
	.btn.ghost {
		color: var(--dd-fg-2);
		background: transparent;
		border: 1px solid var(--dd-border-2);
	}
	.btn.ghost:hover {
		color: var(--dd-fg-1);
		background: var(--dd-bg-3);
	}
	.btn.primary {
		background: var(--dd-accent);
		color: white;
	}
	.btn.primary:hover {
		background: color-mix(in srgb, var(--dd-accent) 88%, white);
	}
	.btn.agent {
		background: color-mix(in srgb, var(--dd-agent) 22%, var(--dd-bg-2));
		color: var(--dd-agent);
		border: 1px solid color-mix(in srgb, var(--dd-agent) 45%, var(--dd-border-2));
	}
	.btn.agent:hover {
		background: color-mix(in srgb, var(--dd-agent) 30%, var(--dd-bg-2));
	}

	.kbd-row {
		display: inline-flex;
		gap: 2px;
	}
	.kbd {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 18px;
		height: 18px;
		padding: 0 3px;
		font-size: 10px;
		border-radius: 3px;
		background: rgba(255, 255, 255, 0.18);
		color: rgba(255, 255, 255, 0.85);
	}
</style>
