<script lang="ts">
	import type { Pane, SdkSessionInfo } from '$lib/wsStore.svelte';

	interface Props {
		pane: Pane;
		isAutoscrollEnabled: boolean;
		onToggleAutoscroll: () => void;
		onContinueSession?: (name: string) => void;
		onCompactSession?: (name: string) => void;
		onEndSession?: (name: string) => void;
		onClearSession?: (name: string) => void;
		onRemovePane: (name: string) => void;
		onFetchSessions?: () => Promise<SdkSessionInfo[]>;
		onOpenSessionPicker: () => void;
		onClose: () => void;
	}

	let {
		pane,
		isAutoscrollEnabled,
		onToggleAutoscroll,
		onContinueSession,
		onCompactSession,
		onEndSession,
		onClearSession,
		onRemovePane,
		onFetchSessions,
		onOpenSessionPicker,
		onClose
	}: Props = $props();
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="menu-dropdown" onclick={(e) => e.stopPropagation()}>
	<div class="menu-section">
		<span class="menu-label">Session</span>
		<button class="menu-item" class:active={isAutoscrollEnabled} onclick={(e) => { e.stopPropagation(); onToggleAutoscroll(); }}>
			<svg class="menu-icon" viewBox="0 0 14 14" width="12" height="12">
				{#if isAutoscrollEnabled}
					<path d="M7 2v10M4 9l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
				{:else}
					<path d="M7 12V2M4 5l3-3 3 3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
				{/if}
			</svg>
			<span>Autoscroll</span>
			{#if isAutoscrollEnabled}<span class="menu-badge">on</span>{/if}
		</button>
		{#if !pane.streaming && onContinueSession}
			<button class="menu-item" onclick={() => { onContinueSession(pane.name); onClose(); }}>
				<svg class="menu-icon" viewBox="0 0 14 14" width="12" height="12">
					<path d="M4 2.5v9l7-4.5-7-4.5z" fill="currentColor"/>
				</svg>
				<span>Continue</span>
			</button>
		{/if}
		{#if onFetchSessions}
			<button class="menu-item" onclick={onOpenSessionPicker}>
				<svg class="menu-icon" viewBox="0 0 14 14" width="12" height="12">
					<path d="M2.5 7a4.5 4.5 0 018-2.5M11.5 7a4.5 4.5 0 01-8 2.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
					<path d="M10.5 2v3h-3M3.5 12V9h3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
				<span>Load Session</span>
			</button>
		{/if}
		{#if onCompactSession}
			<button class="menu-item" class:active={pane.compacted} onclick={() => { onCompactSession(pane.name); onClose(); }}>
				<svg class="menu-icon" viewBox="0 0 14 14" width="12" height="12">
					<circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" stroke-width="1.3"/>
					<path d="M7 2a5 5 0 010 10" fill="currentColor"/>
				</svg>
				<span>Compact</span>
				{#if pane.compacted}<span class="menu-badge">done</span>{/if}
			</button>
		{/if}
		{#if onEndSession}
			<button class="menu-item" onclick={() => { onEndSession(pane.name); onClose(); }}>
				<svg class="menu-icon" viewBox="0 0 14 14" width="12" height="12">
					<rect x="3" y="3" width="8" height="8" rx="1" fill="currentColor"/>
				</svg>
				<span>End</span>
			</button>
		{/if}
		{#if onClearSession}
			<button class="menu-item danger" onclick={() => { onClearSession(pane.name); onClose(); }}>
				<svg class="menu-icon" viewBox="0 0 14 14" width="12" height="12">
					<path d="M3 4h8M5 4V3a1 1 0 011-1h2a1 1 0 011 1v1M6 6.5v4M8 6.5v4M4.5 4l.5 8a1 1 0 001 1h4a1 1 0 001-1l.5-8" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
				<span>Clear</span>
			</button>
		{/if}
	</div>
	<div class="menu-divider"></div>
	<button class="menu-item danger" onclick={() => { onRemovePane(pane.name); onClose(); }}>
		<svg class="menu-icon" viewBox="0 0 14 14" width="12" height="12">
			<path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
		</svg>
		<span>Close</span>
	</button>
</div>

<style>
	.menu-dropdown {
		position: absolute;
		top: 100%;
		right: 0;
		margin-top: 4px;
		min-width: 160px;
		background: var(--bg-secondary, #1a1a1e);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 6px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
		z-index: 100;
		overflow: hidden;
		animation: menuSlide 100ms ease;
	}

	@keyframes menuSlide {
		from { opacity: 0; transform: translateY(-4px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.menu-section { padding: 4px; }

	.menu-label {
		display: block;
		padding: 4px 8px 6px;
		font: 600 9px/1 'IBM Plex Mono', monospace;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-tertiary);
		opacity: 0.7;
	}

	.menu-item {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 6px 8px;
		background: transparent;
		border: none;
		border-radius: 4px;
		font: 400 11px/1 'IBM Plex Mono', monospace;
		color: var(--text-primary);
		cursor: pointer;
		transition: background 60ms ease;
		text-align: left;
	}

	.menu-item:hover { background: rgba(255, 255, 255, 0.08); }
	.menu-item.active { color: #10b981; }
	.menu-item.danger:hover { background: rgba(239, 68, 68, 0.15); color: #ef4444; }

	.menu-icon {
		width: 14px;
		text-align: center;
		font-size: 10px;
		opacity: 0.7;
	}

	.menu-badge {
		margin-left: auto;
		font: 500 8px/1 'IBM Plex Mono', monospace;
		text-transform: uppercase;
		padding: 2px 4px;
		border-radius: 2px;
		background: rgba(16, 185, 129, 0.2);
		color: #10b981;
	}

	.menu-divider {
		height: 1px;
		background: rgba(255, 255, 255, 0.06);
		margin: 2px 0;
	}

	:global(.app.light) .menu-dropdown {
		background: var(--surface-elevated);
		border-color: var(--border-default);
		box-shadow: var(--shadow-lg);
	}

	:global(.app.light) .menu-item:hover { background: rgba(60, 70, 80, 0.08); }
</style>
