<script lang="ts">
	import { browser } from '$app/environment';
	import { untrack } from 'svelte';
	import { pushState as svelteKitPushState, replaceState as svelteKitReplaceState } from '$app/navigation';
	import { setCurrentProject, appendProjectParam } from '$lib/project';
	import { connect, disconnect, getPanes, getSessions, isConnected, addPane, removePane, sendToPane, killSession, clearAllSessions, endSession, clearSession, continueSession, compactSession, interrupt, getPersistedSdkSessionId, getAllPersistedSessions, deletePersistedSession, fetchSdkSessions, markPaneAsRead, getTotalUnreadCount, getUnreadCount, notifyAgentOfTicketUpdate, type Pane, type SdkSessionInfo } from '$lib/wsStore.svelte';
	import { coerceViewMode, type Issue, type Attachment, type CardPosition, type FlyingCard, type SortBy, type PaneSize, type ViewMode, type Project, type ViewRecipe, type TableColumnConfig, type TableSortState } from '$lib/types';
	import {
		columns,
		getPriorityConfig,
		getDepTypeConfig,
		getTypeIcon,
		hasOpenBlockers,
		formatDate,
		sortIssues,
		sortIssuesBy,
		getIssueColumn,
		getColumnMoveUpdates
	} from '$lib/utils';
	import ColumnNav from '$lib/components/ColumnNav.svelte';
	import Header from '$lib/components/Header.svelte';
	import ContextMenu from '$lib/components/ContextMenu.svelte';
	import RopeDrag from '$lib/components/RopeDrag.svelte';
	import DepTypePicker from '$lib/components/DepTypePicker.svelte';
	import CwdConflictDialog from '$lib/components/CwdConflictDialog.svelte';
	import KeyboardHelp from '$lib/components/KeyboardHelp.svelte';
	import KanbanColumn from '$lib/components/KanbanColumn.svelte';
	import DetailPanel from '$lib/components/DetailPanel.svelte';
	import ZenReview from '$lib/components/ZenReview.svelte';
	import { setIssueStateApi } from '$lib/api';
	import type { TriageAction } from '$lib/zen-triage';
	import FlyingCardComponent from '$lib/components/FlyingCard.svelte';
	import AgentBar from '$lib/components/AgentBar.svelte';
	import InitialLoader from '$lib/components/InitialLoader.svelte';
	import MutationLog from '$lib/components/MutationLog.svelte';
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	import QueuePanel from '$lib/components/QueuePanel.svelte';
	import ManagerPane from '$lib/components/ManagerPane.svelte';
	import PwaInstallPrompt from '$lib/components/PwaInstallPrompt.svelte';
	import SettingsPane from '$lib/components/SettingsPane.svelte';
	import SetupWizard from '$lib/components/SetupWizard.svelte';
	import { fetchMutations } from '$lib/mutationStore.svelte';
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
	import { issueMatchesFilters as matchesFilters, hasActiveFilters as checkActiveFilters, countActiveFilters, emptyFilterState, normalizeFilterState, type FilterState } from '$lib/filters';
	import FilterSidebar from '$lib/components/FilterSidebar.svelte';
	import TableView from '$lib/components/TableView.svelte';
	import SelectionGrid from '$lib/components/SelectionGrid.svelte';
	import FlowView from '$lib/components/flow/FlowView.svelte';
	import { reconcileTableColumns } from '$lib/table-columns';
	import { getManagerVisible, getManagerSessionName, isManagerSession } from '$lib/stores/manager.svelte';
	import { startManager, switchManagerProject, setServerProject } from '$lib/stores/ws-connection.svelte';
	import { getQueueItems, getQueuedTicketIds, fetchInitialQueue } from '$lib/stores/queue.svelte';

	// --- UI State (page-only) ---
	let bdVersion = $state<{ version: string; compatible: boolean } | null>(null);
	let filters = $state<FilterState>(emptyFilterState());
	let isFilterPreviewing = $state(false);
	let selectedId = $state<string | null>(null);
	let activeColumnIndex = $state(0);
	let isDarkMode = $state(true);
	let colorScheme = $state('default');
	let themeTransitionActive = $state(false);
	let themeTransitionToLight = $state(false);
	let showActivityBar = $state(true);
	let chatBarReserve = $state(64);
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
	let showWizard = $state(browser && !localStorage.getItem('beads-wizard-complete'));
	let showPrompts = $state(false);
	let projectName = $state('');
	let teleports = $state<{id: string; from: {x: number; y: number; w: number; h: number}; to: {x: number; y: number; w: number; h: number}; startTime: number}[]>([]);
	let placeholders = $state<{id: string; targetColumn: string; height: number}[]>([]);
	let cardRefs = $state<Map<string, HTMLElement>>(new Map());
	let placeholderRefs = $state<Map<string, HTMLElement>>(new Map());
	let flyingCards = $state<Map<string, {from: {x: number; y: number; w: number; h: number}; to: {x: number; y: number; w: number; h: number}; issue: Issue}>>(new Map());
	let shrinkingSourceIds = $state<Set<string>>(new Set());
	let viewMode = $state<ViewMode>('kanban');
	let zenOpen = $state(false);
	let zenIds = $state<string[]>([]);
	let zenIndex = $state(0);
	let lastAppliedDefaultView = $state<ViewMode | null>(null);
	let lastAppliedDefaultSort = $state<SortBy | null>(null);
	let showMutationLog = $state(false);
	let projects = $state<Project[]>([]);
	let showProjectSwitcher = $state(false);
	let currentProjectPath = $state('');
	let projectColor = $state('#6366f1');
	let projectTransition = $state<'idle' | 'wipe-out' | 'wipe-in'>('idle');
	let switchStatus = $state<string | null>(null);
	let collapsedColumns = $derived(settings.collapsedColumns);
	let currentRecipeId = $state<string | null>(null);
	let lastAppliedRecipeSnapshot = $state<string | null>(null);
	let hydratedProject = $state<string | null>(null);
	const PROJECT_VIEW_PREFIX = 'bdk:view:';

	// --- Read project from URL before any effects fire ---
	if (browser) {
		const urlProject = new URL(window.location.href).searchParams.get('project');
		if (urlProject) {
			setCurrentProject(urlProject);
			currentProjectPath = urlProject;
		}
	}

	// Agent queue state
	let runningAgents = $derived.by(() => {
		const sessions = Array.from(getSessions().values());
		return sessions.filter(s => s.ticketId && !s.ended && (s.projectCwd ?? s.cwd) === currentProjectPath);
	});
	let worktreeTicketIds = $derived.by(() => {
		const ids = new Set<string>();
		for (const s of runningAgents) {
			if (s.worktreePath && s.ticketId) ids.add(s.ticketId);
		}
		return ids;
	});
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
		measureTargetPosition: (targetColumn, height) => {
			// Find the column element
			const columnEl = document.querySelector(`[data-column-key="${targetColumn}"] .cards`);
			if (!columnEl) return null;

			// Create temporary hidden placeholder
			const tempPlaceholder = document.createElement('div');
			tempPlaceholder.style.height = `${height}px`;
			tempPlaceholder.style.visibility = 'hidden';
			tempPlaceholder.style.position = 'relative';

			// Inject, measure, remove
			columnEl.insertBefore(tempPlaceholder, columnEl.firstChild);
			const rect = tempPlaceholder.getBoundingClientRect();
			const pos = { x: rect.left, y: rect.top, w: rect.width, h: rect.height };
			columnEl.removeChild(tempPlaceholder);
			return pos;
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
		addShrinkingSource: (id) => {
			shrinkingSourceIds.add(id);
			shrinkingSourceIds = new Set(shrinkingSourceIds);
		},
		cleanupAnimation: (id) => {
			teleports = teleports.filter(t => t.id !== id);
			placeholders = placeholders.filter(p => p.id !== id);
			flyingCards.delete(id);
			flyingCards = new Map(flyingCards);
			shrinkingSourceIds.delete(id);
			shrinkingSourceIds = new Set(shrinkingSourceIds);
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

	let serverQueue = $derived(getQueueItems());
	let queuedTicketIds = $derived(getQueuedTicketIds());
	let scopedServerQueue = $derived(serverQueue.filter(item => item.cwd === currentProjectPath));
	let mappedAgentQueue = $derived(scopedServerQueue.map(item => ({
		ticketId: item.ticketId,
		title: item.title,
		description: item.description,
		agentName: item.agentName,
		cwd: item.cwd
	})));
	// --- Card Drag/Drop & Touch ---
	const cardDrag = createCardDrag({
		getIssues: () => issues,
		updateIssue: (id, updates) => issueStore.updateIssue(id, updates),
		getActiveColumnIndex: () => activeColumnIndex,
		setActiveColumnIndex: (idx) => { activeColumnIndex = idx; },
		closePanel: ops.closePanel,
		onQueueDrop: (issueId) => {
			const issue = issues.find(i => i.id === issueId);
			if (issue) ops.startAgentForIssue(issue);
		},
		onQueueItemDropToColumn: (ticketId) => {
			ops.cancelQueueItem(ticketId);
		}
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
	let managerSession = $derived.by(() => {
		if (!currentProjectPath) return null;
		const sessionName = getManagerSessionName(currentProjectPath);
		return wsPanes.get(sessionName) ?? null;
	});
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
	const issueMatchesFilters = (issue: Issue) => matchesFilters(issue, filters);
	const hasActiveFilters = $derived(checkActiveFilters(filters));
	const activeFilterCount = $derived(countActiveFilters(filters));
	const availableLabels = $derived([...new Set(issues.flatMap(i => i.labels || []))].sort());
	const availableAssignees = $derived([...new Set(issues.map(i => i.assignee).filter((a): a is string => !!a))].sort());
	const availableTypes = $derived([...new Set(issues.map(i => i.issue_type).filter(Boolean))].sort());
	const filteredIssues = $derived(issues.filter((issue) => issueMatchesFilters(issue)));
	// Ordered rows for the table view — the single source of order shared by the
	// table display AND keyboard next/prev, so "next" is always the next visible row.
	const orderedTableIssues = $derived(
		settings.tableSort ? sortIssuesBy(filteredIssues, settings.tableSort.field, settings.tableSort.dir) : filteredIssues
	);

	// Table multi-select (controlled): when >1 rows are selected we show a grid of
	// blocks in the detail slot instead of a single ticket's details.
	let tableSelectedIds = $state<string[]>([]);
	const tableSelectedIssues = $derived(orderedTableIssues.filter((i) => tableSelectedIds.includes(i.id)));
	const showSelectionGrid = $derived(viewMode === 'table' && tableSelectedIds.length > 1);

	// --- Zen focus review ---
	function openZenReview(ids?: string[], startIndex?: number) {
		const list = ids && ids.length ? ids : filteredIssues.map((i) => i.id);
		if (!list.length) return;
		zenIds = list;
		const seeded = startIndex ?? (selectedId ? list.indexOf(selectedId) : -1);
		zenIndex = seeded >= 0 ? seeded : 0;
		zenOpen = true;
	}

	// Quick triage (Q in Zen): record the pick as a `triage:<value>` state
	// label and reprioritize when the action carries one. Sequential awaits —
	// bd writes to the same issue must not overlap.
	async function handleZenQuickAction(issue: Issue, action: TriageAction) {
		if (action.priority !== undefined && action.priority !== issue.priority) {
			await ops.updateIssue(issue.id, { priority: action.priority });
		}
		await setIssueStateApi(issue.id, 'triage', action.value, `Zen triage: ${action.label}`);
		fetchMutations();
	}

	// Deep-link entrypoint: ?zen=bd-1,bd-2,bd-3 opens focus review on load.
	// The param is consumed (stripped) so a refresh/close doesn't force it back.
	function consumeZenParam(raw: string) {
		const wanted = raw.split(',').map((s) => s.trim()).filter(Boolean);
		const valid = wanted.filter((id) => issues.some((i) => i.id === id));
		const list = valid.length ? valid : wanted;
		if (list.length) openZenReview(list, 0);
		if (browser) {
			const url = new URL(window.location.href);
			url.searchParams.delete('zen');
			svelteKitReplaceState(url.pathname + url.search + url.hash, {});
		}
	}

	// --- Keyboard Nav ---
	const keyboardNav = createKeyboardNav({
		getFilteredIssues: () => filteredIssues,
		getViewMode: () => viewMode,
		getOrderedVisibleIssues: () => (viewMode === 'table' ? orderedTableIssues : filteredIssues),
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
		getOverlayOpen: () => showSettings || showPrompts || showWizard || showMutationLog || showProjectSwitcher,
		getProjectCount: () => projects.length,
		createIssue: ops.createIssue,
		openCreatePanel: ops.openCreatePanel,
		openEditPanel: (issue) => { tableSelectedIds = []; ops.openEditPanel(issue); },
		deleteIssue: ops.deleteIssue,
		toggleTheme,
		closePanel: ops.closePanel,
		openZenReview: () => openZenReview()
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
	// settings.load() both reads and writes settings $state (e.g.
	// `viewRecipes = loadObject('viewRecipes', viewRecipes)`), so it must run
	// untracked — otherwise this effect self-triggers once localStorage holds a
	// value that parses to a fresh reference each run (infinite loop / freeze).
	$effect(() => {
		untrack(() => {
			settings.load();
			notificationStore.init();
			isDarkMode = settings.isDarkMode;
			colorScheme = settings.colorScheme;
		});
	});

	$effect(() => {
		showActivityBar = settings.showAgentBar;
	});

	$effect(() => {
		const defaultView = settings.defaultViewMode;
		if (lastAppliedDefaultView === null || defaultView !== lastAppliedDefaultView) {
			viewMode = defaultView;
			lastAppliedDefaultView = defaultView;
		}
	});

	$effect(() => {
		const defaultSort = settings.defaultColumnSort;
		if (lastAppliedDefaultSort === null) {
			if (Object.keys(columnSortBy).length === 0) {
				columnSortBy = Object.fromEntries(columns.map((col) => [col.key, defaultSort])) as Record<string, SortBy>;
			}
			lastAppliedDefaultSort = defaultSort;
			return;
		}
		if (defaultSort !== lastAppliedDefaultSort) {
			columnSortBy = Object.fromEntries(columns.map((col) => [col.key, defaultSort])) as Record<string, SortBy>;
			lastAppliedDefaultSort = defaultSort;
		}
	});

	// --- Per-project view state: hydrate on project change, persist on edit ---
	$effect(() => {
		if (!browser) return;
		const path = currentProjectPath;
		if (!path) return;
		untrack(() => {
			try {
				const raw = localStorage.getItem(PROJECT_VIEW_PREFIX + path);
				if (raw) applyViewState(JSON.parse(raw));
			} catch {
				/* ignore corrupt/unavailable persisted view state */
			}
			// A remembered project view is not a named recipe.
			currentRecipeId = null;
			lastAppliedRecipeSnapshot = null;
			hydratedProject = path;
		});
	});

	$effect(() => {
		if (!browser) return;
		const state = captureCurrentViewState();
		const path = currentProjectPath;
		// Only persist once the active project's state has been hydrated,
		// so we never overwrite it with defaults during a project switch.
		if (!path || path !== hydratedProject) return;
		untrack(() => {
			try {
				localStorage.setItem(PROJECT_VIEW_PREFIX + path, JSON.stringify(state));
			} catch {
				/* ignore quota / unavailable storage */
			}
		});
	});

	// --- Apply theme to body element ---
	$effect(() => {
		if (!browser) return;
		document.body.classList.toggle('light', !isDarkMode);
		// Remove all scheme classes first
		document.body.className = document.body.className.replace(/scheme-\w+/g, '').trim();
		// Add current scheme if not default
		if (colorScheme !== 'default') {
			document.body.classList.add(`scheme-${colorScheme}`);
		}
	});

	// --- Lifecycle effects ---
	$effect(() => {
		untrack(() => issueStore.connectSSE());
		return () => issueStore.closeSse();
	});

	$effect(() => {
		if (!browser) return;
		fetch(appendProjectParam('/api/issues')).then(r => r.json()).then(payload => {
			const data = payload?.ok ? payload.data : null;
			if (data?.bdVersion) bdVersion = data.bdVersion;
		}).catch(() => {});
	});

	$effect(() => {
		if (browser && settings.agentEnabled) connect();
		return () => disconnect();
	});

	// Keep backend fenced to the current project: re-send set_project whenever
	// connection comes up or the current project changes. Also seed the queue.
	$effect(() => {
		if (!browser) return;
		if (!wsConnected) return;
		if (!currentProjectPath) return;
		setServerProject(currentProjectPath);
		fetchInitialQueue(9347, currentProjectPath);
	});

	let initialUrlChecked = false;
	$effect(() => {
		if (!browser || initialUrlChecked || issues.length === 0) return;
		initialUrlChecked = true;
		const params = new URL(window.location.href).searchParams;
		const zenParam = params.get('zen');
		if (zenParam) consumeZenParam(zenParam);
		const issueId = params.get('issue');
		if (issueId && !zenParam) ops.openIssueById(issueId, false);
	});

	async function initProject(urlProject: string | null) {
		let cwd: string;
		let name: string;

		if (urlProject) {
			// URL specifies the project — switch server default to match
			const res = await fetch('/api/cwd', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ path: urlProject })
			});
			const payload = await res.json();
			const data = payload?.ok ? payload.data : {};
			cwd = data.cwd || urlProject;
			name = data.name || cwd.split('/').pop() || 'project';
		} else {
			// No URL param — get current from server
			const res = await fetch('/api/cwd');
			const payload = await res.json();
			const data = payload?.ok ? payload.data : {};
			cwd = data.cwd;
			name = data.name || cwd.split('/').pop() || 'project';
			setCurrentProject(cwd);
		}

		projectName = name;
		currentProjectPath = cwd;

		const projRes = await fetch('/api/projects', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ path: cwd, name })
		});
		const projPayload = await projRes.json();
		const projData = projPayload?.ok ? projPayload.data : {};
		if (projData.projects) {
			projects = projData.projects;
			const current = projects.find((p: Project) => p.path === cwd);
			if (current) {
				projectColor = current.color;
				projectName = current.meta?.title || current.name || name;
			}
		}
	}

	$effect(() => {
		if (!browser) return;
		const urlProject = new URL(window.location.href).searchParams.get('project');
		initProject(urlProject);
	});

	async function switchProject(project: Project) {
		if (project.path === currentProjectPath) return;
		const WIPE_DURATION = 350;
		const targetName = project.meta?.title || project.name;
		switchStatus = `Switching to ${targetName}…`;
		projectTransition = 'wipe-out';
		issueStore.closeSse();

		// Update frontend project context BEFORE API calls so appendProjectParam works
		setCurrentProject(project.path);
		currentProjectPath = project.path;

		// Switch manager to new project (if visible, it will auto-resume or start new session)
		switchManagerProject(project.path);

		// Flip backend fence to new project immediately so broadcasts filter correctly.
		setServerProject(project.path);
		fetchInitialQueue(9347, project.path);

		const [cwdRes] = await Promise.all([
			fetch('/api/cwd', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: project.path }) }),
			new Promise(r => setTimeout(r, WIPE_DURATION))
		]);
		if (!cwdRes.ok) { projectTransition = 'idle'; switchStatus = null; return; }
		switchStatus = 'Loading issues…';
		const issuesRes = await fetch(appendProjectParam('/api/issues'));
		const issuesPayload = await issuesRes.json();
		const issuesData = issuesPayload?.ok ? issuesPayload.data : { issues: [] };
		issueStore.setIssues(issuesData.issues || []);
		projectName = project.meta?.title || project.name;
		projectColor = project.color;
		issueStore.initialLoaded = true;
		selectedId = null;
		tableSelectedIds = [];
		ops.editingIssue = null;
		ops.isCreating = false;
		projectTransition = 'wipe-in';
		switchStatus = null;
		issueStore.connectSSE();

		// Update URL to include project param
		const url = new URL(window.location.href);
		url.searchParams.set('project', project.path);
		url.searchParams.delete('issue');
		svelteKitPushState(url.pathname + url.search, { project: project.path });

		await new Promise(r => setTimeout(r, WIPE_DURATION));
		projectTransition = 'idle';
	}

	function handlePopState(e: PopStateEvent) {
		const url = new URL(window.location.href);
		const urlProject = url.searchParams.get('project');
		if (urlProject && urlProject !== currentProjectPath) {
			const project = projects.find(p => p.path === urlProject);
			if (project) switchProject(project);
			return;
		}
		ops.handlePopState(e);
	}

	function captureCurrentViewState(): { filters: FilterState; columnSort: Record<string, SortBy>; collapsedColumns: string[]; viewMode: ViewMode; table: TableColumnConfig[]; tableSort: TableSortState | null } {
		return {
			filters: normalizeFilterState(filters),
			columnSort: { ...columnSortBy },
			collapsedColumns: [...settings.collapsedColumns],
			viewMode,
			table: settings.tableColumns.map((c) => ({ ...c })),
			tableSort: settings.tableSort ? { ...settings.tableSort } : null
		};
	}

	function saveRecipe(name: string) {
		const state = captureCurrentViewState();
		const recipe: ViewRecipe = {
			id: crypto.randomUUID(),
			name,
			filters: state.filters,
			columnSort: state.columnSort,
			collapsedColumns: state.collapsedColumns,
			viewMode: state.viewMode,
			table: state.table,
			tableSort: state.tableSort,
			createdAt: new Date().toISOString()
		};
		settings.saveRecipe(recipe);
		currentRecipeId = recipe.id;
		lastAppliedRecipeSnapshot = JSON.stringify(captureCurrentViewState());
	}

	function applyViewState(state: {
		filters: FilterState;
		columnSort: Record<string, SortBy>;
		collapsedColumns: string[];
		viewMode: ViewMode;
		table?: TableColumnConfig[];
		tableSort?: TableSortState | null;
	}) {
		filters = normalizeFilterState(state.filters);
		columnSortBy = { ...state.columnSort };
		viewMode = coerceViewMode(state.viewMode);
		if (state.table) settings.tableColumns = reconcileTableColumns(state.table);
		if (state.tableSort !== undefined) settings.tableSort = state.tableSort;

		const savedCollapsed = new Set(state.collapsedColumns);
		for (const col of [...settings.collapsedColumns]) {
			if (!savedCollapsed.has(col)) settings.toggleColumnCollapse(col);
		}
		for (const col of state.collapsedColumns) {
			if (!settings.collapsedColumns.has(col)) settings.toggleColumnCollapse(col);
		}
	}

	function applyRecipe(recipe: ViewRecipe) {
		applyViewState(recipe);
		currentRecipeId = recipe.id;
		lastAppliedRecipeSnapshot = JSON.stringify(captureCurrentViewState());
	}

	function deleteRecipe(id: string) {
		settings.deleteRecipe(id);
		if (currentRecipeId === id) {
			currentRecipeId = null;
			lastAppliedRecipeSnapshot = null;
		}
	}

	function renameRecipe(id: string, newName: string) {
		settings.renameRecipe(id, newName);
	}

	// --- Table bulk actions ---
	async function bulkUpdateIssues(ids: string[], updates: Partial<Issue>) {
		for (const id of ids) await ops.updateIssue(id, updates);
	}
	async function bulkDeleteIssues(ids: string[]) {
		for (const id of ids) await ops.deleteIssue(id);
	}

	const hasUnsavedRecipeChanges = $derived(() => {
		if (!currentRecipeId) return false;
		const current = JSON.stringify(captureCurrentViewState());
		return current !== lastAppliedRecipeSnapshot;
	});
