<script lang="ts">
	import { onMount } from 'svelte';
	import type { Project } from '$lib/types';
	import { setCurrentProject } from '$lib/project';
	import { kanban, toggleProject, setActiveProject } from '$lib/stores/kanban.svelte';

	let projects = $state<Project[]>([]);
	let pathInput = $state('');
	let pathError = $state('');
	let isAddingProject = $state(false);
	let isValidatingProject = $state(false);

	const trackedPaths = $derived(new Set(kanban.trackedProjects.map(project => project.path)));

	onMount(() => {
		loadProjects();
	});

	async function loadProjects() {
		const res = await fetch('/api/projects');
		if (res.ok) {
			const payload = await res.json();
			projects = payload?.ok ? (payload.data?.projects ?? []) : (payload.projects ?? []);
		}
	}

	function fallbackProject(path: string, name?: string): Project {
		return {
			path,
			name: name || path.split('/').filter(Boolean).at(-1) || path,
			lastAccess: new Date().toISOString(),
			color: '#6366f1'
		};
	}

	async function addProject() {
		const path = pathInput.trim();
		if (!path) {
			pathError = 'Enter an absolute path';
			return;
		}
		pathError = '';
		isValidatingProject = true;
		try {
			const res = await fetch('/api/cwd', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ path })
			});
			const payload = await res.json();
			if (!res.ok || !payload?.ok) {
				pathError = payload?.error?.message || 'Failed to validate project';
				return;
			}

			await loadProjects();
			const validatedPath = payload.data?.cwd || path;
			const project = projects.find(p => p.path === validatedPath) || fallbackProject(validatedPath, payload.data?.name);
			if (!trackedPaths.has(project.path)) await toggleProject(project);
			setActiveProject(project);
			setCurrentProject(project.path);
			pathInput = '';
			isAddingProject = false;
		} catch {
			pathError = 'Request failed';
		} finally {
			isValidatingProject = false;
		}
	}

	async function toggleTracked(project: Project, event: Event) {
		event.stopPropagation();
		await toggleProject(project);
	}

	async function removeTracked(project: Project, event: Event) {
		event.stopPropagation();
		if (trackedPaths.has(project.path)) await toggleProject(project);
	}

	function activate(project: Project) {
		if (!trackedPaths.has(project.path)) return;
		setActiveProject(project);
		setCurrentProject(project.path);
	}

	function cancelAdd() {
		pathInput = '';
		pathError = '';
		isAddingProject = false;
	}
</script>

