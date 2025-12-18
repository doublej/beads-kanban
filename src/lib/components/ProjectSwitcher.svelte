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

		<div class="projects-stack">
			{#each sortedProjects() as project, i}
				{@const isCurrent = project.path === currentPath}
				{@const isSelected = i === selectedIndex}
				<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
				<div
					class="project-card"
					class:current={isCurrent}
					class:selected={isSelected}
					style="--project-color: {project.color}; --index: {i};"
					onclick={() => selectProject(project, i)}
					role="option"
					aria-selected={isSelected}
				>
					<div class="card-color-bar"></div>
					<div class="card-content">
						<div class="project-icon" style="background: {project.color}">
							{project.name.charAt(0).toUpperCase()}
						</div>
						<div class="project-info">
							<span class="project-name">{project.name}</span>
							<span class="project-path">{project.path}</span>
						</div>
						{#if isCurrent}
							<span class="current-badge">Current</span>
						{/if}
					</div>
					{#if isSelected}
						<div class="selection-glow"></div>
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
		background: transparent;
		animation: overlayIn 150ms ease-out;
	}

	@keyframes overlayIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.switcher-modal {
		width: 420px;
		max-width: 90vw;
		max-height: 80vh;
		background: linear-gradient(
			145deg,
			rgba(45, 45, 55, 0.98) 0%,
			rgba(30, 30, 38, 0.98) 100%
		);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 20px;
		box-shadow:
			0 25px 50px rgba(0, 0, 0, 0.5),
			0 0 0 1px rgba(255, 255, 255, 0.05),
			inset 0 1px 0 rgba(255, 255, 255, 0.08);
		overflow: hidden;
		animation: modalIn 200ms cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	:global(.app.light) .switcher-modal {
		background: linear-gradient(
			145deg,
			rgba(255, 255, 255, 0.98) 0%,
			rgba(245, 245, 250, 0.98) 100%
		);
		border-color: rgba(0, 0, 0, 0.1);
	}

	@keyframes modalIn {
		from {
			opacity: 0;
			transform: scale(0.9) translateY(-20px);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}

	.switcher-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 1rem 1.25rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
		background: rgba(255, 255, 255, 0.02);
	}

	:global(.app.light) .switcher-header {
		border-bottom-color: rgba(0, 0, 0, 0.06);
		background: rgba(0, 0, 0, 0.02);
	}

	.header-text {
		font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif;
		font-size: 0.9375rem;
		font-weight: 700;
		letter-spacing: -0.01em;
		color: var(--text-primary);
	}

	.header-hint {
		margin-left: auto;
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 0.625rem;
		padding: 0.25rem 0.5rem;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 6px;
		color: var(--text-tertiary);
	}

	:global(.app.light) .header-hint {
		background: rgba(0, 0, 0, 0.04);
		border-color: rgba(0, 0, 0, 0.08);
	}

	.projects-stack {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding: 0.75rem;
		max-height: 400px;
		overflow-y: auto;
	}

	.project-card {
		position: relative;
		display: flex;
		align-items: center;
		padding: 0;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 12px;
		cursor: pointer;
		transition: all 180ms cubic-bezier(0.34, 1.56, 0.64, 1);
		overflow: hidden;
	}

	:global(.app.light) .project-card {
		background: rgba(0, 0, 0, 0.02);
		border-color: rgba(0, 0, 0, 0.06);
	}

	.project-card:hover {
		background: rgba(255, 255, 255, 0.06);
		border-color: rgba(255, 255, 255, 0.1);
	}

	:global(.app.light) .project-card:hover {
		background: rgba(0, 0, 0, 0.04);
		border-color: rgba(0, 0, 0, 0.1);
	}

	.project-card.selected {
		background: rgba(var(--project-color-rgb, 99, 102, 241), 0.12);
		border-color: var(--project-color);
		box-shadow:
			0 4px 16px rgba(0, 0, 0, 0.2),
			0 0 0 1px var(--project-color),
			inset 0 0 20px rgba(var(--project-color-rgb, 99, 102, 241), 0.05);
	}

	.project-card.current {
		opacity: 0.6;
	}

	.project-card.current.selected {
		opacity: 1;
	}

	.card-color-bar {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 4px;
		background: var(--project-color);
		border-radius: 2px 0 0 2px;
		transition: width 180ms ease;
	}

	.project-card.selected .card-color-bar {
		width: 6px;
	}

	.card-content {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem 0.75rem 1.25rem;
		flex: 1;
		min-width: 0;
	}

	.project-icon {
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 10px;
		font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif;
		font-size: 1rem;
		font-weight: 800;
		color: white;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
		flex-shrink: 0;
		box-shadow:
			0 2px 8px rgba(0, 0, 0, 0.2),
			inset 0 1px 0 rgba(255, 255, 255, 0.2);
	}

	.project-info {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		min-width: 0;
		flex: 1;
	}

	.project-name {
		font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.project-path {
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 0.6875rem;
		color: var(--text-tertiary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.current-badge {
		padding: 0.25rem 0.5rem;
		background: rgba(255, 255, 255, 0.08);
		border-radius: 6px;
		font-size: 0.625rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-tertiary);
		flex-shrink: 0;
	}

	:global(.app.light) .current-badge {
		background: rgba(0, 0, 0, 0.06);
	}

	.selection-glow {
		position: absolute;
		inset: -1px;
		border-radius: 13px;
		background: linear-gradient(
			90deg,
			transparent 0%,
			var(--project-color) 50%,
			transparent 100%
		);
		opacity: 0.15;
		pointer-events: none;
		animation: glowPulse 2s ease-in-out infinite;
	}

	@keyframes glowPulse {
		0%, 100% { opacity: 0.1; }
		50% { opacity: 0.2; }
	}

	.switcher-footer {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1.5rem;
		padding: 0.75rem 1rem;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
		background: rgba(0, 0, 0, 0.1);
	}

	:global(.app.light) .switcher-footer {
		border-top-color: rgba(0, 0, 0, 0.06);
		background: rgba(0, 0, 0, 0.02);
	}

	.footer-hint {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.6875rem;
		color: var(--text-tertiary);
	}

	.footer-hint kbd {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.25rem;
		height: 1.25rem;
		padding: 0 0.375rem;
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 0.5625rem;
		font-weight: 500;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 4px;
		color: var(--text-secondary);
	}

	:global(.app.light) .footer-hint kbd {
		background: rgba(0, 0, 0, 0.04);
		border-color: rgba(0, 0, 0, 0.1);
	}
</style>
