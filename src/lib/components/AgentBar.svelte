<script lang="ts">
	import type { Pane, SdkSessionInfo } from '$lib/wsStore.svelte';
	import type { LoadingStatus } from '$lib/types';
	import PaneActivity from './PaneActivity.svelte';
	import StatusBar from './StatusBar.svelte';
	import AgentBarSessionPicker from './AgentBarSessionPicker.svelte';

	interface Props {
		wsConnected: boolean;
		showActivityBar: boolean;
		wsPanes: Map<string, Pane>;
		expandedPanes: Set<string>;
		newPaneName: string;
		resumePrompt: { name: string; sessionId: string } | null;
		showSessionPicker: boolean;
		sdkSessions: SdkSessionInfo[];
		loadingSdkSessions: boolean;
		sessionSearchQuery: string;
		filteredSessions: SdkSessionInfo[];
		searchedSessions: () => SdkSessionInfo[];
		paneSizes: Record<string, 'compact' | 'medium' | 'large'>;
		panePositions: Record<string, { x: number; y: number }>;
		paneCustomSizes: Record<string, { w: number; h: number }>;
		paneMessageInputs: Record<string, string>;
		draggingPane: string | null;
		resizingPane: string | null;
		loadingStatus: LoadingStatus;
		agentEnabled: boolean;
		isDarkMode: boolean;
		agentToolsExpanded: boolean;
		currentProjectPath: string;
		agentFirstMessage: string;
		combinedSystemPrompt: string;
		agentSystemPrompt: string;
		// Callbacks
		getPersistedSdkSessionId: (name: string) => string | undefined;
		getUnreadCount: (name: string) => number;
		getTotalUnreadCount: () => number;
		extractTicketIdFromName: (name: string) => string | undefined;
		onaddpane: (name: string, projectPath: string, firstMsg: string, systemPrompt: string, sessionId?: string, ticketId?: string) => void;
		onremovepane: (name: string) => void;
		onsendtopane: (name: string, msg: string, projectPath: string) => void;
		onstartagentserver: () => void;
		onrestartagentserver: () => void;
		onfetchsdksessions: (projectPath: string) => Promise<SdkSessionInfo[]>;
		onendSession: (name: string) => void;
		onclearSession: (name: string) => void;
		oncontinueSession: (name: string) => void;
		oncompactSession: (name: string) => void;
		onmarkPaneAsRead: (name: string) => void;
		onopenTicketFromPane: (ticketId: string) => void;
		onstartDrag: (e: MouseEvent, name: string) => void;
		onstartResize: (e: MouseEvent, name: string, edge: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw') => void;
		oncyclePaneSize: (name: string) => void;
		onhandleMouseMove: (e: MouseEvent) => void;
		onhandleMouseUp: () => void;
	}

	let {
		wsConnected,
		showActivityBar,
		wsPanes,
		expandedPanes = $bindable(),
		newPaneName = $bindable(),
		resumePrompt = $bindable(),
		showSessionPicker = $bindable(),
		sdkSessions = $bindable(),
		loadingSdkSessions = $bindable(),
		sessionSearchQuery = $bindable(),
		filteredSessions,
		searchedSessions,
		paneSizes,
		panePositions,
		paneCustomSizes,
		paneMessageInputs = $bindable(),
		draggingPane,
		resizingPane,
		loadingStatus,
		agentEnabled,
		isDarkMode,
		agentToolsExpanded,
		currentProjectPath,
		agentFirstMessage,
		combinedSystemPrompt,
		agentSystemPrompt,
		getPersistedSdkSessionId,
		getUnreadCount,
		getTotalUnreadCount,
		extractTicketIdFromName,
		onaddpane,
		onremovepane,
		onsendtopane,
		onstartagentserver,
		onrestartagentserver,
		onfetchsdksessions,
		onendSession,
		onclearSession,
		oncontinueSession,
		oncompactSession,
		onmarkPaneAsRead,
		onopenTicketFromPane,
		onstartDrag,
		onstartResize,
		oncyclePaneSize,
		onhandleMouseMove,
		onhandleMouseUp,
	}: Props = $props();

	let agentMenuOpen = $state(false);
	let agentNameInputOpen = $state(false);
	let agentNameInputRef = $state<HTMLInputElement | null>(null);

	function handleNewAgent() {
		agentMenuOpen = false;
		agentNameInputOpen = true;
		setTimeout(() => agentNameInputRef?.focus(), 50);
	}

	async function handleResumeSessions() {
		agentMenuOpen = false;
		sessionSearchQuery = '';
		loadingSdkSessions = true;
		showSessionPicker = true;
		sdkSessions = await onfetchsdksessions(currentProjectPath);
		loadingSdkSessions = false;
	}

	function handleNameSubmit(e: Event) {
		e.preventDefault();
		const name = newPaneName.trim();
		if (!name) return;
		const persistedId = getPersistedSdkSessionId(name);
		if (persistedId) {
			resumePrompt = { name, sessionId: persistedId };
		} else {
			onaddpane(name, currentProjectPath, agentFirstMessage, combinedSystemPrompt);
			expandedPanes.add(name);
			expandedPanes = new Set(expandedPanes);
		}
		newPaneName = '';
		agentNameInputOpen = false;
	}

	function handleResume() {
		if (!resumePrompt) return;
		onaddpane(resumePrompt.name, currentProjectPath, agentFirstMessage, agentSystemPrompt, resumePrompt.sessionId);
		expandedPanes.add(resumePrompt.name);
		expandedPanes = new Set(expandedPanes);
		resumePrompt = null;
	}

	function handleFreshStart() {
		if (!resumePrompt) return;
		onaddpane(resumePrompt.name, currentProjectPath, agentFirstMessage, agentSystemPrompt);
		expandedPanes.add(resumePrompt.name);
		expandedPanes = new Set(expandedPanes);
		resumePrompt = null;
	}

	function togglePaneExpanded(name: string) {
		if (expandedPanes.has(name)) {
			expandedPanes.delete(name);
		} else {
			expandedPanes.add(name);
		}
		expandedPanes = new Set(expandedPanes);
	}

	function handleSessionSelect(session: SdkSessionInfo) {
		const name = session.agentName || session.sessionId.slice(0, 8);
		const ticketId = extractTicketIdFromName(name);
		onaddpane(name, currentProjectPath, agentFirstMessage, agentSystemPrompt, session.sessionId, ticketId);
		expandedPanes.add(name);
		expandedPanes = new Set(expandedPanes);
		showSessionPicker = false;
	}
</script>

{#if wsConnected && showActivityBar}
<div class="agent-bar" class:has-panes={wsPanes.size > 0}>
	<div class="agent-bar-inner">
		<!-- Agent launcher button with dropdown menu -->
		<div class="agent-launcher">
			<button
				class="launcher-btn"
				class:active={agentMenuOpen}
				onclick={() => agentMenuOpen = !agentMenuOpen}
			>
				<span class="launcher-label">New</span>
				<svg class="launcher-caret" class:open={agentMenuOpen} viewBox="0 0 10 10" width="9" height="9">
					<path d="M2.5 4l2.5 2.5 2.5-2.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
			</button>

			{#if agentMenuOpen}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="launcher-backdrop" onclick={() => agentMenuOpen = false}></div>
				<div class="launcher-menu">
					<button class="launcher-option" onclick={handleNewAgent}>
						<svg viewBox="0 0 16 16" width="13" height="13">
							<circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" stroke-width="1.3"/>
							<path d="M8 5v6M5 8h6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
						</svg>
						<span class="option-label">New Agent</span>
					</button>
					<button class="launcher-option" onclick={handleResumeSessions}>
						<svg viewBox="0 0 16 16" width="13" height="13">
							<path d="M4 8a4 4 0 017.5-2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
							<path d="M11 3.5v2.5h-2.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
						</svg>
						<span class="option-label">Resume Session</span>
						<span class="option-badge">{filteredSessions.length}</span>
					</button>
				</div>
			{/if}
		</div>

		<!-- Name input (appears after clicking New Agent) -->
		{#if agentNameInputOpen}
			<form class="agent-name-form" onsubmit={handleNameSubmit}>
				<input
					type="text"
					bind:this={agentNameInputRef}
					bind:value={newPaneName}
					placeholder="agent name"
					class="agent-name-input"
					onblur={() => { if (!newPaneName.trim()) setTimeout(() => agentNameInputOpen = false, 150); }}
					onkeydown={(e) => { if (e.key === 'Escape') { newPaneName = ''; agentNameInputOpen = false; } }}
				/>
				<button type="submit" class="cta cta-icon" disabled={!newPaneName.trim()}>
					<svg viewBox="0 0 16 16" width="12" height="12">
						<path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
				</button>
				<button type="button" class="cta cta-icon danger" onclick={() => { newPaneName = ''; agentNameInputOpen = false; }}>
					<svg viewBox="0 0 16 16" width="10" height="10">
						<path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
					</svg>
				</button>
			</form>
		{/if}

		<!-- Resume prompt -->
		{#if resumePrompt}
			<div class="resume-prompt">
				<svg viewBox="0 0 16 16" width="12" height="12" class="resume-icon">
					<path d="M3 8a5 5 0 019-2" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
					<path d="M12 3v3h-3" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
				<span class="resume-text">Resume <strong>{resumePrompt.name}</strong>?</span>
				<button class="cta cta-primary" onclick={handleResume}>
					<svg viewBox="0 0 12 12" width="10" height="10">
						<path d="M2 6l3 3 5-5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
					Resume
				</button>
				<button class="cta cta-ghost" onclick={handleFreshStart}>
					<svg viewBox="0 0 12 12" width="10" height="10">
						<circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" stroke-width="1.2"/>
						<path d="M6 4v4M4 6h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
					</svg>
					Fresh
				</button>
				<button class="cta cta-icon danger" onclick={() => { resumePrompt = null; }}>
					<svg viewBox="0 0 12 12" width="10" height="10">
						<path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
					</svg>
				</button>
			</div>
		{/if}

		<div class="agent-tabs">
			{#each [...wsPanes.values()] as pane}
				{@const unread = getUnreadCount(pane.name)}
				<button
					class="agent-tab"
					class:active={expandedPanes.has(pane.name)}
					class:streaming={pane.streaming}
					class:unread={unread > 0}
					onclick={() => togglePaneExpanded(pane.name)}
				>
					<span class="tab-dot" class:live={pane.streaming}></span>
					<span class="tab-name">{pane.name}</span>
					{#if unread > 0}
						<span class="tab-unread">{unread > 99 ? '99+' : unread}</span>
					{:else if pane.messages.length > 0}
						<span class="tab-count">{pane.messages.length}</span>
					{/if}
				</button>
			{/each}
		</div>
		<div class="agent-bar-spacer"></div>
		<div class="agent-bar-status">
			<StatusBar
				dataStatus={loadingStatus}
				agentConnected={wsConnected}
				agentCount={wsPanes.size}
				unreadCount={getTotalUnreadCount()}
				{agentEnabled}
				light={!isDarkMode}
				onstartAgent={onstartagentserver}
				onrestartAgent={onrestartagentserver}
			/>
		</div>
	</div>

	<PaneActivity
		{wsPanes}
		{expandedPanes}
		{paneSizes}
		{panePositions}
		{paneCustomSizes}
		bind:paneMessageInputs
		{draggingPane}
		{resizingPane}
		disabled={!wsConnected}
		toolsExpandedByDefault={agentToolsExpanded}
		{getUnreadCount}
		onStartDrag={onstartDrag}
		onStartResize={onstartResize}
		onCyclePaneSize={oncyclePaneSize}
		onRemovePane={onremovepane}
		onMinimizePane={(name) => { expandedPanes.delete(name); expandedPanes = new Set(expandedPanes); }}
		onSendMessage={(name, msg) => onsendtopane(name, msg, currentProjectPath)}
		onMouseMove={onhandleMouseMove}
		onMouseUp={onhandleMouseUp}
		onEndSession={onendSession}
		onClearSession={onclearSession}
		onContinueSession={(name) => {
			const pane = wsPanes.get(name);
			const sessionId = pane?.sdkSessionId || getPersistedSdkSessionId(name);
			if (sessionId) {
				onremovepane(name);
				const ticketId = pane?.ticketId ?? extractTicketIdFromName(name);
				onaddpane(name, currentProjectPath, agentFirstMessage, agentSystemPrompt, sessionId, ticketId);
				expandedPanes.add(name);
				expandedPanes = new Set(expandedPanes);
			} else {
				oncontinueSession(name);
			}
		}}
		onCompactSession={oncompactSession}
		onFetchSessions={() => onfetchsdksessions(currentProjectPath)}
		onResumeSession={(name, sessionId) => {
			const pane = wsPanes.get(name);
			onremovepane(name);
			const ticketId = pane?.ticketId ?? extractTicketIdFromName(name);
			onaddpane(name, currentProjectPath, agentFirstMessage, agentSystemPrompt, sessionId, ticketId);
			expandedPanes.add(name);
			expandedPanes = new Set(expandedPanes);
		}}
		onMarkAsRead={onmarkPaneAsRead}
		onOpenTicket={onopenTicketFromPane}
	/>
</div>
{/if}

<AgentBarSessionPicker
	show={showSessionPicker}
	loading={loadingSdkSessions}
	{filteredSessions}
	{searchedSessions}
	{sessionSearchQuery}
	onclose={() => showSessionPicker = false}
	onsearch={(q) => sessionSearchQuery = q}
	onselect={handleSessionSelect}
/>

{#if !wsConnected}
<div class="status-bar-fallback" class:light={!isDarkMode}>
	<StatusBar
		dataStatus={loadingStatus}
		agentConnected={wsConnected}
		agentCount={wsPanes.size}
		unreadCount={getTotalUnreadCount()}
		{agentEnabled}
		light={!isDarkMode}
		onstartAgent={onstartagentserver}
		onrestartAgent={onrestartagentserver}
	/>
</div>
{/if}

<style>
	.agent-bar {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: 1000;
		display: flex;
		flex-direction: column-reverse;
		pointer-events: none;
	}

	.agent-bar-inner {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		margin: 0 8px 8px;
		padding: 0.25rem 0.5rem;
		background: var(--bg-secondary, rgba(20, 20, 24, 0.98));
		border: 1px solid rgba(255, 255, 255, 0.04);
		border-radius: 6px;
		pointer-events: auto;
	}

	:global(.app.light) .agent-bar-inner {
		background: rgba(255, 255, 255, 0.98);
		border-color: rgba(0, 0, 0, 0.06);
	}

	.agent-bar-spacer {
		flex: 1;
		min-width: 0.5rem;
	}

	.agent-bar-status {
		flex-shrink: 0;
		margin-left: auto;
	}

	.agent-bar-status :global(.status-bar) {
		background: transparent;
		border: none;
		padding: 0;
	}

	.status-bar-fallback {
		position: fixed;
		bottom: 12px;
		right: 12px;
		z-index: 9999;
	}

	/* ===== Agent Launcher ===== */
	.agent-launcher {
		position: relative;
		flex-shrink: 0;
	}

	.launcher-btn {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 6px 8px 6px 7px;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 5px;
		color: var(--text-secondary);
		font: 500 11px/1 system-ui, -apple-system, sans-serif;
		cursor: pointer;
		transition: all 100ms ease;
	}

	.launcher-btn:hover {
		background: rgba(255, 255, 255, 0.07);
		border-color: rgba(255, 255, 255, 0.12);
		color: var(--text-primary);
	}

	.launcher-btn.active {
		background: rgba(99, 102, 241, 0.12);
		border-color: rgba(99, 102, 241, 0.25);
		color: var(--text-primary);
	}

	.launcher-label { letter-spacing: -0.01em; }

	.launcher-caret {
		color: var(--text-tertiary);
		transition: transform 120ms ease;
	}

	.launcher-caret.open { transform: rotate(180deg); }

	.launcher-backdrop {
		position: fixed;
		inset: 0;
		z-index: 999;
	}

	.launcher-menu {
		position: absolute;
		bottom: calc(100% + 4px);
		left: 0;
		padding: 3px;
		background: rgba(28, 28, 32, 0.98);
		backdrop-filter: blur(20px) saturate(1.5);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 8px;
		box-shadow:
			0 0 0 0.5px rgba(0, 0, 0, 0.3),
			0 4px 16px rgba(0, 0, 0, 0.35),
			0 8px 32px rgba(0, 0, 0, 0.2);
		z-index: 1000;
		animation: menuSlide 100ms ease-out;
	}

	@keyframes menuSlide {
		from { opacity: 0; transform: translateY(3px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.launcher-option {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 7px 10px;
		background: transparent;
		border: none;
		border-radius: 5px;
		color: var(--text-primary);
		font: 500 12px/1 system-ui, -apple-system, sans-serif;
		text-align: left;
		cursor: pointer;
		transition: background 60ms ease;
		white-space: nowrap;
	}

	.launcher-option:hover { background: rgba(255, 255, 255, 0.08); }
	.launcher-option:active { background: rgba(255, 255, 255, 0.12); }

	.launcher-option svg {
		color: var(--text-tertiary);
		flex-shrink: 0;
		transition: color 60ms ease;
	}

	.launcher-option:hover svg { color: var(--text-secondary); }

	.option-label { flex-shrink: 0; }

	.option-badge {
		margin-left: auto;
		padding: 2px 5px;
		font: 500 9px/1 'IBM Plex Mono', ui-monospace, monospace;
		color: var(--text-tertiary);
		background: rgba(255, 255, 255, 0.06);
		border-radius: 3px;
	}

	:global(.app.light) .launcher-btn {
		background: rgba(0, 0, 0, 0.04);
		border-color: rgba(0, 0, 0, 0.08);
	}

	:global(.app.light) .launcher-btn:hover {
		background: rgba(0, 0, 0, 0.06);
		border-color: rgba(0, 0, 0, 0.12);
	}

	:global(.app.light) .launcher-btn.active {
		background: rgba(99, 102, 241, 0.1);
		border-color: rgba(99, 102, 241, 0.2);
	}

	:global(.app.light) .launcher-menu {
		background: rgba(255, 255, 255, 0.98);
		border-color: rgba(0, 0, 0, 0.08);
		box-shadow:
			0 0 0 0.5px rgba(0, 0, 0, 0.06),
			0 4px 16px rgba(0, 0, 0, 0.1),
			0 8px 32px rgba(0, 0, 0, 0.08);
	}

	:global(.app.light) .launcher-option:hover { background: rgba(0, 0, 0, 0.04); }
	:global(.app.light) .launcher-option:active { background: rgba(0, 0, 0, 0.07); }
	:global(.app.light) .option-badge { background: rgba(0, 0, 0, 0.05); }

	/* ===== Agent Name Input ===== */
	.agent-name-form {
		display: flex;
		align-items: center;
		gap: 4px;
		animation: slideIn 150ms ease-out;
	}

	@keyframes slideIn {
		from { opacity: 0; transform: translateX(-8px); }
		to { opacity: 1; transform: translateX(0); }
	}

	.agent-name-input {
		width: 120px;
		padding: 6px 10px;
		font: 11px/1 'IBM Plex Mono', ui-monospace, monospace;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(99, 102, 241, 0.3);
		border-radius: 5px;
		color: var(--text-primary);
		transition: all 100ms ease;
	}

	.agent-name-input:focus {
		outline: none;
		background: rgba(255, 255, 255, 0.1);
		border-color: rgba(99, 102, 241, 0.6);
		box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
	}

	.agent-name-input::placeholder {
		color: var(--text-tertiary);
		font-style: italic;
	}

	:global(.app.light) .agent-name-input {
		background: rgba(0, 0, 0, 0.04);
		border-color: rgba(99, 102, 241, 0.25);
	}

	:global(.app.light) .agent-name-input:focus {
		background: rgba(0, 0, 0, 0.06);
	}

	/* ===== Resume Prompt ===== */
	.resume-prompt {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 12px;
		background: linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(99, 102, 241, 0.08) 100%);
		border: 1px solid rgba(99, 102, 241, 0.2);
		border-radius: 6px;
		animation: slideIn 150ms ease-out;
	}

	.resume-icon {
		color: rgba(99, 102, 241, 0.8);
		flex-shrink: 0;
	}

	.resume-text {
		font: 11px/1.2 system-ui;
		color: var(--text-secondary);
	}

	.resume-text strong {
		color: var(--text-primary);
		font-weight: 600;
	}

	:global(.app.light) .resume-prompt {
		background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(99, 102, 241, 0.05) 100%);
	}

	/* ===== Agent Tabs ===== */
	.agent-tabs {
		display: flex;
		gap: 2px;
		flex: 1;
		overflow-x: auto;
		scrollbar-width: none;
	}

	.agent-tabs::-webkit-scrollbar { display: none; }

	.agent-tab {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.25rem 0.5rem;
		background: transparent;
		border: none;
		border-radius: 3px;
		color: var(--text-tertiary);
		font: 11px/1 'IBM Plex Mono', ui-monospace, monospace;
		cursor: pointer;
		transition: all 80ms ease;
		white-space: nowrap;
	}

	.agent-tab:hover {
		background: rgba(255, 255, 255, 0.06);
		color: var(--text-primary);
	}

	.agent-tab.active {
		background: rgba(99, 102, 241, 0.12);
		color: var(--text-primary);
	}

	.agent-tab.streaming { color: var(--text-primary); }

	:global(.app.light) .agent-tab:hover { background: rgba(0, 0, 0, 0.05); }
	:global(.app.light) .agent-tab.active { background: rgba(99, 102, 241, 0.1); }

	.tab-dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: currentColor;
		opacity: 0.4;
		flex-shrink: 0;
	}

	.tab-dot.live {
		background: #f59e0b;
		opacity: 1;
		box-shadow: 0 0 4px rgba(245, 158, 11, 0.5);
		animation: pulse 1.2s ease-in-out infinite;
	}

	.tab-name {
		max-width: 80px;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.tab-count {
		font-size: 9px;
		color: var(--text-tertiary);
		opacity: 0.7;
	}

	.agent-tab.active .tab-count {
		color: #6366f1;
		opacity: 1;
	}

	.agent-tab.unread { border-color: rgba(239, 68, 68, 0.4); }

	.tab-unread {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 14px;
		height: 14px;
		padding: 0 4px;
		background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
		border-radius: 7px;
		font-size: 8px;
		font-weight: 700;
		color: #fff;
		letter-spacing: -0.02em;
		box-shadow: 0 1px 2px rgba(239, 68, 68, 0.3);
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}
</style>
