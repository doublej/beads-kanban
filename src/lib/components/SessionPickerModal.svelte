<script lang="ts">
	import type { SdkSessionInfo } from '$lib/wsStore.svelte';

	interface Props {
		paneName: string;
		sessions: SdkSessionInfo[];
		loading: boolean;
		onSelect: (sessionId: string) => void;
		onClose: () => void;
	}

	let { paneName, sessions, loading, onSelect, onClose }: Props = $props();

	function formatTimeAgo(timestamp: string): string {
		const diff = Date.now() - new Date(timestamp).getTime();
		const mins = Math.floor(diff / 60000);
		const hours = Math.floor(diff / 3600000);
		const days = Math.floor(diff / 86400000);
		if (mins < 60) return `${mins}m ago`;
		if (hours < 24) return `${hours}h ago`;
		if (days < 7) return `${days}d ago`;
		return new Date(timestamp).toLocaleDateString('en', { month: 'short', day: 'numeric' });
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="session-picker-overlay" onclick={onClose}>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="session-picker-modal" onclick={(e) => e.stopPropagation()}>
		<header class="picker-header">
			<div class="picker-title-row">
				<svg class="picker-icon" viewBox="0 0 16 16" width="16" height="16">
					<circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
					<circle cx="8" cy="8" r="2" fill="currentColor"/>
				</svg>
				<h3>Resume Session</h3>
			</div>
			<span class="picker-agent-name">{paneName}</span>
			<button class="picker-close" onclick={onClose}>
				<svg viewBox="0 0 14 14" width="14" height="14">
					<path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
				</svg>
			</button>
		</header>
		{#if loading}
			<div class="picker-state">
				<span class="spinner"></span>
				<span>Loading sessions...</span>
			</div>
		{:else if sessions.length === 0}
			<div class="picker-state empty">
				<svg class="picker-empty-icon" viewBox="0 0 24 24" width="32" height="32">
					<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.5"/>
				</svg>
				<span>No saved sessions</span>
			</div>
		{:else}
			<div class="picker-list">
				{#each sessions as session, i}
					{@const timeAgo = formatTimeAgo(session.timestamp)}
					{@const isMatch = session.agentName === paneName}
					<button
						class="picker-item"
						class:match={isMatch}
						style="animation-delay: {i * 30}ms"
						onclick={() => onSelect(session.sessionId)}
					>
						<div class="picker-item-main">
							<span class="picker-item-agent" class:match={isMatch}>{session.agentName || 'unnamed'}</span>
							{#if session.summary}
								<span class="picker-item-summary">{session.summary}</span>
							{:else if session.preview.length > 0}
								<span class="picker-item-preview">{session.preview[0].slice(0, 60)}</span>
							{/if}
						</div>
						<div class="picker-item-meta">
							<span class="picker-item-time">{timeAgo}</span>
							<svg class="picker-item-arrow" viewBox="0 0 12 12" width="12" height="12">
								<path d="M3 6h6M6.5 3.5L9 6l-2.5 2.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
							</svg>
						</div>
					</button>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	.session-picker-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.7);
		backdrop-filter: blur(12px);
		z-index: 2000;
		display: flex;
		align-items: center;
		justify-content: center;
		animation: overlayIn 200ms ease-out;
	}

	@keyframes overlayIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.session-picker-modal {
		width: 420px;
		max-height: 70vh;
		background: linear-gradient(180deg, rgba(32, 32, 36, 0.98) 0%, rgba(24, 24, 28, 0.98) 100%);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 16px;
		box-shadow:
			0 0 0 1px rgba(0, 0, 0, 0.3),
			0 24px 64px rgba(0, 0, 0, 0.5),
			0 0 120px rgba(99, 102, 241, 0.08);
		overflow: hidden;
		display: flex;
		flex-direction: column;
		animation: modalIn 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	@keyframes modalIn {
		from { opacity: 0; transform: scale(0.95) translateY(10px); }
		to { opacity: 1; transform: scale(1) translateY(0); }
	}

	.picker-header {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem 1.25rem;
		background: rgba(255, 255, 255, 0.02);
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	}

	.picker-title-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.picker-icon {
		width: 16px;
		height: 16px;
		color: #6366f1;
		opacity: 0.9;
		flex-shrink: 0;
	}

	.picker-header h3 {
		font: 600 13px/1 'Inter', system-ui, sans-serif;
		color: var(--text-primary, #fff);
		margin: 0;
		letter-spacing: -0.01em;
	}

	.picker-agent-name {
		margin-left: auto;
		font: 600 10px/1 'IBM Plex Mono', ui-monospace, monospace;
		color: #818cf8;
		background: rgba(99, 102, 241, 0.15);
		padding: 4px 10px;
		border-radius: 6px;
		letter-spacing: 0.02em;
	}

	.picker-close {
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		background: rgba(255, 255, 255, 0.04);
		color: var(--text-tertiary, #666);
		cursor: pointer;
		border-radius: 8px;
		transition: all 120ms ease;
	}

	.picker-close:hover {
		background: rgba(255, 255, 255, 0.1);
		color: var(--text-primary, #fff);
		transform: rotate(90deg);
	}

	.picker-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: 3rem 2rem;
		font: 500 12px/1.4 'Inter', system-ui, sans-serif;
		color: var(--text-tertiary, #666);
	}

	.picker-state.empty .picker-empty-icon {
		width: 32px;
		height: 32px;
		color: var(--text-tertiary, #666);
		opacity: 0.3;
	}

	.picker-list {
		max-height: 50vh;
		overflow-y: auto;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.picker-list::-webkit-scrollbar { width: 6px; }
	.picker-list::-webkit-scrollbar-track { background: transparent; }
	.picker-list::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 3px; }

	.picker-item {
		display: flex;
		align-items: center;
		gap: 1rem;
		width: 100%;
		padding: 0.875rem 1rem;
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 10px;
		text-align: left;
		cursor: pointer;
		transition: all 150ms ease;
		animation: itemIn 200ms ease-out backwards;
	}

	@keyframes itemIn {
		from { opacity: 0; transform: translateX(-8px); }
		to { opacity: 1; transform: translateX(0); }
	}

	.picker-item:hover {
		background: rgba(99, 102, 241, 0.1);
		border-color: rgba(99, 102, 241, 0.25);
		transform: translateX(4px);
	}

	.picker-item:hover .picker-item-arrow { opacity: 1; transform: translateX(0); }

	.picker-item.match { border-color: rgba(34, 197, 94, 0.3); background: rgba(34, 197, 94, 0.06); }
	.picker-item.match:hover { background: rgba(34, 197, 94, 0.12); border-color: rgba(34, 197, 94, 0.4); }

	.picker-item-main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.picker-item-agent {
		font: 600 12px/1 'IBM Plex Mono', ui-monospace, monospace;
		color: var(--text-primary, #fff);
		letter-spacing: -0.01em;
	}

	.picker-item-agent.match { color: #22c55e; }

	.picker-item-summary,
	.picker-item-preview {
		font: 400 11px/1.3 'Inter', system-ui, sans-serif;
		color: var(--text-secondary, #888);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.picker-item-summary { color: rgba(129, 140, 248, 0.9); }

	.picker-item-meta {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-shrink: 0;
	}

	.picker-item-time {
		font: 500 10px/1 'IBM Plex Mono', monospace;
		color: var(--text-tertiary, #666);
		white-space: nowrap;
	}

	.picker-item-arrow {
		width: 12px;
		height: 12px;
		color: var(--text-tertiary, #666);
		opacity: 0;
		transform: translateX(-4px);
		transition: all 150ms ease;
		flex-shrink: 0;
	}

	.spinner {
		width: 10px;
		height: 10px;
		border: 1.5px solid currentColor;
		border-top-color: transparent;
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	@keyframes spin { to { transform: rotate(360deg); } }

	:global(.app.light) .session-picker-modal {
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(250, 250, 252, 0.98) 100%);
		border-color: rgba(0, 0, 0, 0.1);
		box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.05), 0 24px 64px rgba(0, 0, 0, 0.15);
	}

	:global(.app.light) .picker-header { background: rgba(0, 0, 0, 0.02); border-bottom-color: rgba(0, 0, 0, 0.06); }
	:global(.app.light) .picker-item { background: rgba(0, 0, 0, 0.02); border-color: rgba(0, 0, 0, 0.06); }
	:global(.app.light) .picker-item:hover { background: rgba(99, 102, 241, 0.08); border-color: rgba(99, 102, 241, 0.2); }

	/* Legacy styles */
	.session-picker-modal :global(.session-card-transcript) {
		display: flex;
		flex-direction: column;
		gap: 1px;
		margin-bottom: 0.25rem;
		max-height: 120px;
		overflow: hidden;
	}

	.session-picker-modal :global(.transcript-line) {
		font: 8px/1.35 'IBM Plex Mono', ui-monospace, monospace;
		color: var(--text-secondary, #aaa);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		padding: 1px 0;
		opacity: 0.8;
	}

	.session-picker-modal :global(.transcript-line.assistant) {
		color: var(--text-tertiary, #666);
		opacity: 0.6;
		padding-left: 6px;
	}

	.session-picker-modal :global(.transcript-line.empty) {
		color: var(--text-tertiary, #666);
		font-style: italic;
		opacity: 0.5;
	}

	.session-picker-modal :global(.session-card-footer) {
		display: flex;
		justify-content: flex-end;
		margin-top: 0.25rem;
		padding-top: 0.25rem;
		border-top: 1px solid rgba(255, 255, 255, 0.04);
	}

	.session-picker-modal :global(.session-card-id) {
		font: 7px/1 'IBM Plex Mono', ui-monospace, monospace;
		color: var(--text-tertiary, #666);
		opacity: 0.4;
	}
</style>
