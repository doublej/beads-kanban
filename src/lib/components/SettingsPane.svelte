<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from './Icon.svelte';
	import type { Project } from '$lib/types';

	interface Props {
		show: boolean;
		tickerRange: number;
		isDarkMode: boolean;
		agentEnabled: boolean;
		agentHost: string;
		agentPort: number;
		colorScheme: string;
		ontoggleTheme: () => void;
		onsetColorScheme: (scheme: string) => void;
	}

	let {
		show = $bindable(),
		tickerRange = $bindable(),
		isDarkMode,
		agentEnabled = $bindable(),
		agentHost = $bindable(),
		agentPort = $bindable(),
		colorScheme,
		ontoggleTheme,
		onsetColorScheme
	}: Props = $props();

	const colorSchemes = [
		{ id: 'default', name: 'Default', accent: '#6366f1', bg: '#27272a' },
		{ id: 'ocean', name: 'Ocean', accent: '#0ea5e9', bg: '#0c4a6e' },
		{ id: 'forest', name: 'Forest', accent: '#22c55e', bg: '#14532d' },
		{ id: 'sunset', name: 'Sunset', accent: '#f97316', bg: '#431407' },
		{ id: 'rose', name: 'Rose', accent: '#f43f5e', bg: '#4c0519' }
	];

	let cwd = $state('');
	let cwdName = $state('');
	let cwdInput = $state('');
	let cwdError = $state('');
	let isEditingCwd = $state(false);
	let isChangingCwd = $state(false);
	let projects = $state<Project[]>([]);

	async function loadProjects() {
		const res = await fetch('/api/projects');
		if (res.ok) {
			const data = await res.json();
			projects = data.projects || [];
		}
	}

	const tickerRangeOptions = [
		{ value: 15, label: '15m' },
		{ value: 60, label: '1h' },
		{ value: 60 * 6, label: '6h' },
		{ value: 60 * 24, label: '24h' },
		{ value: 60 * 24 * 7, label: '7d' },
		{ value: 60 * 24 * 30, label: '30d' }
	];

	onMount(() => {
		fetchCwd();
		loadProjects();
	});

	async function fetchCwd() {
		const res = await fetch('/api/cwd');
		if (res.ok) {
			const data = await res.json();
			cwd = data.cwd;
			cwdName = data.name;
			cwdInput = data.cwd;
		}
	}

	async function changeCwd() {
		cwdError = '';
		isChangingCwd = true;
		try {
			const res = await fetch('/api/cwd', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ path: cwdInput })
			});
			const data = await res.json();
			if (!res.ok) {
				cwdError = data.error || 'Failed to change directory';
			} else {
				cwd = data.cwd;
				cwdName = data.name;
				isEditingCwd = false;
				window.location.reload();
			}
		} catch {
			cwdError = 'Request failed';
		} finally {
			isChangingCwd = false;
		}
	}

	function selectProject(project: Project) {
		cwdInput = project.path;
		isEditingCwd = true;
	}

	function cancelCwdEdit() {
		cwdInput = cwd;
		cwdError = '';
		isEditingCwd = false;
	}

	function handleOverlayClick() {
		show = false;
	}

	function handlePanelClick(e: MouseEvent) {
		e.stopPropagation();
	}
</script>

