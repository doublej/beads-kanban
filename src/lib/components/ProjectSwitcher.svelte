<script lang="ts">
	import type { Project } from '$lib/types';

	interface Props {
		show: boolean;
		projects: Project[];
		currentPath: string;
		onselect: (project: Project) => void;
		onclose: () => void;
	}

	let {
		show = $bindable(),
		projects,
		currentPath,
		onselect,
		onclose
	}: Props = $props();

	let selectedIndex = $state(0);

	// Most-recent beads activity for a project, falling back to last access.
	function activityAt(p: Project): number {
		const iso = p.stats?.lastActivity ?? p.lastAccess;
		const t = iso ? Date.parse(iso) : NaN;
		return Number.isFinite(t) ? t : 0;
	}

	// Sort by most active; pin the current project to the top.
	const sortedProjects = $derived(() => {
		const sorted = [...projects].sort((a, b) => activityAt(b) - activityAt(a));
		const currentIdx = sorted.findIndex(p => p.path === currentPath);
		if (currentIdx > 0) sorted.unshift(sorted.splice(currentIdx, 1)[0]);
		return sorted;
	});

	function relTime(iso: string | null | undefined): string {
		if (!iso) return '';
		const t = Date.parse(iso);
		if (!Number.isFinite(t)) return '';
		const s = Math.max(0, (Date.now() - t) / 1000);
		if (s < 90) return 'just now';
		if (s < 3600) return `${Math.floor(s / 60)}m ago`;
		if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
		const d = Math.floor(s / 86400);
		if (d < 30) return `${d}d ago`;
		if (d < 365) return `${Math.floor(d / 30)}mo ago`;
		return `${Math.floor(d / 365)}y ago`;
	}

	// Reset selection when opening
	$effect(() => {
		if (show) {
			selectedIndex = Math.min(1, sortedProjects().length - 1); // Start at second project if available
		}
	});

	function handleKeydown(e: KeyboardEvent) {
		if (!show) return;

		if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
			e.preventDefault();
			selectedIndex = Math.max(0, selectedIndex - 1);
		} else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
			e.preventDefault();
			selectedIndex = Math.min(sortedProjects().length - 1, selectedIndex + 1);
		} else if (e.key === 'Enter' || e.key === 'Tab') {
			e.preventDefault();
			const project = sortedProjects()[selectedIndex];
			if (project && project.path !== currentPath) {
				onselect(project);
			}
			onclose();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			onclose();
		}
	}

	function selectProject(project: Project, idx: number) {
		selectedIndex = idx;
		if (project.path !== currentPath) {
			onselect(project);
		}
		onclose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if show}
<div
	class="switcher-overlay"
	onclick={(e) => { if (e.target === e.currentTarget) onclose(); }}
	onkeydown={(e) => e.key === 'Escape' && onclose()}
	role="button"
	tabindex="-1"
	aria-label="Close"
