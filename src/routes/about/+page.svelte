<script lang="ts">
	let isDarkMode = $state(true);

	$effect(() => {
		if (typeof window !== 'undefined') {
			const saved = localStorage.getItem('theme');
			isDarkMode = saved !== 'light';
		}
	});
</script>

<svelte:head>
	<title>About - StrandKanban</title>
</svelte:head>

<div class="page" class:light={!isDarkMode}>
	<header class="header">
		<a href="/" class="logo">
			<h1>strandkanban</h1>
		</a>
		<nav>
			<a href="/">Board</a>
			<a href="/about" class="active">About</a>
			<a href="/prompts">Prompts</a>
		</nav>
	</header>

	<main class="content">
		<h2>About StrandKanban</h2>

		<section>
			<h3>What is StrandKanban?</h3>
			<p>
				StrandKanban is a local-first kanban board designed for AI-assisted development workflows.
				It integrates directly with the <strong>beads</strong> issue tracking system, providing a visual
				interface to manage tasks tracked in your local repository.
			</p>
		</section>

		<section>
			<h3>How is this different from Vibekanban?</h3>
			<p>
				While both are kanban-style interfaces, StrandKanban has key differences:
			</p>
			<ul>
				<li><strong>Local-first:</strong> All data lives in your repository via beads, not in a cloud database</li>
				<li><strong>CLI integration:</strong> Issues are managed through the <code>bd</code> command-line tool</li>
				<li><strong>Git-native:</strong> Issue history is tracked in git, enabling branching and collaboration patterns</li>
				<li><strong>AI-workflow optimized:</strong> Designed for rapid iteration with AI coding assistants</li>
				<li><strong>Real-time sync:</strong> Changes made via CLI or other tools reflect instantly via SSE</li>
			</ul>
		</section>

		<section>
			<h3>Core Features</h3>
			<ul>
				<li>Drag-and-drop card management with smooth animations</li>
				<li>Keyboard navigation (vim-style: hjkl or arrow keys)</li>
				<li>Dependency tracking between issues</li>
				<li>Real-time updates via Server-Sent Events</li>
				<li>Priority and type indicators</li>
				<li>Search and filtering</li>
			</ul>
		</section>

		<section>
			<h3>Technology</h3>
			<p>
				Built with SvelteKit 5, using the new runes reactivity system. The backend integrates with
				beads via shell commands, making it easy to extend and customize.
			</p>
		</section>
	</main>
</div>

<style>
	@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;800&display=swap');

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
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 1.3rem;
		font-weight: 800;
		letter-spacing: -0.02em;
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
		max-width: 700px;
		margin: 0 auto;
		padding: 3rem 2rem;
	}

	h2 {
		font-size: 1.75rem;
		font-weight: 700;
		margin-bottom: 2rem;
		letter-spacing: -0.02em;
	}

	h3 {
		font-size: 1.125rem;
		font-weight: 600;
		margin: 2rem 0 1rem;
		letter-spacing: -0.01em;
	}

	section {
		margin-bottom: 2rem;
	}

	p {
		line-height: 1.7;
		color: rgba(255, 255, 255, 0.7);
	}

	.page.light p {
		color: rgba(0, 0, 0, 0.7);
	}

	ul {
		line-height: 1.8;
		padding-left: 1.5rem;
		color: rgba(255, 255, 255, 0.7);
	}

	.page.light ul {
		color: rgba(0, 0, 0, 0.7);
	}

	li {
		margin-bottom: 0.5rem;
	}

	code {
		background: rgba(255, 255, 255, 0.1);
		padding: 0.125rem 0.375rem;
		border-radius: 4px;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 0.875em;
	}

	.page.light code {
		background: rgba(0, 0, 0, 0.08);
	}

	strong {
		color: rgba(255, 255, 255, 0.9);
	}

	.page.light strong {
		color: rgba(0, 0, 0, 0.9);
	}
</style>