{#if show}
<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="settings-overlay" onclick={handleOverlayClick} role="presentation">
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions a11y_click_events_have_key_events -->
	<aside class="settings-pane" onclick={handlePanelClick} role="dialog" aria-label="Settings">
		<header class="settings-header">
			<div class="settings-title-row">
				<span class="settings-icon"><Icon name="settings" size={18} /></span>
				<h2>Settings</h2>
			</div>
			<button class="settings-close" onclick={() => show = false} aria-label="Close settings">
				<Icon name="close" size={16} />
			</button>
		</header>

		<div class="settings-body">
			<!-- Project Section -->
			<section class="settings-section">
				<h3 class="section-label">Project</h3>
				<div class="setting-row">
					<div class="setting-info">
						<span class="setting-name">Working Directory</span>
						<span class="setting-desc">Beads project location</span>
					</div>
				</div>
				{#if isEditingCwd}
					<div class="cwd-edit">
						<input
							type="text"
							class="cwd-input"
							bind:value={cwdInput}
							placeholder="/path/to/project"
							disabled={isChangingCwd}
						/>
						{#if cwdError}
							<span class="cwd-error">{cwdError}</span>
						{/if}
						<div class="cwd-actions">
							<button class="btn-secondary" onclick={cancelCwdEdit} disabled={isChangingCwd}>
								Cancel
							</button>
							<button class="btn-primary" onclick={changeCwd} disabled={isChangingCwd}>
								{isChangingCwd ? 'Changing...' : 'Apply'}
							</button>
						</div>
					</div>
				{:else}
					<div class="cwd-display">
						<div class="cwd-path">
							<span class="cwd-icon">📁</span>
							<span class="cwd-name">{cwdName || '...'}</span>
						</div>
						<button class="btn-change" onclick={() => isEditingCwd = true}>
							Change
						</button>
					</div>
					<span class="cwd-full">{cwd}</span>
					{#if projects.length > 1}
						<div class="projects-list">
							<span class="projects-label">Switch Project <kbd>⌘`</kbd></span>
							<div class="projects-grid">
								{#each projects.filter(p => p.path !== cwd) as project}
									<button class="project-item" onclick={() => selectProject(project)}>
										<span class="project-dot" style="background: {project.color}"></span>
										<span class="project-name">{project.name}</span>
									</button>
								{/each}
							</div>
						</div>
					{/if}
				{/if}
			</section>

			<!-- Agent Section -->
			<section class="settings-section">
				<h3 class="section-label">Agent</h3>
				<div class="setting-row">
					<div class="setting-info">
						<span class="setting-name">Agent Features</span>
						<span class="setting-desc">Enable AI agent integration</span>
					</div>
					<button class="toggle-switch" onclick={() => agentEnabled = !agentEnabled}>
						<span class="toggle-track" class:active={agentEnabled}>
							<span class="toggle-thumb"></span>
						</span>
					</button>
				</div>

				{#if agentEnabled}
					<div class="agent-config">
						<div class="config-row">
							<label class="config-label">Host</label>
							<input
								type="text"
								class="config-input"
								bind:value={agentHost}
								placeholder="localhost"
							/>
						</div>
						<div class="config-row">
							<label class="config-label">Port</label>
							<input
								type="number"
								class="config-input config-input-port"
								bind:value={agentPort}
								placeholder="8765"
								min="1"
								max="65535"
							/>
						</div>
						<div class="config-endpoint">
							<span class="endpoint-label">Endpoint</span>
							<code class="endpoint-value">ws://{agentHost}:{agentPort}</code>
						</div>
					</div>
				{/if}
			</section>

			<!-- Appearance Section -->
			<section class="settings-section">
				<h3 class="section-label">Appearance</h3>
				<div class="setting-row">
					<div class="setting-info">
						<span class="setting-name">Theme</span>
						<span class="setting-desc">Toggle dark/light mode</span>
					</div>
					<button class="theme-toggle" onclick={ontoggleTheme}>
						<span class="theme-track" class:dark={isDarkMode}>
							<span class="theme-thumb">
								{#if isDarkMode}
									<Icon name="moon" size={12} />
								{:else}
									<Icon name="sun" size={12} />
								{/if}
							</span>
						</span>
					</button>
				</div>
				<div class="setting-row" style="margin-top: 0.75rem">
					<div class="setting-info">
						<span class="setting-name">Color Scheme</span>
						<span class="setting-desc">Accent color theme</span>
					</div>
				</div>
				<div class="color-scheme-selector">
					{#each colorSchemes as scheme}
						<button
							class="color-scheme-option"
							class:active={colorScheme === scheme.id}
							onclick={() => onsetColorScheme(scheme.id)}
							style="--scheme-accent: {scheme.accent}; --scheme-bg: {scheme.bg}"
						>
							<span class="scheme-preview">
								<span class="scheme-dot"></span>
							</span>
							<span class="scheme-name">{scheme.name}</span>
						</button>
					{/each}
				</div>
			</section>

			<!-- Activity Feed Section -->
			<section class="settings-section">
				<h3 class="section-label">Activity Feed</h3>
				<div class="setting-row">
					<div class="setting-info">
						<span class="setting-name">Ticker Range</span>
						<span class="setting-desc">Show events from the last...</span>
					</div>
				</div>
				<div class="range-selector">
					{#each tickerRangeOptions as opt}
						<button
							class="range-chip"
							class:active={tickerRange === opt.value}
							onclick={() => tickerRange = opt.value}
						>
							{opt.label}
						</button>
					{/each}
				</div>
			</section>

			<!-- Keyboard Section -->
			<section class="settings-section">
				<h3 class="section-label">Keyboard</h3>
				<div class="shortcuts-preview">
					<div class="shortcut-row">
						<kbd>?</kbd>
						<span>Show all shortcuts</span>
					</div>
					<div class="shortcut-row">
						<kbd>N</kbd>
						<span>New issue</span>
					</div>
					<div class="shortcut-row">
						<kbd>T</kbd>
						<span>Toggle theme</span>
					</div>
				</div>
			</section>
		</div>

		<footer class="settings-footer">
			<div class="footer-brand">
				<span class="brand-name">strandkanban</span>
				<span class="brand-version">v0.1.0</span>
			</div>
		</footer>
	</aside>
</div>
{/if}

<style>
	.settings-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(4px);
		z-index: 1000;
		animation: overlayFadeIn 200ms ease-out;
	}

	@keyframes overlayFadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.settings-pane {
		position: absolute;
		top: 0;
		right: 0;
		bottom: 0;
		width: 340px;
		max-width: 90vw;
		background: var(--bg-primary);
		border-left: 1px solid var(--border-subtle);
		display: flex;
		flex-direction: column;
		animation: slideIn 280ms cubic-bezier(0.32, 0.72, 0, 1);
		box-shadow: -8px 0 32px rgba(0, 0, 0, 0.3);
	}

	@keyframes slideIn {
		from { transform: translateX(100%); }
		to { transform: translateX(0); }
	}

	/* Header */
	.settings-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1.25rem;
		border-bottom: 1px solid var(--border-subtle);
		background: linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 100%);
	}

	:global(.app.light) .settings-header {
		background: linear-gradient(180deg, rgba(0,0,0,0.01) 0%, transparent 100%);
	}

	.settings-title-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.settings-icon {
		font-size: 1rem;
		opacity: 0.6;
	}

	.settings-header h2 {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0;
		letter-spacing: -0.01em;
	}

	.settings-close {
		width: 1.75rem;
		height: 1.75rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		color: var(--text-tertiary);
		cursor: pointer;
		transition: all 150ms ease;
	}

	.settings-close :global(svg) {
		width: 1rem;
		height: 1rem;
	}

	.settings-close:hover {
		background: rgba(255, 255, 255, 0.06);
		color: var(--text-secondary);
	}

	:global(.app.light) .settings-close:hover {
		background: rgba(0, 0, 0, 0.06);
	}

	/* Body */
	.settings-body {
		flex: 1;
		overflow-y: auto;
		padding: 0.5rem 0;
	}

	.settings-section {
		padding: 0.75rem 1.25rem;
	}

	.settings-section + .settings-section {
		border-top: 1px solid rgba(255, 255, 255, 0.04);
	}

	:global(.app.light) .settings-section + .settings-section {
		border-top-color: rgba(0, 0, 0, 0.04);
	}

	.section-label {
		font-size: 0.625rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--text-tertiary);
		margin: 0 0 0.625rem 0;
	}

	.setting-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.setting-info {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.setting-name {
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--text-primary);
	}

	.setting-desc {
		font-size: 0.6875rem;
		color: var(--text-tertiary);
	}

	/* CWD Display/Edit */
	.cwd-display {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: 0.5rem;
		padding: 0.5rem 0.625rem;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: var(--radius-md);
	}

	:global(.app.light) .cwd-display {
		background: rgba(0, 0, 0, 0.02);
		border-color: rgba(0, 0, 0, 0.06);
	}

	.cwd-path {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	.cwd-icon {
		font-size: 0.875rem;
	}

	.cwd-name {
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.cwd-full {
		display: block;
		margin-top: 0.375rem;
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 0.625rem;
		color: var(--text-tertiary);
		word-break: break-all;
	}

	.btn-change {
		padding: 0.25rem 0.5rem;
		background: transparent;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		font-family: inherit;
		font-size: 0.6875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 150ms ease;
	}

	.btn-change:hover {
		background: rgba(255, 255, 255, 0.06);
		border-color: rgba(255, 255, 255, 0.15);
		color: var(--text-primary);
	}

	:global(.app.light) .btn-change {
		border-color: rgba(0, 0, 0, 0.1);
	}

	:global(.app.light) .btn-change:hover {
		background: rgba(0, 0, 0, 0.04);
	}

	.cwd-edit {
		margin-top: 0.5rem;
	}

	.cwd-input {
		width: 100%;
		padding: 0.5rem 0.625rem;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 0.75rem;
	}

	.cwd-input:focus {
		outline: none;
		border-color: rgba(59, 130, 246, 0.5);
		box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
	}

	:global(.app.light) .cwd-input {
		background: rgba(0, 0, 0, 0.03);
		border-color: rgba(0, 0, 0, 0.1);
	}

	.cwd-error {
		display: block;
		margin-top: 0.375rem;
		font-size: 0.6875rem;
		color: #ef4444;
	}

	.cwd-actions {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.projects-list {
		margin-top: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
	}

	:global(.app.light) .projects-list {
		border-top-color: rgba(0, 0, 0, 0.06);
	}

	.projects-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.6875rem;
		font-weight: 600;
		color: var(--text-tertiary);
		margin-bottom: 0.5rem;
	}

	.projects-label kbd {
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 0.5625rem;
		padding: 0.125rem 0.375rem;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 4px;
		color: var(--text-tertiary);
	}

	:global(.app.light) .projects-label kbd {
		background: rgba(0, 0, 0, 0.04);
		border-color: rgba(0, 0, 0, 0.08);
	}

	.projects-grid {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.project-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.625rem;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		font-family: inherit;
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 180ms ease;
		text-align: left;
	}

	.project-item:hover {
		background: rgba(255, 255, 255, 0.06);
		border-color: rgba(255, 255, 255, 0.12);
		color: var(--text-primary);
		transform: translateX(4px);
	}

	:global(.app.light) .project-item {
		background: rgba(0, 0, 0, 0.02);
		border-color: rgba(0, 0, 0, 0.06);
	}

	:global(.app.light) .project-item:hover {
		background: rgba(0, 0, 0, 0.04);
		border-color: rgba(0, 0, 0, 0.1);
	}

	.project-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		flex-shrink: 0;
		box-shadow: 0 0 6px currentColor;
	}

	.project-name {
		flex: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.btn-secondary,
	.btn-primary {
		flex: 1;
		padding: 0.375rem 0.625rem;
		border-radius: var(--radius-sm);
		font-family: inherit;
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 150ms ease;
	}

	.btn-secondary {
		background: transparent;
		border: 1px solid rgba(255, 255, 255, 0.1);
		color: var(--text-secondary);
	}

	.btn-secondary:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.04);
	}

	.btn-primary {
		background: rgba(59, 130, 246, 0.15);
		border: 1px solid rgba(59, 130, 246, 0.25);
		color: #60a5fa;
	}

	.btn-primary:hover:not(:disabled) {
		background: rgba(59, 130, 246, 0.2);
	}

	.btn-primary:disabled,
	.btn-secondary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	:global(.app.light) .btn-secondary {
		border-color: rgba(0, 0, 0, 0.1);
	}

	:global(.app.light) .btn-primary {
		background: rgba(59, 130, 246, 0.1);
		color: #2563eb;
	}

	/* Toggle Switch */
	.toggle-switch {
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
	}

	.toggle-track {
		display: flex;
		align-items: center;
		width: 36px;
		height: 20px;
		padding: 2px;
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 10px;
		transition: all 200ms ease;
	}

	.toggle-track.active {
		background: rgba(34, 211, 238, 0.2);
		border-color: rgba(34, 211, 238, 0.3);
	}

	:global(.app.light) .toggle-track {
		background: rgba(0, 0, 0, 0.06);
		border-color: rgba(0, 0, 0, 0.1);
	}

	:global(.app.light) .toggle-track.active {
		background: rgba(6, 182, 212, 0.15);
		border-color: rgba(6, 182, 212, 0.25);
	}

	.toggle-thumb {
		width: 14px;
		height: 14px;
		background: var(--text-tertiary);
		border-radius: 50%;
		transition: all 200ms ease;
	}

	.toggle-track.active .toggle-thumb {
		transform: translateX(16px);
		background: #22d3ee;
	}

	:global(.app.light) .toggle-track.active .toggle-thumb {
		background: #0891b2;
	}

	/* Agent Config */
	.agent-config {
		margin-top: 0.75rem;
		padding: 0.625rem;
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid rgba(255, 255, 255, 0.04);
		border-radius: var(--radius-md);
	}

	:global(.app.light) .agent-config {
		background: rgba(0, 0, 0, 0.02);
		border-color: rgba(0, 0, 0, 0.04);
	}

	.config-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.config-label {
		width: 40px;
		font-size: 0.6875rem;
		font-weight: 500;
		color: var(--text-tertiary);
	}

	.config-input {
		flex: 1;
		padding: 0.375rem 0.5rem;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: var(--radius-sm);
		color: var(--text-primary);
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 0.6875rem;
	}

	.config-input:focus {
		outline: none;
		border-color: rgba(34, 211, 238, 0.4);
	}

	.config-input-port {
		width: 70px;
		flex: none;
	}

	:global(.app.light) .config-input {
		background: rgba(0, 0, 0, 0.03);
		border-color: rgba(0, 0, 0, 0.08);
	}

	.config-endpoint {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid rgba(255, 255, 255, 0.04);
	}

	:global(.app.light) .config-endpoint {
		border-top-color: rgba(0, 0, 0, 0.04);
	}

	.endpoint-label {
		font-size: 0.625rem;
		color: var(--text-tertiary);
	}

	.endpoint-value {
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 0.625rem;
		color: #22d3ee;
		background: rgba(34, 211, 238, 0.1);
		padding: 0.125rem 0.375rem;
		border-radius: 3px;
	}

	:global(.app.light) .endpoint-value {
		color: #0891b2;
		background: rgba(6, 182, 212, 0.1);
	}

	/* Theme Toggle */
	.theme-toggle {
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
	}

	.theme-track {
		display: flex;
		align-items: center;
		width: 44px;
		height: 24px;
		padding: 2px;
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 12px;
		transition: all 200ms ease;
	}

	.theme-track.dark {
		background: rgba(99, 102, 241, 0.2);
		border-color: rgba(99, 102, 241, 0.3);
	}

	:global(.app.light) .theme-track {
		background: rgba(0, 0, 0, 0.06);
		border-color: rgba(0, 0, 0, 0.1);
	}

	:global(.app.light) .theme-track.dark {
		background: rgba(99, 102, 241, 0.15);
	}

	.theme-thumb {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		background: var(--bg-elevated);
		border-radius: 50%;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
		transition: transform 200ms ease;
	}

	.theme-track.dark .theme-thumb {
		transform: translateX(20px);
		background: #818cf8;
	}

	.theme-thumb :global(svg) {
		width: 11px;
		height: 11px;
		color: var(--text-secondary);
	}

	.theme-track.dark .theme-thumb :global(svg) {
		color: white;
	}

	/* Color Scheme Selector */
	.color-scheme-selector {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		margin-top: 0.5rem;
	}

	.color-scheme-option {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.625rem;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		font-family: inherit;
		font-size: 0.6875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 150ms ease;
	}

	.color-scheme-option:hover {
		background: rgba(255, 255, 255, 0.08);
		border-color: rgba(255, 255, 255, 0.12);
	}

	.color-scheme-option.active {
		background: color-mix(in srgb, var(--scheme-accent) 15%, transparent);
		border-color: color-mix(in srgb, var(--scheme-accent) 30%, transparent);
		color: var(--text-primary);
	}

	:global(.app.light) .color-scheme-option {
		background: rgba(0, 0, 0, 0.03);
		border-color: rgba(0, 0, 0, 0.08);
	}

	:global(.app.light) .color-scheme-option:hover {
		background: rgba(0, 0, 0, 0.06);
	}

	.scheme-preview {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 14px;
		height: 14px;
		background: var(--scheme-bg);
		border-radius: 3px;
	}

	.scheme-dot {
		width: 8px;
		height: 8px;
		background: var(--scheme-accent);
		border-radius: 50%;
	}

	.scheme-name {
		font-size: 0.6875rem;
	}

	/* Range Selector */
	.range-selector {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		margin-top: 0.5rem;
	}

	.range-chip {
		padding: 0.375rem 0.625rem;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 0.6875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 150ms ease;
	}

	.range-chip:hover {
		background: rgba(255, 255, 255, 0.08);
		border-color: rgba(255, 255, 255, 0.12);
	}

	.range-chip.active {
		background: rgba(34, 211, 238, 0.15);
		border-color: rgba(34, 211, 238, 0.3);
		color: #22d3ee;
	}

	:global(.app.light) .range-chip {
		background: rgba(0, 0, 0, 0.03);
		border-color: rgba(0, 0, 0, 0.08);
	}

	:global(.app.light) .range-chip:hover {
		background: rgba(0, 0, 0, 0.06);
	}

	:global(.app.light) .range-chip.active {
		background: rgba(6, 182, 212, 0.1);
		border-color: rgba(6, 182, 212, 0.25);
		color: #0891b2;
	}

	/* Shortcuts Preview */
	.shortcuts-preview {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.shortcut-row {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		font-size: 0.75rem;
		color: var(--text-secondary);
	}

	.shortcut-row kbd {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.375rem;
		height: 1.375rem;
		padding: 0 0.375rem;
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 0.625rem;
		font-weight: 500;
		color: var(--text-primary);
		background: var(--bg-tertiary);
		border: 1px solid var(--border-default);
		border-radius: 4px;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
	}

	/* Footer */
	.settings-footer {
		padding: 1rem 1.25rem;
		border-top: 1px solid var(--border-subtle);
		background: rgba(0, 0, 0, 0.1);
	}

	:global(.app.light) .settings-footer {
		background: rgba(0, 0, 0, 0.02);
	}

	.footer-brand {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}

	.brand-name {
		font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif;
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: -0.01em;
		color: var(--text-tertiary);
		text-transform: lowercase;
	}

	.brand-version {
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 0.625rem;
		color: var(--text-tertiary);
		opacity: 0.6;
	}
</style>
