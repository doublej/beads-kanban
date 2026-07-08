<script lang="ts">
	import { columns } from '$lib/utils';
	import { demoIssues, pinnedIds, worktreeIds, impactScores } from './fixtures';
	import TaskCard from './TaskCard.svelte';
	import NewIssuePane from './NewIssuePane.svelte';
	import DetailPanel from './DetailPanel.svelte';
	import Icon from './Icon.svelte';
	import './tokens.css';

	let openId = $state<string | null>(null);
	let newOpen = $state(false);

	const openIssue = $derived(openId ? demoIssues.find((i) => i.key === openId) ?? null : null);

	function openIssueById(id: string) { newOpen = false; openId = id; }
	function closeAll() { openId = null; newOpen = false; }
	function openNew() { openId = null; newOpen = true; }

	function columnIssues(status: string) {
		return demoIssues
			.filter((i) => i.status === status)
			.sort((a, b) => {
				const ap = pinnedIds.has(a.id) ? 0 : 1;
				const bp = pinnedIds.has(b.id) ? 0 : 1;
				if (ap !== bp) return ap - bp;
				return a.priority - b.priority;
			});
	}

	function onGlobalKey(e: KeyboardEvent) {
		const tag = (e.target as HTMLElement)?.tagName;
		if (tag === 'INPUT' || tag === 'TEXTAREA') return;
		if (e.key === 'n' || e.key === 'N') { e.preventDefault(); openNew(); }
	}
</script>

<svelte:head><title>Design Demo · Strandkanban</title></svelte:head>
<svelte:window on:keydown={onGlobalKey} />

<div class="design-demo page">
	<header class="top">
		<div class="top-left">
			<span class="label">Design demo · pass 3</span>
			<h1 class="top-title">Four core surfaces</h1>
			<p class="top-sub">Click a card · click any property to edit · <span class="kbd">N</span> to capture.</p>
		</div>
		<div class="top-right">
			<button class="ctrl is-primary" onclick={openNew}>
				<Icon name="plus" size={12} />
				<span>New</span>
				<span class="kbd is-inverse">N</span>
			</button>
		</div>
	</header>

	<section class="board scrollarea">
		{#each columns as col (col.key)}
			{@const issues = columnIssues(col.status)}
			<div class="column">
				<header class="col-head">
					<span class="dot" style="background: {col.accent};"></span>
					<span class="col-label label">{col.label}</span>
					<span class="col-count mono">{issues.length}</span>
				</header>
				<div class="col-body">
					{#each issues as issue (issue.key)}
						<TaskCard
							{issue}
							pinned={pinnedIds.has(issue.id)}
							worktree={worktreeIds.has(issue.id)}
							impact={impactScores[issue.id] ?? 0}
							selected={openId === issue.key}
							onopen={openIssueById}
						/>
					{/each}
				</div>
			</div>
		{/each}
	</section>

	{#if openId}
		<div class="scrim" onclick={closeAll} role="presentation"></div>
	{/if}

	<NewIssuePane open={newOpen} onclose={closeAll} />

	{#if openIssue}
		{#key openIssue.key}
			<DetailPanel issue={openIssue} onclose={closeAll} />
		{/key}
	{/if}
</div>

<style>
	.page {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		background: var(--surf-0);
	}

	.top {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: end;
		gap: var(--sp-4);
		padding: var(--sp-6) var(--gutter-x) var(--sp-4);
		border-bottom: 1px solid var(--line-1);
	}
	.top-left {
		display: flex;
		flex-direction: column;
		gap: var(--sp-1);
	}
	.top-title {
		margin: 0;
		font-size: var(--fs-xxl);
		font-weight: 600;
		line-height: var(--lh-tight);
		letter-spacing: -0.022em;
	}
	.top-sub {
		margin: var(--sp-1) 0 0;
		font-size: var(--fs-sm);
		color: var(--ink-2);
	}

	.board {
		flex: 1;
		display: grid;
		grid-template-columns: repeat(5, minmax(240px, 1fr));
		gap: var(--col-gap);
		padding: var(--sp-4) var(--gutter-x) var(--sp-6);
		overflow-x: auto;
		min-height: 0;
	}

	.column {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.col-head {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		height: var(--ctrl-lg);
		padding: 0 var(--sp-1);
		margin-bottom: var(--sp-2);
	}
	.col-count { margin-left: auto; font-size: var(--fs-xs); color: var(--ink-4); }

	.col-body {
		display: flex;
		flex-direction: column;
		gap: var(--card-gap);
		min-height: var(--sp-12);
	}

	.scrim {
		position: fixed;
		inset: 0;
		background: rgba(20, 20, 25, 0.18);
		z-index: 40;
		animation: fade-in 160ms ease-out;
	}
	@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }

	@media (max-width: 900px) {
		.board { grid-template-columns: repeat(5, 240px); }
	}
</style>
