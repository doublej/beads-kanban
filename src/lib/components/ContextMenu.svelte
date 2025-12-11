<script lang="ts">
	import type { Issue } from '$lib/types';
	import { getPriorityConfig } from '$lib/utils';

	interface Props {
		x: number;
		y: number;
		issue: Issue;
		onSetPriority: (priority: number) => void;
		onStartRopeDrag: (e: MouseEvent) => void;
		onClose: () => void;
	}

	let { x, y, issue, onSetPriority, onStartRopeDrag, onClose }: Props = $props();
</script>

<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
<div
	class="context-menu"
	role="menu"
	style="left: {x}px; top: {y}px"
	onclick={(e) => e.stopPropagation()}
>
	<div class="context-menu-section">
		<span class="context-menu-label">Priority</span>
		<div class="context-menu-options">
			<button class="context-option" class:active={issue.priority === 0} onclick={() => onSetPriority(0)}>
				<span class="priority-dot" style="background: #ef4444"></span>Critical
			</button>
			<button class="context-option" class:active={issue.priority === 1} onclick={() => onSetPriority(1)}>
				<span class="priority-dot" style="background: #f59e0b"></span>High
			</button>
			<button class="context-option" class:active={issue.priority === 2} onclick={() => onSetPriority(2)}>
				<span class="priority-dot" style="background: #6366f1"></span>Medium
			</button>
			<button class="context-option" class:active={issue.priority === 3} onclick={() => onSetPriority(3)}>
				<span class="priority-dot" style="background: #10b981"></span>Low
			</button>
			<button class="context-option" class:active={issue.priority === 4} onclick={() => onSetPriority(4)}>
				<span class="priority-dot" style="background: #6b7280"></span>Backlog
			</button>
		</div>
	</div>
	<div class="context-menu-divider"></div>
	<div class="context-menu-section">
		<span class="context-menu-label">Link</span>
		<div
			class="rope-handle"
			onmousedown={onStartRopeDrag}
		>
			<svg class="rope-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
				<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
			</svg>
			<span>Drag to link</span>
			<span class="rope-tip">⟡</span>
		</div>
	</div>
</div>

<style>
	.context-menu {
		position: fixed;
		z-index: 1000;
		background: var(--bg-secondary);
		border: none;
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
		padding: 0.5rem;
		min-width: 180px;
		backdrop-filter: saturate(180%) blur(20px);
		-webkit-backdrop-filter: saturate(180%) blur(20px);
		animation: contextMenuIn 200ms cubic-bezier(0.25, 0.1, 0.25, 1);
		transform-origin: top left;
	}

	@keyframes contextMenuIn {
		0% {
			opacity: 0;
			transform: scale(0.95);
		}
		100% {
			opacity: 1;
			transform: scale(1);
		}
	}

	.context-menu-section {
		padding: 0.25rem 0;
	}

	.context-menu-label {
		display: block;
		font-size: 0.625rem;
		font-weight: 600;
		color: var(--text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 0.25rem 0.5rem;
	}

	.context-menu-options {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.context-option {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.375rem 0.5rem;
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		font-size: 0.75rem;
		cursor: pointer;
		transition: all var(--transition-fast);
		text-align: left;
	}

	.context-option:hover {
		background: var(--bg-elevated);
		color: var(--text-primary);
	}

	.context-option.active {
		background: var(--accent-glow);
		color: var(--accent-primary);
	}

	.context-menu-divider {
		height: 1px;
		background: var(--border-subtle);
		margin: 0.375rem 0;
	}

	:global(.app.light) .context-menu {
		background: rgba(255, 255, 255, 0.92);
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15), 0 0 0 0.5px rgba(0, 0, 0, 0.08);
	}

	:global(.app.light) .context-option:hover {
		background: rgba(0, 0, 0, 0.04);
	}

	:global(.app.light) .context-option.active {
		background: rgba(0, 122, 255, 0.12);
	}

	.rope-handle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.625rem;
		background: linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(16, 185, 129, 0.15) 100%);
		border: 1px dashed rgba(99, 102, 241, 0.3);
		border-radius: var(--radius-md);
		cursor: grab;
		transition: all 0.2s ease;
		color: var(--text-secondary);
		font-size: 0.75rem;
	}

	.rope-handle:hover {
		background: linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(16, 185, 129, 0.25) 100%);
		border-color: rgba(99, 102, 241, 0.5);
		color: var(--text-primary);
	}

	.rope-handle:active {
		cursor: grabbing;
		transform: scale(0.98);
	}

	.rope-icon {
		width: 16px;
		height: 16px;
		color: #6366f1;
	}

	.rope-tip {
		margin-left: auto;
		font-size: 0.875rem;
		color: #10b981;
		animation: ropeTipPulse 1.5s ease-in-out infinite;
	}

	@keyframes ropeTipPulse {
		0%, 100% { opacity: 0.6; transform: scale(1); }
		50% { opacity: 1; transform: scale(1.2); }
	}

	.priority-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}
</style>
