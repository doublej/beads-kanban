<script lang="ts">
	import { browser } from '$app/environment';
	import { untrack } from 'svelte';
	import { connect, disconnect, getPanes, isConnected, addPane, removePane, sendToPane, killSession, clearAllSessions, endSession, clearSession, continueSession, compactSession, getPersistedSdkSessionId, getAllPersistedSessions, deletePersistedSession, fetchSdkSessions, markPaneAsRead, getTotalUnreadCount, getUnreadCount, notifyAgentOfTicketUpdate, type Pane, type SdkSessionInfo } from '$lib/wsStore.svelte';
	import type { Issue, Comment, Attachment, CardPosition, FlyingCard, ContextMenuState, RopeDragState, SortBy, PaneSize, ViewMode, Project } from '$lib/types';
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
	import {
		loadComments as loadCommentsApi,
		addCommentApi,
		createDependencyApi,
		removeDependencyApi,
		loadAttachmentsApi,
		uploadAttachmentApi,
		deleteAttachmentApi
	} from '$lib/api';
	import ColumnNav from '$lib/components/ColumnNav.svelte';
	import Header from '$lib/components/Header.svelte';
	import ContextMenu from '$lib/components/ContextMenu.svelte';
	import RopeDrag from '$lib/components/RopeDrag.svelte';
	import DepTypePicker from '$lib/components/DepTypePicker.svelte';
	import KeyboardHelp from '$lib/components/KeyboardHelp.svelte';
	import KanbanColumn from '$lib/components/KanbanColumn.svelte';
	import IssueCard from '$lib/components/IssueCard.svelte';
	import DetailPanel from '$lib/components/DetailPanel.svelte';
	import FlyingCardComponent from '$lib/components/FlyingCard.svelte';
	import AgentBar from '$lib/components/AgentBar.svelte';
	import InitialLoader from '$lib/components/InitialLoader.svelte';
	import TreeView from '$lib/components/TreeView.svelte';
	import GraphView from '$lib/components/GraphView.svelte';
		import MutationLog from '$lib/components/MutationLog.svelte';
	import SettingsPane from '$lib/components/SettingsPane.svelte';
	import { fetchMutations } from '$lib/mutationStore.svelte';
	import StatsView from '$lib/components/StatsView.svelte';
	import ThemeTransition from '$lib/components/ThemeTransition.svelte';
	import ProjectSwitcher from '$lib/components/ProjectSwitcher.svelte';
	import { settings } from '$lib/stores/settings.svelte';
	import { createPaneDrag } from '$lib/stores/pane-drag.svelte';
	import { formatTicketDelivery as formatTicketDeliveryFn, isValidSession as isValidSessionFn } from '$lib/agent/ticket-delivery';
	import type { TicketDeliveryData } from '$lib/agent/ticket-delivery';
	import { createKeyboardNav } from '$lib/keyboard/kanban-nav';
	import { createIssueStore } from '$lib/stores/issue-store.svelte';
	import { createCardDrag } from '$lib/drag-drop/card-drag.svelte';
	import { issueMatchesFilters as matchesFilters, hasActiveFilters as checkActiveFilters, type FilterState } from '$lib/filters';

	let bdVersion = $state<{ version: string; compatible: boolean } | null>(null);
	let editingIssue = $state<Issue | null>(null);
	let originalLabels = $state<string[]>([]);
	let panelColumnIndex = $state<number | null>(null); // Fixed column index when panel is opened
	let isCreating = $state(false);
	let createForm = $state({ title: '', description: '', priority: 2, issue_type: 'task', deps: [] as string[] });
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
	let isDarkMode = $state(true); // synced with settings store
	let colorScheme = $state('default'); // synced with settings store
	let notificationsEnabled = $state(false); // synced with settings store
	let themeTransitionActive = $state(false);
	let themeTransitionToLight = $state(false);
	let comments = $state<{ id: number; author: string; text: string; created_at: string }[]>([]);
	let newComment = $state('');
	let loadingComments = $state(false);
	let attachments = $state<Attachment[]>([]);
	let loadingAttachments = $state(false);
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
	const paneDrag = createPaneDrag();
	let contextMenu = $state<{ x: number; y: number; issue: Issue } | null>(null);
	let collapsedColumns = $derived(settings.collapsedColumns);
	let columnSortBy = $state<Record<string, 'priority' | 'created' | 'title'>>({});
	let sortMenuOpen = $state<string | null>(null);
	let ropeDrag = $state<{ fromId: string; startX: number; startY: number; currentX: number; currentY: number; targetId: string | null } | null>(null);
	let newLabelInput = $state('');
	let pendingDep = $state<{ fromId: string; toId: string } | null>(null);
	let showKeyboardHelp = $state(false);
	let showHotkeys = $state(false);
	let showSettings = $state(false);
	let showPrompts = $state(false);
	let showPromptsEditor = $state(false);
	let projectName = $state('');
	// Agent settings - local $state vars synced with settings store for template bind: compatibility
	let agentEnabled = $state(true);
	let agentHost = $state('localhost');
	let agentPort = $state(8765);
	let agentFirstMessage = $state('');
	let agentSystemPrompt = $state('');
	let agentWorkflow = $state('');
	let agentTicketDelivery = $state('');
	let agentTicketNotification = $state('');
	let agentToolsExpanded = $state(false);
	const combinedSystemPrompt = $derived(settings.combinedSystemPrompt);
	let agentMenuOpen = $state(false);
	let agentNameInputOpen = $state(false);
	let agentNameInputRef = $state<HTMLInputElement | null>(null);
	let teleports = $state<{id: string; from: {x: number; y: number; w: number; h: number}; to: {x: number; y: number; w: number; h: number}; startTime: number}[]>([]);
	let placeholders = $state<{id: string; targetColumn: string; height: number}[]>([]);
	let cardRefs = $state<Map<string, HTMLElement>>(new Map());
	let placeholderRefs = $state<Map<string, HTMLElement>>(new Map());
	let flyingCards = $state<Map<string, {from: {x: number; y: number; w: number; h: number}; to: {x: number; y: number; w: number; h: number}; issue: Issue}>>(new Map());
	let issueClosedExternally = $state(false);
	let viewMode = $state<ViewMode>('kanban');
	let showMutationLog = $state(false);
	let projects = $state<Project[]>([]);
	let showProjectSwitcher = $state(false);
	let currentProjectPath = $state('');
	let projectColor = $state('#6366f1');
	let projectTransition = $state<'idle' | 'wipe-out' | 'wipe-in'>('idle');

	// --- Issue Store ---
	const issueStore = createIssueStore({
		onNewIssue: (issue) => sendNotification('New Issue Created', issue.title),
		onStatusChange: (issue, oldStatus) => {
			if (issue.status === 'blocked' && oldStatus !== 'blocked') {
				sendNotification('Issue Blocked', `${issue.title} is now blocked`);
			} else if (issue.status !== 'blocked' && oldStatus === 'blocked') {
				sendNotification('Issue Unblocked', `${issue.title} is no longer blocked`);
			}
		},
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
		notifyTicket: (id, message, type, context) => notifyTicket(id, message, type, context),
		onEditingIssueClosedExternally: () => { issueClosedExternally = true; },
		getEditingIssue: () => editingIssue,
		getIsCreating: () => isCreating
	});

	// Convenience aliases for store properties
	let issues = $derived(issueStore.issues);
	let animatingIds = $derived(issueStore.animatingIds);
	let loadingStatus = $derived(issueStore.loadingStatus);
	let initialLoaded = $derived(issueStore.initialLoaded);

	// --- Card Drag/Drop & Touch ---
	const cardDrag = createCardDrag({
		getIssues: () => issues,
		updateIssue: (id, updates) => issueStore.updateIssue(id, updates),
		getActiveColumnIndex: () => activeColumnIndex,
		setActiveColumnIndex: (idx) => { activeColumnIndex = idx; },
		closePanel
	});

	let draggedId = $derived(cardDrag.draggedId);
	let draggedOverColumn = $derived(cardDrag.draggedOverColumn);
	let dropIndicatorIndex = $derived(cardDrag.dropIndicatorIndex);
	let dropTargetColumn = $derived(cardDrag.dropTargetColumn);
	let isPanelDragging = $derived(cardDrag.isPanelDragging);
	let panelDragOffset = $derived(cardDrag.panelDragOffset);

	function getCardPosition(id: string): {x: number; y: number; w: number; h: number} | null {
		const el = cardRefs.get(id);
		if (!el) return null;
		const rect = el.getBoundingClientRect();
		return { x: rect.left, y: rect.top, w: rect.width, h: rect.height };
	}

	function getPlaceholderPosition(id: string): {x: number; y: number; w: number; h: number} | null {
		const el = placeholderRefs.get(id);
		if (!el) return null;
		const rect = el.getBoundingClientRect();
		return { x: rect.left, y: rect.top, w: rect.width, h: rect.height };
	}

	function triggerTeleport(id: string, fromPos: {x: number; y: number; w: number; h: number}) {
		// Get placeholder position immediately (before issues update removes it from DOM)
		const toPos = getPlaceholderPosition(id);
		if (!toPos) {
			// Clean up placeholder even if we can't find position
			placeholders = placeholders.filter(p => p.id !== id);
			return;
		}
		teleports = [...teleports, { id, from: fromPos, to: toPos, startTime: Date.now() }];
		setTimeout(() => {
			teleports = teleports.filter(t => t.id !== id);
			placeholders = placeholders.filter(p => p.id !== id);
		}, 800);
	}

	// Debug: expose test function to console
	if (browser) {
		(window as any).testTeleport = () => {
			const firstCard = document.querySelector('.card') as HTMLElement;
			if (!firstCard) return console.log('No cards found');
			const rect = firstCard.getBoundingClientRect();
			const from = { x: rect.left - 300, y: rect.top - 100, w: rect.width, h: rect.height };
			const to = { x: rect.left, y: rect.top, w: rect.width, h: rect.height };
			teleports = [...teleports, { id: 'test', from, to, startTime: Date.now() }];
			setTimeout(() => { teleports = teleports.filter(t => t.id !== 'test'); }, 800);
			console.log('Teleport triggered!');
		};
	}

	function registerCard(node: HTMLElement, id: string) {
		cardRefs.set(id, node);
		return {
			destroy() {
				cardRefs.delete(id);
			}
		};
	}

	function registerPlaceholder(node: HTMLElement, id: string) {
		placeholderRefs.set(id, node);
		return {
			destroy() {
				placeholderRefs.delete(id);
			}
		};
	}

	function toggleSortMenu(columnKey: string, e: MouseEvent) {
		e.stopPropagation();
		sortMenuOpen = sortMenuOpen === columnKey ? null : columnKey;
	}

	function setColumnSort(columnKey: string, sortBy: 'priority' | 'created' | 'title') {
		columnSortBy = { ...columnSortBy, [columnKey]: sortBy };
		sortMenuOpen = null;
	}

	async function startAgentServer() {
		try {
			await fetch('/api/agent', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'start' })
			});
			// The wsStore will auto-reconnect
		} catch (err) {
			console.error('Failed to start agent server:', err);
		}
	}

	async function restartAgentServer() {
		try {
			disconnect();
			await fetch('/api/agent', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'restart' })
			});
			setTimeout(() => connect(), 800);
		} catch (err) {
			console.error('Failed to restart agent server:', err);
		}
	}

	function toggleColumnCollapse(key: string) {
		settings.toggleColumnCollapse(key);
	}

	// Pane drag/resize delegated to paneDrag module
	const { cyclePaneSize, startDrag, startResize } = paneDrag;
	// Aliases for template shorthand props ({paneSizes}, {draggingPane}, etc.)
	let paneSizes = $derived(paneDrag.paneSizes);
	let panePositions = $derived(paneDrag.panePositions);
	let paneCustomSizes = $derived(paneDrag.paneCustomSizes);
	let draggingPane = $derived(paneDrag.draggingPane);
	let resizingPane = $derived(paneDrag.resizingPane);

	// Attach document-level listeners when dragging/resizing
	$effect(() => paneDrag.setupListeners());

	function handleMouseMove(e: MouseEvent) {
		// Only handle ropeDrag here - pane drag/resize use document listeners
		if (ropeDrag) {
			ropeDrag = { ...ropeDrag, currentX: e.clientX, currentY: e.clientY };
			// Find card under cursor - get all elements at point and find card
			const elements = document.elementsFromPoint(e.clientX, e.clientY);
			const card = elements.find(el => el.classList.contains('card')) as HTMLElement | null;
			const targetId = card?.querySelector('.card-id')?.textContent?.trim() || null;
			if (targetId && targetId !== ropeDrag.fromId) {
				ropeDrag = { ...ropeDrag, targetId };
			} else {
				ropeDrag = { ...ropeDrag, targetId: null };
			}
		}
	}

	function handleMouseUp() {
		if (ropeDrag && ropeDrag.targetId) {
			pendingDep = { fromId: ropeDrag.fromId, toId: ropeDrag.targetId };
		}
		ropeDrag = null;
	}

	function getIssueTitle(id: string): string {
		return issues.find(i => i.id === id)?.title ?? id;
	}

	async function confirmDependency(depType: string) {
		if (!pendingDep) return;
		const { fromId, toId } = pendingDep;
		await createDependencyApi(fromId, toId, depType);
		// Notify both agents if active
		notifyTicket(fromId, `Dependency added: ${depType} → ${toId}`, 'dependency', { ticketTitle: getIssueTitle(fromId), sender: 'user' });
		notifyTicket(toId, `Dependency added: ${fromId} ${depType} this`, 'dependency', { ticketTitle: getIssueTitle(toId), sender: 'user' });
		closeContextMenu();
	}

	function cancelDependency() {
		pendingDep = null;
	}

	async function createDependency(fromId: string, toId: string) {
		const res = await fetch(`/api/issues/${fromId}/deps`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ depends_on: toId, dep_type: 'blocks' })
		});
		const data = await res.json();
		if (!res.ok) {
			console.error('Failed to create dependency:', data.error);
			return;
		}
		// Notify both agents if active
		notifyTicket(fromId, `Dependency added: blocks → ${toId}`, 'dependency', { ticketTitle: getIssueTitle(fromId), sender: 'user' });
		notifyTicket(toId, `Dependency added: ${fromId} blocks this`, 'dependency', { ticketTitle: getIssueTitle(toId), sender: 'user' });
		closeContextMenu();
	}

	async function removeDependency(issueId: string, dependsOnId: string) {
		const res = await fetch(`/api/issues/${issueId}/deps`, {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ depends_on: dependsOnId })
		});
		const data = await res.json();
		if (!res.ok) {
			console.error('Failed to remove dependency:', data.error);
			return;
		}
		if (editingIssue) {
			if (editingIssue.dependencies) {
				editingIssue.dependencies = editingIssue.dependencies.filter(d => d.id !== dependsOnId);
			}
			if (editingIssue.dependents) {
				editingIssue.dependents = editingIssue.dependents.filter(d => d.id !== issueId);
			}
		}
		// Notify both agents if active
		notifyTicket(issueId, `Dependency removed: → ${dependsOnId}`, 'dependency', { ticketTitle: getIssueTitle(issueId), sender: 'user' });
		notifyTicket(dependsOnId, `Dependency removed: ${issueId} no longer blocks`, 'dependency', { ticketTitle: getIssueTitle(dependsOnId), sender: 'user' });
	}

	function startRopeDrag(e: MouseEvent, issueId: string) {
		e.preventDefault();
		e.stopPropagation();
		ropeDrag = {
			fromId: issueId,
			startX: e.clientX,
			startY: e.clientY,
			currentX: e.clientX,
			currentY: e.clientY,
			targetId: null
		};
		closeContextMenu();
	}

	const { getPaneStyle, isCustomized } = paneDrag;

	// Reactive polling for cross-module state (Svelte 5 doesn't track $state across modules in $derived)
	let wsConnected = $state(false);
	let wsPanes = $state<Map<string, Pane>>(new Map());
	let lastPanesJson = '';

	$effect(() => {
		const poll = () => {
			wsConnected = isConnected();
			// Only update wsPanes if content actually changed (prevent infinite loops)
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

	const panelOpen = $derived(editingIssue !== null || isCreating);
	const activeAgentNames = $derived([...wsPanes.keys()]);

	// Get all unique labels from issues for filter dropdown
	const filterState = $derived<FilterState>({
		searchQuery,
		filterPriority,
		filterType,
		filterTime,
		filterStatus,
		filterLabel,
		filterActionable
	});

	function issueMatchesFilters(issue: Issue): boolean {
		return matchesFilters(issue, filterState);
	}
	const hasActiveFilters = $derived(checkActiveFilters(filterState));

	const availableLabels = $derived([...new Set(issues.flatMap(i => i.labels || []))].sort());

	const filteredIssues = $derived(
		issues.filter((issue) => issueMatchesFilters(issue))
	);

	// --- Issue CRUD delegating to issueStore ---
	async function updateIssue(id: string, updates: Partial<Issue>) {
		await issueStore.updateIssue(id, updates);
	}

	async function deleteIssue(id: string) {
		const deleted = await issueStore.deleteIssue(id);
		if (deleted && editingIssue?.id === id) editingIssue = null;
	}

	function openContextMenu(e: MouseEvent, issue: Issue) {
		e.preventDefault();
		e.stopPropagation();
		contextMenu = { x: e.clientX, y: e.clientY, issue };
	}

	function closeContextMenu() {
		contextMenu = null;
		sortMenuOpen = null;
	}

	async function setIssuePriority(id: string, priority: number) {
		await updateIssue(id, { priority });
		closeContextMenu();
	}

	let copiedId = $state<string | null>(null);
	async function copyToClipboard(text: string, id?: string) {
		await navigator.clipboard.writeText(text);
		copiedId = id ?? text;
		setTimeout(() => copiedId = null, 1500);
	}

	async function createIssue() {
		if (!createForm.title.trim()) return;
		const form = { title: createForm.title, description: createForm.description, priority: createForm.priority, issue_type: createForm.issue_type };
		createForm = { title: '', description: '', priority: 2, issue_type: 'task', deps: [] };
		isCreating = false;
		await issueStore.createIssue(form);
	}

	async function createIssueAndStartAgent() {
		if (!createForm.title.trim()) return;
		const savedForm = { title: createForm.title, description: createForm.description, priority: createForm.priority, issue_type: createForm.issue_type };
		createForm = { title: '', description: '', priority: 2, issue_type: 'task', deps: [] };
		isCreating = false;

		const newId = await issueStore.createIssueAndGetId(savedForm);
		if (newId) {
			const agentName = `${newId}-agent`;
			const newIssue: Issue = {
				id: newId,
				title: savedForm.title,
				description: savedForm.description || '',
				status: 'open',
				priority: savedForm.priority || 2,
				issue_type: savedForm.issue_type || 'task'
			};
			const briefing = formatTicketDelivery(agentName, { issue: newIssue });
			addPane(agentName, currentProjectPath, briefing, combinedSystemPrompt, undefined, newId);
			expandedPanes.add(agentName);
			expandedPanes = new Set(expandedPanes);
		}
	}

	function formatTicketDelivery(agentName: string, data: TicketDeliveryData): string {
		return formatTicketDeliveryFn(agentName, data, agentTicketDelivery);
	}

	function notifyTicket(
		ticketId: string,
		content: string,
		notificationType: 'comment' | 'dependency' | 'attachment' | 'status' | 'priority' | 'assignee' | 'label',
		context?: { ticketTitle?: string; sender?: string }
	) {
		notifyAgentOfTicketUpdate(ticketId, content, notificationType, context, agentTicketNotification);
	}

	async function startAgentForIssue(issue: Issue) {
		const agentName = `${issue.id}-agent`;

		// Fetch comments and attachments for the issue
		const [issueComments, issueAttachments] = await Promise.all([
			loadCommentsApi(issue.id),
			loadAttachmentsApi(issue.id)
		]);

		const briefing = formatTicketDelivery(agentName, {
			issue,
			comments: issueComments,
			attachments: issueAttachments
		});
		addPane(agentName, currentProjectPath, briefing, combinedSystemPrompt, undefined, issue.id);
		expandedPanes.add(agentName);
		expandedPanes = new Set(expandedPanes);
		// Close panel to show agent activity
		editingIssue = null;
		isCreating = false;
	}

	function openAgentPane(paneName: string) {
		// Expand the pane if it exists
		if (wsPanes.has(paneName)) {
			expandedPanes.add(paneName);
			expandedPanes = new Set(expandedPanes);
		}
	}

	function openTicketFromPane(ticketId: string) {
		// Find the issue and open the detail panel
		const issue = issues.find(i => i.id === ticketId);
		if (issue) {
			editingIssue = issue;
			isCreating = false;
		}
	}

	// Extract ticketId from agent name pattern "{ticketId}-agent"
	function extractTicketIdFromName(name: string): string | undefined {
		if (name.endsWith('-agent')) return name.slice(0, -6);
		return undefined;
	}

	function openCreatePanel() {
		editingIssue = null;
		isCreating = true;
		createForm = { title: '', description: '', priority: 2, issue_type: 'task', deps: [] };
		requestAnimationFrame(() => {
			const titleInput = document.getElementById('create-title') as HTMLInputElement;
			titleInput?.focus();
		});
	}

	async function loadComments(issueId: string) {
		loadingComments = true;
		const res = await fetch(`/api/issues/${issueId}/comments`);
		const data = await res.json();
		comments = data.comments || [];
		loadingComments = false;
	}

	async function loadAttachments(issueId: string) {
		loadingAttachments = true;
		attachments = await loadAttachmentsApi(issueId);
		loadingAttachments = false;
	}

	async function handleUploadAttachment(file: File) {
		if (!editingIssue) return;
		const attachment = await uploadAttachmentApi(editingIssue.id, file);
		if (attachment) {
			attachments = [...attachments, attachment];
			// Notify agent if one is active for this ticket
			notifyTicket(
				editingIssue.id,
				`Attachment added: ${file.name}`,
				'attachment',
				{ ticketTitle: editingIssue.title, sender: 'user' }
			);
		}
	}

	async function handleDeleteAttachment(filename: string) {
		if (!editingIssue) return;
		await deleteAttachmentApi(editingIssue.id, filename);
		attachments = attachments.filter(a => a.filename !== filename);
		notifyTicket(
			editingIssue.id,
			`Attachment removed: ${filename}`,
			'attachment',
			{ ticketTitle: editingIssue.title, sender: 'user' }
		);
	}

	async function addComment() {
		if (!editingIssue || !newComment.trim()) return;
		const commentText = newComment.trim();
		await fetch(`/api/issues/${editingIssue.id}/comments`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ text: commentText })
		});
		// Notify agent if one is active for this ticket
		notifyTicket(
			editingIssue.id,
			`Comment: "${commentText.slice(0, 100)}${commentText.length > 100 ? '...' : ''}"`,
			'comment',
			{ ticketTitle: editingIssue.title, sender: 'user' }
		);
		newComment = '';
		await loadComments(editingIssue.id);
		fetchMutations();
	}

	function openEditPanel(issue: Issue, pushState = true) {
		if (hasUnsavedCreate()) {
			if (!confirm('You have unsaved changes. Discard them?')) return;
		}
		isCreating = false;
		createForm = { title: '', description: '', priority: 2, issue_type: 'task', deps: [] };
		editingIssue = { ...issue, labels: issue.labels ? [...issue.labels] : [] };
		originalLabels = issue.labels ? [...issue.labels] : [];
		// Capture column index when panel opens - panel stays here even if status changes
		const col = getIssueColumn(issue);
		const idx = columns.findIndex(c => c.key === col.key);
		panelColumnIndex = idx >= 0 ? idx : 0;
		selectedId = issue.id;
		comments = [];
		loadComments(issue.id);
		loadAttachments(issue.id);
		if (browser && pushState) {
			const url = new URL(window.location.href);
			url.searchParams.set('issue', issue.id);
			history.pushState({ issue: issue.id }, '', url);
		}
	}

	function setEditingColumn(columnKey: string) {
		if (!editingIssue) return;
		const updates = getColumnMoveUpdates(editingIssue, columnKey);
		if (updates.status) editingIssue.status = updates.status;
	}

	function addLabelToEditing(label: string) {
		if (!editingIssue) return;
		const trimmed = label.trim().toLowerCase();
		if (!trimmed) return;
		const labels = editingIssue.labels || [];
		if (!labels.includes(trimmed)) {
			editingIssue.labels = [...labels, trimmed];
		}
		newLabelInput = '';
	}

	function removeLabelFromEditing(label: string) {
		if (!editingIssue) return;
		editingIssue.labels = (editingIssue.labels || []).filter(l => l !== label);
	}

	function hasUnsavedCreate(): boolean {
		return isCreating && (createForm.title.trim() !== '' || createForm.description.trim() !== '');
	}

	function closePanel(pushState = true, force = false) {
		if (!force && hasUnsavedCreate()) {
			if (!confirm('You have unsaved changes. Discard them?')) return;
		}
		editingIssue = null;
		panelColumnIndex = null;
		isCreating = false;
		issueClosedExternally = false;
		comments = [];
		attachments = [];
		newComment = '';
		if (browser && pushState) {
			const url = new URL(window.location.href);
			url.searchParams.delete('issue');
			history.pushState({}, '', url);
		}
	}

	function openIssueById(id: string, pushState = true) {
		const issue = issues.find(i => i.id === id);
		if (issue) openEditPanel(issue, pushState);
	}

	function handlePopState(e: PopStateEvent) {
		const issueId = e.state?.issue || new URL(window.location.href).searchParams.get('issue');
		if (issueId) openIssueById(issueId, false);
		else closePanel(false);
	}

	// --- Keyboard Navigation ---
	const keyboardNav = createKeyboardNav({
		getFilteredIssues: () => filteredIssues,
		getSelectedId: () => selectedId,
		setSelectedId: (id) => { selectedId = id; },
		getPanelOpen: () => panelOpen,
		getIsCreating: () => isCreating,
		getShowKeyboardHelp: () => showKeyboardHelp,
		setShowKeyboardHelp: (v) => { showKeyboardHelp = v; },
		getShowHotkeys: () => showHotkeys,
		setShowHotkeys: (v) => { showHotkeys = v; },
		getShowProjectSwitcher: () => showProjectSwitcher,
		setShowProjectSwitcher: (v) => { showProjectSwitcher = v; },
		getProjectCount: () => projects.length,
		createIssue,
		openCreatePanel,
		openEditPanel,
		deleteIssue,
		toggleTheme,
		closePanel
	});
	const { handleKeydown, handleKeyup, handleWindowBlur } = keyboardNav;

	function toggleTheme() {
		if (themeTransitionActive) return;
		themeTransitionToLight = isDarkMode; // going from dark to light
		themeTransitionActive = true;
	}

	function switchTheme() {
		isDarkMode = !isDarkMode;
		settings.isDarkMode = isDarkMode;
	}

	function completeThemeTransition() {
		themeTransitionActive = false;
	}

	async function toggleNotifications() {
		if (notificationsEnabled) {
			notificationsEnabled = false;
			return;
		}
		if (!browser) return;
		if (!('Notification' in window)) return;

		if (Notification.permission === 'granted') {
			notificationsEnabled = true;
		} else if (Notification.permission !== 'denied') {
			const permission = await Notification.requestPermission();
			if (permission === 'granted') {
				notificationsEnabled = true;
			}
		}
	}

	function sendNotification(title: string, body: string) {
		if (!notificationsEnabled || !browser) return;
		if (!('Notification' in window)) return;
		if (Notification.permission !== 'granted') return;
		new Notification(title, { body, icon: '/favicon.png' });
	}

	// Load settings from localStorage on mount, sync local vars from store
	$effect(() => {
		settings.load();
		isDarkMode = settings.isDarkMode;
		colorScheme = settings.colorScheme;
		notificationsEnabled = settings.notificationsEnabled;
		agentEnabled = settings.agentEnabled;
		agentHost = settings.agentHost;
		agentPort = settings.agentPort;
		agentFirstMessage = settings.agentFirstMessage;
		agentSystemPrompt = settings.agentSystemPrompt;
		agentWorkflow = settings.agentWorkflow;
		agentTicketDelivery = settings.agentTicketDelivery;
		agentTicketNotification = settings.agentTicketNotification;
		agentToolsExpanded = settings.agentToolsExpanded;
	});

	// Persist local setting changes to the store (which handles localStorage)
	$effect(() => { settings.agentEnabled = agentEnabled; });
	$effect(() => { settings.agentHost = agentHost; });
	$effect(() => { settings.agentPort = agentPort; });
	$effect(() => { settings.agentFirstMessage = agentFirstMessage; });
	$effect(() => { settings.agentSystemPrompt = agentSystemPrompt; });
	$effect(() => { settings.agentWorkflow = agentWorkflow; });
	$effect(() => { settings.agentTicketDelivery = agentTicketDelivery; });
	$effect(() => { settings.agentTicketNotification = agentTicketNotification; });
	$effect(() => { settings.agentToolsExpanded = agentToolsExpanded; });
	$effect(() => { settings.colorScheme = colorScheme; });
	$effect(() => { settings.notificationsEnabled = notificationsEnabled; });

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
		if (browser && agentEnabled) connect();
		return () => disconnect();
	});

	// Deep link: open issue from URL on initial load
	let initialUrlChecked = false;
	$effect(() => {
		if (!browser || initialUrlChecked || issues.length === 0) return;
		initialUrlChecked = true;
		const issueId = new URL(window.location.href).searchParams.get('issue');
		if (issueId) openIssueById(issueId, false);
	});

	// Register project on load and fetch all projects
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

		// Start wipe out (bottom to top)
		projectTransition = 'wipe-out';

		// Close SSE and change CWD in parallel with animation
		issueStore.closeSse();

		const [cwdRes] = await Promise.all([
			fetch('/api/cwd', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ path: project.path })
			}),
			new Promise(r => setTimeout(r, WIPE_DURATION))
		]);

		if (!cwdRes.ok) {
			projectTransition = 'idle';
			return;
		}

		// Fetch new issues
		const issuesRes = await fetch('/api/issues');
		const issuesData = await issuesRes.json();

		// Update state
		issueStore.setIssues(issuesData.issues || []);
		currentProjectPath = project.path;
		projectName = project.name;
		projectColor = project.color;
		issueStore.initialLoaded = true;
		selectedId = null;
		editingIssue = null;
		isCreating = false;

		// Start wipe in (top to bottom)
		projectTransition = 'wipe-in';
		issueStore.connectSSE();

		await new Promise(r => setTimeout(r, WIPE_DURATION));
		projectTransition = 'idle';
	}