</script>

<svelte:window onkeydown={handleKeydown} onkeyup={handleKeyup} onpopstate={handlePopState} onclick={ops.closeContextMenu} onmousemove={ops.handleMouseMove} onmouseup={ops.handleMouseUp} onblur={handleWindowBlur} />

<div class="app scheme-{colorScheme}" class:light={!isDarkMode} class:panel-open={ops.panelOpen} class:show-hotkeys={showHotkeys || settings.alwaysShowHotkeys} class:has-chat-bar={wsConnected && showActivityBar} style="--project-color: {projectColor}; --chat-bar-space: {chatBarReserve}px">

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

<CwdConflictDialog conflict={ops.cwdConflict} onresolve={ops.resolveConflict} ondismiss={ops.dismissConflict} />

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
<SetupWizard bind:show={showWizard} {isDarkMode} {projectName} ontoggleTheme={toggleTheme} oncomplete={() => {}} />
<SettingsPane
	bind:show={showSettings}
	bind:showPrompts
	bind:agentEnabled={settings.agentEnabled}
	bind:agentHost={settings.agentHost}
	bind:agentPort={settings.agentPort}
	bind:agentFirstMessage={settings.agentFirstMessage}
	bind:agentSystemPrompt={settings.agentSystemPrompt}
	bind:agentWorkflow={settings.agentWorkflow}
	bind:agentTicketDelivery={settings.agentTicketDelivery}
	bind:agentTicketNotification={settings.agentTicketNotification}
	bind:agentModel={settings.agentModel}
	bind:agentToolsExpanded={settings.agentToolsExpanded}
	bind:showAgentBar={settings.showAgentBar}
	bind:conflictStrategy={settings.conflictStrategy}
	bind:managerEnabled={settings.managerEnabled}
	bind:managerModel={settings.managerModel}
	{isDarkMode}
	{colorScheme}
	ontoggleTheme={toggleTheme}
	onsetColorScheme={(scheme) => { colorScheme = scheme; settings.colorScheme = scheme; }}
