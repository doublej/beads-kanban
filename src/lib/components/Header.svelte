<script lang="ts">
	interface Props {
		searchQuery: string;
		filterPriority: number | 'all';
		filterType: string;
		isDarkMode: boolean;
		wsConnected: boolean;
		paneCount: number;
		ontoggleTheme: () => void;
		onopenKeyboardHelp: () => void;
		onopenCreatePanel: () => void;
		ontogglePaneActivity: () => void;
	}

	let {
		searchQuery = $bindable(),
		filterPriority = $bindable(),
		filterType = $bindable(),
		isDarkMode,
		wsConnected,
		paneCount,
		ontoggleTheme,
		onopenKeyboardHelp,
		onopenCreatePanel,
		ontogglePaneActivity
	}: Props = $props();
</script>

<header class="header">
	<div class="header-left">
		<div class="logo">
			<h1>strandkanban</h1>
		</div>
		<nav class="header-nav">
			<a href="/about">About</a>
			<a href="/prompts">Prompts</a>
		</nav>
	</div>
	<div class="header-center">
		<div class="search-container">
			<svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<circle cx="11" cy="11" r="8"/>
				<path d="m21 21-4.35-4.35"/>
			</svg>
			<input
				type="text"
				placeholder="Search issues..."
				bind:value={searchQuery}
				class="search-input"
			/>
			{#if searchQuery}
				<button class="search-clear" onclick={() => searchQuery = ''}>×</button>
			{:else}
				<kbd class="hotkey-hint">/</kbd>
			{/if}
		</div>
		<button class="btn-create" onclick={onopenCreatePanel}>
			<span class="btn-create-icon">+</span>
			<span class="btn-create-text">New Issue</span>
			<kbd class="btn-hotkey">N</kbd>
		</button>
	</div>
	<div class="header-right">
		<div class="filter-group">
			<select bind:value={filterPriority} class="filter-select">
				<option value="all">All Priorities</option>
				<option value={0}>Critical</option>
				<option value={1}>High</option>
				<option value={2}>Medium</option>
				<option value={3}>Low</option>
				<option value={4}>Backlog</option>
			</select>
			<select bind:value={filterType} class="filter-select">
				<option value="all">All Types</option>
				<option value="task">Task</option>
				<option value="bug">Bug</option>
				<option value="feature">Feature</option>
				<option value="epic">Epic</option>
				<option value="chore">Chore</option>
			</select>
		</div>
		<button class="keyboard-help-btn" onclick={onopenKeyboardHelp} aria-label="Keyboard shortcuts" title="Keyboard shortcuts">
			<kbd>?</kbd>
		</button>
		<button class="theme-toggle" onclick={ontoggleTheme} aria-label="Toggle theme">
			{#if isDarkMode}
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="5"/>
					<path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
				</svg>
			{:else}
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
				</svg>
			{/if}
		</button>
		<button
			class="pane-toggle"
			class:connected={wsConnected}
			onclick={ontogglePaneActivity}
			title={wsConnected ? 'Panes connected' : 'Panes disconnected'}
		>
			<span class="pane-dot"></span>
			<span class="pane-count">{paneCount}</span>
		</button>
	</div>
</header>

<style>
	/* Header */
	.header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		padding: 0.875rem 1.5rem;
		background: transparent;
		gap: 1.5rem;
		z-index: 100;
		flex-shrink: 0;
	}

	.header-left {
		flex-shrink: 0;
		display: flex;
		align-items: baseline;
		gap: 1.5rem;
	}

	.header-nav {
		display: flex;
		align-items: baseline;
		gap: 1rem;
	}

	.header-nav a {
		color: rgba(255, 255, 255, 0.7);
		text-decoration: none;
		font-size: 0.8125rem;
		font-weight: 500;
		transition: color 0.15s;
	}

	.header-nav a:hover {
		color: rgba(255, 255, 255, 0.9);
	}

	:global(.app.light) .header-nav a {
		color: rgba(0, 0, 0, 0.7);
	}

	:global(.app.light) .header-nav a:hover {
		color: rgba(0, 0, 0, 0.9);
	}

	.logo h1 {
		font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif;
		font-size: 1.3rem;
		font-weight: 800;
		letter-spacing: -0.02em;
		color: rgba(255, 255, 255, 0.95);
		text-transform: lowercase;
		text-shadow: 0 0.5px 0 rgba(0, 0, 0, 0.5);
	}

	.header-center {
		flex: 1;
		max-width: 500px;
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.search-container {
		position: relative;
		display: flex;
		align-items: center;
		flex: 1;
	}

	.search-icon {
		position: absolute;
		left: 0.75rem;
		width: 0.9375rem;
		height: 0.9375rem;
		color: var(--text-tertiary);
		pointer-events: none;
	}

	.search-input {
		width: 100%;
		padding: 0.625rem 2.25rem;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: var(--radius-lg);
		color: var(--text-primary);
		font-family: inherit;
		font-size: 0.875rem;
		transition: all var(--transition-fast);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
	}

	.search-input::placeholder {
		color: var(--text-secondary);
	}

	.search-input:focus {
		outline: none;
		background: rgba(255, 255, 255, 0.06);
		border-color: rgba(59, 130, 246, 0.5);
		box-shadow:
			0 2px 8px rgba(0, 0, 0, 0.08),
			0 0 0 3px rgba(59, 130, 246, 0.15);
	}

	.search-clear {
		position: absolute;
		right: 0.5rem;
		width: 1.125rem;
		height: 1.125rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-elevated);
		border: none;
		border-radius: 50%;
		color: var(--text-tertiary);
		font-size: 0.8125rem;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.search-clear:hover {
		background: var(--text-tertiary);
		color: var(--bg-primary);
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		flex-shrink: 0;
	}

	.filter-group {
		display: flex;
		gap: 0.375rem;
	}

	.filter-select {
		padding: 0.375rem 0.5rem;
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		color: var(--text-tertiary);
		font-family: inherit;
		font-size: 0.75rem;
		cursor: pointer;
		transition: all var(--transition-fast);
		appearance: none;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 24 24' fill='none' stroke='%2365656d' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 0.25rem center;
		padding-right: 1.25rem;
	}

	.filter-select:hover {
		background: rgba(255, 255, 255, 0.06);
		color: var(--text-secondary);
	}

	.filter-select:focus {
		outline: none;
		background: rgba(255, 255, 255, 0.06);
		color: var(--text-secondary);
	}

	.filter-select option {
		background: var(--bg-secondary);
	}

	.theme-toggle {
		width: 2rem;
		height: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		color: var(--text-tertiary);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.theme-toggle svg {
		width: 1rem;
		height: 1rem;
	}

	.theme-toggle:hover {
		background: rgba(255, 255, 255, 0.06);
		color: var(--text-secondary);
	}

	.btn-create {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.625rem 1.125rem;
		background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: var(--radius-lg);
		color: white;
		font-family: inherit;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition:
			transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1),
			box-shadow 200ms cubic-bezier(0, 0, 0.2, 1),
			background 150ms ease-out;
		box-shadow:
			0 2px 8px rgba(59, 130, 246, 0.3),
			0 1px 2px rgba(0, 0, 0, 0.1);
	}

	.btn-create:hover {
		background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
		transform: translateY(-2px) scale(1.02);
		box-shadow:
			0 6px 16px rgba(59, 130, 246, 0.45),
			0 3px 6px rgba(0, 0, 0, 0.12);
	}

	.btn-create:active {
		background: linear-gradient(180deg, var(--accent-primary) 0%, #0066cc 100%);
		transform: translateY(0) scale(0.98);
		transition:
			transform 80ms cubic-bezier(0.4, 0, 0.2, 1),
			box-shadow 80ms ease-out;
		box-shadow:
			inset 0 2px 4px rgba(0, 0, 0, 0.2),
			0 1px 2px rgba(0, 0, 0, 0.15);
	}

	.btn-create-icon {
		font-size: 1rem;
		line-height: 1;
	}

	.btn-hotkey {
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 0.625rem;
		font-weight: 500;
		padding: 0.125rem 0.375rem;
		background: rgba(255, 255, 255, 0.15);
		border-radius: 3px;
		margin-left: 0.5rem;
		opacity: 0.8;
	}

	.pane-toggle {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.375rem 0.5rem;
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		color: var(--text-tertiary);
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.6875rem;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.pane-toggle:hover {
		background: rgba(255, 255, 255, 0.06);
		color: var(--text-secondary);
	}

	.pane-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #ef4444;
		transition: all var(--transition-fast);
	}

	.pane-toggle.connected .pane-dot {
		background: #22d3ee;
		box-shadow: 0 0 8px rgba(34, 211, 238, 0.6);
		animation: pulseDot 2s ease-in-out infinite;
	}

	@keyframes pulseDot {
		0%, 100% { opacity: 1; transform: scale(1); }
		50% { opacity: 0.7; transform: scale(1.2); }
	}

	.pane-count {
		font-weight: 500;
		letter-spacing: 0.05em;
	}

	.hotkey-hint {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1rem;
		height: 1rem;
		padding: 0 0.25rem;
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 0.5rem;
		font-weight: 600;
		color: var(--text-tertiary);
		background: var(--bg-tertiary);
		border: 1px solid var(--border-subtle);
		border-radius: 3px;
		opacity: 0.5;
		transition: opacity 200ms ease;
	}

	.search-container .hotkey-hint {
		position: absolute;
		right: 0.75rem;
		top: 50%;
		transform: translateY(-50%);
	}

	.keyboard-help-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.keyboard-help-btn:hover {
		background: rgba(255, 255, 255, 0.06);
	}

	.keyboard-help-btn kbd {
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 0.6875rem;
		font-weight: 500;
		color: var(--text-tertiary);
		background: none;
		border: none;
		box-shadow: none;
	}

	.keyboard-help-btn:hover kbd {
		color: var(--text-secondary);
	}

	.theme-toggle, .btn-create {
		position: relative;
	}

	/* Mobile responsive styles */
	@media (max-width: 768px) {
		.header {
			display: flex;
			flex-direction: column;
			padding: 0.75rem;
			padding-top: max(0.75rem, env(safe-area-inset-top));
			padding-left: max(0.75rem, env(safe-area-inset-left));
			padding-right: max(0.75rem, env(safe-area-inset-right));
			gap: 0.5rem;
		}

		.header-left {
			display: none;
		}

		.header-center {
			display: flex;
			width: 100%;
			max-width: 100%;
			gap: 0.5rem;
		}

		.header-right {
			display: flex;
			width: 100%;
			gap: 0.5rem;
		}

		.search-input,
		.filter-select,
		.btn-create {
			height: 2.75rem;
			min-height: 2.75rem;
			border-radius: 0.75rem;
		}

		.search-container {
			flex: 1;
			min-width: 0;
		}

		.search-input {
			width: 100%;
			padding: 0 2.25rem 0 2.5rem;
			font-size: 1rem;
			background: rgba(255, 255, 255, 0.04);
			border: none;
			box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
		}

		.search-input:focus {
			background: rgba(255, 255, 255, 0.1);
			box-shadow: inset 0 0 0 2px var(--accent-primary);
		}

		.search-icon {
			left: 0.75rem;
			width: 1.125rem;
			height: 1.125rem;
		}

		.search-clear {
			right: 0.625rem;
		}

		.hotkey-hint {
			display: none;
		}

		.btn-create {
			flex: 0 0 2.75rem;
			width: 2.75rem;
			padding: 0;
			justify-content: center;
			border: none;
		}

		.btn-create-text,
		.btn-create .btn-hotkey {
			display: none;
		}

		.btn-create-icon {
			font-size: 1.5rem;
			line-height: 1;
		}

		.filter-group {
			display: flex;
			flex: 1;
			gap: 0.5rem;
		}

		.filter-select {
			flex: 1;
			min-width: 0;
			padding: 0 1.75rem 0 0.75rem;
			font-size: 0.875rem;
			background: rgba(255, 255, 255, 0.04);
			border: none;
			box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
			color: var(--text-secondary);
			background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2398989d' stroke-width='3'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
			background-repeat: no-repeat;
			background-position: right 0.5rem center;
		}

		.filter-select:focus {
			background-color: rgba(255, 255, 255, 0.1);
			box-shadow: inset 0 0 0 2px var(--accent-primary);
			outline: none;
		}

		.pane-toggle,
		.theme-toggle,
		.keyboard-help-btn {
			display: none;
		}
	}
</style>
