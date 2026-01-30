<script lang="ts">
	import { browser } from '$app/environment';
	import { untrack } from 'svelte';
	import { connect, disconnect, getPanes, isConnected, addPane, removePane, sendToPane, killSession, clearAllSessions, endSession, clearSession, continueSession, compactSession, getPersistedSdkSessionId, getAllPersistedSessions, deletePersistedSession, fetchSdkSessions, markPaneAsRead, getTotalUnreadCount, getUnreadCount, notifyAgentOfTicketUpdate, type Pane, type SdkSessionInfo } from '$lib/wsStore.svelte';
	import type { Issue, Attachment, CardPosition, FlyingCard, SortBy, PaneSize, ViewMode, Project } from '$lib/types';
	import {
		columns,
		getPriorityConfig,
		getDepTypeConfig,
		getTypeIcon,
		hasOpenBlockers,
		formatDate,
		sortIssues,
		getIssueColumn,
		getColumnMoveUpdates
	} from '$lib/utils';
	import ColumnNav from '$lib/components/ColumnNav.svelte';
	import Header from '$lib/components/Header.svelte';
	import ContextMenu from '$lib/components/ContextMenu.svelte';
	import RopeDrag from '$lib/components/RopeDrag.svelte';
	import DepTypePicker from '$lib/components/DepTypePicker.svelte';
	import KeyboardHelp from '$lib/components/KeyboardHelp.svelte';
	import KanbanColumn from '$lib/components/KanbanColumn.svelte';
	import DetailPanel from '$lib/components/DetailPanel.svelte';
	import FlyingCardComponent from '$lib/components/FlyingCard.svelte';
	import AgentBar from '$lib/components/AgentBar.svelte';
	import InitialLoader from '$lib/components/InitialLoader.svelte';
	import TreeView from '$lib/components/TreeView.svelte';
	import GraphView from '$lib/components/GraphView.svelte';
	import MutationLog from '$lib/components/MutationLog.svelte';
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	import SettingsPane from '$lib/components/SettingsPane.svelte';
	import { fetchMutations } from '$lib/mutationStore.svelte';
	import StatsView from '$lib/components/StatsView.svelte';
	import ThemeTransition from '$lib/components/ThemeTransition.svelte';
	import ProjectSwitcher from '$lib/components/ProjectSwitcher.svelte';
	import { settings } from '$lib/stores/settings.svelte';
	import { notificationStore } from '$lib/notifications/notification-store.svelte';
	import { createPaneDrag } from '$lib/stores/pane-drag.svelte';
	import { isValidSession as isValidSessionFn } from '$lib/agent/ticket-delivery';
	import { createKeyboardNav } from '$lib/keyboard/kanban-nav';
	import { createIssueStore } from '$lib/stores/issue-store.svelte';
	import { createCardDrag } from '$lib/drag-drop/card-drag.svelte';
	import { createPageOps } from '$lib/stores/page-ops.svelte';
	import { issueMatchesFilters as matchesFilters, hasActiveFilters as checkActiveFilters, type FilterState } from '$lib/filters';

	// --- UI State (page-only) ---
	let bdVersion = $state<{ version: string; compatible: boolean } | null>(null);
	let searchQuery = $state('');
	let filterPriority = $state<number | 'all'>('all');
	let filterType = $state<string>('all');
	let filterTime = $state<string>('all');
	let filterStatus = $state<string>('all');
	let filterLabel = $state<string>('all');
	let filterActionable = $state(false);
	let isFilterPreviewing = $state(false);
	let selectedId = $state<string | null>(null);
	let activeColumnIndex = $state(0);
	let isDarkMode = $state(true);
	let colorScheme = $state('default');
	let themeTransitionActive = $state(false);
	let themeTransitionToLight = $state(false);
	let showActivityBar = $state(true);
	let newPaneName = $state('');
	let resumePrompt = $state<{ name: string; sessionId: string } | null>(null);
	let showSessionPicker = $state(false);
	let sdkSessions = $state<SdkSessionInfo[]>([]);
	let filteredSessions = $derived(sdkSessions.filter(isValidSessionFn));
	let loadingSdkSessions = $state(false);
	let sessionSearchQuery = $state('');
	let searchedSessions = $derived(() => {
		const q = sessionSearchQuery.trim().toLowerCase();
		if (!q) return filteredSessions;
		return filteredSessions.filter(s =>
			(s.agentName?.toLowerCase().includes(q)) ||
			(s.summary?.toLowerCase().includes(q)) ||
			s.preview.some(line => line.toLowerCase().includes(q))
		);
	});
	let paneMessageInputs = $state<Record<string, string>>({});
	let expandedPanes = $state<Set<string>>(new Set());
	let columnSortBy = $state<Record<string, 'priority' | 'created' | 'title'>>({});
	let showKeyboardHelp = $state(false);
	let showHotkeys = $state(false);
	let showSettings = $state(false);
	let showPrompts = $state(false);
	let showPromptsEditor = $state(false);
	let projectName = $state('');
	let teleports = $state<{id: string; from: {x: number; y: number; w: number; h: number}; to: {x: number; y: number; w: number; h: number}; startTime: number}[]>([]);
	let placeholders = $state<{id: string; targetColumn: string; height: number}[]>([]);
	let cardRefs = $state<Map<string, HTMLElement>>(new Map());
	let placeholderRefs = $state<Map<string, HTMLElement>>(new Map());
	let flyingCards = $state<Map<string, {from: {x: number; y: number; w: number; h: number}; to: {x: number; y: number; w: number; h: number}; issue: Issue}>>(new Map());
	let viewMode = $state<ViewMode>('kanban');
	let showMutationLog = $state(false);
	let projects = $state<Project[]>([]);
	let showProjectSwitcher = $state(false);
	let currentProjectPath = $state('');
	let projectColor = $state('#6366f1');
	let projectTransition = $state<'idle' | 'wipe-out' | 'wipe-in'>('idle');
	let collapsedColumns = $derived(settings.collapsedColumns);

	// --- Issue Store ---
	const issueStore = createIssueStore({
		onNewIssue: () => {}, // Notifications now handled by event system
		onStatusChange: () => {}, // Notifications now handled by event system
		getCardPosition: (id) => {
			const el = cardRefs.get(id);
			if (!el) return null;
			const rect = el.getBoundingClientRect();
			return { x: rect.left, y: rect.top, w: rect.width, h: rect.height };
		},
		getPlaceholderPosition: (id) => {
			const el = placeholderRefs.get(id);
			if (!el) return null;
			const rect = el.getBoundingClientRect();
			return { x: rect.left, y: rect.top, w: rect.width, h: rect.height };
		},
		addPlaceholder: (id, targetColumn, height) => {
			if (!placeholders.some(p => p.id === id)) {
				placeholders = [...placeholders, { id, targetColumn, height }];
			}
		},
		addFlyingCard: (id, from, to, issue) => {
			flyingCards.set(id, { from, to, issue });
			flyingCards = new Map(flyingCards);
		},
		addTeleport: (id, from, to) => {
			teleports = [...teleports, { id, from, to, startTime: Date.now() }];
		},
		cleanupAnimation: (id) => {
			teleports = teleports.filter(t => t.id !== id);
			placeholders = placeholders.filter(p => p.id !== id);
			flyingCards.delete(id);
			flyingCards = new Map(flyingCards);
		},
		notifyTicket: (id, message, type, context) => ops.notifyTicket(id, message, type, context),
		onEditingIssueClosedExternally: () => { ops.issueClosedExternally = true; },
		getEditingIssue: () => ops.editingIssue,
		getIsCreating: () => ops.isCreating
	});

	let issues = $derived(issueStore.issues);
	let animatingIds = $derived(issueStore.animatingIds);
	let loadingStatus = $derived(issueStore.loadingStatus);
	let initialLoaded = $derived(issueStore.initialLoaded);

	// --- Page Operations (detail panel, deps, context menu, agent ops) ---
	const ops = createPageOps({
		issueStore,
		getIssues: () => issues,
		getWsPanes: () => wsPanes,
		getCurrentProjectPath: () => currentProjectPath,
		getSelectedId: () => selectedId,
		setSelectedId: (id) => { selectedId = id; },
		getExpandedPanes: () => expandedPanes,
		setExpandedPanes: (v) => { expandedPanes = v; },
	});

	// --- Card Drag/Drop & Touch ---
	const cardDrag = createCardDrag({
		getIssues: () => issues,
		updateIssue: (id, updates) => issueStore.updateIssue(id, updates),
		getActiveColumnIndex: () => activeColumnIndex,
		setActiveColumnIndex: (idx) => { activeColumnIndex = idx; },
		closePanel: ops.closePanel
	});

	let draggedId = $derived(cardDrag.draggedId);
	let draggedOverColumn = $derived(cardDrag.draggedOverColumn);
	let dropIndicatorIndex = $derived(cardDrag.dropIndicatorIndex);
	let dropTargetColumn = $derived(cardDrag.dropTargetColumn);
	let isPanelDragging = $derived(cardDrag.isPanelDragging);
	let panelDragOffset = $derived(cardDrag.panelDragOffset);

	// --- Pane Drag ---
	const paneDrag = createPaneDrag();
	const { cyclePaneSize, startDrag, startResize } = paneDrag;
	let paneSizes = $derived(paneDrag.paneSizes);
	let panePositions = $derived(paneDrag.panePositions);
	let paneCustomSizes = $derived(paneDrag.paneCustomSizes);
	let draggingPane = $derived(paneDrag.draggingPane);
	let resizingPane = $derived(paneDrag.resizingPane);
	$effect(() => paneDrag.setupListeners());

	// --- WS Polling ---
	let wsConnected = $state(false);
	let wsPanes = $state<Map<string, Pane>>(new Map());
	let lastPanesJson = '';

	$effect(() => {
		const poll = () => {
			wsConnected = isConnected();
			const newPanes = getPanes();
			const newJson = JSON.stringify([...newPanes.entries()].map(([k, v]) => [k, v.messages.length, v.currentDelta?.length || 0, v.streaming]));
			if (newJson !== lastPanesJson) {
				lastPanesJson = newJson;
				wsPanes = newPanes;
			}
		};
		poll();
		const id = setInterval(poll, 100);
		return () => clearInterval(id);
	});

	const activeAgentNames = $derived([...wsPanes.keys()]);

	// --- Filters ---
	const filterState = $derived<FilterState>({
		searchQuery, filterPriority, filterType, filterTime, filterStatus, filterLabel, filterActionable
	});

	function issueMatchesFilters(issue: Issue): boolean {
		return matchesFilters(issue, filterState);
	}
	const hasActiveFilters = $derived(checkActiveFilters(filterState));
	const availableLabels = $derived([...new Set(issues.flatMap(i => i.labels || []))].sort());
	const filteredIssues = $derived(issues.filter((issue) => issueMatchesFilters(issue)));

	// --- Keyboard Nav ---
	const keyboardNav = createKeyboardNav({
		getFilteredIssues: () => filteredIssues,
		getSelectedId: () => selectedId,
		setSelectedId: (id) => { selectedId = id; },
		getPanelOpen: () => ops.panelOpen,
		getIsCreating: () => ops.isCreating,
		getShowKeyboardHelp: () => showKeyboardHelp,
		setShowKeyboardHelp: (v) => { showKeyboardHelp = v; },
		getShowHotkeys: () => showHotkeys,
		setShowHotkeys: (v) => { showHotkeys = v; },
		getShowProjectSwitcher: () => showProjectSwitcher,
		setShowProjectSwitcher: (v) => { showProjectSwitcher = v; },
		getProjectCount: () => projects.length,
		createIssue: ops.createIssue,
		openCreatePanel: ops.openCreatePanel,
		openEditPanel: ops.openEditPanel,
		deleteIssue: ops.deleteIssue,
		toggleTheme,
		closePanel: ops.closePanel
	});
	const { handleKeydown, handleKeyup, handleWindowBlur } = keyboardNav;

	// --- Theme ---
	function toggleTheme() {
		if (themeTransitionActive) return;
		themeTransitionToLight = isDarkMode;
		themeTransitionActive = true;
	}

	function switchTheme() {
		isDarkMode = !isDarkMode;
		settings.isDarkMode = isDarkMode;
	}

	function completeThemeTransition() {
		themeTransitionActive = false;
	}

	// --- Helpers ---
	function registerCard(node: HTMLElement, id: string) {
		cardRefs.set(id, node);
		return { destroy() { cardRefs.delete(id); } };
	}

	function registerPlaceholder(node: HTMLElement, id: string) {
		placeholderRefs.set(id, node);
		return { destroy() { placeholderRefs.delete(id); } };
	}

	function toggleSortMenu(columnKey: string, e: MouseEvent) {
		e.stopPropagation();
		ops.sortMenuOpen = ops.sortMenuOpen === columnKey ? null : columnKey;
	}

	function setColumnSort(columnKey: string, sortBy: 'priority' | 'created' | 'title') {
		columnSortBy = { ...columnSortBy, [columnKey]: sortBy };
		ops.sortMenuOpen = null;
	}

	async function startAgentServer() {
		try {
			await fetch('/api/agent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'start' }) });
		} catch (err) {
			console.error('Failed to start agent server:', err);
		}
	}

	async function restartAgentServer() {
		try {
			disconnect();
			await fetch('/api/agent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'restart' }) });
			setTimeout(() => connect(), 800);
		} catch (err) {
			console.error('Failed to restart agent server:', err);
		}
	}

	// --- Settings sync (load once, bind directly to settings store) ---
	$effect(() => {
		settings.load();
		notificationStore.init();
		isDarkMode = settings.isDarkMode;
		colorScheme = settings.colorScheme;
	});

	// --- Lifecycle effects ---
	$effect(() => {
		const source = untrack(() => issueStore.connectSSE());
		return () => source.close();
	});

	$effect(() => {
		if (!browser) return;
		fetch('/api/issues').then(r => r.json()).then(data => {
			if (data.bdVersion) bdVersion = data.bdVersion;
		}).catch(() => {});
	});

	$effect(() => {
		if (browser && settings.agentEnabled) connect();
		return () => disconnect();
	});

	let initialUrlChecked = false;
	$effect(() => {
		if (!browser || initialUrlChecked || issues.length === 0) return;
		initialUrlChecked = true;
		const issueId = new URL(window.location.href).searchParams.get('issue');
		if (issueId) ops.openIssueById(issueId, false);
	});

	$effect(() => {
		if (!browser) return;
		fetch('/api/cwd').then(r => r.json()).then(({ cwd, name }) => {
			projectName = name || cwd.split('/').pop() || 'project';
			currentProjectPath = cwd;
			fetch('/api/projects', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ path: cwd, name })
			}).then(r => r.json()).then(data => {
				if (data.projects) {
					projects = data.projects;
					const current = projects.find(p => p.path === cwd);
					if (current) projectColor = current.color;
				}
			});
		});
	});

	async function switchProject(project: Project) {
		if (project.path === currentProjectPath) return;
		const WIPE_DURATION = 350;
		projectTransition = 'wipe-out';
		issueStore.closeSse();
		const [cwdRes] = await Promise.all([
			fetch('/api/cwd', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: project.path }) }),
			new Promise(r => setTimeout(r, WIPE_DURATION))
		]);
		if (!cwdRes.ok) { projectTransition = 'idle'; return; }
		const issuesRes = await fetch('/api/issues');
		const issuesData = await issuesRes.json();
		issueStore.setIssues(issuesData.issues || []);
		currentProjectPath = project.path;
		projectName = project.name;
		projectColor = project.color;
		issueStore.initialLoaded = true;
		selectedId = null;
		ops.editingIssue = null;
		ops.isCreating = false;
		projectTransition = 'wipe-in';
		issueStore.connectSSE();
		await new Promise(r => setTimeout(r, WIPE_DURATION));
		projectTransition = 'idle';
	}
