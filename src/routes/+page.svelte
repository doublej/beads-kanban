<script lang="ts">
	import { browser } from '$app/environment';
	import { untrack } from 'svelte';
	import { connect, disconnect, getPanes, isConnected, addPane, removePane, sendToPane, killSession, clearAllSessions, endSession, clearSession, continueSession, compactSession, getPersistedSdkSessionId, getAllPersistedSessions, deletePersistedSession, fetchSdkSessions, type Pane, type SdkSessionInfo } from '$lib/wsStore.svelte';
	import type { Issue, Comment, Attachment, CardPosition, FlyingCard, ContextMenuState, RopeDragState, SortBy, PaneSize, ViewMode, LoadingStatus as LoadingStatusType, Project } from '$lib/types';
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
		updateIssue as updateIssueApi,
		deleteIssueApi,
		createIssueApi,
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
	import PaneActivity from '$lib/components/PaneActivity.svelte';
	import InitialLoader from '$lib/components/InitialLoader.svelte';
	import StatusBar from '$lib/components/StatusBar.svelte';
	import TreeView from '$lib/components/TreeView.svelte';
	import GraphView from '$lib/components/GraphView.svelte';
	import TickerTape from '$lib/components/TickerTape.svelte';
	import MutationLog from '$lib/components/MutationLog.svelte';
	import SettingsPane from '$lib/components/SettingsPane.svelte';
	import { fetchMutations } from '$lib/mutationStore.svelte';
	import StatsView from '$lib/components/StatsView.svelte';
	import ThemeTransition from '$lib/components/ThemeTransition.svelte';
	import ProjectSwitcher from '$lib/components/ProjectSwitcher.svelte';

	let issues = $state<Issue[]>([]);
	let draggedId = $state<string | null>(null);
	let draggedOverColumn = $state<string | null>(null);
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
	let isFilterPreviewing = $state(false);
	let animatingIds = $state<Set<string>>(new Set());
	let selectedId = $state<string | null>(null);
	let activeColumnIndex = $state(0);
	let touchStartX = $state(0);
	let touchEndX = $state(0);
	let touchStartY = $state(0);
	let touchEndY = $state(0);
	let panelTouchStartY = $state(0);
	let panelDragOffset = $state(0);
	let isPanelDragging = $state(false);
	let dropIndicatorIndex = $state<number | null>(null);
	let dropTargetColumn = $state<string | null>(null);
	let isDarkMode = $state(true);
	let colorScheme = $state('default');
	let notificationsEnabled = $state(false);
	let themeTransitionActive = $state(false);
	let themeTransitionToLight = $state(false);
	let comments = $state<{ id: number; author: string; text: string; created_at: string }[]>([]);
	let newComment = $state('');
	let loadingComments = $state(false);
	let attachments = $state<Attachment[]>([]);
	let loadingAttachments = $state(false);
	let showPaneActivity = $state(true);
	let newPaneName = $state('');
	let resumePrompt = $state<{ name: string; sessionId: string } | null>(null);
	let showSessionPicker = $state(false);
	let sdkSessions = $state<SdkSessionInfo[]>([]);
	let loadingSdkSessions = $state(false);
	let paneMessageInputs = $state<Record<string, string>>({});
	let expandedPanes = $state<Set<string>>(new Set());
	let paneSizes = $state<Record<string, 'compact' | 'medium' | 'large'>>({});
	let panePositions = $state<Record<string, { x: number; y: number }>>({});
	let paneCustomSizes = $state<Record<string, { w: number; h: number }>>({});
	let draggingPane = $state<string | null>(null);
	let resizingPane = $state<string | null>(null);
	let resizeEdge = $state<'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | null>(null);
	let dragOffset = $state({ x: 0, y: 0 });
	let resizeStart = $state({ x: 0, y: 0, w: 0, h: 0, px: 0, py: 0 });
	let contextMenu = $state<{ x: number; y: number; issue: Issue } | null>(null);
	let collapsedColumns = $state<Set<string>>(new Set());
	let columnSortBy = $state<Record<string, 'priority' | 'created' | 'title'>>({});
	let sortMenuOpen = $state<string | null>(null);
	let ropeDrag = $state<{ fromId: string; startX: number; startY: number; currentX: number; currentY: number; targetId: string | null } | null>(null);
	let newLabelInput = $state('');
	let pendingDep = $state<{ fromId: string; toId: string } | null>(null);
	let showKeyboardHelp = $state(false);
	let showHotkeys = $state(false);
	let showSettings = $state(false);
	let projectName = $state('');
	let tickerRange = $state(60 * 24 * 7); // 7 days default
	let agentEnabled = $state(true);
	let agentHost = $state('localhost');
	let agentPort = $state(8765);
	let agentFirstMessage = $state('You are an agent named "{name}". Await further instructions.');
	let agentSystemPrompt = $state('');
	let agentToolsExpanded = $state(false);
	let teleports = $state<{id: string; from: {x: number; y: number; w: number; h: number}; to: {x: number; y: number; w: number; h: number}; startTime: number}[]>([]);
	let placeholders = $state<{id: string; targetColumn: string; height: number}[]>([]);
	let cardRefs = $state<Map<string, HTMLElement>>(new Map());
	let placeholderRefs = $state<Map<string, HTMLElement>>(new Map());
	let flyingCards = $state<Map<string, {from: {x: number; y: number; w: number; h: number}; to: {x: number; y: number; w: number; h: number}; issue: Issue}>>(new Map());
	let issueClosedExternally = $state(false);
	let viewMode = $state<ViewMode>('kanban');
	let loadingStatus = $state<LoadingStatusType>({
		phase: 'disconnected',
		pollCount: 0,
		lastUpdate: null,
		issueCount: 0,
		hasChanges: false,
		errorMessage: null
	});
	let initialLoaded = $state(false);
	let showMutationLog = $state(false);
	let projects = $state<Project[]>([]);
	let showProjectSwitcher = $state(false);
	let currentProjectPath = $state('');
	let projectColor = $state('#6366f1');
	let projectTransition = $state<'idle' | 'wipe-out' | 'wipe-in'>('idle');
	let sseSource = $state<EventSource | null>(null);

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
		const next = new Set(collapsedColumns);
		if (next.has(key)) {
			next.delete(key);
		} else {
			next.add(key);
		}
		collapsedColumns = next;
		if (browser) {
			localStorage.setItem('collapsedColumns', JSON.stringify([...next]));
		}
	}

	function cyclePaneSize(name: string) {
		const current = paneSizes[name] || 'compact';
		const next = current === 'compact' ? 'medium' : current === 'medium' ? 'large' : 'compact';
		paneSizes = { ...paneSizes, [name]: next };
		// Reset custom position/size when cycling presets
		if (next !== 'large') {
			const { [name]: _p, ...restPos } = panePositions;
			const { [name]: _s, ...restSize } = paneCustomSizes;
			panePositions = restPos;
			paneCustomSizes = restSize;
		}
	}

	function getPaneSize(name: string): 'compact' | 'medium' | 'large' {
		return paneSizes[name] || 'compact';
	}

	function startDrag(e: MouseEvent, name: string) {
		if ((e.target as HTMLElement).closest('.ctrl-btn, .msg-input, button')) return;
		e.preventDefault();
		const el = (e.currentTarget as HTMLElement).closest('.agent-window') as HTMLElement;
		const rect = el.getBoundingClientRect();
		draggingPane = name;
		dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
		// Initialize position if not set
		if (!panePositions[name]) {
			panePositions = { ...panePositions, [name]: { x: rect.left, y: rect.top } };
		}
	}

	function startResize(e: MouseEvent, name: string, edge: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw') {
		e.preventDefault();
		e.stopPropagation();
		resizingPane = name;
		resizeEdge = edge;
		const el = document.querySelector(`[data-pane="${name}"]`) as HTMLElement;
		const rect = el.getBoundingClientRect();
		resizeStart = { x: e.clientX, y: e.clientY, w: rect.width, h: rect.height, px: rect.left, py: rect.top };
		// Initialize position/size if not customized
		if (!panePositions[name]) {
			panePositions = { ...panePositions, [name]: { x: rect.left, y: rect.top } };
		}
		if (!paneCustomSizes[name]) {
			paneCustomSizes = { ...paneCustomSizes, [name]: { w: rect.width, h: rect.height } };
		}
	}

	// Document-level handlers for smooth drag/resize (prevents losing grip)
	function handleDocumentMouseMove(e: MouseEvent) {
		if (draggingPane) {
			e.preventDefault();
			const el = document.querySelector(`[data-pane="${draggingPane}"]`) as HTMLElement;
			if (el) {
				const x = Math.max(0, Math.min(window.innerWidth - 100, e.clientX - dragOffset.x));
				const y = Math.max(0, Math.min(window.innerHeight - 50, e.clientY - dragOffset.y));
				// Direct DOM update for smooth dragging
				el.style.left = `${x}px`;
				el.style.top = `${y}px`;
				el.style.position = 'fixed';
				// Store for state sync on mouseup
				panePositions[draggingPane] = { x, y };
			}
		}
		if (resizingPane && resizeEdge) {
			e.preventDefault();
			const el = document.querySelector(`[data-pane="${resizingPane}"]`) as HTMLElement;
			if (el) {
				const dx = e.clientX - resizeStart.x;
				const dy = e.clientY - resizeStart.y;
				let w = resizeStart.w, h = resizeStart.h, x = resizeStart.px, y = resizeStart.py;

				// Handle horizontal resize
				if (resizeEdge.includes('e')) {
					w = Math.max(280, Math.min(window.innerWidth - x - 10, resizeStart.w + dx));
				}
				if (resizeEdge.includes('w')) {
					const newW = Math.max(280, resizeStart.w - dx);
					const maxW = resizeStart.px + resizeStart.w - 10;
					w = Math.min(newW, maxW);
					x = resizeStart.px + resizeStart.w - w;
				}

				// Handle vertical resize
				if (resizeEdge.includes('s')) {
					h = Math.max(200, Math.min(window.innerHeight - y - 50, resizeStart.h + dy));
				}
				if (resizeEdge === 'n' || resizeEdge === 'ne' || resizeEdge === 'nw') {
					const newH = Math.max(200, resizeStart.h - dy);
					const maxH = resizeStart.py + resizeStart.h - 10;
					h = Math.min(newH, maxH);
					y = resizeStart.py + resizeStart.h - h;
				}

				// Direct DOM update for smooth resizing
				el.style.width = `${w}px`;
				el.style.height = `${h}px`;
				el.style.left = `${x}px`;
				el.style.top = `${y}px`;
				el.style.position = 'fixed';
				// Store for state sync on mouseup
				paneCustomSizes[resizingPane] = { w, h };
				panePositions[resizingPane] = { x, y };
			}
		}
	}

	function handleDocumentMouseUp() {
		if (draggingPane) {
			// Force reactivity update
			panePositions = { ...panePositions };
		}
		if (resizingPane) {
			// Force reactivity update
			paneCustomSizes = { ...paneCustomSizes };
			panePositions = { ...panePositions };
		}
		draggingPane = null;
		resizingPane = null;
		resizeEdge = null;
	}

	// Attach document-level listeners when dragging/resizing
	$effect(() => {
		if (!browser) return;
		const isDraggingOrResizing = draggingPane !== null || resizingPane !== null;
		if (isDraggingOrResizing) {
			document.addEventListener('mousemove', handleDocumentMouseMove, { passive: false });
			document.addEventListener('mouseup', handleDocumentMouseUp);
			const cursorMap: Record<string, string> = { n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', ne: 'nesw-resize', sw: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize' };
			document.body.style.cursor = draggingPane ? 'grabbing' : (resizeEdge ? cursorMap[resizeEdge] : '');
			document.body.style.userSelect = 'none';
			return () => {
				document.removeEventListener('mousemove', handleDocumentMouseMove);
				document.removeEventListener('mouseup', handleDocumentMouseUp);
				document.body.style.cursor = '';
				document.body.style.userSelect = '';
			};
		}
	});

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

	async function confirmDependency(depType: string) {
		if (!pendingDep) return;
		await createDependencyApi(pendingDep.fromId, pendingDep.toId, depType);
		// Issues are updated via SSE stream
		pendingDep = null;
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

	function getPaneStyle(name: string): string {
		const pos = panePositions[name];
		const size = paneCustomSizes[name];
		const parts: string[] = [];
		if (pos) parts.push(`left: ${pos.x}px`, `top: ${pos.y}px`, `position: fixed`);
		if (size) parts.push(`width: ${size.w}px`, `max-height: ${size.h}px`);
		return parts.join('; ');
	}

	function isCustomized(name: string): boolean {
		return !!(panePositions[name] || paneCustomSizes[name]);
	}

	// Reactive polling for cross-module state (Svelte 5 doesn't track $state across modules in $derived)
	let wsConnected = $state(false);
	let wsPanes = $state<Map<string, Pane>>(new Map());

	$effect(() => {
		const poll = () => {
			wsConnected = isConnected();
			wsPanes = getPanes();
		};
		poll();
		const id = setInterval(poll, 100);
		return () => clearInterval(id);
	});

	const panelOpen = $derived(editingIssue !== null || isCreating);
	const activeAgentNames = $derived([...wsPanes.keys()]);

	function issueMatchesTimeFilter(issue: Issue): boolean {
		if (filterTime === 'all') return true;
		const now = new Date();
		const updated = issue.updated_at ? new Date(issue.updated_at) : new Date(issue.created_at);
		const diffMs = now.getTime() - updated.getTime();
		const diffHours = diffMs / (1000 * 60 * 60);
		switch (filterTime) {
			case '1h': return diffHours <= 1;
			case '24h': return diffHours <= 24;
			case 'today': {
				const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
				return updated >= startOfDay;
			}
			case 'week': {
				const startOfWeek = new Date(now);
				startOfWeek.setDate(now.getDate() - now.getDay());
				startOfWeek.setHours(0, 0, 0, 0);
				return updated >= startOfWeek;
			}
			default: return true;
		}
	}

	function issueMatchesFilters(issue: Issue): boolean {
		const query = searchQuery.toLowerCase();
		const matchesSearch = !query ||
			issue.id.toLowerCase().includes(query) ||
			issue.title.toLowerCase().includes(query) ||
			issue.description.toLowerCase().includes(query);
		const matchesPriority = filterPriority === 'all' || issue.priority === filterPriority;
		const matchesType = filterType === 'all' || issue.issue_type === filterType;
		const matchesTime = issueMatchesTimeFilter(issue);
		// Status filter: supports negation with '!' prefix (e.g., '!closed')
		const matchesStatus = filterStatus === 'all' ||
			(filterStatus.startsWith('!') ? issue.status !== filterStatus.slice(1) : issue.status === filterStatus);
		// Label filter: issue must have the selected label
		const matchesLabel = filterLabel === 'all' || (issue.labels || []).includes(filterLabel);
		return matchesSearch && matchesPriority && matchesType && matchesTime && matchesStatus && matchesLabel;
	}

	const hasActiveFilters = $derived(searchQuery !== '' || filterPriority !== 'all' || filterType !== 'all' || filterTime !== 'all' || filterStatus !== 'all' || filterLabel !== 'all');

	// Get all unique labels from issues for filter dropdown
	const availableLabels = $derived([...new Set(issues.flatMap(i => i.labels || []))].sort());

	const filteredIssues = $derived(
		issues.filter((issue) => issueMatchesFilters(issue))
	);

	function connectSSE() {
		const eventSource = new EventSource('/api/issues/stream');
		sseSource = eventSource;

		eventSource.onmessage = (event) => {
			const msg = JSON.parse(event.data);

			if (msg.type === 'error') {
				loadingStatus = { ...loadingStatus, phase: 'error', errorMessage: msg.message };
				return;
			}

			if (msg.type !== 'data') return;

			loadingStatus = {
				...loadingStatus,
				phase: 'ready',
				pollCount: msg.pollCount,
				lastUpdate: msg.timestamp,
				issueCount: msg.issues.length,
				hasChanges: msg.hasChanges,
				errorMessage: null
			};
			if (!initialLoaded) {
				initialLoaded = true;
				fetchMutations();
			}

			const data = msg;
			const oldIssuesMap = new Map(issues.map(i => [i.id, i]));

			// Check if the currently editing issue was closed externally
			const currentEditing = editingIssue;
			if (currentEditing && !isCreating) {
				const updatedIssue = data.issues.find((i: Issue) => i.id === currentEditing.id);
				if (updatedIssue && updatedIssue.status === 'closed' && currentEditing.status !== 'closed') {
					issueClosedExternally = true;
				}
			}

			// Find status changes and capture positions
			const statusChanges: {id: string; fromPos: {x: number; y: number; w: number; h: number}; newStatus: string; height: number}[] = [];
			data.issues.forEach((issue: Issue) => {
				const oldIssue = oldIssuesMap.get(issue.id);
				if (!oldIssue) {
					// New issue created
					sendNotification('New Issue Created', issue.title);
				} else if (oldIssue.status !== issue.status) {
					const fromPos = getCardPosition(issue.id);
					if (fromPos) {
						statusChanges.push({ id: issue.id, fromPos, newStatus: issue.status, height: fromPos.h });
					}
					// Notify on blocking events
					if (issue.status === 'blocked' && oldIssue.status !== 'blocked') {
						sendNotification('Issue Blocked', `${issue.title} is now blocked`);
					} else if (issue.status !== 'blocked' && oldIssue.status === 'blocked') {
						sendNotification('Issue Unblocked', `${issue.title} is no longer blocked`);
					}
				}
			});

			if (statusChanges.length > 0) {
				// Create placeholders in target columns first (to make room)
				// Skip if placeholder already exists for this id
				const existingPlaceholderIds = new Set(placeholders.map(p => p.id));
				statusChanges.forEach(({ id, newStatus, height }) => {
					if (!existingPlaceholderIds.has(id)) {
						placeholders = [...placeholders, { id, targetColumn: newStatus, height }];
					}
				});

				// Wait for placeholders to fully expand (350ms > 300ms animation), then capture positions, update issues, and teleport
				setTimeout(() => {
					// Capture placeholder positions BEFORE updating issues (which will remove placeholders from DOM)
					const teleportTargets = statusChanges.map(({ id, fromPos }) => ({
						id,
						fromPos,
						toPos: getPlaceholderPosition(id),
						issue: oldIssuesMap.get(id)
					})).filter(t => t.toPos !== null && t.issue);

					// Start flying cards BEFORE updating issues
					teleportTargets.forEach(({ id, fromPos, toPos, issue }) => {
						flyingCards.set(id, { from: fromPos, to: toPos!, issue: issue! });
						flyingCards = new Map(flyingCards);
					});

					issues = data.issues;

					// Trigger teleports with pre-captured positions
					teleportTargets.forEach(({ id, fromPos, toPos }) => {
						teleports = [...teleports, { id, from: fromPos, to: toPos!, startTime: Date.now() }];
						setTimeout(() => {
							teleports = teleports.filter(t => t.id !== id);
							placeholders = placeholders.filter(p => p.id !== id);
							flyingCards.delete(id);
							flyingCards = new Map(flyingCards);
						}, 600);
					});
				}, 350);
			} else {
				issues = data.issues;
			}
		};

		eventSource.onerror = () => {
			eventSource.close();
			loadingStatus = { ...loadingStatus, phase: 'disconnected' };
			setTimeout(connectSSE, 3000);
		};

		return eventSource;
	}

	async function updateIssue(id: string, updates: Partial<Issue>) {
		// Optimistic update - apply immediately for instant feedback
		const idx = issues.findIndex(i => i.id === id);
		if (idx !== -1) {
			const updated = { ...issues[idx], ...updates, updated_at: new Date().toISOString() };
			issues = [...issues.slice(0, idx), updated, ...issues.slice(idx + 1)];
		}
		// Flash animation for feedback
		animatingIds = new Set([...animatingIds, id]);
		setTimeout(() => {
			animatingIds = new Set([...animatingIds].filter(x => x !== id));
		}, 600);
		await fetch(`/api/issues/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(updates)
		});
		fetchMutations();
	}

	async function deleteIssue(id: string) {
		if (!confirm('Delete this issue?')) return;
		// Optimistic update - mark as closed immediately
		const idx = issues.findIndex(i => i.id === id);
		if (idx !== -1) {
			const closed = { ...issues[idx], status: 'closed' as const, updated_at: new Date().toISOString() };
			issues = [...issues.slice(0, idx), closed, ...issues.slice(idx + 1)];
		}
		// Flash animation for feedback
		animatingIds = new Set([...animatingIds, id]);
		setTimeout(() => {
			animatingIds = new Set([...animatingIds].filter(x => x !== id));
		}, 600);
		if (editingIssue?.id === id) {
			editingIssue = null;
		}
		await fetch(`/api/issues/${id}`, { method: 'DELETE' });
		fetchMutations();
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
		// Optimistic update - add temp issue immediately
		const tempId = `temp-${Date.now()}`;
		const tempIssue: Issue = {
			id: tempId,
			title: createForm.title,
			description: createForm.description,
			status: 'open',
			priority: createForm.priority as Issue['priority'],
			issue_type: createForm.issue_type,
			labels: [],
			dependencies: [],
			dependents: [],
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString()
		};
		issues = [tempIssue, ...issues];
		// Flash animation for feedback
		animatingIds = new Set([...animatingIds, tempId]);
		setTimeout(() => {
			animatingIds = new Set([...animatingIds].filter(x => x !== tempId));
		}, 600);
		createForm = { title: '', description: '', priority: 2, issue_type: 'task', deps: [] };
		isCreating = false;

		const res = await fetch('/api/issues', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ title: tempIssue.title, description: tempIssue.description, priority: tempIssue.priority, issue_type: tempIssue.issue_type })
		});
		await res.json();
		// SSE will replace temp issue with real one on next poll
		fetchMutations();
	}

	async function createIssueAndStartAgent() {
		if (!createForm.title.trim()) return;
		// Optimistic update
		const tempId = `temp-${Date.now()}`;
		const tempIssue: Issue = {
			id: tempId,
			title: createForm.title,
			description: createForm.description,
			status: 'open',
			priority: createForm.priority as Issue['priority'],
			issue_type: createForm.issue_type,
			labels: [],
			dependencies: [],
			dependents: [],
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString()
		};
		issues = [tempIssue, ...issues];
		animatingIds = new Set([...animatingIds, tempId]);
		setTimeout(() => {
			animatingIds = new Set([...animatingIds].filter(x => x !== tempId));
		}, 600);
		const savedForm = { ...createForm };
		createForm = { title: '', description: '', priority: 2, issue_type: 'task', deps: [] };
		isCreating = false;

		// Create the issue and get the real ID
		const res = await fetch('/api/issues', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ title: savedForm.title, description: savedForm.description, priority: savedForm.priority, issue_type: savedForm.issue_type })
		});
		const data = await res.json();
		fetchMutations();

		// Start agent with ticket-specific briefing
		if (data.id) {
			const agentName = `${data.id}-agent`;
			const briefing = `You are agent "${agentName}" assigned to ticket ${data.id}.

## Your Task
Work on this ticket:
- **ID**: ${data.id}
- **Title**: ${savedForm.title}
${savedForm.description ? `- **Description**: ${savedForm.description}` : ''}

Start by claiming the ticket (set status to in_progress), then implement the required changes.`;
			addPane(agentName, currentProjectPath, briefing, agentSystemPrompt);
		}
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
		}
	}

	async function handleDeleteAttachment(filename: string) {
		if (!editingIssue) return;
		await deleteAttachmentApi(editingIssue.id, filename);
		attachments = attachments.filter(a => a.filename !== filename);
	}

	async function addComment() {
		if (!editingIssue || !newComment.trim()) return;
		await fetch(`/api/issues/${editingIssue.id}/comments`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ text: newComment })
		});
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

	function handleDragStart(e: DragEvent, id: string) {
		draggedId = id;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', id);
		}
		const target = e.target as HTMLElement;
		target.classList.add('dragging');
	}

	function handleDragEnd(e: DragEvent) {
		draggedId = null;
		draggedOverColumn = null;
		dropIndicatorIndex = null;
		dropTargetColumn = null;
		const target = e.target as HTMLElement;
		target.classList.remove('dragging');
	}

	function handleDragOver(e: DragEvent, columnKey: string) {
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
		draggedOverColumn = columnKey;

		const column = e.currentTarget as HTMLElement;
		const cards = column.querySelector('.cards');
		if (!cards) return;

		const cardElements = Array.from(cards.querySelectorAll('.card:not(.dragging)'));
		const mouseY = e.clientY;

		let insertIndex = cardElements.length;
		for (let i = 0; i < cardElements.length; i++) {
			const rect = cardElements[i].getBoundingClientRect();
			const midY = rect.top + rect.height / 2;
			if (mouseY < midY) {
				insertIndex = i;
				break;
			}
		}

		dropIndicatorIndex = insertIndex;
		dropTargetColumn = columnKey;
	}

	function handleDragLeave(e: DragEvent, columnKey: string) {
		const relatedTarget = e.relatedTarget as HTMLElement;
		const currentTarget = e.currentTarget as HTMLElement;
		if (!currentTarget.contains(relatedTarget)) {
			if (draggedOverColumn === columnKey) {
				draggedOverColumn = null;
			}
			if (dropTargetColumn === columnKey) {
				dropIndicatorIndex = null;
				dropTargetColumn = null;
			}
		}
	}

	function handleDrop(e: DragEvent, columnKey: string) {
		e.preventDefault();
		if (draggedId) {
			const issue = issues.find(i => i.id === draggedId);
			if (issue && columnKey === 'closed' && hasOpenBlockers(issue)) {
				// Prevent moving blocked issues to closed
				draggedId = null;
				draggedOverColumn = null;
				dropIndicatorIndex = null;
				dropTargetColumn = null;
				return;
			}
			if (issue) {
				const updates = getColumnMoveUpdates(issue, columnKey);
				if (Object.keys(updates).length > 0) {
					updateIssue(draggedId, updates);
				}
			}
			draggedId = null;
			draggedOverColumn = null;
			dropIndicatorIndex = null;
			dropTargetColumn = null;
		}
	}

	function handleTouchStart(e: TouchEvent) {
		touchStartX = e.changedTouches[0].screenX;
		touchStartY = e.changedTouches[0].screenY;
	}

	function handleTouchEnd(e: TouchEvent) {
		touchEndX = e.changedTouches[0].screenX;
		touchEndY = e.changedTouches[0].screenY;
		handleSwipe();
	}

	function handleSwipe() {
		const swipeThreshold = 50;
		const diffX = touchStartX - touchEndX;
		const diffY = touchStartY - touchEndY;
		// Only trigger horizontal swipe if horizontal > vertical (prevents scroll conflicts)
		if (Math.abs(diffX) < swipeThreshold || Math.abs(diffY) > Math.abs(diffX)) return;
		if (diffX > 0 && activeColumnIndex < columns.length - 1) activeColumnIndex++;
		else if (diffX < 0 && activeColumnIndex > 0) activeColumnIndex--;
	}

	function handlePanelTouchStart(e: TouchEvent) {
		// Only track on panel-header for drag handle
		const target = e.target as HTMLElement;
		if (!target.closest('.panel-header')) return;
		panelTouchStartY = e.touches[0].clientY;
		isPanelDragging = true;
		panelDragOffset = 0;
	}

	function handlePanelTouchMove(e: TouchEvent) {
		if (!isPanelDragging) return;
		const diff = e.touches[0].clientY - panelTouchStartY;
		// Only allow downward drag
		panelDragOffset = Math.max(0, diff);
	}

	function handlePanelTouchEnd() {
		if (!isPanelDragging) return;
		isPanelDragging = false;
		// Dismiss if dragged more than 100px down
		if (panelDragOffset > 100) {
			closePanel();
		}
		panelDragOffset = 0;
	}

	function getCardGrid() {
		return columns.map(col => filteredIssues.filter(i => getIssueColumn(i).key === col.key));
	}

	function findCardPosition(id: string) {
		const grid = getCardGrid();
		for (let col = 0; col < grid.length; col++) {
			const row = grid[col].findIndex(i => i.id === id);
			if (row !== -1) return { col, row };
		}
		return null;
	}

	function getCardAt(col: number, row: number) {
		const grid = getCardGrid();
		if (col < 0 || col >= grid.length) return null;
		const column = grid[col];
		if (row < 0 || row >= column.length) return null;
		return column[row]?.id ?? null;
	}

	function handleKeydown(e: KeyboardEvent) {
		const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;

		// Cmd/Ctrl+Enter to submit create form
		if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && isCreating) {
			e.preventDefault();
			createIssue();
			return;
		}

		// Cmd/Ctrl+K to focus search (global, works even in inputs)
		if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
			e.preventDefault();
			const searchInput = document.querySelector('.search-input') as HTMLInputElement;
			searchInput?.focus();
			searchInput?.select();
			return;
		}

		// Cmd/Ctrl+` or Ctrl+Tab to open project switcher
		if ((e.metaKey || e.ctrlKey) && (e.key === '`' || e.key === 'Tab') && projects.length > 1) {
			e.preventDefault();
			showProjectSwitcher = true;
			return;
		}

		// Global shortcuts (work even in inputs)
		if (e.key === 'Escape') {
			if (showProjectSwitcher) {
				showProjectSwitcher = false;
				e.preventDefault();
				return;
			}
			if (showKeyboardHelp) {
				showKeyboardHelp = false;
				e.preventDefault();
				return;
			}
			if (isInput) {
				(e.target as HTMLElement).blur();
				e.preventDefault();
				return;
			}
			if (panelOpen) {
				closePanel();
			} else {
				selectedId = null;
			}
			e.preventDefault();
			return;
		}

		if (isInput) return;

		// Show/hide hotkey hints with Alt/Option
		if (e.key === 'Alt') {
			showHotkeys = true;
			return;
		}

		// Keyboard help overlay
		if (e.key === '?') {
			showKeyboardHelp = !showKeyboardHelp;
			e.preventDefault();
			return;
		}

		// Focus search
		if (e.key === '/') {
			e.preventDefault();
			const searchInput = document.querySelector('.search-input') as HTMLInputElement;
			searchInput?.focus();
			return;
		}

		// New issue
		if (e.key === 'n' || e.key === 'N') {
			e.preventDefault();
			openCreatePanel();
			return;
		}

		// Jump to column by number (1-7)
		const colIndex = parseInt(e.key) - 1;
		if (colIndex >= 0 && colIndex < columns.length) {
			const targetColumn = columns[colIndex];
			const columnIssues = filteredIssues.filter(i => getIssueColumn(i).key === targetColumn.key);
			if (columnIssues.length > 0) {
				selectedId = columnIssues[0].id;
			}
			e.preventDefault();
			return;
		}

		// Toggle theme
		if (e.key === 't' || e.key === 'T') {
			toggleTheme();
			e.preventDefault();
			return;
		}

		if (panelOpen) return;

		if (!selectedId && filteredIssues.length > 0) {
			if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'j', 'k', 'h', 'l'].includes(e.key)) {
				selectedId = filteredIssues[0].id;
				e.preventDefault();
				return;
			}
		}

		if (!selectedId) return;

		const pos = findCardPosition(selectedId);
		if (!pos) return;

		let newId: string | null = null;

		// Arrow keys and vim-style navigation
		if (e.key === 'ArrowUp' || e.key === 'k') {
			newId = getCardAt(pos.col, pos.row - 1);
		} else if (e.key === 'ArrowDown' || e.key === 'j') {
			newId = getCardAt(pos.col, pos.row + 1);
		} else if (e.key === 'ArrowLeft' || e.key === 'h') {
			const grid = getCardGrid();
			for (let c = pos.col - 1; c >= 0; c--) {
				if (grid[c].length > 0) {
					newId = grid[c][Math.min(pos.row, grid[c].length - 1)].id;
					break;
				}
			}
		} else if (e.key === 'ArrowRight' || e.key === 'l') {
			const grid = getCardGrid();
			for (let c = pos.col + 1; c < grid.length; c++) {
				if (grid[c].length > 0) {
					newId = grid[c][Math.min(pos.row, grid[c].length - 1)].id;
					break;
				}
			}
		} else if (e.key === 'Enter' || e.key === 'o') {
			const issue = filteredIssues.find(i => i.id === selectedId);
			if (issue) openEditPanel(issue);
			e.preventDefault();
			return;
		} else if (e.key === 'Delete' || e.key === 'Backspace' || e.key === 'x') {
			deleteIssue(selectedId);
			e.preventDefault();
			return;
		}

		if (newId) {
			selectedId = newId;
			e.preventDefault();
		}
	}

	function handleKeyup(e: KeyboardEvent) {
		if (e.key === 'Alt') {
			showHotkeys = false;
		}
	}

	function handleWindowBlur() {
		showHotkeys = false;
	}

	function toggleTheme() {
		if (themeTransitionActive) return;
		themeTransitionToLight = isDarkMode; // going from dark to light
		themeTransitionActive = true;
	}

	function switchTheme() {
		isDarkMode = !isDarkMode;
		if (browser) {
			localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
		}
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

	$effect(() => {
		if (browser) {
			const saved = localStorage.getItem('theme');
			if (saved) {
				isDarkMode = saved === 'dark';
			} else {
				isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
			}
			const savedCollapsed = localStorage.getItem('collapsedColumns');
			if (savedCollapsed) {
				collapsedColumns = new Set(JSON.parse(savedCollapsed));
			}
			const savedTickerRange = localStorage.getItem('tickerRange');
			if (savedTickerRange) tickerRange = Number(savedTickerRange);
			const savedAgentEnabled = localStorage.getItem('agentEnabled');
			if (savedAgentEnabled) agentEnabled = savedAgentEnabled === 'true';
			const savedAgentHost = localStorage.getItem('agentHost');
			if (savedAgentHost) agentHost = savedAgentHost;
			const savedAgentPort = localStorage.getItem('agentPort');
			if (savedAgentPort) agentPort = Number(savedAgentPort);
			const savedAgentFirstMessage = localStorage.getItem('agentFirstMessage');
			if (savedAgentFirstMessage) agentFirstMessage = savedAgentFirstMessage;
			const savedAgentSystemPrompt = localStorage.getItem('agentSystemPrompt');
			if (savedAgentSystemPrompt) agentSystemPrompt = savedAgentSystemPrompt;
			const savedAgentToolsExpanded = localStorage.getItem('agentToolsExpanded');
			if (savedAgentToolsExpanded) agentToolsExpanded = savedAgentToolsExpanded === 'true';
			const savedColorScheme = localStorage.getItem('colorScheme');
			if (savedColorScheme) colorScheme = savedColorScheme;
			const savedNotifications = localStorage.getItem('notificationsEnabled');
			if (savedNotifications) notificationsEnabled = savedNotifications === 'true';
		}
	});

	// Persist settings to localStorage
	$effect(() => {
		if (browser) localStorage.setItem('tickerRange', String(tickerRange));
	});
	$effect(() => {
		if (browser) localStorage.setItem('agentEnabled', String(agentEnabled));
	});
	$effect(() => {
		if (browser) localStorage.setItem('agentHost', agentHost);
	});
	$effect(() => {
		if (browser) localStorage.setItem('agentPort', String(agentPort));
	});
	$effect(() => {
		if (browser) localStorage.setItem('agentFirstMessage', agentFirstMessage);
	});
	$effect(() => {
		if (browser) localStorage.setItem('agentSystemPrompt', agentSystemPrompt);
	});
	$effect(() => {
		if (browser) localStorage.setItem('agentToolsExpanded', String(agentToolsExpanded));
	});
	$effect(() => {
		if (browser) localStorage.setItem('colorScheme', colorScheme);
	});
	$effect(() => {
		if (browser) localStorage.setItem('notificationsEnabled', String(notificationsEnabled));
	});

	$effect(() => {
		const source = untrack(() => connectSSE());
		return () => source.close();
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
		if (sseSource) {
			sseSource.close();
			sseSource = null;
		}

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
		issues = issuesData.issues || [];
		currentProjectPath = project.path;
		projectName = project.name;
		projectColor = project.color;
		initialLoaded = true;
		selectedId = null;
		editingIssue = null;
		isCreating = false;

		// Start wipe in (top to bottom)
		projectTransition = 'wipe-in';
		connectSSE();

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

<div class="app scheme-{colorScheme}" class:light={!isDarkMode} class:panel-open={panelOpen} class:show-hotkeys={showHotkeys} class:has-chat-bar={wsConnected} style="--project-color: {projectColor}">

<TickerTape
	rangeMinutes={tickerRange}
	onticketclick={(id) => {
		const issue = issues.find(i => i.id === id);
		if (issue) openEditPanel(issue);
	}}
	onopenlog={() => showMutationLog = true}
/>
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
	bind:tickerRange
	bind:agentEnabled
	bind:agentHost
	bind:agentPort
	bind:agentFirstMessage
	bind:agentSystemPrompt
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
		{availableLabels}
		bind:viewMode
		{isDarkMode}
		{projectName}
		totalIssues={issues.length}
		ontoggleTheme={toggleTheme}
		onopenKeyboardHelp={() => showKeyboardHelp = true}
		onopenCreatePanel={openCreatePanel}
		onopenSettings={() => showSettings = true}
		onpreviewchange={(previewing) => isFilterPreviewing = previewing}
		oneditProject={() => showSettings = true}
	/>

	{#if viewMode === 'kanban'}
	<ColumnNav
		{columns}
		bind:activeColumnIndex
		{issues}
		{filteredIssues}
		{hasActiveFilters}
	/>

	<div class="main-content" class:wipe-out={projectTransition === 'wipe-out'} class:wipe-in={projectTransition === 'wipe-in'}>
		<main class="board" ontouchstart={handleTouchStart} ontouchend={handleTouchEnd}>
			{#each columns as column, i}
				{#if i === 0 && isCreating}
					{@render detailPanel()}
				{/if}
				{@const rawColumnIssues = issues.filter((x) => getIssueColumn(x).key === column.key)}
				{@const allColumnIssues = columnSortBy[column.key] ? sortIssues(rawColumnIssues, columnSortBy[column.key]) : rawColumnIssues}
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
					ondragover={(e) => handleDragOver(e, column.key)}
					ondragleave={(e) => handleDragLeave(e, column.key)}
					ondrop={(e) => handleDrop(e, column.key)}
					oncollapseclick={(key) => toggleColumnCollapse(key)}
					ontogglecollapse={(e, key) => { e.stopPropagation(); toggleColumnCollapse(key); }}
					ontogglesortmenu={(key, e) => toggleSortMenu(key, e)}
					onsetcolumnsort={(key, sortBy) => setColumnSort(key, sortBy)}
					oncardclick={(issue) => openEditPanel(issue)}
					oncarddragstart={(e, id) => handleDragStart(e, id)}
					oncarddragend={handleDragEnd}
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
{#if wsConnected}
<div class="agent-bar" class:has-panes={wsPanes.size > 0}>
	<div class="agent-bar-inner">
		<form class="agent-add-form" onsubmit={(e) => {
			e.preventDefault();
			const name = newPaneName.trim();
			if (!name) return;
			const persistedId = getPersistedSdkSessionId(name);
			if (persistedId) {
				resumePrompt = { name, sessionId: persistedId };
			} else {
				addPane(name, currentProjectPath, agentFirstMessage, agentSystemPrompt);
				expandedPanes.add(name);
				expandedPanes = new Set(expandedPanes);
			}
			newPaneName = '';
		}}>
			<input type="text" bind:value={newPaneName} placeholder="+ agent" class="agent-add-input" />
		</form>
		<div class="session-picker-container">
			<button class="session-picker-btn" onclick={async () => {
				if (!showSessionPicker) {
					loadingSdkSessions = true;
					sdkSessions = await fetchSdkSessions(currentProjectPath);
					loadingSdkSessions = false;
				}
				showSessionPicker = !showSessionPicker;
			}} title="Saved sessions">
				⟳
			</button>
			{#if showSessionPicker}
				<div class="session-picker-dropdown">
					<div class="session-picker-header">
						<span class="session-picker-title">Recent Sessions</span>
						<span class="session-picker-count">{sdkSessions.length}</span>
					</div>
					{#if loadingSdkSessions}
						<div class="session-picker-empty">
							<span class="spinner"></span>
							Loading sessions...
						</div>
					{:else if sdkSessions.length === 0}
						<div class="session-picker-empty">No saved sessions found</div>
					{:else}
						<div class="session-picker-list">
							{#each sdkSessions as session}
								{@const timeAgo = (() => {
									const diff = Date.now() - new Date(session.timestamp).getTime();
									const mins = Math.floor(diff / 60000);
									const hours = Math.floor(diff / 3600000);
									const days = Math.floor(diff / 86400000);
									if (mins < 60) return `${mins}m ago`;
									if (hours < 24) return `${hours}h ago`;
									if (days < 7) return `${days}d ago`;
									return new Date(session.timestamp).toLocaleDateString();
								})()}
								<button class="session-card" onclick={() => {
									const name = session.agentId || session.sessionId.slice(0, 8);
									addPane(name, currentProjectPath, agentFirstMessage, agentSystemPrompt, session.sessionId);
									expandedPanes.add(name);
									expandedPanes = new Set(expandedPanes);
									showSessionPicker = false;
								}}>
									<div class="session-card-header">
										<span class="session-card-name">{session.agentId || session.sessionId.slice(0, 8)}</span>
										<span class="session-card-time">{timeAgo}</span>
									</div>
									{#if session.firstMessage}
										<div class="session-card-preview">{session.firstMessage}</div>
									{:else}
										<div class="session-card-preview empty">No message preview</div>
									{/if}
									<div class="session-card-id">{session.sessionId.slice(0, 12)}...</div>
								</button>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</div>
		{#if resumePrompt}
			<div class="resume-prompt">
				<span class="resume-text">Resume "{resumePrompt.name}"?</span>
				<button class="resume-btn yes" onclick={() => {
					if (resumePrompt) {
						addPane(resumePrompt.name, currentProjectPath, agentFirstMessage, agentSystemPrompt, resumePrompt.sessionId);
						expandedPanes.add(resumePrompt.name);
						expandedPanes = new Set(expandedPanes);
						resumePrompt = null;
					}
				}}>Yes</button>
				<button class="resume-btn no" onclick={() => {
					if (resumePrompt) {
						addPane(resumePrompt.name, currentProjectPath, agentFirstMessage, agentSystemPrompt);
						expandedPanes.add(resumePrompt.name);
						expandedPanes = new Set(expandedPanes);
						resumePrompt = null;
					}
				}}>Fresh</button>
				<button class="resume-btn cancel" onclick={() => { resumePrompt = null; }}>×</button>
			</div>
		{/if}
		<div class="agent-tabs">
			{#each [...wsPanes.values()] as pane}
				<button
					class="agent-tab"
					class:active={expandedPanes.has(pane.name)}
					class:streaming={pane.streaming}
					onclick={() => { if (expandedPanes.has(pane.name)) { expandedPanes.delete(pane.name); } else { expandedPanes.add(pane.name); } expandedPanes = new Set(expandedPanes); }}
				>
					<span class="tab-dot" class:live={pane.streaming}></span>
					<span class="tab-name">{pane.name}</span>
					{#if pane.messages.length > 0}
						<span class="tab-count">{pane.messages.length}</span>
					{/if}
				</button>
			{/each}
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
		onStartDrag={startDrag}
		onStartResize={startResize}
		onCyclePaneSize={cyclePaneSize}
		onRemovePane={removePane}
		onMinimizePane={(name) => { expandedPanes.delete(name); expandedPanes = new Set(expandedPanes); }}
		onSendMessage={(name, msg) => sendToPane(name, msg, currentProjectPath)}
		onMouseMove={handleMouseMove}
		onMouseUp={handleMouseUp}
		onEndSession={endSession}
		onClearSession={clearSession}
		onContinueSession={continueSession}
		onCompactSession={compactSession}
	/>
</div>
{/if}

<FlyingCardComponent {teleports} />
</div>

<InitialLoader status={loadingStatus} visible={!initialLoaded} />

<div class="status-bar-container" class:light={!isDarkMode}>
	<StatusBar
		dataStatus={loadingStatus}
		agentConnected={wsConnected}
		agentCount={wsPanes.size}
		{agentEnabled}
		light={!isDarkMode}
		onstartAgent={startAgentServer}
		onrestartAgent={restartAgentServer}
	/>
</div>

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
		ondelete={(id) => deleteIssue(id)}
		onsave={(id, updates) => updateIssue(id, updates)}
		onaddcomment={addComment}
		oncopyid={(text, id) => copyToClipboard(text, id)}
		onsetcolumn={(key) => setEditingColumn(key)}
		onaddlabel={(label) => addLabelToEditing(label)}
		onremovelabel={(label) => removeLabelFromEditing(label)}
		onremovedep={(issueId, depId) => removeDependency(issueId, depId)}
		onpaneltouchstart={handlePanelTouchStart}
		onpaneltouchmove={handlePanelTouchMove}
		onpaneltouchend={handlePanelTouchEnd}
		updatecreateform={(key, value) => createForm[key] = value}
		updatenewlabel={(value) => newLabelInput = value}
		ondismissclosedwarning={() => issueClosedExternally = false}
		updatenewcomment={(value) => newComment = value}
	/>
{/snippet}

<style>
	@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Plus+Jakarta+Sans:wght@700;800&display=swap');

	:root {
		--bg-primary: #3f3f46;
		--bg-secondary: #27272a;
		--bg-tertiary: #18181b;
		--bg-elevated: #3a3a3c;
		--border-subtle: rgba(255, 255, 255, 0.08);
		--border-default: rgba(255, 255, 255, 0.12);
		--border-strong: rgba(255, 255, 255, 0.18);
		--text-primary: #ffffff;
		--text-secondary: #98989d;
		--text-tertiary: #636366;
		--accent-primary: #0a84ff;
		--accent-glow: rgba(10, 132, 255, 0.15);
		--radius-sm: 8px;
		--radius-md: 12px;
		--radius-lg: 20px;
		--radius-xl: 28px;
		--transition-fast: 200ms cubic-bezier(0.25, 0.1, 0.25, 1);
		--transition-smooth: 350ms cubic-bezier(0.25, 0.1, 0.25, 1);
		--transition-bounce: 500ms cubic-bezier(0.34, 1.56, 0.64, 1);
		--shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.15);
		--shadow-md: 0 4px 24px rgba(0, 0, 0, 0.2);
		--shadow-lg: 0 8px 40px rgba(0, 0, 0, 0.3);
	}

	:global(*) {
		box-sizing: border-box;
		margin: 0;
		padding: 0;
	}

	:global(body) {
		font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
		background: var(--bg-primary);
		color: var(--text-primary);
		line-height: 1.5;
		-webkit-font-smoothing: antialiased;
		-moz-osx-font-smoothing: grayscale;
		text-rendering: optimizeLegibility;
		overflow: hidden;
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
		padding-bottom: 48px;
	}

	.app::before {
		content: '';
		position: absolute;
		inset: 0;
		background:
			/* Core glow - center top concentration */
			radial-gradient(ellipse 90% 60% at 50% 30%, rgba(99, 102, 241, 0.09) 0%, transparent 60%),
			radial-gradient(ellipse 70% 50% at 35% 25%, rgba(56, 189, 248, 0.07) 0%, transparent 55%),
			radial-gradient(ellipse 65% 45% at 65% 35%, rgba(167, 139, 250, 0.06) 0%, transparent 50%),
			/* Subtle accent in middle */
			radial-gradient(ellipse 50% 40% at 50% 50%, rgba(52, 211, 153, 0.04) 0%, transparent 50%),
			/* Edge fade - makes outside lighter */
			radial-gradient(ellipse 120% 100% at 50% 40%, transparent 40%, rgba(0, 0, 0, 0.02) 100%);
		animation: auroraShift 30s ease-in-out infinite alternate;
		pointer-events: none;
		z-index: 0;
	}

	/* Noise overlay to eliminate gradient banding */
	.app::after {
		content: '';
		position: absolute;
		inset: 0;
		background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
		background-size: 256px 256px;
		opacity: 0.035;
		pointer-events: none;
		z-index: 0;
	}

	.app > * {
		position: relative;
		z-index: 1;
	}

	@keyframes auroraShift {
		0% {
			transform: translate(0, 0) scale(1);
			opacity: 1;
		}
		50% {
			transform: translate(2%, -1%) scale(1.02);
			opacity: 0.8;
		}
		100% {
			transform: translate(-1%, 2%) scale(0.98);
			opacity: 1;
		}
	}

	.app.light::before {
		background:
			/* Core glow - center top concentration */
			radial-gradient(ellipse 90% 60% at 50% 30%, rgba(99, 102, 241, 0.12) 0%, transparent 60%),
			radial-gradient(ellipse 70% 50% at 35% 25%, rgba(56, 189, 248, 0.1) 0%, transparent 55%),
			radial-gradient(ellipse 65% 45% at 65% 35%, rgba(167, 139, 250, 0.08) 0%, transparent 50%),
			/* Subtle accent in middle */
			radial-gradient(ellipse 50% 40% at 50% 50%, rgba(52, 211, 153, 0.06) 0%, transparent 50%),
			/* Edge fade - makes outside lighter */
			radial-gradient(ellipse 120% 100% at 50% 40%, transparent 40%, rgba(255, 255, 255, 0.3) 100%);
	}

	/* Light theme */
	.app.light {
		--bg-primary: #f2f2f7;
		--bg-secondary: #ffffff;
		--bg-tertiary: #e5e5ea;
		--bg-elevated: #d1d1d6;
		--border-subtle: rgba(0, 0, 0, 0.04);
		--border-default: rgba(0, 0, 0, 0.08);
		--border-strong: rgba(0, 0, 0, 0.12);
		--text-primary: #000000;
		--text-secondary: #3c3c43;
		--text-tertiary: #8e8e93;
		--accent-primary: #007aff;
		--accent-glow: rgba(0, 122, 255, 0.12);
		--shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.08);
		--shadow-md: 0 4px 12px rgba(0, 0, 0, 0.1);
		--shadow-lg: 0 8px 28px rgba(0, 0, 0, 0.12);
		background: var(--bg-primary);
	}

	/* Color Schemes */
	.app.scheme-ocean {
		--bg-primary: #0f172a;
		--bg-secondary: #1e293b;
		--bg-tertiary: #0c4a6e;
		--bg-elevated: #334155;
		--accent-primary: #0ea5e9;
		--accent-glow: rgba(14, 165, 233, 0.15);
	}

	.app.scheme-forest {
		--bg-primary: #0f1a0f;
		--bg-secondary: #14532d;
		--bg-tertiary: #166534;
		--bg-elevated: #1a3a1a;
		--accent-primary: #22c55e;
		--accent-glow: rgba(34, 197, 94, 0.15);
	}

	.app.scheme-sunset {
		--bg-primary: #1c0a00;
		--bg-secondary: #431407;
		--bg-tertiary: #7c2d12;
		--bg-elevated: #581c0a;
		--accent-primary: #f97316;
		--accent-glow: rgba(249, 115, 22, 0.15);
	}

	.app.scheme-rose {
		--bg-primary: #1a0a10;
		--bg-secondary: #4c0519;
		--bg-tertiary: #881337;
		--bg-elevated: #5c0a1f;
		--accent-primary: #f43f5e;
		--accent-glow: rgba(244, 63, 94, 0.15);
	}

	/* Light mode + color schemes */
	.app.light.scheme-ocean { --accent-primary: #0284c7; }
	.app.light.scheme-forest { --accent-primary: #16a34a; }
	.app.light.scheme-sunset { --accent-primary: #ea580c; }
	.app.light.scheme-rose { --accent-primary: #e11d48; }

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

	@keyframes wipeUp {
		from {
			clip-path: inset(0 0 0 0);
			opacity: 1;
		}
		to {
			clip-path: inset(0 0 100% 0);
			opacity: 0.5;
		}
	}

	@keyframes wipeDown {
		from {
			clip-path: inset(100% 0 0 0);
			opacity: 0.5;
		}
		to {
			clip-path: inset(0 0 0 0);
			opacity: 1;
		}
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

	@keyframes dropPulse {
		0%, 100% { opacity: 0.6; transform: scaleX(0.95); }
		50% { opacity: 1; transform: scaleX(1); }
	}

	@keyframes flyCard {
		0% {
			transform: translate(var(--from-x), var(--from-y));
			box-shadow:
				0 0 0 3px rgba(59, 130, 246, 0.6),
				0 12px 32px -6px rgba(0, 0, 0, 0.4);
		}
		100% {
			transform: translate(var(--to-x), var(--to-y));
			box-shadow:
				0 12px 32px -6px rgba(0, 0, 0, 0.35),
				0 6px 12px -3px rgba(0, 0, 0, 0.18);
		}
	}

	@keyframes teleportStrobe {
		0% {
			transform: translate(var(--from-x), var(--from-y));
			opacity: var(--opacity);
			filter: blur(0px);
		}
		20% {
			opacity: calc(var(--opacity) * 1.2);
			filter: blur(1px);
		}
		80% {
			opacity: calc(var(--opacity) * 0.8);
			filter: blur(2px);
		}
		100% {
			transform: translate(var(--to-x), var(--to-y));
			opacity: 0;
			filter: blur(4px);
		}
	}

	@keyframes placeholderExpand {
		from {
			height: 0;
		}
		to {
			height: var(--placeholder-height);
		}
	}

	@keyframes copySuccess {
		0% { transform: scale(1); }
		50% { transform: scale(1.2); }
		100% { transform: scale(1); }
	}

	@keyframes agent-pulse-sweep {
		0%, 100% { transform: translateX(-100%); opacity: 0; }
		50% { transform: translateX(100%); opacity: 1; }
	}

	@keyframes agent-icon-spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}

	@keyframes panelSlideIn {
		0% {
			opacity: 0;
			transform: scale(0.96) translateX(-16px);
			filter: blur(4px);
		}
		100% {
			opacity: 1;
			transform: scale(1) translateX(0);
			filter: blur(0);
		}
	}

	@media (max-width: 768px) {
	:root {
			--mobile-control-height: 2.75rem;
			--mobile-radius: 0.75rem;
			--mobile-bg: rgba(255, 255, 255, 0.06);
			--mobile-border: inset 0 0 0 1px rgba(255, 255, 255, 0.1);
			--mobile-padding: 0.75rem;
		}

		/* --- Board & Cards --- */
	.main-content {
			flex-direction: column;
		}

	.board {
			flex-direction: column;
			padding: var(--mobile-padding);
			padding-left: max(var(--mobile-padding), env(safe-area-inset-left));
			padding-right: max(var(--mobile-padding), env(safe-area-inset-right));
			gap: 0.5rem;
			overflow-y: auto;
		}

	@keyframes panelSlideUp {
			from {
				opacity: 0;
				transform: translateY(100%);
			}
			to {
				opacity: 1;
				transform: translateY(0);
			}
		}
	}

	

	@keyframes pulseDot {
		0%, 100% { opacity: 1; transform: scale(1); }
		50% { opacity: 0.7; transform: scale(1.2); }
	}

	@keyframes busyPulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}

	@keyframes cursorBlink {
		0%, 50% { opacity: 1; }
		51%, 100% { opacity: 0; }
	}

	@keyframes idlePulse {
		0%, 100% { opacity: 0.3; }
		50% { opacity: 0.6; }
	}

	/* ============================================
	   AGENT BAR - Compact bottom bar
	   ============================================ */
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

	.app.light .agent-bar-inner {
		background: rgba(255, 255, 255, 0.98);
		border-color: rgba(0, 0, 0, 0.06);
	}

	.agent-add-form {
		flex-shrink: 0;
	}

	.session-picker-container {
		position: relative;
		flex-shrink: 0;
	}

	.session-picker-btn {
		width: 28px;
		height: 22px;
		padding: 0;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 4px;
		color: var(--text-secondary);
		font-size: 14px;
		cursor: pointer;
		transition: all 80ms ease;
	}

	.session-picker-btn:hover {
		background: rgba(255, 255, 255, 0.1);
		color: var(--text-primary);
	}

	.session-picker-dropdown {
		position: absolute;
		bottom: 100%;
		left: 0;
		margin-bottom: 6px;
		width: 280px;
		max-height: 360px;
		background: var(--bg-secondary);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 8px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2);
		z-index: 1000;
		overflow: hidden;
	}

	.session-picker-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.625rem 0.75rem;
		background: rgba(255, 255, 255, 0.03);
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}

	.session-picker-title {
		font: 600 11px/1 system-ui;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.session-picker-count {
		font: 500 10px/1 'JetBrains Mono', monospace;
		color: var(--text-tertiary);
		background: rgba(99, 102, 241, 0.2);
		padding: 2px 6px;
		border-radius: 10px;
	}

	.session-picker-list {
		max-height: 300px;
		overflow-y: auto;
		padding: 0.375rem;
	}

	.session-picker-empty {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 1.5rem 0.75rem;
		font: 11px/1.4 system-ui;
		color: var(--text-tertiary);
	}

	.session-picker-empty .spinner {
		width: 12px;
		height: 12px;
		border: 2px solid rgba(99, 102, 241, 0.2);
		border-top-color: rgba(99, 102, 241, 0.8);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.session-card {
		width: 100%;
		padding: 0.625rem 0.75rem;
		margin-bottom: 0.25rem;
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 6px;
		text-align: left;
		cursor: pointer;
		transition: all 100ms ease;
	}

	.session-card:last-child {
		margin-bottom: 0;
	}

	.session-card:hover {
		background: rgba(99, 102, 241, 0.12);
		border-color: rgba(99, 102, 241, 0.3);
		transform: translateY(-1px);
	}

	.session-card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.375rem;
	}

	.session-card-name {
		font: 600 12px/1 'JetBrains Mono', ui-monospace, monospace;
		color: var(--text-primary);
	}

	.session-card-time {
		font: 500 10px/1 system-ui;
		color: var(--text-tertiary);
		background: rgba(255, 255, 255, 0.05);
		padding: 2px 6px;
		border-radius: 3px;
	}

	.session-card-preview {
		font: 11px/1.4 system-ui;
		color: var(--text-secondary);
		margin-bottom: 0.375rem;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.session-card-preview.empty {
		color: var(--text-tertiary);
		font-style: italic;
	}

	.session-card-id {
		font: 9px/1 'JetBrains Mono', ui-monospace, monospace;
		color: var(--text-tertiary);
		opacity: 0.6;
	}

	.resume-prompt {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.25rem 0.5rem;
		background: rgba(99, 102, 241, 0.15);
		border-radius: 4px;
		font: 11px/1 'JetBrains Mono', ui-monospace, monospace;
	}

	.resume-text {
		color: var(--text-secondary);
	}

	.resume-btn {
		padding: 0.125rem 0.375rem;
		font: 600 10px/1 system-ui;
		border: none;
		border-radius: 3px;
		cursor: pointer;
		transition: all 80ms ease;
	}

	.resume-btn.yes {
		background: rgba(99, 102, 241, 0.8);
		color: white;
	}

	.resume-btn.yes:hover {
		background: #6366f1;
	}

	.resume-btn.no {
		background: rgba(255, 255, 255, 0.1);
		color: var(--text-secondary);
	}

	.resume-btn.no:hover {
		background: rgba(255, 255, 255, 0.15);
	}

	.resume-btn.cancel {
		background: transparent;
		color: var(--text-tertiary);
		padding: 0.125rem 0.25rem;
	}

	.resume-btn.cancel:hover {
		color: var(--text-secondary);
	}

	.agent-add-input {
		width: 72px;
		padding: 0.25rem 0.375rem;
		font: 11px/1 'JetBrains Mono', ui-monospace, monospace;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid transparent;
		border-radius: 3px;
		color: var(--text-primary);
	}

	.agent-add-input:focus {
		outline: none;
		background: rgba(255, 255, 255, 0.08);
		border-color: rgba(99, 102, 241, 0.4);
	}

	.agent-add-input::placeholder {
		color: var(--text-tertiary);
		opacity: 0.6;
	}

	.app.light .agent-add-input {
		background: rgba(0, 0, 0, 0.03);
	}

	.app.light .agent-add-input:focus {
		background: rgba(0, 0, 0, 0.05);
	}

	.agent-tabs {
		display: flex;
		gap: 2px;
		flex: 1;
		overflow-x: auto;
		scrollbar-width: none;
	}

	.agent-tabs::-webkit-scrollbar {
		display: none;
	}

	.agent-tab {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.25rem 0.5rem;
		background: transparent;
		border: none;
		border-radius: 3px;
		color: var(--text-tertiary);
		font: 11px/1 'JetBrains Mono', ui-monospace, monospace;
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

	.agent-tab.streaming {
		color: var(--text-primary);
	}

	.app.light .agent-tab:hover {
		background: rgba(0, 0, 0, 0.05);
	}

	.app.light .agent-tab.active {
		background: rgba(99, 102, 241, 0.1);
	}

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

	@keyframes msgIn {
		from {
			opacity: 0;
			transform: translateY(8px) scale(0.96);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	@keyframes blink {
		50% { opacity: 0; }
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
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

	@keyframes ropeTipPulse {
		0%, 100% { opacity: 0.6; transform: scale(1); }
		50% { opacity: 1; transform: scale(1.2); }
	}

	@keyframes energyFlow {
		from { stroke-dashoffset: 0; }
		to { stroke-dashoffset: -16; }
	}

	@keyframes ringPulse {
		0%, 100% { stroke-opacity: 0.8; }
		50% { stroke-opacity: 1; }
	}

	@keyframes corePulse {
		0%, 100% { transform: scale(1); }
		50% { transform: scale(1.1); }
	}

	@keyframes labelGlow {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes slideUp {
		from { opacity: 0; transform: translateY(20px) scale(0.95); }
		to { opacity: 1; transform: translateY(0) scale(1); }
	}

	.status-bar-container {
		position: fixed;
		bottom: 12px;
		right: 12px;
		z-index: 9999;
	}
</style>
