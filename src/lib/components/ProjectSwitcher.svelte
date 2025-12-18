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

	// Sort projects by last access, current project first
	const sortedProjects = $derived(() => {
		const sorted = [...projects].sort((a, b) =>
			new Date(b.lastAccess).getTime() - new Date(a.lastAccess).getTime()
		);
		// Move current project to front
		const currentIdx = sorted.findIndex(p => p.path === currentPath);
		if (currentIdx > 0) {
			const current = sorted.splice(currentIdx, 1)[0];
			sorted.unshift(current);
		}
		return sorted;
	});

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
<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="switcher-overlay" onclick={onclose}>
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="switcher-modal" onclick={(e) => e.stopPropagation()}>
		<div class="switcher-header">
			<span class="header-text">Switch Project</span>
			<kbd class="header-hint">Tab</kbd>
		</div>

		<div class="projects-list">
			{#each sortedProjects() as project, i}
				{@const isCurrent = project.path === currentPath}
				{@const isSelected = i === selectedIndex}
				<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
				<div
					class="project-item"
					class:current={isCurrent}
					class:selected={isSelected}
					style="--project-color: {project.color};"
					onclick={() => selectProject(project, i)}
					role="option"
					aria-selected={isSelected}
				>
					<div class="project-dot"></div>
					<div class="project-info">
						<span class="project-name">{project.name}</span>
						<span class="project-path">{project.path}</span>
					</div>
					{#if isCurrent}
						<span class="current-badge">current</span>
					{/if}
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
		width: 320px;
		max-width: 90vw;
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
		align-items: center;
		gap: 0.625rem;
		padding: 0.5rem 0.625rem;
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
	}

	.project-info {
		display: flex;
		flex-direction: column;
		gap: 0.0625rem;
		min-width: 0;
		flex: 1;
	}

	.project-name {
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.project-path {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.625rem;
		color: var(--text-tertiary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.current-badge {
		font-size: 0.5625rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-tertiary);
		flex-shrink: 0;
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