/>
	<Header
		bind:searchQuery={filters.search}
		filterCount={activeFilterCount}
		ontogglefilters={() => settings.sidebarCollapsed = !settings.sidebarCollapsed}
		bind:viewMode
		{isDarkMode}
		{projectName}
		totalIssues={issues.length}
		agentPaneCount={wsPanes.size}
		showAgentPanes={showActivityBar}
		recipes={settings.viewRecipes}
		bind:currentRecipeId
		hasUnsavedChanges={hasUnsavedRecipeChanges()}
		ontoggleTheme={toggleTheme}
		onopenKeyboardHelp={() => showKeyboardHelp = true}
		onopenCreatePanel={ops.openCreatePanel}
		onopenSettings={() => showSettings = true}
		onopenPrompts={() => { showSettings = true; showPrompts = true; }}
		onpreviewchange={(previewing) => isFilterPreviewing = previewing}
		oneditProject={() => showSettings = true}
		ontoggleAgentPanes={() => { showActivityBar = !showActivityBar; settings.showAgentBar = showActivityBar; }}
		onsaverecipe={saveRecipe}
		onapplyrecipe={applyRecipe}
		ondeleterecipe={deleteRecipe}
		onrenamerecipe={renameRecipe}
	/>

	{#if bdVersion && !bdVersion.compatible}
		<div class="version-warning">
			bd v{bdVersion.version} detected — v1.0.0+ required for full functionality. Run <code>brew upgrade bd</code> to update.
		</div>
	{/if}

	<div class="workspace">
	<FilterSidebar
		{filters}
		{availableLabels}
		{availableAssignees}
		{availableTypes}
		activeCount={activeFilterCount}
		collapsed={settings.sidebarCollapsed}
		ontogglecollapse={() => settings.sidebarCollapsed = !settings.sidebarCollapsed}
		onclear={() => filters = emptyFilterState()}
		queue={queuePanel}
		queueCount={mappedAgentQueue.length + runningAgents.length}
		onexpand={() => settings.sidebarCollapsed = false}
	/>
	<div class="workspace-main">

	{#if viewMode === 'kanban'}
	<ColumnNav
		{columns}
		bind:activeColumnIndex
		{issues}
		{filteredIssues}
		{hasActiveFilters}
		showColumnCounts={settings.showColumnCounts}
	/>

	<div class="app-body">
	<div class="main-content" class:wipe-out={projectTransition === 'wipe-out'} class:wipe-in={projectTransition === 'wipe-in'}>
		<main class="board" ontouchstart={cardDrag.handleTouchStart} ontouchend={cardDrag.handleTouchEnd}>
			{#each columns as column, i}
				{#if i === 0 && ops.isCreating}
					{@render detailPanel()}
				{/if}
				{#if i === columns.length - 1 && ops.editingIssue && ops.panelColumnIndex === i}
					{@render detailPanel()}
				{/if}
				{@const rawColumnIssues = issues.filter((x) => getIssueColumn(x).key === column.key && !queuedTicketIds.has(x.id))}
				{@const allColumnIssues = sortIssues(rawColumnIssues, columnSortBy[column.key] ?? settings.defaultColumnSort)}
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
					{hasActiveFilters}
					{isFilterPreviewing}
					{flyingCards}
					{placeholders}
					{shrinkingSourceIds}
					{worktreeTicketIds}
					{activeColumnIndex}
					showColumnCounts={settings.showColumnCounts}
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
				{#if ops.editingIssue && ops.panelColumnIndex === i && i !== columns.length - 1}
					{@render detailPanel()}
				{/if}
			{/each}
		</main>
		</div>
		{#if getManagerVisible() && managerSession}
			{#key currentProjectPath}
				<ManagerPane
					session={managerSession}
					onSendMessage={(name, msg) => sendToPane(name, msg, currentProjectPath)}
					onInterrupt={interrupt}
					disabled={!wsConnected}
				/>
			{/key}
		{/if}
	</div>
	{:else if viewMode === 'table'}
		<div class="table-layout" class:wipe-out={projectTransition === 'wipe-out'} class:wipe-in={projectTransition === 'wipe-in'}>
			{#if showSelectionGrid}
				<SelectionGrid
					issues={tableSelectedIssues}
					onselect={(issue) => { tableSelectedIds = []; ops.openEditPanel(issue); }}
					ondeselect={(id) => tableSelectedIds = tableSelectedIds.filter((x) => x !== id)}
					onclear={() => tableSelectedIds = []}
				/>
			{:else if ops.panelOpen}
				{@render detailPanel()}
			{/if}
			<TableView
				issues={orderedTableIssues}
				columnConfig={settings.tableColumns}
				sort={settings.tableSort}
				{selectedId}
				selectedIds={tableSelectedIds}
				onselect={(issue) => ops.openEditPanel(issue)}
				onselectionchange={(ids) => tableSelectedIds = ids}
				oncreate={ops.openCreatePanel}
				oncolumnschange={(cols) => settings.tableColumns = cols}
				onsortchange={(s) => settings.tableSort = s}
				onbulkupdate={bulkUpdateIssues}
				onbulkdelete={bulkDeleteIssues}
				onupdate={(id, updates) => ops.updateIssue(id, updates)}
			/>
		</div>
	{:else if viewMode === 'flow'}
		<div class="flow-layout" class:wipe-out={projectTransition === 'wipe-out'} class:wipe-in={projectTransition === 'wipe-in'}>
			{#if ops.panelOpen}
				{@render detailPanel()}
			{/if}
			<FlowView
				issues={filteredIssues}
				{selectedId}
				isDark={isDarkMode}
				onselect={(issue) => ops.openEditPanel(issue)}
			/>
		</div>
	{/if}

	</div><!-- /.workspace-main -->
	</div><!-- /.workspace -->

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
	oninterrupt={interrupt}
	managerEnabled={settings.managerEnabled}
	{managerSession}
	onstartmanager={() => startManager(currentProjectPath)}
	onstartDrag={startDrag}
	onstartResize={startResize}
	oncyclePaneSize={cyclePaneSize}
	onhandleMouseMove={ops.handleMouseMove}
	onhandleMouseUp={ops.handleMouseUp}
	onbasesizechange={(px) => chatBarReserve = px}
/>

<FlyingCardComponent {teleports} />

<InitialLoader status={loadingStatus} visible={!initialLoaded} {projectName} />

{#if switchStatus}
	<div class="switch-status" role="status" aria-live="polite">
		<span class="switch-spinner"></span>
		<span class="switch-text">{switchStatus}</span>
	</div>
{/if}

{#if zenOpen}
	<ZenReview
		ids={zenIds}
		index={zenIndex}
		{issues}
		onnav={(i) => (zenIndex = i)}
		onclose={() => (zenOpen = false)}
		onopendetail={(issue) => { zenOpen = false; ops.openEditPanel(issue); }}
		onquickaction={handleZenQuickAction}
	/>
{/if}
</div>


{#snippet queuePanel()}
	<QueuePanel
		queue={mappedAgentQueue}
		runningSessions={runningAgents}
		{draggedOverColumn}
		onCancel={ops.cancelQueueItem}
		onReorder={ops.reorderQueue}
		ondragover={(e) => cardDrag.handleDragOver(e, 'queue')}
		ondragleave={(e) => cardDrag.handleDragLeave(e, 'queue')}
		ondrop={(e) => cardDrag.handleDrop(e, 'queue')}
	/>
{/snippet}

{#snippet detailPanel()}
	<DetailPanel
		bind:editingIssue={ops.editingIssue}
		isCreating={ops.isCreating}
		bind:createForm={ops.createForm}
		allIssues={issues}
		activeAgents={activeAgentNames}
		agentEnabled={settings.agentEnabled}
		comments={ops.comments}
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
		onsetstate={(dimension, value, reason) => ops.setIssueState(dimension, value, reason)}
		onpromote={(reason) => ops.promoteWisp(reason)}
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


<PwaInstallPrompt />

<style>
	.switch-status {
		position: fixed;
		top: 1rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 9998;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.875rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--bg-secondary, #1c1c1f) 82%, transparent);
		border: 1px solid var(--border-subtle);
		box-shadow: var(--shadow-lg);
		backdrop-filter: blur(10px);
		animation: switchStatusIn 160ms ease-out;
	}

	@keyframes switchStatusIn {
		from { opacity: 0; transform: translate(-50%, -8px); }
		to { opacity: 1; transform: translate(-50%, 0); }
	}

	.switch-spinner {
		width: 13px;
		height: 13px;
		border: 2px solid var(--border-default, rgba(255, 255, 255, 0.15));
		border-top-color: var(--accent-primary, #6366f1);
		border-radius: 50%;
		animation: switchSpin 0.7s linear infinite;
	}

	@keyframes switchSpin {
		to { transform: rotate(360deg); }
	}

	.switch-text {
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--text-primary);
		white-space: nowrap;
	}

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
		height: calc(100vh - var(--chat-bar-space, 64px));
	}

	.workspace {
		display: flex;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.workspace-main {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
	}

	.app-body {
		display: flex;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.main-content {
		display: flex;
		flex: 1;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
	}

	.main-content.wipe-out {
		animation: wipeUp 350ms ease-in forwards;
	}

	.main-content.wipe-in {
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

	.table-layout {
		display: flex;
		flex: 1;
		gap: 1rem;
		padding: 1.25rem;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
	}

	/* Wider detail panel in table view — more room than the 420px kanban panel */
	.table-layout :global(.panel) {
		flex: 0 0 clamp(480px, 40%, 760px);
		min-width: 480px;
		max-width: 760px;
	}

	/* Multi-select grid occupies the same side slot as the detail panel */
	.table-layout :global(.selection-grid) {
		flex: 0 0 clamp(480px, 40%, 760px);
		min-width: 480px;
		max-width: 760px;
	}

	.flow-layout {
		display: flex;
		flex: 1;
		gap: 1rem;
		padding: 1.25rem;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
	}

	.flow-layout :global(.panel) {
		flex: 0 0 clamp(420px, 34%, 620px);
		min-width: 420px;
		max-width: 620px;
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