>
	<div class="switcher-modal">
		<div class="switcher-header">
			<span class="header-text">Switch Project</span>
			<kbd class="header-hint">Tab</kbd>
		</div>

		<div class="projects-list">
			{#each sortedProjects() as project, i}
				{@const isCurrent = project.path === currentPath}
				{@const isSelected = i === selectedIndex}
				<div
					class="project-item"
					class:current={isCurrent}
					class:selected={isSelected}
					style="--project-color: {project.color};"
					onclick={() => selectProject(project, i)}
					onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && selectProject(project, i)}
					role="option"
					tabindex="0"
					aria-selected={isSelected}
				>
					<div class="project-dot"></div>
					<div class="project-info">
						<div class="name-row">
							<span class="project-name">{project.name}</span>
							{#if project.meta?.type}
								<span class="tag">{project.meta.type}</span>
							{/if}
							{#if project.meta?.framework}
								<span class="tag tag-alt">{project.meta.framework}</span>
							{/if}
						</div>
						<span class="project-desc">{project.meta?.description || project.path}</span>
						<div class="meta-row">
							{#if project.stats && project.stats.changed > 0 && !isCurrent}
								<span class="meta-new">+{project.stats.changed} since visit</span>
							{/if}
							{#if project.meta?.gitBranch}
								<span class="meta-item git" class:dirty={project.meta.git === 'dirty'}>
									<span class="git-dot"></span>{project.meta.gitBranch}
								</span>
							{/if}
							{#if project.stats?.lastActivity}
								<span class="meta-item muted">{relTime(project.stats.lastActivity)}</span>
							{/if}
						</div>
					</div>
					<div class="project-right">
						{#if isCurrent}
							<span class="current-badge">current</span>
						{/if}
						{#if project.stats}
							<span class="ticket-pill" title="{project.stats.active} active · {project.stats.total} total">
								<span class="ticket-count">{project.stats.active}</span>
								<span class="ticket-label">active</span>
							</span>
						{/if}
					</div>
				</div>
			{/each}
		</div>

		<div class="switcher-footer">
			<div class="footer-hint">
				<kbd>↑</kbd><kbd>↓</kbd> Navigate
			</div>
			<div class="footer-hint">
				<kbd>Enter</kbd> Select
			</div>
			<div class="footer-hint">
				<kbd>Esc</kbd> Cancel
			</div>
		</div>
	</div>
</div>
{/if}

<style>
	.switcher-overlay {
		position: fixed;
		inset: 0;
		z-index: 9999;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(8px);
		animation: fadeIn 150ms ease-out;
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.switcher-modal {
		width: 480px;
		max-width: 92vw;
		max-height: 80vh;
		background: var(--bg-secondary);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-xl);
		box-shadow: var(--shadow-lg);
		overflow: hidden;
		animation: slideUp 200ms cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	@keyframes slideUp {
		from { opacity: 0; transform: translateY(16px) scale(0.98); }
		to { opacity: 1; transform: translateY(0) scale(1); }
	}

	.switcher-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--border-subtle);
	}

	.header-text {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.header-hint {
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 0.5625rem;
		font-weight: 500;
		padding: 0.125rem 0.375rem;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-default);
		border-radius: 3px;
		color: var(--text-tertiary);
	}

	.projects-list {
		display: flex;
		flex-direction: column;
		padding: 0.5rem;
		max-height: 320px;
		overflow-y: auto;
	}

	.project-item {
		display: flex;
		align-items: flex-start;
		gap: 0.625rem;
		padding: 0.625rem 0.75rem;
		border-radius: var(--radius-md);
		cursor: pointer;
		transition: background 100ms ease;
	}

	.project-item:hover {
		background: var(--bg-elevated);
	}

	.project-item.selected {
		background: var(--accent-glow);
	}

	.project-item.current {
		opacity: 0.5;
	}

	.project-item.current.selected {
		opacity: 0.7;
	}

	.project-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--project-color);
		flex-shrink: 0;
		margin-top: 0.3rem;
	}

	.project-info {
		display: flex;
		flex-direction: column;
		gap: 0.1875rem;
		min-width: 0;
		flex: 1;
	}

	.name-row {
		display: flex;
		align-items: baseline;
		gap: 0.375rem;
		min-width: 0;
	}

	.project-name {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.tag {
		flex-shrink: 0;
		font-size: 0.5625rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		padding: 0.0625rem 0.3125rem;
		border-radius: 4px;
		background: var(--bg-tertiary);
		color: var(--text-tertiary);
		border: 1px solid var(--border-subtle);
	}

	.tag-alt {
		color: var(--text-secondary);
	}

	.project-desc {
		font-size: 0.6875rem;
		line-height: 1.35;
		color: var(--text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.meta-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.0625rem;
	}

	.meta-item {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.625rem;
		color: var(--text-tertiary);
	}

	.meta-item.muted {
		color: var(--text-tertiary);
		opacity: 0.75;
	}

	.meta-new {
		font-size: 0.625rem;
		font-weight: 600;
		color: var(--accent, #6366f1);
	}

	.git {
		font-family: 'IBM Plex Mono', monospace;
	}

	.git-dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--text-tertiary);
	}

	.git.dirty .git-dot {
		background: #f59e0b;
	}

	.project-right {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.25rem;
		flex-shrink: 0;
	}

	.current-badge {
		font-size: 0.5625rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-tertiary);
		flex-shrink: 0;
	}

	.ticket-pill {
		display: inline-flex;
		align-items: baseline;
		gap: 0.25rem;
		padding: 0.125rem 0.4375rem;
		border-radius: 6px;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-subtle);
	}

	.ticket-count {
		font-size: 0.8125rem;
		font-weight: 700;
		color: var(--text-primary);
		font-variant-numeric: tabular-nums;
	}

	.ticket-label {
		font-size: 0.5625rem;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		color: var(--text-tertiary);
	}

	.switcher-footer {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		padding: 0.5rem 0.75rem;
		border-top: 1px solid var(--border-subtle);
	}

	.footer-hint {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.625rem;
		color: var(--text-tertiary);
	}

	.footer-hint kbd {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1rem;
		height: 1rem;
		padding: 0 0.25rem;
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 0.5625rem;
		font-weight: 500;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-default);
		border-radius: 3px;
		color: var(--text-primary);
	}
</style>
