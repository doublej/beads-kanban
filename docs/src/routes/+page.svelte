<script lang="ts">
	import { base } from '$app/paths';

	let copied = $state(false);
	const cloneCommand = 'npx github:doublej/beads-kanban /path/to/project';

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
		},
		{
			title: 'Notifications',
			desc: 'Browser push and MCP desktop notifications keep you informed of issue changes without polling.',
			icon: '&#x1F514;'
		}
	];

	const screenshots = [
		{ file: 'kanban-wide-light.png', label: 'Kanban Board' },
		{ file: 'detail-panel-light.png', label: 'Detail Panel' },
		{ file: 'agent-kanban-light.png', label: 'Agent Pane' },
		{ file: 'keyboard-hints-light.png', label: 'Keyboard Nav' },
		{ file: 'graph-view-light.png', label: 'Dependency Graph' },
		{ file: 'stats-view-light.png', label: 'Stats Dashboard' },
		{ file: 'tree-expanded-light.png', label: 'Tree View' },
		{ file: 'tree-view-light.png', label: 'Tree Collapsed' }
	];

	// Filmroll gallery state
	let scrollContainer = $state<HTMLDivElement | undefined>(undefined);
	let isDragging = $state(false);
	let isHovering = $state(false);
	let hoverPreview = $state<{ file: string; label: string } | null>(null);
	let dragStartX = 0;
	let dragScrollLeft = 0;
	let scrollLeft = $state(0);
	let hasDragged = false;

	// Theater mode state
	let theaterOpen = $state(false);
	let theaterShot = $state(screenshots[0]);

	function curveY(idx: number, total: number): number {
		const c = (total - 1) / 2;
		const n = (idx - c) / (c || 1);
		return n * -12;
	}

	function curveZ(idx: number, total: number): number {
		const c = (total - 1) / 2;
		const n = (idx - c) / (c || 1);
		return (1 - n * n) * 60;
	}

	function onPointerDown(e: PointerEvent) {
		if (!scrollContainer) return;
		isDragging = true;
		hasDragged = false;
		dragStartX = e.clientX;
		dragScrollLeft = scrollContainer.scrollLeft;
	}

	function onPointerMove(e: PointerEvent) {
		if (!isDragging || !scrollContainer) return;
		const dx = e.clientX - dragStartX;
		if (Math.abs(dx) > 5) hasDragged = true;
		scrollContainer.scrollLeft = dragScrollLeft - dx;
	}

	function onPointerUp() {
		isDragging = false;
	}

	function onTrackScroll() {
		if (!scrollContainer) return;
		scrollLeft = scrollContainer.scrollLeft;
	}

	const centerLabel = $derived.by(() => {
		if (!scrollContainer) return screenshots[0].label;
		const center = scrollLeft + (scrollContainer?.clientWidth ?? 0) / 2;
		const frameW = 280 + 12; // width + gap
		const idx = Math.round(center / frameW) % screenshots.length;
		return screenshots[Math.abs(idx) % screenshots.length]?.label ?? '';
	});

	function setHoverPreview(shot: { file: string; label: string } | null) {
		hoverPreview = shot;
	}

	let stageEl = $state<HTMLDivElement | undefined>(undefined);
	let theaterAnimating = $state(false);

	function openTheater(shot: { file: string; label: string }) {
		if (hasDragged) return;
		theaterShot = shot;
		hoverPreview = null;
		if (!stageEl) return;
		// Clip to current position BEFORE going fixed, preventing full-screen black flash
		const r = stageEl.getBoundingClientRect();
		const top = (r.top / window.innerHeight) * 100;
		const right = ((window.innerWidth - r.right) / window.innerWidth) * 100;
		const bottom = ((window.innerHeight - r.bottom) / window.innerHeight) * 100;
		const left = (r.left / window.innerWidth) * 100;
		stageEl.style.clipPath = `inset(${top}% ${right}% ${bottom}% ${left}% round 8px)`;
		theaterAnimating = true;
		theaterOpen = true;
		document.body.style.overflow = 'hidden';
		// Next frame: transition clip-path to full screen
		requestAnimationFrame(() => {
			if (stageEl) stageEl.style.clipPath = 'inset(0 0 0 0 round 0)';
		});
		setTimeout(() => {
			theaterAnimating = false;
			if (stageEl) stageEl.style.clipPath = '';
		}, 550);
	}

	function closeTheater() {
		if (!stageEl) return;
		theaterAnimating = true;
		// Animate clip-path back to the original inset before removing theater mode
		const r = stageEl.getBoundingClientRect();
		// Use the filmroll-stage's non-theater position (approximate: re-read from CSS vars or use center)
		stageEl.style.clipPath = '';
		theaterOpen = false;
		document.body.style.overflow = '';
		setTimeout(() => { theaterAnimating = false; }, 500);
	}

	function onTheaterKey(e: KeyboardEvent) {
		if (!theaterOpen) return;
		if (e.key === 'Escape') return closeTheater();
		const idx = screenshots.findIndex((s) => s.file === theaterShot.file);
		if (e.key === 'ArrowRight') theaterShot = screenshots[(idx + 1) % screenshots.length];
		if (e.key === 'ArrowLeft') theaterShot = screenshots[(idx - 1 + screenshots.length) % screenshots.length];
	}

	const architecture = [
		{ layer: 'SQLite DB', desc: '.beads/ directory with issues.db', direction: 'down' },
		{ layer: 'db.ts', desc: 'Direct SQLite reads for fast queries', direction: 'down' },
		{ layer: 'API Routes', desc: 'SvelteKit endpoints: GET reads DB, POST/PATCH shell out to bd', direction: 'down' },
		{ layer: 'Svelte State', desc: '$state runes for reactive Kanban columns', direction: 'down' },
		{ layer: 'Kanban Board', desc: 'Drag-and-drop UI with keyboard navigation', direction: '' }
	];
