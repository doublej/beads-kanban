<script lang="ts">
	import type { Pane, SdkSessionInfo } from '$lib/wsStore.svelte';
	import AgentPaneMenu from './AgentPaneMenu.svelte';

	interface Props {
		pane: Pane;
		ticketId: string | null;
		isMenuOpen: boolean;
		isAutoscrollEnabled: boolean;
		onStartDrag: (e: MouseEvent) => void;
		onRemovePane: (name: string) => void;
		onMinimizePane: (name: string) => void;
		onCyclePaneSize: (name: string) => void;
		onToggleMenu: () => void;
		onCloseMenu: () => void;
		onToggleAutoscroll: () => void;
		onOpenTicket?: (ticketId: string) => void;
		onContinueSession?: (name: string) => void;
		onCompactSession?: (name: string) => void;
		onEndSession?: (name: string) => void;
		onClearSession?: (name: string) => void;
		onFetchSessions?: () => Promise<SdkSessionInfo[]>;
		onOpenSessionPicker: () => void;
	}

	let {
		pane,
		ticketId,
		isMenuOpen,
		isAutoscrollEnabled,
		onStartDrag,
		onRemovePane,
		onMinimizePane,
		onCyclePaneSize,
		onToggleMenu,
		onCloseMenu,
		onToggleAutoscroll,
		onOpenTicket,
		onContinueSession,
		onCompactSession,
		onEndSession,
		onClearSession,
		onFetchSessions,
		onOpenSessionPicker
	}: Props = $props();
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="window-header" onmousedown={onStartDrag}>
	<!-- Traffic light controls (left) -->
	<div class="traffic-lights">
		<button class="traffic-btn close" onclick={(e) => { e.stopPropagation(); onRemovePane(pane.name); }} title="Close"></button>
		<button class="traffic-btn minimize" onclick={(e) => { e.stopPropagation(); onMinimizePane(pane.name); }} title="Minimize"></button>
		<button class="traffic-btn zoom" onclick={(e) => { e.stopPropagation(); onCyclePaneSize(pane.name); }} title="Zoom"></button>
	</div>

	<!-- Centered title -->
	<div class="window-title-center">
		{#if ticketId && onOpenTicket}
			<button
				class="ticket-link"
				onclick={(e) => { e.stopPropagation(); onOpenTicket(ticketId); }}
				title="Open ticket {ticketId}"
			>
				<svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor">
					<path d="M2 2.5A2.5 2.5 0 014.5 0h7A2.5 2.5 0 0114 2.5v11a2.5 2.5 0 01-2.5 2.5h-7A2.5 2.5 0 012 13.5v-11zM4.5 1A1.5 1.5 0 003 2.5v11A1.5 1.5 0 004.5 15h7a1.5 1.5 0 001.5-1.5v-11A1.5 1.5 0 0011.5 1h-7z"/>
					<path d="M5 4h6v1H5V4zm0 2.5h6v1H5v-1zm0 2.5h4v1H5V9z"/>
				</svg>
				<span>{ticketId}</span>
			</button>
		{:else}
			<span class="agent-name">{pane.name}</span>
		{/if}
		{#if pane.sdkSessionId}
			<span class="session-id" class:compacted={pane.compacted} title="{pane.sdkSessionId}&#10;{pane.cwd || 'no cwd'}">
				{pane.sdkSessionId.slice(0, 6)}
			</span>
		{/if}
		{#if pane.usage}
			{@const total = pane.usage.inputTokens + pane.usage.outputTokens}
			{@const cached = pane.usage.cacheRead}
			{@const maxContext = 200000}
			{@const usedPct = Math.min(100, (total / maxContext) * 100)}
			{@const remainPct = 100 - usedPct}
			{@const cachePct = total > 0 ? Math.round((cached / total) * 100) : 0}
			{@const level = remainPct > 66 ? 'low' : remainPct > 33 ? 'mid' : remainPct > 15 ? 'high' : 'critical'}
			<div
				class="context-meter {level}"
				title="Remaining: {(maxContext - total).toLocaleString()} tokens ({remainPct.toFixed(1)}%)&#10;Used: {total.toLocaleString()} / {maxContext.toLocaleString()}&#10;Input: {pane.usage.inputTokens.toLocaleString()}&#10;Output: {pane.usage.outputTokens.toLocaleString()}&#10;Cache: {cached.toLocaleString()} ({cachePct}%)"
			>
				<svg viewBox="0 0 28 14" width="28" height="14">
					<rect x="1" y="2" width="22" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.2"/>
					<rect x="23" y="5" width="3" height="4" rx="1" fill="currentColor" opacity="0.5"/>
					<rect x="3" y="4" width="{Math.max(0, (remainPct / 100) * 18)}" height="6" rx="1" fill="currentColor"/>
					<line x1="8" y1="4" x2="8" y2="10" stroke="var(--meter-bg)" stroke-width="0.8"/>
					<line x1="13" y1="4" x2="13" y2="10" stroke="var(--meter-bg)" stroke-width="0.8"/>
					<line x1="18" y1="4" x2="18" y2="10" stroke="var(--meter-bg)" stroke-width="0.8"/>
				</svg>
				<span class="meter-label">{total >= 1000 ? `${(total / 1000).toFixed(0)}k` : total}</span>
			</div>
		{/if}
	</div>

	<!-- Actions menu (right) -->
	<div class="window-actions">
		<div class="menu-container">
			<button
				class="menu-trigger"
				class:active={isMenuOpen}
				onclick={(e) => { e.stopPropagation(); onToggleMenu(); }}
			>
				<svg viewBox="0 0 16 16" width="12" height="12">
					<circle cx="8" cy="3" r="1.2" fill="currentColor"/>
					<circle cx="8" cy="8" r="1.2" fill="currentColor"/>
					<circle cx="8" cy="13" r="1.2" fill="currentColor"/>
				</svg>
			</button>
			{#if isMenuOpen}
				<AgentPaneMenu
					{pane}
					{isAutoscrollEnabled}
					{onToggleAutoscroll}
					{onContinueSession}
					{onCompactSession}
					{onEndSession}
					{onClearSession}
					{onRemovePane}
					{onFetchSessions}
					{onOpenSessionPicker}
					onClose={onCloseMenu}
				/>
			{/if}
		</div>
	</div>
</div>

<style>
	.window-header {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		padding: 0 0.5rem;
		height: 28px;
		background: rgba(255, 255, 255, 0.025);
		border-bottom: 1px solid rgba(255, 255, 255, 0.04);
		cursor: grab;
		user-select: none;
		flex-shrink: 0;
	}

	:global(.agent-window.dragging) .window-header { cursor: grabbing; }

	:global(.app.light) .window-header {
		background: rgba(0, 0, 0, 0.02);
		border-bottom-color: rgba(0, 0, 0, 0.06);
	}

	/* Traffic lights */
	.traffic-lights { display: flex; gap: 6px; padding: 0 2px; }

	.traffic-btn {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		border: none;
		cursor: pointer;
		transition: filter 120ms ease;
		position: relative;
	}

	.traffic-btn::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: 50%;
		opacity: 0;
		transition: opacity 80ms ease;
	}

	.traffic-btn:hover::after { opacity: 1; }

	.traffic-btn.close { background: #ff5f57; }
	.traffic-btn.close::after { background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'%3E%3Cpath d='M3 3l4 4M7 3l-4 4' stroke='%23730000' stroke-width='1.2' stroke-linecap='round'/%3E%3C/svg%3E") center/6px no-repeat; }

	.traffic-btn.minimize { background: #febc2e; }
	.traffic-btn.minimize::after { background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'%3E%3Cpath d='M2.5 5h5' stroke='%23985700' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E") center/6px no-repeat; }

	.traffic-btn.zoom { background: #28c840; }
	.traffic-btn.zoom::after { background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'%3E%3Cpath d='M2.5 5h5M5 2.5v5' stroke='%23006500' stroke-width='1.2' stroke-linecap='round'/%3E%3C/svg%3E") center/6px no-repeat; }

	/* Inactive state */
	:global(.agent-window):not(:hover) .traffic-btn { background: rgba(255, 255, 255, 0.12); }
	:global(.agent-window):not(:hover) .traffic-btn::after { opacity: 0 !important; }
	:global(.app.light) :global(.agent-window):not(:hover) .traffic-btn { background: rgba(0, 0, 0, 0.08); }

	/* Title center */
	.window-title-center {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		overflow: hidden;
	}

	.agent-name {
		font: 500 11px/1 -apple-system, BlinkMacSystemFont, system-ui;
		color: var(--text-secondary, #888);
		letter-spacing: -0.01em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.ticket-link {
		display: flex;
		align-items: center;
		gap: 4px;
		height: 20px;
		padding: 0 8px;
		background: rgba(99, 102, 241, 0.1);
		border: none;
		border-radius: 4px;
		font: 600 9px/1 'IBM Plex Mono', ui-monospace, monospace;
		letter-spacing: 0.02em;
		color: #6366f1;
		cursor: pointer;
		transition: background 0.15s ease;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 160px;
	}

	.ticket-link:hover { background: rgba(99, 102, 241, 0.18); }
	.ticket-link svg { flex-shrink: 0; opacity: 0.7; }

	:global(.app.light) .ticket-link { background: rgba(99, 102, 241, 0.08); color: #4f46e5; }
	:global(.app.light) .ticket-link:hover { background: rgba(99, 102, 241, 0.15); }

	.session-id {
		font: 500 8px/1 'IBM Plex Mono', monospace;
		text-transform: uppercase;
		letter-spacing: 0.02em;
		padding: 2px 4px;
		border-radius: 3px;
		background: rgba(99, 102, 241, 0.12);
		color: rgba(129, 140, 248, 0.8);
	}

	.session-id.compacted { background: rgba(16, 185, 129, 0.12); color: rgba(16, 185, 129, 0.8); }

	/* Context meter */
	.context-meter {
		--meter-bg: rgba(0,0,0,0.7);
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 2px 6px 2px 4px;
		border-radius: 4px;
		background: transparent;
		cursor: help;
		opacity: 0.5;
		transition: opacity 0.15s ease;
	}
	.context-meter:hover { opacity: 0.8; }
	.context-meter svg { display: block; }
	.context-meter.low { color: #4ade80; }
	.context-meter.mid { color: #facc15; }
	.context-meter.high { color: #fb923c; }
	.context-meter.critical { color: #f87171; animation: pulse-critical 1.5s ease-in-out infinite; }

	@keyframes pulse-critical { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }

	.meter-label {
		font: 600 9px/1 'IBM Plex Mono', monospace;
		letter-spacing: -0.5px;
		opacity: 0.9;
	}

	/* Right actions */
	.window-actions { display: flex; justify-content: flex-end; }
	.menu-container { position: relative; }

	.menu-trigger {
		width: 20px;
		height: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		border-radius: 4px;
		color: var(--text-tertiary);
		cursor: pointer;
		opacity: 0.4;
		transition: all 80ms ease;
	}

	.menu-trigger:hover,
	.menu-trigger.active {
		background: rgba(255, 255, 255, 0.08);
		color: var(--text-primary);
		opacity: 1;
	}

	:global(.app.light) .menu-trigger:hover,
	:global(.app.light) .menu-trigger.active { background: rgba(0, 0, 0, 0.06); }

	@media (max-width: 768px) {
		.window-header { padding: 0.5rem 0.625rem; }
	}
</style>
