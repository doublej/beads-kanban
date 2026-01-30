<script lang="ts">
	import { base } from '$app/paths';

	let copied = $state(false);
	const cloneCommand = 'git clone https://github.com/doublej/beads-kanban && cd beads-kanban && bun install && bun run dev';

	function copyCommand() {
		navigator.clipboard.writeText(cloneCommand);
		copied = true;
		setTimeout(() => copied = false, 2000);
	}

	const columns = [
		{ name: 'Backlog', status: 'open', desc: 'New issues waiting to be worked on' },
		{ name: 'In Progress', status: 'in_progress', desc: 'Currently being worked on' },
		{ name: 'Hooked', status: 'hooked', desc: 'Waiting for agent action' },
		{ name: 'Blocked', status: 'blocked', desc: 'Blocked by a dependency' },
		{ name: 'Complete', status: 'closed', desc: 'Done and resolved' }
	];

	const features = [
		{
			title: 'Drag & Drop',
			desc: 'Move issues between columns to update their status. Reorder within columns to set priority.',
			icon: '&#x2725;'
		},
		{
			title: 'Keyboard Navigation',
			desc: 'Navigate and manage issues entirely from the keyboard. Arrow keys, shortcuts, and quick actions.',
			icon: '&#x2328;'
		},
		{
			title: 'Dependency Tracking',
			desc: 'Link issues with parent-child and blocker relationships. See what blocks what at a glance.',
			icon: '&#x21C4;'
		},
		{
			title: 'Inline Editing',
			desc: 'Edit titles, descriptions, and comments directly on the board without leaving the view.',
			icon: '&#x270E;'
		},
		{
			title: 'Search & Filter',
			desc: 'Filter issues by text, status, labels, and actionability. Find what matters quickly.',
			icon: '&#x2315;'
		},
		{
			title: 'CLI-Backed',
			desc: 'All writes go through the bd CLI, keeping your .beads directory as the single source of truth.',
			icon: '&#x2713;'
		}
	];

	const architecture = [
		{ layer: 'SQLite DB', desc: '.beads/ directory with issues.db', direction: 'down' },
		{ layer: 'db.ts', desc: 'Direct SQLite reads for fast queries', direction: 'down' },
		{ layer: 'API Routes', desc: 'SvelteKit endpoints: GET reads DB, POST/PATCH shell out to bd', direction: 'down' },
		{ layer: 'Svelte State', desc: '$state runes for reactive Kanban columns', direction: 'down' },
		{ layer: 'Kanban Board', desc: 'Drag-and-drop UI with keyboard navigation', direction: '' }
	];
</script>

<svelte:head>
	<title>beads-kanban</title>
	<link rel="preconnect" href="https://fonts.googleapis.com">
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous">
	<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
</svelte:head>

