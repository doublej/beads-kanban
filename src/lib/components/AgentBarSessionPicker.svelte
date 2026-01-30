<script lang="ts">
	import type { SdkSessionInfo } from '$lib/wsStore.svelte';

	interface Props {
		show: boolean;
		loading: boolean;
		filteredSessions: SdkSessionInfo[];
		searchedSessions: () => SdkSessionInfo[];
		sessionSearchQuery: string;
		onclose: () => void;
		onsearch: (query: string) => void;
		onselect: (session: SdkSessionInfo) => void;
	}

	let {
		show,
		loading,
		filteredSessions,
		searchedSessions,
		sessionSearchQuery,
		onclose,
		onsearch,
		onselect
	}: Props = $props();

	function formatTimeAgo(timestamp: string): string {
		const diff = Date.now() - new Date(timestamp).getTime();
		const mins = Math.floor(diff / 60000);
		const hours = Math.floor(diff / 3600000);
		const days = Math.floor(diff / 86400000);
		if (mins < 60) return `${mins}m`;
		if (hours < 24) return `${hours}h`;
		if (days < 7) return `${days}d`;
		return new Date(timestamp).toLocaleDateString('en', { month: 'short', day: 'numeric' });
	}
</script>

{#if show}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="session-picker-overlay" onclick={onclose}>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="session-picker-modal" onclick={(e) => e.stopPropagation()}>
			<header class="picker-header">
				<div class="picker-title-row">
					<svg viewBox="0 0 16 16" width="16" height="16" class="picker-icon">
						<path d="M3 8a5 5 0 019-2M13 8a5 5 0 01-9 2" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
						<path d="M12 3v3h-3M4 13v-3h3" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
					<h3>Load Session</h3>
				</div>
				<div class="picker-search-row">
					<svg viewBox="0 0 16 16" width="12" height="12" class="search-icon">
						<circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.2"/>
						<path d="M10.5 10.5l3 3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
					</svg>
					<input
						type="text"
						class="picker-search"
						placeholder="Search sessions..."
						value={sessionSearchQuery}
						oninput={(e) => onsearch(e.currentTarget.value)}
					/>
					<span class="picker-count">{searchedSessions().length}</span>
				</div>
				<button class="cta cta-icon danger picker-close-override" onclick={onclose}>
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
			{:else if filteredSessions.length === 0}
				<div class="picker-state empty">
					<svg viewBox="0 0 24 24" width="24" height="24" class="empty-icon">
						<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.5"/>
						<path d="M12 8v4M12 15v1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
					</svg>
					<span>No saved sessions</span>
				</div>
			{:else if searchedSessions().length === 0}
				<div class="picker-state empty">
					<span>No matches for "{sessionSearchQuery}"</span>
				</div>
			{:else}
				<div class="picker-list">
					{#each searchedSessions() as session, i}
						{@const timeAgo = formatTimeAgo(session.timestamp)}
						<button
							class="picker-item"
							style="animation-delay: {i * 25}ms"
							onclick={() => onselect(session)}
						>
							<div class="picker-item-main">
								<span class="picker-item-name">{session.agentName || 'unnamed'}</span>
								{#if session.summary}
									<span class="picker-item-summary">{session.summary}</span>
								{:else if session.preview.length > 0}
									<span class="picker-item-preview">{session.preview[0].slice(0, 50)}</span>
								{/if}
							</div>
							<div class="picker-item-meta">
								<span class="picker-item-time">{timeAgo}</span>
								<svg viewBox="0 0 16 16" width="12" height="12" class="picker-arrow">
									<path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
								</svg>
							</div>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.session-picker-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 10001;
		animation: overlayIn 150ms ease-out;
	}

	@keyframes overlayIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.session-picker-modal {
		width: 400px;
		max-width: 90vw;
		max-height: 80vh;
		background: var(--bg-secondary, #1a1a1f);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 12px;
		box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05);
		overflow: hidden;
		display: flex;
		flex-direction: column;
		animation: modalIn 200ms cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	@keyframes modalIn {
		from { opacity: 0; transform: scale(0.92) translateY(20px); }
		to { opacity: 1; transform: scale(1) translateY(0); }
	}

	.picker-header {
		display: grid;
		grid-template-columns: 1fr auto;
		grid-template-rows: auto auto;
		gap: 10px;
		padding: 16px;
		background: rgba(255, 255, 255, 0.02);
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	}

	.picker-title-row {
		display: flex;
		align-items: center;
		gap: 10px;
		grid-column: 1;
	}

	.picker-title-row h3 {
		font: 600 14px/1 system-ui;
		color: var(--text-primary);
		margin: 0;
	}

	.picker-icon { color: rgba(99, 102, 241, 0.8); }

	.picker-close-override {
		grid-column: 2;
		grid-row: 1;
		width: 28px;
		height: 28px;
	}

	.picker-search-row {
		grid-column: 1 / -1;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		background: rgba(255, 255, 255, 0.04);
		border-radius: 6px;
	}

	.search-icon {
		color: var(--text-tertiary);
		flex-shrink: 0;
	}

	.picker-search {
		flex: 1;
		padding: 0;
		font: 12px/1 'IBM Plex Mono', ui-monospace, monospace;
		background: transparent;
		border: none;
		color: var(--text-primary);
	}

	.picker-search:focus { outline: none; }
	.picker-search::placeholder { color: var(--text-tertiary); }

	.picker-count {
		font: 600 10px/1 'IBM Plex Mono', monospace;
		color: rgba(99, 102, 241, 0.8);
		background: rgba(99, 102, 241, 0.15);
		padding: 3px 8px;
		border-radius: 10px;
	}

	.picker-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12px;
		padding: 48px 24px;
		color: var(--text-tertiary);
		font: 12px/1.4 system-ui;
	}

	.picker-state .spinner {
		width: 20px;
		height: 20px;
		border: 2px solid rgba(99, 102, 241, 0.2);
		border-top-color: rgba(99, 102, 241, 0.8);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin { to { transform: rotate(360deg); } }

	.picker-state.empty .empty-icon {
		color: var(--text-tertiary);
		opacity: 0.5;
	}

	.picker-list {
		flex: 1;
		overflow-y: auto;
		padding: 8px;
	}

	.picker-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: 12px 14px;
		margin-bottom: 4px;
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid rgba(255, 255, 255, 0.04);
		border-radius: 8px;
		cursor: pointer;
		transition: all 100ms ease;
		animation: itemIn 150ms ease-out backwards;
	}

	@keyframes itemIn {
		from { opacity: 0; transform: translateY(8px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.picker-item:hover {
		background: rgba(99, 102, 241, 0.1);
		border-color: rgba(99, 102, 241, 0.25);
		transform: translateX(2px);
	}

	.picker-item:last-child { margin-bottom: 0; }

	.picker-item-main {
		display: flex;
		flex-direction: column;
		gap: 4px;
		text-align: left;
		min-width: 0;
	}

	.picker-item-name {
		font: 600 12px/1 'IBM Plex Mono', ui-monospace, monospace;
		color: var(--text-primary);
	}

	.picker-item-summary {
		font: 400 10px/1.3 system-ui;
		color: rgba(99, 102, 241, 0.8);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 280px;
	}

	.picker-item-preview {
		font: 400 10px/1.3 'IBM Plex Mono', monospace;
		color: var(--text-tertiary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 280px;
	}

	.picker-item-meta {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-shrink: 0;
	}

	.picker-item-time {
		font: 500 10px/1 'IBM Plex Mono', monospace;
		color: var(--text-tertiary);
		background: rgba(255, 255, 255, 0.05);
		padding: 3px 6px;
		border-radius: 4px;
	}

	.picker-arrow {
		color: var(--text-tertiary);
		opacity: 0;
		transition: all 100ms ease;
	}

	.picker-item:hover .picker-arrow {
		opacity: 1;
		transform: translateX(2px);
		color: rgba(99, 102, 241, 0.8);
	}

	:global(.app.light) .session-picker-overlay { background: rgba(0, 0, 0, 0.4); }

	:global(.app.light) .session-picker-modal {
		background: var(--surface-elevated);
		border-color: var(--border-default);
		box-shadow: var(--shadow-elevated);
	}

	:global(.app.light) .picker-header {
		background: rgba(60, 70, 80, 0.04);
		border-color: var(--border-subtle);
	}

	:global(.app.light) .picker-search-row { background: rgba(60, 70, 80, 0.03); }

	:global(.app.light) .picker-item {
		background: rgba(60, 70, 80, 0.02);
		border-color: rgba(60, 70, 80, 0.06);
	}

	:global(.app.light) .picker-item:hover { background: rgba(79, 107, 143, 0.10); }
</style>
