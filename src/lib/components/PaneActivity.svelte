<script lang="ts">
	import type { Pane, SdkSessionInfo } from '$lib/wsStore.svelte';

	interface Props {
		wsPanes: Map<string, Pane>;
		expandedPanes: Set<string>;
		paneSizes: Record<string, 'compact' | 'medium' | 'large'>;
		panePositions: Record<string, { x: number; y: number }>;
		paneCustomSizes: Record<string, { w: number; h: number }>;
		paneMessageInputs: Record<string, string>;
		draggingPane: string | null;
		resizingPane: string | null;
		disabled?: boolean;
		toolsExpandedByDefault?: boolean;
		onStartDrag: (e: MouseEvent, name: string) => void;
		onStartResize: (e: MouseEvent, name: string, edge: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw') => void;
		onCyclePaneSize: (name: string) => void;
		onRemovePane: (name: string) => void;
		onMinimizePane: (name: string) => void;
		onSendMessage: (name: string, message: string) => void;
		onMouseMove: (e: MouseEvent) => void;
		onMouseUp: () => void;
		onEndSession?: (name: string) => void;
		onClearSession?: (name: string) => void;
		onContinueSession?: (name: string) => void;
		onCompactSession?: (name: string) => void;
		onFetchSessions?: () => Promise<SdkSessionInfo[]>;
		onResumeSession?: (name: string, sessionId: string) => void;
	}

	let {
		wsPanes,
		expandedPanes,
		paneSizes,
		panePositions,
		paneCustomSizes,
		paneMessageInputs = $bindable(),
		draggingPane,
		resizingPane,
		disabled = false,
		toolsExpandedByDefault = false,
		onStartDrag,
		onStartResize,
		onCyclePaneSize,
		onRemovePane,
		onMinimizePane,
		onSendMessage,
		onMouseMove,
		onMouseUp,
		onEndSession,
		onClearSession,
		onContinueSession,
		onCompactSession,
		onFetchSessions,
		onResumeSession
	}: Props = $props();

	let messagesRefs = $state<Record<string, HTMLDivElement | null>>({});
	let collapsedTools = $state<Set<string>>(new Set());
	let openMenuPane = $state<string | null>(null);
	let sessionPickerPane = $state<string | null>(null);
	let sessionPickerSessions = $state<SdkSessionInfo[]>([]);
	let sessionPickerLoading = $state(false);

	function toggleToolCollapse(key: string) {
		if (collapsedTools.has(key)) {
			collapsedTools.delete(key);
		} else {
			collapsedTools.add(key);
		}
		collapsedTools = new Set(collapsedTools);
	}

	function toggleMenu(name: string) {
		openMenuPane = openMenuPane === name ? null : name;
	}

	function closeMenu() {
		openMenuPane = null;
	}

	function getPaneSize(name: string): 'compact' | 'medium' | 'large' {
		return paneSizes[name] || 'compact';
	}

	function getPaneStyle(name: string): string {
		const pos = panePositions[name];
		const size = paneCustomSizes[name];
		const parts: string[] = [];
		if (pos) parts.push(`left: ${pos.x}px`, `top: ${pos.y}px`, `position: fixed`);
		if (size) parts.push(`width: ${size.w}px`, `height: ${size.h}px`);
		return parts.join('; ');
	}

	function isCustomized(name: string): boolean {
		return !!(panePositions[name] || paneCustomSizes[name]);
	}

	function handleSubmit(e: Event, paneName: string) {
		e.preventDefault();
		const msg = paneMessageInputs[paneName];
		if (msg?.trim()) {
			onSendMessage(paneName, msg.trim());
			paneMessageInputs[paneName] = '';
		}
	}

	$effect(() => {
		for (const [name, pane] of wsPanes) {
			const ref = messagesRefs[name];
			if (ref && (pane.messages.length > 0 || pane.currentDelta)) {
				ref.scrollTop = ref.scrollHeight;
			}
		}
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="agent-windows"
	class:has-large={Object.values(paneSizes).includes('large')}
	onmousemove={onMouseMove}
	onmouseup={onMouseUp}
	onmouseleave={onMouseUp}
>
	{#each [...wsPanes.values()].filter(p => expandedPanes.has(p.name)) as pane}
		{@const size = getPaneSize(pane.name)}
		{@const customized = isCustomized(pane.name)}
		<div
			class="agent-window {size}"
			class:streaming={pane.streaming}
			class:customized
			class:dragging={draggingPane === pane.name}
			class:resizing={resizingPane === pane.name}
			data-pane={pane.name}
			style={getPaneStyle(pane.name)}
		>
			<!-- Header -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="window-header" onmousedown={(e) => onStartDrag(e, pane.name)}>
				<div class="window-title">
					<span class="status-dot" class:active={pane.streaming}></span>
					<span class="agent-name">{pane.name}</span>
					{#if pane.sdkSessionId}
						<span class="session-tag" class:compacted={pane.compacted}>
							{pane.compacted ? 'compacted' : 'session'}
						</span>
					{/if}
				</div>
				<div class="window-controls">
					<!-- Session actions dropdown -->
					<div class="menu-container">
						<button
							class="menu-trigger"
							class:active={openMenuPane === pane.name}
							onclick={(e) => { e.stopPropagation(); toggleMenu(pane.name); }}
						>
							<svg viewBox="0 0 16 16" width="14" height="14">
								<circle cx="8" cy="3" r="1.5" fill="currentColor"/>
								<circle cx="8" cy="8" r="1.5" fill="currentColor"/>
								<circle cx="8" cy="13" r="1.5" fill="currentColor"/>
							</svg>
						</button>
						{#if openMenuPane === pane.name}
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div class="menu-dropdown" onclick={(e) => e.stopPropagation()}>
								<div class="menu-section">
									<span class="menu-label">Session</span>
									{#if !pane.streaming && onContinueSession}
										<button class="menu-item" onclick={() => { onContinueSession(pane.name); closeMenu(); }}>
											<span class="menu-icon">▶</span>
											<span>Continue</span>
										</button>
									{/if}
									{#if onFetchSessions && onResumeSession}
										<button class="menu-item" onclick={async () => {
											sessionPickerPane = pane.name;
											sessionPickerLoading = true;
											sessionPickerSessions = await onFetchSessions();
											sessionPickerLoading = false;
											closeMenu();
										}}>
											<span class="menu-icon">⟳</span>
											<span>Load Session</span>
										</button>
									{/if}
									{#if onCompactSession}
										<button class="menu-item" class:active={pane.compacted} onclick={() => { onCompactSession(pane.name); closeMenu(); }}>
											<span class="menu-icon">◐</span>
											<span>Compact</span>
											{#if pane.compacted}<span class="menu-badge">done</span>{/if}
										</button>
									{/if}
									{#if onEndSession}
										<button class="menu-item" onclick={() => { onEndSession(pane.name); closeMenu(); }}>
											<span class="menu-icon">■</span>
											<span>End</span>
										</button>
									{/if}
									{#if onClearSession}
										<button class="menu-item danger" onclick={() => { onClearSession(pane.name); closeMenu(); }}>
											<span class="menu-icon">⌫</span>
											<span>Clear</span>
										</button>
									{/if}
								</div>
								<div class="menu-divider"></div>
								<div class="menu-section">
									<span class="menu-label">Window</span>
									<button class="menu-item" onclick={() => { onCyclePaneSize(pane.name); closeMenu(); }}>
										<span class="menu-icon">⊡</span>
										<span>Resize</span>
										<span class="menu-hint">{size}</span>
									</button>
								</div>
								<div class="menu-divider"></div>
								<button class="menu-item danger" onclick={() => { onRemovePane(pane.name); closeMenu(); }}>
									<span class="menu-icon">×</span>
									<span>Close</span>
								</button>
							</div>
						{/if}
					</div>
					<button class="ctrl-btn" onclick={() => onMinimizePane(pane.name)} title="Minimize">−</button>
				</div>
			</div>

			<!-- Messages -->
			<div class="messages" bind:this={messagesRefs[pane.name]}>
				{#each pane.messages.slice(size === 'large' ? -200 : size === 'medium' ? -80 : -40) as msg, i}
					{@const toolKey = `${pane.name}-${i}`}
					{@const isCollapsed = msg.role === 'tool' && (toolsExpandedByDefault ? collapsedTools.has(toolKey) : !collapsedTools.has(toolKey))}
					<div class="msg {msg.role}" class:collapsed={isCollapsed}>
						{#if msg.role === 'tool'}
							<button class="collapse-toggle" onclick={() => toggleToolCollapse(toolKey)} title={isCollapsed ? 'Expand' : 'Collapse'}>
								<span class="toggle-icon">{isCollapsed ? '▶' : '▼'}</span>
							</button>
						{:else}
							<span class="role-tag">{msg.role === 'user' ? '>' : '<'}</span>
						{/if}
						{#if msg.role === 'tool'}
							{#if isCollapsed}
								<pre class="content collapsed-preview"><span class="tool-name">{msg.toolName || 'tool'}</span></pre>
							{:else}
								<div class="tool-details">
									<div class="tool-header">{msg.toolName || 'tool'}</div>
									{#if msg.toolInput}
										<div class="tool-section">
											<span class="tool-label">Input:</span>
											<pre class="tool-json">{JSON.stringify(msg.toolInput, null, 2)}</pre>
										</div>
									{/if}
									{#if msg.toolResult}
										<div class="tool-section">
											<span class="tool-label">Result:</span>
											<pre class="tool-result">{msg.toolResult.slice(0, size === 'large' ? 10000 : 2000)}{msg.toolResult.length > (size === 'large' ? 10000 : 2000) ? '…' : ''}</pre>
										</div>
									{:else}
										<div class="tool-section tool-pending">
											<span class="tool-label">Executing...</span>
										</div>
									{/if}
								</div>
							{/if}
						{:else}
							<pre class="content">{size === 'large' ? msg.content : msg.content.slice(0, 3000)}{size !== 'large' && msg.content.length > 3000 ? '…' : ''}</pre>
						{/if}
					</div>
				{/each}
				{#if pane.currentDelta}
					<div class="msg assistant streaming">
						<span class="role-tag">&lt;</span>
						<pre class="content">{size === 'large' ? pane.currentDelta : pane.currentDelta.slice(-500)}<span class="cursor"></span></pre>
					</div>
				{/if}
				{#if pane.messages.length === 0 && !pane.currentDelta}
					<div class="empty-state">awaiting input</div>
				{/if}
			</div>

			<!-- Input -->
			<form class="input-row" onsubmit={(e) => handleSubmit(e, pane.name)}>
				<input
					type="text"
					value={paneMessageInputs[pane.name] || ''}
					oninput={(e) => paneMessageInputs[pane.name] = e.currentTarget.value}
					placeholder={disabled ? "connecting..." : ">"}
					class="msg-input"
					disabled={disabled}
				/>
				<button type="submit" class="send-btn" disabled={disabled || !paneMessageInputs[pane.name]?.trim()}>
					{#if disabled}
						<span class="spinner"></span>
					{:else}
						↵
					{/if}
				</button>
			</form>

			<!-- Resize handles: 4 edges + 4 corners -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="resize-edge top" onmousedown={(e) => onStartResize(e, pane.name, 'n')}></div>
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="resize-edge right" onmousedown={(e) => onStartResize(e, pane.name, 'e')}></div>
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="resize-edge bottom" onmousedown={(e) => onStartResize(e, pane.name, 's')}></div>
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="resize-edge left" onmousedown={(e) => onStartResize(e, pane.name, 'w')}></div>
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="resize-corner nw" onmousedown={(e) => onStartResize(e, pane.name, 'nw')}></div>
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="resize-corner ne" onmousedown={(e) => onStartResize(e, pane.name, 'ne')}></div>
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="resize-corner sw" onmousedown={(e) => onStartResize(e, pane.name, 'sw')}></div>
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="resize-corner se" onmousedown={(e) => onStartResize(e, pane.name, 'se')}>
				<svg viewBox="0 0 8 8" width="8" height="8">
					<path d="M7 1v6H1" stroke="currentColor" stroke-width="1" fill="none" opacity="0.5"/>
					<path d="M7 4v3H4" stroke="currentColor" stroke-width="1" fill="none" opacity="0.3"/>
				</svg>
			</div>
		</div>
	{/each}
</div>

<!-- Session Picker Modal -->
{#if sessionPickerPane}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="session-picker-overlay" onclick={() => sessionPickerPane = null}>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="session-picker-modal" onclick={(e) => e.stopPropagation()}>
			<div class="session-picker-header">
				<span class="session-picker-title">Load Session for "{sessionPickerPane}"</span>
				<button class="session-picker-close" onclick={() => sessionPickerPane = null}>×</button>
			</div>
			{#if sessionPickerLoading}
				<div class="session-picker-loading">
					<span class="spinner"></span>
					Loading sessions...
				</div>
			{:else if sessionPickerSessions.length === 0}
				<div class="session-picker-empty">No saved sessions found</div>
			{:else}
				<div class="session-picker-list">
					{#each sessionPickerSessions as session}
						{@const timeAgo = (() => {
							const diff = Date.now() - new Date(session.timestamp).getTime();
							const mins = Math.floor(diff / 60000);
							const hours = Math.floor(diff / 3600000);
							const days = Math.floor(diff / 86400000);
							if (mins < 60) return `${mins}m`;
							if (hours < 24) return `${hours}h`;
							if (days < 7) return `${days}d`;
							return new Date(session.timestamp).toLocaleDateString('en', { month: 'short', day: 'numeric' });
						})()}
						{@const isMatch = session.agentName === sessionPickerPane}
						<button class="session-card" class:match={isMatch} onclick={() => {
							if (onResumeSession && sessionPickerPane) {
								onResumeSession(sessionPickerPane, session.sessionId);
								sessionPickerPane = null;
							}
						}}>
							<div class="session-card-header">
								<span class="session-card-name" class:highlight={isMatch}>{session.agentName || 'unnamed'}</span>
								<span class="session-card-time">{timeAgo}</span>
							</div>
							{#if session.summary}
								<div class="session-card-summary">{session.summary}</div>
							{/if}
							<div class="session-card-transcript">
								{#each session.preview.slice(0, 8) as line}
									<div class="transcript-line" class:assistant={line.startsWith('>')}>{line}</div>
								{/each}
								{#if session.preview.length === 0}
									<div class="transcript-line empty">No conversation</div>
								{/if}
							</div>
							<div class="session-card-footer">
								<span class="session-card-id">{session.sessionId.slice(0, 8)}</span>
							</div>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.agent-windows {
		display: flex;
		gap: 0.5rem;
		padding: 0 0.75rem 0.375rem;
		pointer-events: auto;
		flex-wrap: wrap;
		justify-content: flex-end;
		align-items: flex-end;
	}

	.agent-windows.has-large {
		position: fixed;
		inset: 0;
		padding: 2rem;
		background: rgba(0, 0, 0, 0.7);
		backdrop-filter: blur(8px);
		z-index: 999;
		justify-content: center;
		align-items: center;
	}

	/* ===== Window ===== */
	.agent-window {
		position: relative;
		display: flex;
		flex-direction: column;
		background: var(--bg-secondary, rgba(24, 24, 28, 0.98));
		border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
		border-radius: 6px;
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
		overflow: hidden;
		min-width: 280px;
		min-height: 200px;
	}

	.agent-window.compact {
		width: 340px;
		height: 320px;
	}

	.agent-window.medium {
		width: 520px;
		height: 480px;
	}

	.agent-window.large {
		width: min(95vw, 1000px);
		height: min(90vh, 800px);
	}

	.agent-window.customized {
		z-index: 1001;
	}

	.agent-window.streaming {
		border-color: rgba(245, 158, 11, 0.4);
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(245, 158, 11, 0.15);
	}

	.agent-window.dragging {
		cursor: grabbing;
		opacity: 0.95;
		box-shadow: 0 12px 48px rgba(0, 0, 0, 0.5);
		z-index: 1002;
		transition: none;
		will-change: transform, left, top;
		contain: layout style;
		pointer-events: none; /* Prevent child elements from interfering */
	}

	.agent-window.resizing {
		z-index: 1002;
		transition: none;
		will-change: width, height;
		contain: layout style;
	}

	:global(.app.light) .agent-window {
		background: rgba(255, 255, 255, 0.98);
		border-color: rgba(0, 0, 0, 0.1);
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
	}

	:global(.app.light) .agent-windows.has-large {
		background: rgba(0, 0, 0, 0.4);
	}

	/* ===== Header ===== */
	.window-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.375rem 0.5rem;
		background: rgba(255, 255, 255, 0.02);
		border-bottom: 1px solid rgba(255, 255, 255, 0.04);
		cursor: grab;
		user-select: none;
		flex-shrink: 0;
	}

	.agent-window.dragging .window-header {
		cursor: grabbing;
	}

	:global(.app.light) .window-header {
		background: rgba(0, 0, 0, 0.02);
		border-bottom-color: rgba(0, 0, 0, 0.06);
	}

	.window-title {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	.status-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--text-tertiary, #666);
		flex-shrink: 0;
	}

	.status-dot.active {
		background: #f59e0b;
		box-shadow: 0 0 6px rgba(245, 158, 11, 0.6);
		animation: pulse 1.2s ease-in-out infinite;
	}

	.agent-name {
		font: 600 11px/1 'JetBrains Mono', ui-monospace, monospace;
		color: var(--text-primary);
		letter-spacing: -0.01em;
	}

	.window-controls {
		display: flex;
		gap: 2px;
	}

	.session-tag {
		font: 500 8px/1 'JetBrains Mono', monospace;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 2px 5px;
		border-radius: 3px;
		background: rgba(99, 102, 241, 0.15);
		color: #818cf8;
	}

	.session-tag.compacted {
		background: rgba(16, 185, 129, 0.15);
		color: #10b981;
	}

	/* Menu trigger */
	.menu-container {
		position: relative;
	}

	.menu-trigger {
		width: 22px;
		height: 22px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		border-radius: 4px;
		color: var(--text-tertiary);
		cursor: pointer;
		transition: all 80ms ease;
	}

	.menu-trigger:hover,
	.menu-trigger.active {
		background: rgba(255, 255, 255, 0.1);
		color: var(--text-primary);
	}

	.ctrl-btn {
		width: 22px;
		height: 22px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		border-radius: 4px;
		color: var(--text-tertiary);
		font: 500 14px/1 system-ui;
		cursor: pointer;
		transition: all 80ms ease;
	}

	.ctrl-btn:hover {
		background: rgba(255, 255, 255, 0.1);
		color: var(--text-primary);
	}

	/* Dropdown menu */
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

	.menu-section {
		padding: 4px;
	}

	.menu-label {
		display: block;
		padding: 4px 8px 6px;
		font: 600 9px/1 'JetBrains Mono', monospace;
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
		font: 400 11px/1 'JetBrains Mono', monospace;
		color: var(--text-primary);
		cursor: pointer;
		transition: background 60ms ease;
		text-align: left;
	}

	.menu-item:hover {
		background: rgba(255, 255, 255, 0.08);
	}

	.menu-item.active {
		color: #10b981;
	}

	.menu-item.danger:hover {
		background: rgba(239, 68, 68, 0.15);
		color: #ef4444;
	}

	.menu-icon {
		width: 14px;
		text-align: center;
		font-size: 10px;
		opacity: 0.7;
	}

	.menu-hint {
		margin-left: auto;
		font-size: 9px;
		color: var(--text-tertiary);
		opacity: 0.6;
	}

	.menu-badge {
		margin-left: auto;
		font: 500 8px/1 'JetBrains Mono', monospace;
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
		background: #fff;
		border-color: rgba(0, 0, 0, 0.1);
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
	}

	:global(.app.light) .menu-item:hover {
		background: rgba(0, 0, 0, 0.05);
	}

	:global(.app.light) .menu-trigger:hover,
	:global(.app.light) .menu-trigger.active {
		background: rgba(0, 0, 0, 0.08);
	}

	/* ===== Messages ===== */
	.messages {
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		padding: 0.375rem;
		display: flex;
		flex-direction: column;
		gap: 1px;
		font: 11px/1.35 'JetBrains Mono', ui-monospace, monospace;
		overscroll-behavior: contain;
	}

	.messages::-webkit-scrollbar {
		width: 6px;
	}

	.messages::-webkit-scrollbar-track {
		background: transparent;
	}

	.messages::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.1);
		border-radius: 3px;
	}

	.messages::-webkit-scrollbar-thumb:hover {
		background: rgba(255, 255, 255, 0.2);
	}

	:global(.app.light) .messages::-webkit-scrollbar-thumb {
		background: rgba(0, 0, 0, 0.1);
	}

	:global(.app.light) .messages::-webkit-scrollbar-thumb:hover {
		background: rgba(0, 0, 0, 0.2);
	}

	.msg {
		display: flex;
		gap: 0.375rem;
		padding: 0.25rem 0.375rem;
		border-radius: 3px;
		animation: fadeIn 150ms ease;
	}

	@keyframes fadeIn {
		from { opacity: 0; transform: translateY(2px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.msg.user {
		background: rgba(99, 102, 241, 0.12);
	}

	.msg.assistant {
		background: rgba(255, 255, 255, 0.03);
	}

	.msg.tool {
		background: rgba(245, 158, 11, 0.08);
		opacity: 0.8;
	}

	.msg.streaming {
		background: rgba(245, 158, 11, 0.1);
	}

	:global(.app.light) .msg.user {
		background: rgba(99, 102, 241, 0.1);
	}

	:global(.app.light) .msg.assistant {
		background: rgba(0, 0, 0, 0.03);
	}

	:global(.app.light) .msg.tool {
		background: rgba(245, 158, 11, 0.08);
	}

	.role-tag {
		color: var(--text-tertiary);
		flex-shrink: 0;
		width: 1ch;
		user-select: none;
	}

	.msg.user .role-tag {
		color: #6366f1;
	}

	.msg.tool .role-tag {
		color: #f59e0b;
	}

	/* Collapse toggle for tool messages */
	.collapse-toggle {
		background: none;
		border: none;
		padding: 0;
		width: 1ch;
		color: #f59e0b;
		cursor: pointer;
		font-size: 8px;
		line-height: 1;
		flex-shrink: 0;
		opacity: 0.7;
		transition: opacity 80ms ease;
	}

	.collapse-toggle:hover {
		opacity: 1;
	}

	.toggle-icon {
		display: inline-block;
	}

	.msg.collapsed {
		opacity: 0.6;
	}

	.collapsed-preview {
		font-style: italic;
		opacity: 0.7;
	}

	.tool-name {
		color: #f59e0b;
		font-weight: 500;
	}

	.tool-details {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 0;
	}

	.tool-header {
		color: #f59e0b;
		font-weight: 600;
		font-size: 11px;
	}

	.tool-section {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.tool-label {
		color: var(--text-tertiary);
		font-size: 9px;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.tool-json, .tool-result {
		margin: 0;
		font-size: 9px;
		line-height: 1.3;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		color: var(--text-secondary, #aaa);
		white-space: pre-wrap;
		word-break: break-word;
		background: rgba(0, 0, 0, 0.2);
		padding: 0.25rem 0.375rem;
		border-radius: 3px;
		max-height: 200px;
		overflow-y: auto;
	}

	:global(.app.light) .tool-json,
	:global(.app.light) .tool-result {
		background: rgba(0, 0, 0, 0.04);
	}

	.tool-pending .tool-label {
		color: #f59e0b;
		opacity: 0.7;
		animation: pulse 1.2s ease-in-out infinite;
	}

	.content {
		flex: 1;
		margin: 0;
		color: var(--text-primary);
		white-space: pre-wrap;
		word-break: break-word;
		font: inherit;
	}

	.cursor {
		display: inline-block;
		width: 1px;
		height: 1em;
		background: #f59e0b;
		animation: blink 0.6s step-end infinite;
		vertical-align: text-bottom;
		margin-left: 1px;
	}

	@keyframes blink {
		50% { opacity: 0; }
	}

	.empty-state {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-tertiary);
		font: italic 11px/1 'JetBrains Mono', monospace;
		opacity: 0.6;
	}

	/* ===== Input ===== */
	.input-row {
		display: flex;
		gap: 0.25rem;
		padding: 0.375rem;
		background: rgba(0, 0, 0, 0.15);
		border-top: 1px solid rgba(255, 255, 255, 0.04);
		flex-shrink: 0;
	}

	:global(.app.light) .input-row {
		background: rgba(0, 0, 0, 0.03);
		border-top-color: rgba(0, 0, 0, 0.06);
	}

	.msg-input {
		flex: 1;
		padding: 0.375rem 0.5rem;
		font: 11px/1.2 'JetBrains Mono', ui-monospace, monospace;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid transparent;
		border-radius: 4px;
		color: var(--text-primary);
		transition: all 100ms ease;
	}

	.msg-input:focus {
		outline: none;
		background: rgba(255, 255, 255, 0.1);
		border-color: rgba(99, 102, 241, 0.4);
	}

	.msg-input::placeholder {
		color: var(--text-tertiary);
		opacity: 0.6;
	}

	.msg-input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	:global(.app.light) .msg-input {
		background: rgba(0, 0, 0, 0.04);
	}

	:global(.app.light) .msg-input:focus {
		background: rgba(0, 0, 0, 0.06);
	}

	.send-btn {
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(99, 102, 241, 0.9);
		border: none;
		border-radius: 4px;
		color: white;
		font: 600 12px/1 system-ui;
		cursor: pointer;
		transition: all 100ms ease;
		flex-shrink: 0;
	}

	.send-btn:hover:not(:disabled) {
		background: #6366f1;
	}

	.send-btn:active:not(:disabled) {
		transform: scale(0.95);
	}

	.send-btn:disabled {
		background: rgba(255, 255, 255, 0.08);
		color: var(--text-tertiary);
		cursor: default;
	}

	:global(.app.light) .send-btn:disabled {
		background: rgba(0, 0, 0, 0.06);
	}

	.spinner {
		width: 10px;
		height: 10px;
		border: 1.5px solid currentColor;
		border-top-color: transparent;
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	/* ===== Resize handles ===== */
	.resize-corner {
		position: absolute;
		width: 12px;
		height: 12px;
		z-index: 10;
	}

	.resize-corner.nw { top: 0; left: 0; cursor: nwse-resize; }
	.resize-corner.ne { top: 0; right: 0; cursor: nesw-resize; }
	.resize-corner.sw { bottom: 0; left: 0; cursor: nesw-resize; }
	.resize-corner.se {
		bottom: 0;
		right: 0;
		cursor: nwse-resize;
		display: flex;
		align-items: flex-end;
		justify-content: flex-end;
		padding: 2px;
		color: var(--text-tertiary);
		opacity: 0.4;
		transition: opacity 100ms ease;
	}

	.resize-corner.se:hover {
		opacity: 0.8;
	}

	.resize-edge {
		position: absolute;
		z-index: 9;
	}

	.resize-edge.top {
		top: 0;
		left: 12px;
		right: 12px;
		height: 4px;
		cursor: ns-resize;
	}

	.resize-edge.right {
		top: 12px;
		right: 0;
		width: 4px;
		bottom: 12px;
		cursor: ew-resize;
	}

	.resize-edge.bottom {
		left: 12px;
		bottom: 0;
		height: 4px;
		right: 12px;
		cursor: ns-resize;
	}

	.resize-edge.left {
		top: 12px;
		left: 0;
		width: 4px;
		bottom: 12px;
		cursor: ew-resize;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.4; }
	}

	/* ===== Mobile ===== */
	@media (max-width: 768px) {
		.agent-windows {
			flex-direction: column;
			align-items: stretch;
			padding: 0.375rem;
			gap: 0.375rem;
		}

		.agent-windows.has-large {
			padding: 0;
		}

		.agent-window {
			width: 100% !important;
			min-width: auto;
		}

		.agent-window.compact {
			height: 280px;
		}

		.agent-window.large {
			height: 100vh;
			border-radius: 0;
		}

		.window-header {
			padding: 0.5rem 0.625rem;
		}

		.messages {
			padding: 0.5rem;
		}

		.input-row {
			padding: 0.5rem;
		}

		.msg-input {
			padding: 0.5rem 0.625rem;
			font-size: 13px;
		}

		.send-btn {
			width: 36px;
			height: 36px;
		}
	}

	/* ===== Session Picker Modal ===== */
	.session-picker-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(4px);
		z-index: 2000;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.session-picker-modal {
		width: 380px;
		max-height: 80vh;
		background: var(--bg-secondary, #1a1a1a);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 10px;
		box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.session-picker-modal .session-picker-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		background: rgba(255, 255, 255, 0.03);
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}

	.session-picker-modal .session-picker-title {
		font: 600 12px/1 system-ui;
		color: var(--text-primary, #fff);
	}

	.session-picker-close {
		width: 24px;
		height: 24px;
		border: none;
		background: transparent;
		color: var(--text-tertiary, #666);
		font-size: 18px;
		cursor: pointer;
		border-radius: 4px;
		transition: all 80ms ease;
	}

	.session-picker-close:hover {
		background: rgba(255, 255, 255, 0.1);
		color: var(--text-primary, #fff);
	}

	.session-picker-loading,
	.session-picker-empty {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 2rem;
		font: 11px/1.4 system-ui;
		color: var(--text-tertiary, #666);
	}

	.session-picker-modal .session-picker-list {
		max-height: 60vh;
		overflow-y: auto;
		padding: 0.5rem;
	}

	.session-picker-modal .session-card {
		width: 100%;
		padding: 0.625rem 0.75rem;
		margin-bottom: 0.375rem;
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 6px;
		text-align: left;
		cursor: pointer;
		transition: all 100ms ease;
	}

	.session-picker-modal .session-card:last-child {
		margin-bottom: 0;
	}

	.session-picker-modal .session-card:hover {
		background: rgba(99, 102, 241, 0.12);
		border-color: rgba(99, 102, 241, 0.3);
	}

	.session-picker-modal .session-card.match {
		border-color: rgba(34, 197, 94, 0.4);
		background: rgba(34, 197, 94, 0.08);
	}

	.session-picker-modal .session-card.match:hover {
		background: rgba(34, 197, 94, 0.15);
		border-color: rgba(34, 197, 94, 0.5);
	}

	.session-picker-modal .session-card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.375rem;
	}

	.session-picker-modal .session-card-name {
		font: 600 11px/1 'JetBrains Mono', ui-monospace, monospace;
		color: var(--text-primary, #fff);
	}

	.session-picker-modal .session-card-name.highlight {
		color: #22c55e;
	}

	.session-picker-modal .session-card-time {
		font: 500 8px/1 'JetBrains Mono', monospace;
		color: var(--text-tertiary, #666);
		background: rgba(255, 255, 255, 0.06);
		padding: 2px 5px;
		border-radius: 3px;
	}

	.session-picker-modal .session-card-summary {
		font: 500 9px/1.3 system-ui;
		color: rgba(99, 102, 241, 0.9);
		margin-bottom: 0.375rem;
		padding: 3px 6px;
		background: rgba(99, 102, 241, 0.1);
		border-radius: 3px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.session-picker-modal .session-card-transcript {
		display: flex;
		flex-direction: column;
		gap: 1px;
		margin-bottom: 0.25rem;
		max-height: 120px;
		overflow: hidden;
	}

	.session-picker-modal .transcript-line {
		font: 8px/1.35 'JetBrains Mono', ui-monospace, monospace;
		color: var(--text-secondary, #aaa);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		padding: 1px 0;
		opacity: 0.8;
	}

	.session-picker-modal .transcript-line.assistant {
		color: var(--text-tertiary, #666);
		opacity: 0.6;
		padding-left: 6px;
	}

	.session-picker-modal .transcript-line.empty {
		color: var(--text-tertiary, #666);
		font-style: italic;
		opacity: 0.5;
	}

	.session-picker-modal .session-card-footer {
		display: flex;
		justify-content: flex-end;
		margin-top: 0.25rem;
		padding-top: 0.25rem;
		border-top: 1px solid rgba(255, 255, 255, 0.04);
	}

	.session-picker-modal .session-card-id {
		font: 7px/1 'JetBrains Mono', ui-monospace, monospace;
		color: var(--text-tertiary, #666);
		opacity: 0.4;
	}
</style>