<main>
	<header class="animate-in">
		<nav>
			<a href="{base}/" class="nav-logo">beads-kanban</a>
			<div class="nav-links">
				<a href="#features" class="nav-link">Features</a>
				<a href="#architecture" class="nav-link">Architecture</a>
				<a href="#getting-started" class="nav-link">Install</a>
				<a href="https://github.com/doublej/beads-kanban" class="nav-link" target="_blank" rel="noopener">GitHub</a>
			</div>
		</nav>
	</header>

	<section class="hero animate-in" style="animation-delay: 200ms;">
		<h1>Kanban board for <span class="nowrap">Beads issue tracking</span></h1>
		<p class="lead">
			A SvelteKit web app that wraps the <a href="https://github.com/steveyegge/beads" target="_blank" rel="noopener">Beads</a> CLI
			with a drag-and-drop Kanban interface. Manage issues visually while keeping <code>.beads/</code> as the source of truth.
		</p>
		<div class="install-block animate-in" style="animation-delay: 400ms;">
			<div class="code-line">
				<code>{cloneCommand}</code>
				<button onclick={copyCommand} class="copy-btn" aria-label="Copy install command">
					{copied ? 'Copied' : 'Copy'}
				</button>
			</div>
			<p class="install-note">
				Requires <a href="https://bun.sh" target="_blank" rel="noopener">Bun</a> and the <a href="https://github.com/steveyegge/beads" target="_blank" rel="noopener">bd CLI</a>
			</p>
		</div>
	</section>

	<section class="section animate-in" style="animation-delay: 500ms;" id="features">
		<h2>Features</h2>
		<p class="section-desc">Everything you need to manage Beads issues visually.</p>
		<div class="features-grid">
			{#each features as feat}
				<div class="feature-card">
					<span class="feature-icon">{@html feat.icon}</span>
					<h3>{feat.title}</h3>
					<p>{feat.desc}</p>
				</div>
			{/each}
		</div>
	</section>

	<section class="section animate-in" style="animation-delay: 600ms;">
		<h2>Status Flow</h2>
		<p class="section-desc">Issues move through five stages, each mapped to a Kanban column.</p>
		<div class="columns-flow">
			{#each columns as col, i}
				<div class="column-card">
					<span class="column-status">{col.status}</span>
					<strong>{col.name}</strong>
					<p>{col.desc}</p>
				</div>
				{#if i < columns.length - 1}
					<span class="flow-arrow">&#x2192;</span>
				{/if}
			{/each}
		</div>
	</section>

	<section class="section animate-in" style="animation-delay: 700ms;" id="architecture">
		<h2>Architecture</h2>
		<p class="section-desc">How data flows from the Beads database to the Kanban UI.</p>
		<div class="arch-stack">
			{#each architecture as layer, i}
				<div class="arch-layer">
					<strong>{layer.layer}</strong>
					<span>{layer.desc}</span>
				</div>
				{#if layer.direction}
					<div class="arch-arrow">&#x2193;</div>
				{/if}
			{/each}
		</div>
		<div class="arch-note">
			<h3>Read vs Write path</h3>
			<div class="rw-grid">
				<div class="rw-card">
					<strong>Reads</strong>
					<p>Go directly to SQLite via <code>db.ts</code> for fast queries, bypassing the CLI.</p>
				</div>
				<div class="rw-card">
					<strong>Writes</strong>
					<p>Shell out to <code>bd</code> CLI commands (<code>bd create</code>, <code>bd update</code>, <code>bd close</code>) to keep the database consistent.</p>
				</div>
			</div>
		</div>
	</section>

	<section class="section animate-in" style="animation-delay: 800ms;">
		<h2>Tech Stack</h2>
		<p class="section-desc">Built with modern tools for fast development and a snappy UI.</p>
		<div class="stack-grid">
			<div class="stack-item">
				<strong>Svelte 5</strong>
				<p>Runes (<code>$state</code>, <code>$derived</code>, <code>$effect</code>) for reactive UI</p>
			</div>
			<div class="stack-item">
				<strong>SvelteKit 2</strong>
				<p>File-based routing, API routes, server-side rendering</p>
			</div>
			<div class="stack-item">
				<strong>TypeScript</strong>
				<p>Type-safe interfaces for issues, deps, and columns</p>
			</div>
			<div class="stack-item">
				<strong>SQLite</strong>
				<p>Direct database reads via better-sqlite3 for performance</p>
			</div>
		</div>
	</section>

	<section class="section animate-in" style="animation-delay: 900ms;" id="getting-started">
		<h2>Getting Started</h2>
		<p class="section-desc">Set up the Kanban board for your Beads project.</p>
		<div class="install-block standalone">
			<div class="code-line">
				<code>{cloneCommand}</code>
				<button onclick={copyCommand} class="copy-btn" aria-label="Copy install command">
					{copied ? 'Copied' : 'Copy'}
				</button>
			</div>
		</div>

		<div class="install-steps">
			<h3>Setup steps</h3>
			<ol class="steps-list">
				<li>
					<span class="step-num">1</span>
					<div class="step-content">
						<strong>Install the Beads CLI</strong>
						<p>Follow the <a href="https://github.com/steveyegge/beads" target="_blank" rel="noopener">Beads README</a> to install <code>bd</code> on your system.</p>
					</div>
				</li>
				<li>
					<span class="step-num">2</span>
					<div class="step-content">
						<strong>Clone and install</strong>
						<p>Clone this repo and run <code>bun install</code> to set up dependencies.</p>
					</div>
				</li>
				<li>
					<span class="step-num">3</span>
					<div class="step-content">
						<strong>Point to your project</strong>
						<p>The app reads from the <code>.beads/</code> directory. Make sure your Beads project is initialized.</p>
					</div>
				</li>
				<li>
					<span class="step-num">4</span>
					<div class="step-content">
						<strong>Start the dev server</strong>
						<p>Run <code>bun run dev</code> and open the board in your browser.</p>
					</div>
				</li>
			</ol>
		</div>

		<div class="commands-block">
			<h3>Available commands</h3>
			<div class="commands-grid">
				<div class="command-item">
					<code>bun run dev</code>
					<span>Start dev server</span>
				</div>
				<div class="command-item">
					<code>bun run build</code>
					<span>Build for production</span>
				</div>
				<div class="command-item">
					<code>bun run check</code>
					<span>Type-check with svelte-check</span>
				</div>
			</div>
		</div>
	</section>

	<footer class="animate-in" style="animation-delay: 1000ms;">
		<p>Built on <a href="https://github.com/steveyegge/beads" target="_blank" rel="noopener">Beads</a> by Steve Yegge</p>
		<p><a href="https://github.com/doublej/beads-kanban" target="_blank" rel="noopener">GitHub</a></p>
	</footer>
</main>

<style>
	@keyframes fadeSlideUp {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.animate-in {
		animation: fadeSlideUp 0.6s cubic-bezier(0.23, 1, 0.32, 1) backwards;
	}

	:global(*) {
		box-sizing: border-box;
	}

	:global(body) {
		margin: 0;
		font-family: 'Instrument Sans', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
		background: #fafafa;
		color: #404040;
		min-height: 100vh;
		line-height: 1.6;
		-webkit-font-smoothing: antialiased;
	}

	main {
		max-width: 1200px;
		margin: 0 auto;
		padding: 0 24px;
	}

	/* Header */
	header {
		padding: 20px 0;
		border-bottom: 1px solid #e0e0e0;
		margin-bottom: 60px;
	}

	nav {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.nav-logo {
		text-decoration: none;
		color: #1a1a1a;
		font-weight: 600;
		font-size: 0.95rem;
	}

	.nav-links {
		display: flex;
		align-items: center;
		gap: 24px;
	}

	.nav-link {
		color: #707070;
		text-decoration: none;
		font-size: 0.9rem;
		font-weight: 500;
	}

	.nav-link:hover {
		color: #1a1a1a;
	}

	/* Hero */
	.hero {
		padding: 0 0 60px;
	}

	h1 {
		font-size: 2.5rem;
		font-weight: 600;
		color: #1a1a1a;
		margin: 0 0 20px;
		letter-spacing: -0.03em;
		line-height: 1.15;
	}

	.nowrap {
		white-space: nowrap;
	}

	.lead {
		font-size: 1.1rem;
		color: #606060;
		max-width: 600px;
		margin: 0 0 40px;
	}

	.lead a {
		color: #404040;
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.lead a:hover {
		color: #1a1a1a;
	}

	.lead code {
		background: #f0f0f0;
		padding: 2px 6px;
		font-size: 0.9rem;
	}

	/* Install block */
	.install-block {
		max-width: 100%;
	}

	.install-block.standalone {
		margin: 32px 0;
	}

	.code-line {
		display: flex;
		align-items: center;
		gap: 12px;
		background: #fff;
		border: 1px solid #d0d0d0;
		padding: 14px 16px;
		overflow: hidden;
	}

	code {
		font-family: 'DM Mono', 'SF Mono', Monaco, monospace;
		font-size: 0.85rem;
		color: #303030;
		flex: 1;
		overflow-x: auto;
		white-space: nowrap;
	}

	.copy-btn {
		background: #1a1a1a;
		color: #fff;
		border: none;
		padding: 8px 16px;
		cursor: pointer;
		font-size: 0.8rem;
		font-weight: 500;
		font-family: 'Instrument Sans', sans-serif;
		white-space: nowrap;
		transition: background 0.15s;
		min-width: 70px;
		text-align: center;
	}

	.copy-btn:hover {
		background: #333;
	}

	.install-note {
		font-size: 0.85rem;
		color: #808080;
		margin: 12px 0 0;
	}

	.install-note a {
		color: #505050;
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.install-note a:hover {
		color: #1a1a1a;
	}

	/* Sections */
	.section {
		padding: 60px 0;
		border-top: 1px solid #e0e0e0;
	}

	h2 {
		font-size: 1.5rem;
		font-weight: 600;
		color: #1a1a1a;
		margin: 0 0 8px;
		letter-spacing: -0.02em;
	}

	.section-desc {
		color: #707070;
		margin: 0 0 32px;
		font-size: 0.95rem;
	}

	/* Features grid */
	.features-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 16px;
	}

	.feature-card {
		background: #fff;
		border: 1px solid #d0d0d0;
		padding: 20px;
	}

	.feature-icon {
		display: block;
		font-size: 1.4rem;
		margin-bottom: 12px;
		color: #707070;
	}

	.feature-card h3 {
		font-size: 0.95rem;
		font-weight: 600;
		color: #1a1a1a;
		margin: 0 0 6px;
	}

	.feature-card p {
		margin: 0;
		font-size: 0.85rem;
		color: #606060;
		line-height: 1.5;
	}

	/* Columns flow */
	.columns-flow {
		display: flex;
		align-items: stretch;
		gap: 8px;
		overflow-x: auto;
		padding: 4px 0;
	}

	.column-card {
		background: #fff;
		border: 1px solid #d0d0d0;
		padding: 16px;
		min-width: 160px;
		flex: 1;
	}

	.column-status {
		display: inline-block;
		font-family: 'DM Mono', monospace;
		font-size: 0.75rem;
		color: #808080;
		background: #f5f5f5;
		padding: 2px 8px;
		margin-bottom: 8px;
	}

	.column-card strong {
		display: block;
		font-size: 0.95rem;
		color: #1a1a1a;
		margin-bottom: 4px;
	}

	.column-card p {
		margin: 0;
		font-size: 0.8rem;
		color: #707070;
		line-height: 1.4;
	}

	.flow-arrow {
		display: flex;
		align-items: center;
		color: #c0c0c0;
		font-size: 1.2rem;
		flex-shrink: 0;
	}

	/* Architecture */
	.arch-stack {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0;
		margin-bottom: 32px;
	}

	.arch-layer {
		background: #fff;
		border: 1px solid #d0d0d0;
		padding: 14px 20px;
		width: 100%;
		max-width: 500px;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 16px;
	}

	.arch-layer strong {
		color: #1a1a1a;
		font-size: 0.9rem;
		white-space: nowrap;
	}

	.arch-layer span {
		color: #707070;
		font-size: 0.8rem;
		text-align: right;
	}

	.arch-arrow {
		color: #c0c0c0;
		font-size: 1rem;
		padding: 4px 0;
	}

	.arch-note {
		margin-top: 24px;
	}

	.arch-note h3 {
		font-size: 1rem;
		font-weight: 600;
		color: #1a1a1a;
		margin: 0 0 12px;
	}

	.rw-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
	}

	.rw-card {
		background: #fff;
		border: 1px solid #d0d0d0;
		padding: 16px;
	}

	.rw-card strong {
		display: block;
		font-size: 0.9rem;
		color: #1a1a1a;
		margin-bottom: 6px;
	}

	.rw-card p {
		margin: 0;
		font-size: 0.85rem;
		color: #606060;
		line-height: 1.5;
	}

	.rw-card code {
		background: #f5f5f5;
		padding: 2px 6px;
		font-size: 0.8rem;
		color: #505050;
	}

	/* Tech stack */
	.stack-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 16px;
	}

	.stack-item {
		background: #fff;
		border: 1px solid #d0d0d0;
		padding: 16px;
	}

	.stack-item strong {
		display: block;
		font-size: 0.9rem;
		color: #1a1a1a;
		margin-bottom: 6px;
	}

	.stack-item p {
		margin: 0;
		font-size: 0.85rem;
		color: #606060;
		line-height: 1.5;
	}

	.stack-item code {
		background: #f5f5f5;
		padding: 2px 6px;
		font-size: 0.8rem;
		color: #505050;
	}

	/* Install steps */
	.install-steps {
		margin: 40px 0;
	}

	.install-steps h3 {
		font-size: 1rem;
		font-weight: 600;
		color: #1a1a1a;
		margin: 0 0 16px;
	}

	.steps-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.steps-list li {
		display: flex;
		gap: 16px;
		background: #fff;
		border: 1px solid #e0e0e0;
		padding: 16px;
	}

	.step-num {
		width: 28px;
		height: 28px;
		background: #f0f0f0;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.85rem;
		font-weight: 600;
		color: #606060;
		flex-shrink: 0;
	}

	.step-content {
		flex: 1;
		min-width: 0;
	}

	.step-content strong {
		display: block;
		color: #1a1a1a;
		font-size: 0.95rem;
		margin-bottom: 4px;
	}

	.step-content p {
		margin: 0;
		font-size: 0.85rem;
		color: #606060;
		line-height: 1.5;
	}

	.step-content code {
		background: #f5f5f5;
		padding: 2px 6px;
		font-size: 0.8rem;
		color: #505050;
	}

	.step-content a {
		color: #505050;
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.step-content a:hover {
		color: #1a1a1a;
	}

	/* Commands block */
	.commands-block {
		margin-top: 32px;
	}

	.commands-block h3 {
		font-size: 1rem;
		font-weight: 600;
		color: #1a1a1a;
		margin: 0 0 12px;
	}

	.commands-grid {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.command-item {
		display: flex;
		align-items: center;
		gap: 16px;
		background: #fff;
		border: 1px solid #e0e0e0;
		padding: 12px 16px;
	}

	.command-item code {
		font-size: 0.85rem;
		color: #1a1a1a;
		font-weight: 500;
		min-width: 160px;
	}

	.command-item span {
		font-size: 0.85rem;
		color: #707070;
	}

	/* Footer */
	footer {
		padding: 48px 0;
		border-top: 1px solid #e0e0e0;
		text-align: center;
		font-size: 0.85rem;
	}

	footer p {
		margin: 6px 0;
		color: #808080;
	}

	footer a {
		color: #505050;
		text-decoration: none;
	}

	footer a:hover {
		color: #1a1a1a;
	}

	/* Responsive */
	@media (max-width: 700px) {
		header {
			margin-bottom: 48px;
		}

		h1 {
			font-size: 1.8rem;
		}

		.lead {
			font-size: 1rem;
		}

		.features-grid {
			grid-template-columns: 1fr;
		}

		.columns-flow {
			flex-direction: column;
		}

		.flow-arrow {
			transform: rotate(90deg);
			justify-content: center;
		}

		.rw-grid {
			grid-template-columns: 1fr;
		}

		.stack-grid {
			grid-template-columns: 1fr;
		}

		.code-line {
			flex-direction: column;
			align-items: stretch;
			gap: 10px;
		}

		code {
			text-align: left;
		}

		.copy-btn {
			align-self: flex-start;
		}
	}
</style>