<section class="settings-section">
	<h3 class="section-label">Projects</h3>
	<div class="setting-row">
		<div class="setting-info">
			<span class="setting-name">Tracked Projects</span>
			<span class="setting-desc">Choose projects shown on the board</span>
		</div>
		<button class="btn-change" onclick={() => isAddingProject = true} disabled={isAddingProject}>Add Project</button>
	</div>

	{#if isAddingProject}
		<div class="cwd-edit">
			<input
				type="text"
				class="cwd-input"
				bind:value={pathInput}
				placeholder="/path/to/project"
				disabled={isValidatingProject}
			/>
			{#if pathError}
				<span class="cwd-error">{pathError}</span>
			{/if}
			<div class="cwd-actions">
				<button class="btn-secondary" onclick={cancelAdd} disabled={isValidatingProject}>Cancel</button>
				<button class="btn-primary" onclick={addProject} disabled={isValidatingProject}>
					{isValidatingProject ? 'Validating...' : 'Add'}
				</button>
			</div>
		</div>
	{/if}

	<div class="projects-list">
		<span class="projects-label">Known Projects</span>
		<div class="projects-grid">
			{#each projects as project}
				{@const isTracked = trackedPaths.has(project.path)}
				{@const isActive = kanban.activeProject?.path === project.path}
				<div
					class="project-item"
					class:tracked={isTracked}
					class:active={isActive}
					onclick={() => activate(project)}
					onkeydown={(event) => isTracked && (event.key === 'Enter' || event.key === ' ') && activate(project)}
					role="button"
					tabindex="0"
				>
					<input type="checkbox" checked={isTracked} onclick={(event) => toggleTracked(project, event)} />
					{#if isTracked}
						<span class="project-dot" style="background: {project.color}"></span>
					{/if}
					<span class="project-info">
						<span class="project-name">{project.name}</span>
						<span class="project-path">{project.path}</span>
					</span>
					{#if isActive}
						<span class="active-badge">Active</span>
					{/if}
					{#if isTracked}
						<span class="remove-project" role="button" tabindex="0" onclick={(event) => removeTracked(project, event)} onkeydown={(event) => (event.key === 'Enter' || event.key === ' ') && removeTracked(project, event)}>×</span>
					{/if}
				</div>
			{/each}
		</div>
	</div>
</section>

<style>
	.settings-section { padding: 0.75rem 1.25rem; }
	.section-label { font-size: 0.625rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-tertiary); margin: 0 0 0.625rem 0; }
	.setting-row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
	.setting-info { display: flex; flex-direction: column; gap: 0.125rem; }
	.setting-name { font-size: 0.8125rem; font-weight: 500; color: var(--text-primary); }
	.setting-desc { font-size: 0.6875rem; color: var(--text-tertiary); }
	.cwd-edit { margin-top: 0.5rem; }
	.cwd-input { width: 100%; padding: 0.5rem 0.625rem; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: var(--radius-md); color: var(--text-primary); font-family: ui-monospace, 'SF Mono', monospace; font-size: 0.75rem; }
	.cwd-input:focus { outline: none; border-color: rgba(59, 130, 246, 0.5); box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1); }
	:global(.app.light) .cwd-input { background: rgba(0, 0, 0, 0.03); border-color: rgba(0, 0, 0, 0.1); }
	.cwd-error { display: block; margin-top: 0.375rem; font-size: 0.6875rem; color: #ef4444; }
	.cwd-actions { display: flex; gap: 0.5rem; margin-top: 0.5rem; }
	.btn-change { padding: 0.25rem 0.5rem; background: transparent; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: var(--radius-sm); color: var(--text-secondary); font-family: inherit; font-size: 0.6875rem; font-weight: 500; cursor: pointer; transition: all 150ms ease; }
	.btn-change:hover:not(:disabled) { background: rgba(255, 255, 255, 0.06); border-color: rgba(255, 255, 255, 0.15); color: var(--text-primary); }
	.btn-change:disabled { opacity: 0.5; cursor: not-allowed; }
	:global(.app.light) .btn-change { border-color: rgba(0, 0, 0, 0.1); }
	:global(.app.light) .btn-change:hover:not(:disabled) { background: rgba(0, 0, 0, 0.04); }
	.projects-list { margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid rgba(255, 255, 255, 0.06); }
	:global(.app.light) .projects-list { border-top-color: rgba(0, 0, 0, 0.06); }
	.projects-label { display: flex; align-items: center; gap: 0.5rem; font-size: 0.6875rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.5rem; }
	.projects-grid { display: flex; flex-direction: column; gap: 0.375rem; }
	.project-item { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.625rem; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: var(--radius-sm); color: var(--text-secondary); font-family: inherit; font-size: 0.75rem; font-weight: 500; cursor: pointer; transition: all 180ms ease; text-align: left; }
	.project-item:not(.tracked) { cursor: default; opacity: 0.7; }
	.project-item.tracked:hover { background: rgba(255, 255, 255, 0.06); border-color: rgba(255, 255, 255, 0.12); color: var(--text-primary); }
	.project-item.active { border-color: rgba(99, 102, 241, 0.35); background: rgba(99, 102, 241, 0.08); }
	:global(.app.light) .project-item { background: rgba(0, 0, 0, 0.02); border-color: rgba(0, 0, 0, 0.06); }
	:global(.app.light) .project-item.tracked:hover { background: rgba(0, 0, 0, 0.04); border-color: rgba(0, 0, 0, 0.1); }
	.project-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; box-shadow: 0 0 6px currentColor; }
	.project-info { display: flex; flex: 1; min-width: 0; flex-direction: column; gap: 0.125rem; }
	.project-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-primary); }
	.project-path { font-family: ui-monospace, 'SF Mono', monospace; font-size: 0.625rem; color: var(--text-tertiary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.active-badge { padding: 0.125rem 0.375rem; border-radius: 999px; background: rgba(99, 102, 241, 0.15); color: #a5b4fc; font-size: 0.625rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
	.remove-project { padding: 0.125rem 0.375rem; border-radius: var(--radius-sm); color: var(--text-tertiary); font-size: 1rem; line-height: 1; cursor: pointer; }
	.remove-project:hover { background: rgba(239, 68, 68, 0.12); color: #f87171; }
	.btn-secondary, .btn-primary { flex: 1; padding: 0.375rem 0.625rem; border-radius: var(--radius-sm); font-family: inherit; font-size: 0.75rem; font-weight: 500; cursor: pointer; transition: all 150ms ease; }
	.btn-secondary { background: transparent; border: 1px solid rgba(255, 255, 255, 0.1); color: var(--text-secondary); }
	.btn-secondary:hover:not(:disabled) { background: rgba(255, 255, 255, 0.04); }
	.btn-primary { background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.25); color: #60a5fa; }
	.btn-primary:hover:not(:disabled) { background: rgba(59, 130, 246, 0.2); }
	.btn-primary:disabled, .btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }
	:global(.app.light) .btn-secondary { border-color: rgba(0, 0, 0, 0.1); }
	:global(.app.light) .btn-primary { background: rgba(59, 130, 246, 0.1); color: #2563eb; }
</style>