</script>

<svelte:window onkeydown={handleKeydown} onkeyup={handleKeyup} onpopstate={handlePopState} onclick={closeContextMenu} onmousemove={handleMouseMove} onmouseup={handleMouseUp} onblur={handleWindowBlur} />

{#if contextMenu}
	<ContextMenu
		x={contextMenu.x}
		y={contextMenu.y}
		issue={contextMenu.issue}
		onSetPriority={(p) => setIssuePriority(contextMenu.issue.id, p)}
		onStartRopeDrag={(e) => startRopeDrag(e, contextMenu.issue.id)}
		onClose={closeContextMenu}
	/>
{/if}

<RopeDrag {ropeDrag} />

<DepTypePicker {pendingDep} onconfirm={confirmDependency} oncancel={cancelDependency} />

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

<div class="app scheme-{colorScheme}" class:light={!isDarkMode} class:panel-open={panelOpen} class:show-hotkeys={showHotkeys} class:has-chat-bar={wsConnected && showActivityBar} style="--project-color: {projectColor}">

<MutationLog
	show={showMutationLog}
	onclose={() => showMutationLog = false}
	onticketclick={(id) => {
		const issue = issues.find(i => i.id === id);
		if (issue) openEditPanel(issue);
	}}
/>

<KeyboardHelp bind:show={showKeyboardHelp} />
<SettingsPane
	bind:show={showSettings}
	bind:showPrompts
	bind:showPromptsEditor
	bind:agentEnabled
	bind:agentHost
	bind:agentPort
	bind:agentFirstMessage
	bind:agentSystemPrompt
	bind:agentWorkflow
	bind:agentTicketDelivery
	bind:agentTicketNotification
	bind:agentToolsExpanded
	{isDarkMode}
	{colorScheme}
	{notificationsEnabled}
	ontoggleTheme={toggleTheme}
	onsetColorScheme={(scheme) => colorScheme = scheme}
	ontoggleNotifications={toggleNotifications}
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
		onopenCreatePanel={openCreatePanel}
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
				{#if i === 0 && isCreating}
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
					{sortMenuOpen}
					{selectedId}
					{editingIssue}
					{draggedId}
					{draggedOverColumn}
					{dropTargetColumn}
					{dropIndicatorIndex}
					{animatingIds}
					{copiedId}
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
					oncollapseclick={(key) => toggleColumnCollapse(key)}
					ontogglecollapse={(e, key) => { e.stopPropagation(); toggleColumnCollapse(key); }}
					ontogglesortmenu={(key, e) => toggleSortMenu(key, e)}
					onsetcolumnsort={(key, sortBy) => setColumnSort(key, sortBy)}
					oncardclick={(issue) => openEditPanel(issue)}
					oncarddragstart={(e, id) => cardDrag.handleDragStart(e, id)}
					oncarddragend={cardDrag.handleDragEnd}
					oncardcontextmenu={(e, issue) => openContextMenu(e, issue)}
					oncopyid={(id, text) => copyToClipboard(id, text)}
					showAddButton={i === 0}
					onaddclick={openCreatePanel}
				/>
				{#if editingIssue && panelColumnIndex === i}
					{@render detailPanel()}
				{/if}
			{/each}
		</main>
		</div>
	{:else if viewMode === 'tree'}
		<div class="list-view-layout" class:wipe-out={projectTransition === 'wipe-out'} class:wipe-in={projectTransition === 'wipe-in'}>
			<TreeView {issues} {selectedId} onselect={(issue) => openEditPanel(issue)} oncreate={openCreatePanel} />
			{#if panelOpen}
				{@render detailPanel()}
			{/if}
		</div>
	{:else if viewMode === 'graph'}
		<div class="list-view-layout" class:wipe-out={projectTransition === 'wipe-out'} class:wipe-in={projectTransition === 'wipe-in'}>
			<GraphView {issues} {selectedId} onselect={(issue) => openEditPanel(issue)} />
			{#if panelOpen}
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
	bind:agentMenuOpen
	bind:agentNameInputOpen
	bind:newPaneName
	bind:agentNameInputRef
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
	{agentEnabled}
	{isDarkMode}
	{agentToolsExpanded}
	{currentProjectPath}
	{agentFirstMessage}
	{combinedSystemPrompt}
	{agentSystemPrompt}
	{getPersistedSdkSessionId}
	{getUnreadCount}
	{getTotalUnreadCount}
	{extractTicketIdFromName}
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
	onopenTicketFromPane={openTicketFromPane}
	onstartDrag={startDrag}
	onstartResize={startResize}
	oncyclePaneSize={cyclePaneSize}
	onhandleMouseMove={handleMouseMove}
	onhandleMouseUp={handleMouseUp}
/>

<FlyingCardComponent {teleports} />
</div>

<InitialLoader status={loadingStatus} visible={!initialLoaded} />


{#snippet detailPanel()}
	<DetailPanel
		bind:editingIssue
		{isCreating}
		bind:createForm
		allIssues={issues}
		activeAgents={activeAgentNames}
		{agentEnabled}
		{comments}
		{copiedId}
		bind:newLabelInput
		bind:newComment
		{loadingComments}
		attachments={attachments}
		loadingAttachments={loadingAttachments}
		onuploadattachment={handleUploadAttachment}
		ondeleteattachment={handleDeleteAttachment}
		{originalLabels}
		{isPanelDragging}
		{panelDragOffset}
		{issueClosedExternally}
		onclose={closePanel}
		oncreate={createIssue}
		oncreateandstartagent={createIssueAndStartAgent}
		onstartagent={startAgentForIssue}
		onviewchat={openAgentPane}
		ondelete={(id) => deleteIssue(id)}
		onsave={(id, updates) => updateIssue(id, updates)}
		onaddcomment={addComment}
		oncopyid={(text, id) => copyToClipboard(text, id)}
		onsetcolumn={(key) => setEditingColumn(key)}
		onaddlabel={(label) => addLabelToEditing(label)}
		onremovelabel={(label) => removeLabelFromEditing(label)}
		onremovedep={(issueId, depId) => removeDependency(issueId, depId)}
		onpaneltouchstart={cardDrag.handlePanelTouchStart}
		onpaneltouchmove={cardDrag.handlePanelTouchMove}
		onpaneltouchend={cardDrag.handlePanelTouchEnd}
		updatecreateform={(key, value) => createForm[key] = value}
		updatenewlabel={(value) => newLabelInput = value}
		ondismissclosedwarning={() => issueClosedExternally = false}
		updatenewcomment={(value) => newComment = value}
	/>
{/snippet}

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

	/* Main Content - Board + Panel */
	.main-content {
		display: flex;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	/* Stats view wrapper */
	.stats-view-wrapper {
		display: flex;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	/* Project switch wipe animation using clip-path */
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

	/* Board */
	.board {
		display: flex;
		gap: 1rem;
		padding: 1.25rem;
		flex: 1 1 0;
		min-height: 0;
		overflow-x: auto;
		overflow-y: hidden;
		transition: margin-right var(--transition-smooth);
		scrollbar-width: none; /* Firefox */
		-ms-overflow-style: none; /* IE/Edge */
	}

	/* List view layout (tree/graph views with side panel) */
	.list-view-layout {
		display: flex;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.board::-webkit-scrollbar {
		display: none; /* Chrome/Safari/Opera */
	}

	@media (max-width: 768px) {
		/* --- Board & Cards --- */
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

		/* Compact app layout */
		.app {
			gap: 0;
		}
	}
</style>