</script>

<svelte:window onkeydown={handleKeydown} onkeyup={handleKeyup} onpopstate={ops.handlePopState} onclick={ops.closeContextMenu} onmousemove={ops.handleMouseMove} onmouseup={ops.handleMouseUp} onblur={handleWindowBlur} />

<div class="app scheme-{colorScheme}" class:light={!isDarkMode} class:panel-open={ops.panelOpen} class:show-hotkeys={showHotkeys} class:has-chat-bar={wsConnected && showActivityBar} style="--project-color: {projectColor}">

{#if ops.contextMenu}
	<ContextMenu
		x={ops.contextMenu.x}
		y={ops.contextMenu.y}
		issue={ops.contextMenu.issue}
		onSetPriority={(p) => ops.setIssuePriority(ops.contextMenu.issue.id, p)}
		onStartRopeDrag={(e) => ops.startRopeDrag(e, ops.contextMenu.issue.id)}
		onClose={ops.closeContextMenu}
	/>
{/if}

<RopeDrag ropeDrag={ops.ropeDrag} />

<DepTypePicker pendingDep={ops.pendingDep} onconfirm={ops.confirmDependency} oncancel={ops.cancelDependency} />

<ThemeTransition
	active={themeTransitionActive}
	toLight={themeTransitionToLight}
	onswitch={switchTheme}
	ondone={completeThemeTransition}
/>

<ProjectSwitcher
	bind:show={showProjectSwitcher}
	{projects}
	currentPath={currentProjectPath}
	onselect={switchProject}
	onclose={() => showProjectSwitcher = false}
/>

<MutationLog
	show={showMutationLog}
	onclose={() => showMutationLog = false}
	onticketclick={(id) => {
		const issue = issues.find(i => i.id === id);
		if (issue) ops.openEditPanel(issue);
	}}
/>

<KeyboardHelp bind:show={showKeyboardHelp} />
<SettingsPane
	bind:show={showSettings}
	bind:showPrompts
	bind:showPromptsEditor
	bind:agentEnabled={settings.agentEnabled}
	bind:agentHost={settings.agentHost}
	bind:agentPort={settings.agentPort}
	bind:agentFirstMessage={settings.agentFirstMessage}
	bind:agentSystemPrompt={settings.agentSystemPrompt}
	bind:agentWorkflow={settings.agentWorkflow}
	bind:agentTicketDelivery={settings.agentTicketDelivery}
	bind:agentTicketNotification={settings.agentTicketNotification}
	bind:agentToolsExpanded={settings.agentToolsExpanded}
	{isDarkMode}
	{colorScheme}
	ontoggleTheme={toggleTheme}
	onsetColorScheme={(scheme) => { colorScheme = scheme; settings.colorScheme = scheme; }}
/>
	<Header
		bind:searchQuery
		bind:filterPriority
		bind:filterType
		bind:filterTime
		bind:filterStatus
		bind:filterLabel
		bind:filterActionable
		{availableLabels}
		bind:viewMode
		{isDarkMode}
		{projectName}
		totalIssues={issues.length}
		agentPaneCount={wsPanes.size}
		showAgentPanes={showActivityBar}
		ontoggleTheme={toggleTheme}
		onopenKeyboardHelp={() => showKeyboardHelp = true}
		onopenCreatePanel={ops.openCreatePanel}
		onopenSettings={() => showSettings = true}
		onopenPrompts={() => { showSettings = true; showPrompts = true; }}
		onpreviewchange={(previewing) => isFilterPreviewing = previewing}
		oneditProject={() => showSettings = true}
		ontoggleAgentPanes={() => showActivityBar = !showActivityBar}
	/>

	{#if bdVersion && !bdVersion.compatible}
		<div class="version-warning">
			bd v{bdVersion.version} detected — v0.49.0+ required for full functionality. Run <code>brew upgrade bd</code> to update.
		</div>
	{/if}

	{#if viewMode === 'kanban'}
	<ColumnNav
		{columns}
		bind:activeColumnIndex
		{issues}
		{filteredIssues}
		{hasActiveFilters}
	/>

	<div class="main-content" class:wipe-out={projectTransition === 'wipe-out'} class:wipe-in={projectTransition === 'wipe-in'}>
		<main class="board" ontouchstart={cardDrag.handleTouchStart} ontouchend={cardDrag.handleTouchEnd}>
			{#each columns as column, i}
				{#if i === 0 && ops.isCreating}
					{@render detailPanel()}
				{/if}
				{@const rawColumnIssues = issues.filter((x) => getIssueColumn(x).key === column.key)}
				{@const allColumnIssues = sortIssues(rawColumnIssues, columnSortBy[column.key] ?? 'created')}
				{@const matchingCount = allColumnIssues.filter(issueMatchesFilters).length}
				{@const isCollapsed = collapsedColumns.has(column.key)}
				{@const currentSort = columnSortBy[column.key]}
				<KanbanColumn
					{column}
					columnIndex={i}
					{allColumnIssues}
					{matchingCount}
					{isCollapsed}
					{currentSort}
					sortMenuOpen={ops.sortMenuOpen}
					{selectedId}
					editingIssue={ops.editingIssue}
					{draggedId}
					{draggedOverColumn}
					{dropTargetColumn}
					{dropIndicatorIndex}
					{animatingIds}
					copiedId={ops.copiedId}
					{hasActiveFilters}
					{isFilterPreviewing}
					{flyingCards}
					{placeholders}
					{activeColumnIndex}
					{registerCard}
					{registerPlaceholder}
					{issueMatchesFilters}
					ondragover={(e) => cardDrag.handleDragOver(e, column.key)}
					ondragleave={(e) => cardDrag.handleDragLeave(e, column.key)}
					ondrop={(e) => cardDrag.handleDrop(e, column.key)}
					oncollapseclick={(key) => settings.toggleColumnCollapse(key)}
					ontogglecollapse={(e, key) => { e.stopPropagation(); settings.toggleColumnCollapse(key); }}
					ontogglesortmenu={(key, e) => toggleSortMenu(key, e)}
					onsetcolumnsort={(key, sortBy) => setColumnSort(key, sortBy)}
					oncardclick={(issue) => ops.openEditPanel(issue)}
					oncarddragstart={(e, id) => cardDrag.handleDragStart(e, id)}
					oncarddragend={cardDrag.handleDragEnd}
					oncardcontextmenu={(e, issue) => ops.openContextMenu(e, issue)}
					oncopyid={(id, text) => ops.copyToClipboard(id, text)}
					showAddButton={i === 0}
					onaddclick={ops.openCreatePanel}
				/>
				{#if ops.editingIssue && ops.panelColumnIndex === i}
					{@render detailPanel()}
				{/if}
			{/each}
		</main>
		</div>
	{:else if viewMode === 'tree'}
		<div class="list-view-layout" class:wipe-out={projectTransition === 'wipe-out'} class:wipe-in={projectTransition === 'wipe-in'}>
			<TreeView {issues} {selectedId} onselect={(issue) => ops.openEditPanel(issue)} oncreate={ops.openCreatePanel} />
			{#if ops.panelOpen}
				{@render detailPanel()}
			{/if}
		</div>
	{:else if viewMode === 'graph'}
		<div class="list-view-layout" class:wipe-out={projectTransition === 'wipe-out'} class:wipe-in={projectTransition === 'wipe-in'}>
			<GraphView {issues} {selectedId} onselect={(issue) => ops.openEditPanel(issue)} />
			{#if ops.panelOpen}
				{@render detailPanel()}
			{/if}
		</div>
	{:else if viewMode === 'stats'}
		<div class="stats-view-wrapper" class:wipe-out={projectTransition === 'wipe-out'} class:wipe-in={projectTransition === 'wipe-in'}>
			<StatsView {issues} />
		</div>
	{/if}

<!-- Agent Bar - Pinned to bottom -->
<AgentBar
	{wsConnected}
	{showActivityBar}
	{wsPanes}
	bind:expandedPanes
	bind:newPaneName
	bind:resumePrompt
	bind:showSessionPicker
	bind:sdkSessions
	bind:loadingSdkSessions
	bind:sessionSearchQuery
	{filteredSessions}
	{searchedSessions}
	{paneSizes}
	{panePositions}
	{paneCustomSizes}
	bind:paneMessageInputs
	{draggingPane}
	{resizingPane}
	{loadingStatus}
	agentEnabled={settings.agentEnabled}
	{isDarkMode}
	agentToolsExpanded={settings.agentToolsExpanded}
	{currentProjectPath}
	agentFirstMessage={settings.agentFirstMessage}
	combinedSystemPrompt={settings.combinedSystemPrompt}
	agentSystemPrompt={settings.agentSystemPrompt}
	{getPersistedSdkSessionId}
	{getUnreadCount}
	{getTotalUnreadCount}
	extractTicketIdFromName={ops.extractTicketIdFromName}
	onaddpane={addPane}
	onremovepane={removePane}
	onsendtopane={sendToPane}
	onstartagentserver={startAgentServer}
	onrestartagentserver={restartAgentServer}
	onfetchsdksessions={fetchSdkSessions}
	onendSession={endSession}
	onclearSession={clearSession}
	oncontinueSession={continueSession}
	oncompactSession={compactSession}
	onmarkPaneAsRead={markPaneAsRead}
	onopenTicketFromPane={ops.openTicketFromPane}
	onstartDrag={startDrag}
	onstartResize={startResize}
	oncyclePaneSize={cyclePaneSize}
	onhandleMouseMove={ops.handleMouseMove}
	onhandleMouseUp={ops.handleMouseUp}
/>

<FlyingCardComponent {teleports} />

<InitialLoader status={loadingStatus} visible={!initialLoaded} />
</div>


{#snippet detailPanel()}
	<DetailPanel
		bind:editingIssue={ops.editingIssue}
		isCreating={ops.isCreating}
		bind:createForm={ops.createForm}
		allIssues={issues}
		activeAgents={activeAgentNames}
		agentEnabled={settings.agentEnabled}
		comments={ops.comments}
		copiedId={ops.copiedId}
		bind:newLabelInput={ops.newLabelInput}
		bind:newComment={ops.newComment}
		loadingComments={ops.loadingComments}
		attachments={ops.attachments}
		loadingAttachments={ops.loadingAttachments}
		onuploadattachment={ops.handleUploadAttachment}
		ondeleteattachment={ops.handleDeleteAttachment}
		originalLabels={ops.originalLabels}
		{isPanelDragging}
		{panelDragOffset}
		issueClosedExternally={ops.issueClosedExternally}
		onclose={ops.closePanel}
		oncreate={ops.createIssue}
		oncreateandstartagent={ops.createIssueAndStartAgent}
		onstartagent={ops.startAgentForIssue}
		onviewchat={ops.openAgentPane}
		ondelete={(id) => ops.deleteIssue(id)}
		onsave={(id, updates) => ops.updateIssue(id, updates)}
		onaddcomment={ops.addComment}
		oncopyid={(text, id) => ops.copyToClipboard(text, id)}
		onsetcolumn={(key) => ops.setEditingColumn(key)}
		onaddlabel={(label) => ops.addLabelToEditing(label)}
		onremovelabel={(label) => ops.removeLabelFromEditing(label)}
		onremovedep={(issueId, depId) => ops.removeDependency(issueId, depId)}
		onpaneltouchstart={cardDrag.handlePanelTouchStart}
		onpaneltouchmove={cardDrag.handlePanelTouchMove}
		onpaneltouchend={cardDrag.handlePanelTouchEnd}
		updatecreateform={(key, value) => ops.createForm[key] = value}
		updatenewlabel={(value) => ops.newLabelInput = value}
		ondismissclosedwarning={() => ops.issueClosedExternally = false}
		updatenewcomment={(value) => ops.newComment = value}
	/>
{/snippet}

<ToastContainer />

<style>
	.version-warning {
		background: rgba(245, 158, 11, 0.15);
		border-bottom: 1px solid rgba(245, 158, 11, 0.3);
		color: #f59e0b;
		padding: 6px 16px;
		font-size: 12px;
		text-align: center;
		font-family: var(--font-mono);
	}

	.version-warning code {
		background: rgba(245, 158, 11, 0.2);
		padding: 1px 5px;
		border-radius: 3px;
	}

	.app {
		display: flex;
		flex-direction: column;
		height: 100vh;
		background: var(--bg-primary);
		transition: background var(--transition-smooth);
		position: relative;
		overflow: hidden;
	}

	.app.has-chat-bar {
		height: calc(100vh - 48px);
	}

	.main-content {
		display: flex;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.stats-view-wrapper {
		display: flex;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.main-content.wipe-out,
	.list-view-layout.wipe-out,
	.stats-view-wrapper.wipe-out {
		animation: wipeUp 350ms ease-in forwards;
	}

	.main-content.wipe-in,
	.list-view-layout.wipe-in,
	.stats-view-wrapper.wipe-in {
		animation: wipeDown 350ms ease-out forwards;
	}

	.board {
		display: flex;
		gap: 1rem;
		padding: 1.25rem;
		flex: 1 1 0;
		min-height: 0;
		overflow-x: auto;
		overflow-y: hidden;
		transition: margin-right var(--transition-smooth);
		scrollbar-width: none;
		-ms-overflow-style: none;
	}

	.list-view-layout {
		display: flex;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.board::-webkit-scrollbar {
		display: none;
	}

	@media (max-width: 768px) {
		.main-content {
			flex-direction: column;
		}

		.board {
			flex-direction: column;
			padding: var(--mobile-padding);
			padding-left: max(var(--mobile-padding), env(safe-area-inset-left));
			padding-right: max(var(--mobile-padding), env(safe-area-inset-right));
			gap: 0.25rem;
			overflow-y: auto;
		}

		.app {
			gap: 0;
		}
	}
</style>