</script>

<svelte:window onkeydown={onTheaterKey} />

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
			A SvelteKit web app that wraps the <a href="https://github.com/gastownhall/beads" target="_blank" rel="noopener">Beads</a> CLI
			with a drag-and-drop Kanban interface. Manage issues visually while keeping <code>.beads/</code> as the source of truth.
		</p>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="filmroll-stage animate-in"
			class:theater={theaterOpen}
			class:theater-animating={theaterAnimating}
			style="animation-delay: 350ms;"
			bind:this={stageEl}
			onpointerenter={() => isHovering = true}
			onpointerleave={() => { isHovering = false; isDragging = false; }}
		>
			{#if theaterOpen}
				<button class="theater-close" onclick={closeTheater} aria-label="Close theater">&times;</button>
				<div class="theater-hero">
					{#key theaterShot.file}
						<img src="{base}/screenshots/{theaterShot.file}" alt={theaterShot.label} class="theater-hero-img" />
					{/key}
					<span class="theater-label">{theaterShot.label}</span>
				</div>
			{:else}
				<span class="frame-label">{centerLabel}</span>
			{/if}
			<div class="filmroll-arc" class:theater-strip={theaterOpen}>
				{#if theaterOpen}
					<div
						class="filmroll-track theater-thumbs"
						role="region"
						aria-label="Screenshot thumbnails"
					>
						{#each screenshots as shot}
							<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
							<div
								class="filmroll-frame"
								class:active-thumb={shot.file === theaterShot.file}
								onclick={() => { theaterShot = shot; }}
							>
								<img src="{base}/screenshots/{shot.file}" alt={shot.label} loading="lazy" draggable="false" />
							</div>
						{/each}
					</div>
				{:else}
					<div
						class="filmroll-track"
						class:grabbing={isDragging}
						bind:this={scrollContainer}
						onpointerdown={onPointerDown}
						onpointermove={onPointerMove}
						onpointerup={onPointerUp}
						onscroll={onTrackScroll}
						role="region"
						aria-label="Screenshot gallery"
					>
						{#each [...screenshots, ...screenshots] as shot, i}
							{@const idx = i % screenshots.length}
							<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
							<div
								class="filmroll-frame"
								style="--ry: {curveY(idx, screenshots.length)}deg; --tz: {curveZ(idx, screenshots.length)}px"
								onclick={() => openTheater(shot)}
							>
								<img src="{base}/screenshots/{shot.file}" alt={shot.label} loading="lazy" draggable="false" />
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
		{#if hoverPreview && !theaterOpen}
			<div class="hover-preview">
				<img src="{base}/screenshots/{hoverPreview.file}" alt={hoverPreview.label} />
			</div>
		{/if}
		<div class="install-block animate-in" style="animation-delay: 400ms;">
			<div class="code-line">
				<code>{cloneCommand}</code>
				<button onclick={copyCommand} class="copy-btn" aria-label="Copy install command">
					{copied ? 'Copied' : 'Copy'}
				</button>
			</div>
			<p class="install-note">
				Requires Node 18+ or <a href="https://bun.sh" target="_blank" rel="noopener">Bun</a> and the <a href="https://github.com/gastownhall/beads" target="_blank" rel="noopener">Beads CLI</a>
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
						<strong>Install prerequisites</strong>
						<p>Install Node 18+ or <a href="https://bun.sh" target="_blank" rel="noopener">Bun</a>, then install the <a href="https://github.com/gastownhall/beads" target="_blank" rel="noopener">Beads CLI</a> with <code>brew install beads</code>.</p>
					</div>
				</li>
				<li>
					<span class="step-num">2</span>
					<div class="step-content">
						<strong>Run once</strong>
						<p>Run <code>npx github:doublej/beads-kanban /path/to/project</code>. The launcher checks <code>bd</code>, initializes <code>.beads/</code> if you approve, and starts the board.</p>
					</div>
				</li>
				<li>
					<span class="step-num">3</span>
					<div class="step-content">
						<strong>Install the shortcut</strong>
						<p>Run <code>npm install -g github:doublej/beads-kanban</code> to get the shorter <code>bdk</code> command.</p>
					</div>
				</li>
				<li>
					<span class="step-num">4</span>
					<div class="step-content">
						<strong>Launch daily</strong>
						<p>Run <code>bdk</code> inside a Beads project or <code>bdk /path/to/project</code> from anywhere.</p>
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
		<p>Built on <a href="https://github.com/gastownhall/beads" target="_blank" rel="noopener">Beads</a></p>
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
		overflow-x: hidden;
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

	/* Film-roll gallery */
	.filmroll-stage {
		margin: 0 calc(-50vw + 50%) 48px;
		width: 100vw;
		position: relative;
		left: 0;
		background: #141414;
		padding: 80px 0 70px;
		overflow: clip;
		display: flex;
		flex-direction: column;
		transition: padding 0.5s cubic-bezier(0.32, 0.72, 0, 1);
	}

	/* Top arc: page-bg ellipse carves convex curve into the top edge */
	.filmroll-stage::before {
		content: '';
		position: absolute;
		top: -50px;
		left: -5%;
		right: -5%;
		height: 80px;
		background: #fafafa;
		border-radius: 0 0 50% 50%;
		z-index: 2;
		transition: opacity 0.4s ease;
	}

	/* Bottom arc: mirrored */
	.filmroll-stage::after {
		content: '';
		position: absolute;
		bottom: -50px;
		left: -5%;
		right: -5%;
		height: 80px;
		background: #fafafa;
		border-radius: 50% 50% 0 0;
		z-index: 2;
		transition: opacity 0.4s ease;
	}

	/* Theater mode: expand to fullscreen */
	.filmroll-stage.theater {
		position: fixed;
		inset: 0;
		z-index: 100;
		margin: 0;
		width: 100vw;
		height: 100vh;
		height: 100dvh;
		padding: 0;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		transition: clip-path 0.5s cubic-bezier(0.32, 0.72, 0, 1);
	}

	.filmroll-stage.theater::before,
	.filmroll-stage.theater::after {
		opacity: 0;
		pointer-events: none;
	}

	.filmroll-arc {
		position: relative;
		perspective: 2000px;
	}

	.filmroll-arc.theater-strip {
		perspective: none;
		flex-shrink: 0;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
	}

	/* Noise texture + radial glow */
	.filmroll-arc::before {
		content: '';
		position: absolute;
		inset: -40px -60px;
		background:
			radial-gradient(ellipse 80% 60% at 50% 40%, rgba(255, 255, 255, 0.04) 0%, transparent 70%),
			url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
		pointer-events: none;
	}

	.filmroll-track {
		display: flex;
		gap: 12px;
		overflow-x: auto;
		scrollbar-width: none;
		cursor: grab;
		padding: 12px 60px;
		scroll-behavior: auto;
		transform: rotateX(4deg);
		transform-origin: center bottom;
		user-select: none;
		-webkit-user-select: none;
		transition: padding 0.4s ease, gap 0.4s ease;
	}

	.filmroll-track::-webkit-scrollbar {
		display: none;
	}

	.filmroll-track.grabbing {
		cursor: grabbing;
	}

	/* Theater thumbnail strip */
	.filmroll-track.theater-thumbs {
		transform: none;
		padding: 12px 24px;
		gap: 8px;
		justify-content: center;
		cursor: default;
		overflow-x: auto;
	}

	.frame-label {
		display: block;
		text-align: center;
		padding: 0 10px 16px;
		font-family: 'DM Mono', monospace;
		font-size: 0.85rem;
		color: rgba(255, 255, 255, 0.7);
		pointer-events: none;
		position: relative;
		z-index: 3;
	}

	.filmroll-frame {
		flex: 0 0 auto;
		width: 280px;
		overflow: hidden;
		position: relative;
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
		transform: rotateY(var(--ry)) translateZ(var(--tz));
		transition: width 0.4s cubic-bezier(0.32, 0.72, 0, 1),
			box-shadow 0.25s,
			opacity 0.3s;
	}

	.filmroll-frame:hover {
		box-shadow: 0 8px 40px rgba(0, 0, 0, 0.45);
	}

	/* Theater thumbnail frames */
	.theater-thumbs .filmroll-frame {
		width: 100px;
		flex: 0 0 100px;
		box-shadow: none;
		transform: none;
		cursor: pointer;
		opacity: 0.4;
		border: 2px solid transparent;
		border-radius: 4px;
		transition: opacity 0.2s ease, border-color 0.25s ease, transform 0.2s ease;
	}

	.theater-thumbs .filmroll-frame:hover {
		opacity: 0.7;
		box-shadow: none;
		transform: translateY(-2px);
	}

	.theater-thumbs .filmroll-frame.active-thumb {
		opacity: 1;
		border-color: rgba(255, 255, 255, 0.6);
	}

	.filmroll-frame img {
		width: 100%;
		display: block;
		border: 1px solid rgba(255, 255, 255, 0.08);
	}

	/* Theater hero */
	.theater-close {
		position: absolute;
		top: 12px;
		right: 16px;
		background: none;
		border: none;
		color: rgba(255, 255, 255, 0.5);
		font-size: 2rem;
		cursor: pointer;
		z-index: 101;
		line-height: 1;
		padding: 4px 10px;
		transition: color 0.15s;
	}

	.theater-close:hover {
		color: #fff;
	}

	.theater-hero {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 48px 32px 12px;
		min-height: 0;
		overflow: hidden;
	}

	/* Hero image entrance -- {#key} re-mounts so animation replays on thumbnail switch */
	.theater-hero-img {
		max-width: min(1200px, 92vw);
		max-height: calc(100vh - 180px);
		max-height: calc(100dvh - 180px);
		object-fit: contain;
		box-shadow: 0 20px 80px rgba(0, 0, 0, 0.55);
		border-radius: 8px;
		animation: heroImageIn 0.38s cubic-bezier(0.32, 0.72, 0, 1) both;
	}

	@keyframes heroImageIn {
		from {
			opacity: 0;
			transform: scale(0.94) translateY(8px);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}

	.theater-label {
		display: block;
		margin-top: 10px;
		font-family: 'DM Mono', monospace;
		font-size: 0.8rem;
		color: rgba(255, 255, 255, 0.55);
		letter-spacing: 0.02em;
	}

	/* Hover preview (non-theater) */
	.hover-preview {
		display: flex;
		justify-content: center;
		padding: 32px 24px 0;
		pointer-events: none;
		animation: previewFadeIn 0.2s ease-out;
	}

	.hover-preview img {
		display: block;
		max-width: 900px;
		width: 100%;
		box-shadow: 0 8px 40px rgba(0, 0, 0, 0.15);
		border: 1px solid #e0e0e0;
	}

	@keyframes previewFadeIn {
		from { opacity: 0; transform: scale(0.97); }
		to { opacity: 1; transform: scale(1); }
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

		.filmroll-stage {
			padding: 70px 0 60px;
			margin: 0 calc(-50vw + 50%) 32px;
		}

		.filmroll-track {
			gap: 12px;
			padding: 12px 20px;
			transform: none;
		}

		.filmroll-frame {
			width: 60vw;
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

		.theater-hero {
			padding: 48px 8px 8px;
		}

		.theater-hero-img {
			max-height: calc(100vh - 140px);
			max-height: calc(100dvh - 140px);
		}

		.theater-thumbs .filmroll-frame {
			width: 56px;
			flex: 0 0 56px;
		}

		.filmroll-track.theater-thumbs {
			padding: 8px 12px;
			gap: 6px;
		}
	}
</style>
