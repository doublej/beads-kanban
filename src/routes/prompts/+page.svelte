<script lang="ts">
	let isDarkMode = $state(true);
	let copiedPrompt = $state<string | null>(null);

	$effect(() => {
		if (typeof window !== 'undefined') {
			const saved = localStorage.getItem('theme');
			isDarkMode = saved !== 'light';
		}
	});

	const prompts = [
		{
			title: 'Start a work session',
			prompt: 'Check beads for ready tickets using `bd ready`. Pick the highest priority one, claim it with `bd update <id> --status in_progress --assignee claude`, and begin implementing.'
		},
		{
			title: 'Create a feature ticket',
			prompt: 'Create a new feature ticket: `bd create "Feature title" --type feature --priority 2`. Add design notes if needed with `bd update <id> --design "Technical approach..."'
		},
		{
			title: 'Report a bug',
			prompt: 'Create a bug ticket: `bd create "Bug description" --type bug --priority 1`. Include reproduction steps in the description.'
		},
		{
			title: 'Add a dependency',
			prompt: 'Link issues with dependencies: `bd dep add <blocked-id> <blocker-id>`. The first issue is blocked by the second.'
		},
		{
			title: 'Complete a ticket',
			prompt: 'When done implementing, close the ticket: `bd close <id> --reason "Implementation complete"`. Verify your work first!'
		},
		{
			title: 'Check blocked items',
			prompt: 'See what\'s blocked: `bd blocked`. This shows issues waiting on dependencies.'
		},
		{
			title: 'Project overview',
			prompt: 'Get project stats: `bd stats`. Shows total, open, in-progress, blocked, and completed counts.'
		},
		{
			title: 'Search issues',
			prompt: 'Find issues by text: `bd search "keyword"`. Use filters: `bd list --status open --priority 1`'
		}
	];

	async function copyPrompt(prompt: string) {
		await navigator.clipboard.writeText(prompt);
		copiedPrompt = prompt;
		setTimeout(() => copiedPrompt = null, 2000);
	}
</script>

<svelte:head>
	<title>Prompts - StrandKanban</title>
</svelte:head>

<div class="page" class:light={!isDarkMode}>
	<header class="header">
		<a href="/" class="logo">
			<h1>strandkanban</h1>
		</a>
		<nav>
			<a href="/">Board</a>
			<a href="/about">About</a>
			<a href="/prompts" class="active">Prompts</a>
		</nav>
	</header>

	<main class="content">
		<h2>Suggested Prompts</h2>
		<p class="intro">
			Copy these prompts to use with your AI assistant when working with beads issues.
		</p>

		<div class="prompts-grid">
			{#each prompts as { title, prompt }}
				<div class="prompt-card">
					<h3>{title}</h3>
					<p>{prompt}</p>
					<button
						class="copy-btn"
						class:copied={copiedPrompt === prompt}
						onclick={() => copyPrompt(prompt)}
					>
						{copiedPrompt === prompt ? 'Copied!' : 'Copy'}
					</button>
				</div>
			{/each}
		</div>
	</main>
</div>

<style>
	:global(body) {
		margin: 0;
		font-family: 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
	}

	.page {
		min-height: 100vh;
		background: #0a0a0b;
		color: #e0e0e0;
	}

	.page.light {
		background: #f5f5f5;
		color: #1a1a1a;
	}

	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 2rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}

	.page.light .header {
		border-bottom-color: rgba(0, 0, 0, 0.1);
	}

	.logo {
		text-decoration: none;
	}

	.logo h1 {
		font-size: 1.25rem;
		font-weight: 800;
		letter-spacing: -0.03em;
		color: rgba(255, 255, 255, 0.95);
		text-transform: lowercase;
		margin: 0;
	}

	.page.light .logo h1 {
		color: rgba(0, 0, 0, 0.9);
	}

	nav {
		display: flex;
		gap: 1.5rem;
	}

	nav a {
		color: rgba(255, 255, 255, 0.6);
		text-decoration: none;
		font-size: 0.875rem;
		transition: color 0.15s;
	}

	nav a:hover,
	nav a.active {
		color: rgba(255, 255, 255, 0.95);
	}

	.page.light nav a {
		color: rgba(0, 0, 0, 0.5);
	}

	.page.light nav a:hover,
	.page.light nav a.active {
		color: rgba(0, 0, 0, 0.9);
	}

	.content {
		max-width: 900px;
		margin: 0 auto;
		padding: 3rem 2rem;
	}

	h2 {
		font-size: 1.75rem;
		font-weight: 700;
		margin-bottom: 1rem;
		letter-spacing: -0.02em;
	}

	.intro {
		color: rgba(255, 255, 255, 0.6);
		margin-bottom: 2rem;
	}

	.page.light .intro {
		color: rgba(0, 0, 0, 0.6);
	}

	.prompts-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 1rem;
	}

	.prompt-card {
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 12px;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.page.light .prompt-card {
		background: rgba(0, 0, 0, 0.02);
		border-color: rgba(0, 0, 0, 0.08);
	}

	.prompt-card h3 {
		font-size: 0.9375rem;
		font-weight: 600;
		margin: 0;
		color: rgba(255, 255, 255, 0.9);
	}

	.page.light .prompt-card h3 {
		color: rgba(0, 0, 0, 0.9);
	}

	.prompt-card p {
		font-size: 0.8125rem;
		line-height: 1.6;
		color: rgba(255, 255, 255, 0.6);
		margin: 0;
		flex: 1;
	}

	.page.light .prompt-card p {
		color: rgba(0, 0, 0, 0.6);
	}

	.copy-btn {
		align-self: flex-start;
		background: rgba(99, 102, 241, 0.15);
		border: 1px solid rgba(99, 102, 241, 0.3);
		color: #818cf8;
		padding: 0.375rem 0.75rem;
		border-radius: 6px;
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s;
	}

	.copy-btn:hover {
		background: rgba(99, 102, 241, 0.25);
	}

	.copy-btn.copied {
		background: rgba(16, 185, 129, 0.15);
		border-color: rgba(16, 185, 129, 0.3);
		color: #34d399;
	}
</style>
