<script lang="ts">
	import { onMount } from 'svelte';
	import type { Project } from '$lib/types';

	interface Props {
		onprojectChanged?: () => void;
	}

	let { onprojectChanged }: Props = $props();

	let cwd = $state('');
	let cwdName = $state('');
	let cwdInput = $state('');
	let cwdError = $state('');
	let isEditingCwd = $state(false);
	let isChangingCwd = $state(false);
	let projects = $state<Project[]>([]);

	onMount(() => {
		fetchCwd();
		loadProjects();
	});

	async function loadProjects() {
		const res = await fetch('/api/projects');
		if (res.ok) {
			const data = await res.json();
			projects = data.projects || [];
		}
	}

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
				onprojectChanged?.();
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
</script>

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

<style>
	.settings-section {
		padding: 0.75rem 1.25rem;
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
		width: 10px; height: 10px;
		border-radius: 50%;
		flex-shrink: 0;
		box-shadow: 0 0 6px currentColor;
	}

	.project-name {
		flex: 1;
		white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
	}

	.btn-secondary, .btn-primary {
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

	.btn-secondary:hover:not(:disabled) { background: rgba(255, 255, 255, 0.04); }

	.btn-primary {
		background: rgba(59, 130, 246, 0.15);
		border: 1px solid rgba(59, 130, 246, 0.25);
		color: #60a5fa;
	}

	.btn-primary:hover:not(:disabled) { background: rgba(59, 130, 246, 0.2); }
	.btn-primary:disabled, .btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }
	:global(.app.light) .btn-secondary { border-color: rgba(0, 0, 0, 0.1); }
	:global(.app.light) .btn-primary { background: rgba(59, 130, 246, 0.1); color: #2563eb; }
</style>
