<script lang="ts">
	import { browser } from '$app/environment';
	import { untrack } from 'svelte';
	import { connect, disconnect, getPanes, isConnected, addPane, removePane, sendToPane, type Pane } from '$lib/wsStore.svelte';
	import type { Issue, Comment, CardPosition, FlyingCard, ContextMenuState, RopeDragState, SortBy, PaneSize, ViewMode, LoadingStatus as LoadingStatusType, Project } from '$lib/types';
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
		removeDependencyApi
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
	let themeTransitionActive = $state(false);
	let themeTransitionToLight = $state(false);
	let comments = $state<{ id: number; author: string; text: string; created_at: string }[]>([]);
	let newComment = $state('');
	let loadingComments = $state(false);
	let showPaneActivity = $state(true);
	let newPaneName = $state('');
	let paneMessageInputs = $state<Record<string, string>>({});
	let expandedPanes = $state<Set<string>>(new Set());
	let paneSizes = $state<Record<string, 'compact' | 'medium' | 'large'>>({});
	let panePositions = $state<Record<string, { x: number; y: number }>>({});
	let paneCustomSizes = $state<Record<string, { w: number; h: number }>>({});
	let draggingPane = $state<string | null>(null);
	let resizingPane = $state<string | null>(null);
	let dragOffset = $state({ x: 0, y: 0 });
	let resizeStart = $state({ x: 0, y: 0, w: 0, h: 0 });
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
	let projectSwitching = $state(false);
	let currentProjectPath = $state('');
	let projectColor = $state('#6366f1');

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
		if ((e.target as HTMLElement).closest('.window-btn, .chat-input, button')) return;
		e.preventDefault();
		const el = (e.currentTarget as HTMLElement).closest('.chat-window') as HTMLElement;
		const rect = el.getBoundingClientRect();
		draggingPane = name;
		dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
		// Initialize position if not set
		if (!panePositions[name]) {
			panePositions = { ...panePositions, [name]: { x: rect.left, y: rect.top } };
		}
	}

	function startResize(e: MouseEvent, name: string) {
		e.preventDefault();
		e.stopPropagation();
		resizingPane = name;
		const el = document.querySelector(`[data-pane="${name}"]`) as HTMLElement;
		const rect = el.getBoundingClientRect();
		resizeStart = { x: e.clientX, y: e.clientY, w: rect.width, h: rect.height };
		// Initialize custom size
		if (!paneCustomSizes[name]) {
			paneCustomSizes = { ...paneCustomSizes, [name]: { w: rect.width, h: rect.height } };
		}
	}

	function handleMouseMove(e: MouseEvent) {
		if (draggingPane) {
			const x = Math.max(0, Math.min(window.innerWidth - 100, e.clientX - dragOffset.x));
			const y = Math.max(0, Math.min(window.innerHeight - 50, e.clientY - dragOffset.y));
			panePositions = { ...panePositions, [draggingPane]: { x, y } };
		}
		if (resizingPane) {
			const dw = e.clientX - resizeStart.x;
			const dh = e.clientY - resizeStart.y;
			const w = Math.max(280, Math.min(window.innerWidth - 40, resizeStart.w + dw));
			const h = Math.max(200, Math.min(window.innerHeight - 100, resizeStart.h + dh));
			paneCustomSizes = { ...paneCustomSizes, [resizingPane]: { w, h } };
		}
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
		draggingPane = null;
		resizingPane = null;
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

	const wsPanes = $derived(getPanes());
	const wsConnected = $derived(isConnected());

	const panelOpen = $derived(editingIssue !== null || isCreating);

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
		return matchesSearch && matchesPriority && matchesType && matchesTime;
	}

	const hasActiveFilters = $derived(searchQuery !== '' || filterPriority !== 'all' || filterType !== 'all' || filterTime !== 'all');

	const filteredIssues = $derived(
		issues.filter((issue) => issueMatchesFilters(issue))
	);

	function connectSSE() {
		const eventSource = new EventSource('/api/issues/stream');

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
				if (oldIssue && oldIssue.status !== issue.status) {
					const fromPos = getCardPosition(issue.id);
					if (fromPos) {
						statusChanges.push({ id: issue.id, fromPos, newStatus: issue.status, height: fromPos.h });
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
			const closed = { ...issues[idx], status: 'closed', updated_at: new Date().toISOString() };
			issues = [...issues.slice(0, idx), closed, ...issues.slice(idx + 1)];
		}
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
			priority: createForm.priority,
			issue_type: createForm.issue_type,
			labels: [],
			dependencies: [],
			dependents: [],
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString()
		};
		issues = [tempIssue, ...issues];
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
		projectSwitching = true;

		// Trigger the 3D column rotation animation
		await new Promise(r => setTimeout(r, 50)); // Let animation class apply

		try {
			const res = await fetch('/api/cwd', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ path: project.path })
			});
			if (res.ok) {
				// Wait for animation to complete then reload
				setTimeout(() => {
					window.location.reload();
				}, 600);
			} else {
				projectSwitching = false;
			}
		} catch {
			projectSwitching = false;
		}
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

<div class="app" class:light={!isDarkMode} class:panel-open={panelOpen} class:show-hotkeys={showHotkeys} class:has-chat-bar={wsConnected} class:project-switching={projectSwitching} style="--project-color: {projectColor}">

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
	{isDarkMode}
	ontoggleTheme={toggleTheme}
/>
	<Header
		bind:searchQuery
		bind:filterPriority
		bind:filterType
		bind:filterTime
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

	<div class="main-content">
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
		<TreeView {issues} {selectedId} onselect={(issue) => openEditPanel(issue)} />
	{:else if viewMode === 'graph'}
		<GraphView {issues} {selectedId} onselect={(issue) => openEditPanel(issue)} />
	{:else if viewMode === 'stats'}
		<StatsView {issues} />
	{/if}

<!-- Chat Bar - Pinned to bottom (only when ws connected) -->
{#if wsConnected}
<div class="chat-bar" class:has-panes={wsPanes.size > 0}>
	<div class="chat-bar-inner">
		<!-- Connection indicator -->
		<div class="chat-bar-status" class:connected={wsConnected}>
			<span class="status-dot"></span>
			<span class="status-text">{wsConnected ? 'Connected' : 'Offline'}</span>
		</div>

		<!-- Add pane button -->
		<form class="chat-add-form" onsubmit={(e) => { e.preventDefault(); if (newPaneName.trim()) { addPane(newPaneName.trim()); newPaneName = ''; expandedPanes.add(newPaneName.trim()); expandedPanes = new Set(expandedPanes); } }}>
			<input type="text" bind:value={newPaneName} placeholder="Add agent..." class="chat-add-input" disabled={!wsConnected} />
			<button type="submit" class="chat-add-btn" disabled={!wsConnected || !newPaneName.trim()}>+</button>
		</form>

		<!-- Pane tabs -->
		<div class="chat-tabs">
			{#each [...wsPanes.values()] as pane}
				<button
					class="chat-tab"
					class:expanded={expandedPanes.has(pane.name)}
					class:streaming={pane.streaming}
					onclick={() => { if (expandedPanes.has(pane.name)) { expandedPanes.delete(pane.name); } else { expandedPanes.add(pane.name); } expandedPanes = new Set(expandedPanes); }}
				>
					<span class="tab-indicator"></span>
					<span class="tab-name">{pane.name}</span>
					<span class="tab-badge">{pane.messages.length}</span>
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
		disabled={true}
		onStartDrag={startDrag}
		onStartResize={startResize}
		onCyclePaneSize={cyclePaneSize}
		onRemovePane={removePane}
		onMinimizePane={(name) => { expandedPanes.delete(name); expandedPanes = new Set(expandedPanes); }}
		onSendMessage={(name, msg) => sendToPane(name, msg)}
		onMouseMove={handleMouseMove}
		onMouseUp={handleMouseUp}
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
	/>
</div>

{#snippet detailPanel()}
	<DetailPanel
		bind:editingIssue
		{isCreating}
		bind:createForm
		allIssues={issues}
		{comments}
		{copiedId}
		bind:newLabelInput
		bind:newComment
		{loadingComments}
		{originalLabels}
		{isPanelDragging}
		{panelDragOffset}
		{issueClosedExternally}
		onclose={closePanel}
		oncreate={createIssue}
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

	/* Project switching 3D column rotation */
	.app.project-switching {
		perspective: 1200px;
	}

	.app.project-switching :global(.board) {
		transform-style: preserve-3d;
	}

	.app.project-switching :global(.column) {
		animation: columnRotateOut 600ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
		transform-origin: center center;
	}

	.app.project-switching :global(.column:nth-child(1)) { animation-delay: 0ms; }
	.app.project-switching :global(.column:nth-child(2)) { animation-delay: 50ms; }
	.app.project-switching :global(.column:nth-child(3)) { animation-delay: 100ms; }
	.app.project-switching :global(.column:nth-child(4)) { animation-delay: 150ms; }
	.app.project-switching :global(.column:nth-child(5)) { animation-delay: 200ms; }
	.app.project-switching :global(.column:nth-child(6)) { animation-delay: 250ms; }

	@keyframes columnRotateOut {
		0% {
			transform: rotateY(0deg) translateZ(0) scale(1);
			opacity: 1;
		}
		40% {
			transform: rotateY(-15deg) translateZ(-100px) scale(0.95);
			opacity: 0.8;
		}
		100% {
			transform: rotateY(-90deg) translateZ(-200px) scale(0.8);
			opacity: 0;
		}
	}

	/* Project title slide animation */
	.app.project-switching :global(.logo-project) {
		animation: titleSlideOut 400ms ease-out forwards;
	}

	@keyframes titleSlideOut {
		0% {
			transform: translateY(0);
			opacity: 1;
		}
		100% {
			transform: translateY(20px);
			opacity: 0;
		}
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

			/* Main Content - Board + Panel */
	.main-content {
		display: flex;
		flex: 1;
		min-height: 0;
		overflow: hidden;
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
	   CHAT BAR - Pinned bottom chat interface
	   ============================================ */
	.chat-bar {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: 1000;
		display: flex;
		flex-direction: column-reverse;
		pointer-events: none;
	}

	.chat-bar-inner {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 1rem;
		background: rgba(15, 15, 20, 0.95);
		border-top: 1px solid rgba(255, 255, 255, 0.06);
		backdrop-filter: blur(12px);
		pointer-events: auto;
	}

	.app.light .chat-bar-inner {
		background: rgba(255, 255, 255, 0.95);
		border-top-color: rgba(0, 0, 0, 0.08);
	}

	.chat-bar-status {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.25rem 0.5rem;
		border-radius: var(--radius-sm);
		background: rgba(239, 68, 68, 0.1);
	}

	.chat-bar-status.connected {
		background: rgba(16, 185, 129, 0.1);
	}

	.chat-bar-status .status-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #ef4444;
	}

	.chat-bar-status.connected .status-dot {
		background: #10b981;
		box-shadow: 0 0 6px rgba(16, 185, 129, 0.5);
	}

	.chat-bar-status .status-text {
		font-size: 0.6875rem;
		font-family: 'JetBrains Mono', monospace;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.chat-add-form {
		display: flex;
		gap: 0.375rem;
	}

	.chat-add-input {
		width: 120px;
		padding: 0.375rem 0.625rem;
		font-size: 0.75rem;
		font-family: 'JetBrains Mono', monospace;
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: var(--radius-sm);
		color: var(--text-primary);
		transition: all 0.15s ease;
	}

	.chat-add-input:focus {
		outline: none;
		border-color: rgba(99, 102, 241, 0.5);
		width: 160px;
	}

	.chat-add-input::placeholder {
		color: var(--text-tertiary);
	}

	.app.light .chat-add-input {
		background: rgba(0, 0, 0, 0.04);
		border-color: rgba(0, 0, 0, 0.1);
	}

	.chat-add-btn {
		padding: 0.375rem 0.625rem;
		font-size: 0.875rem;
		font-weight: 600;
		background: rgba(99, 102, 241, 0.2);
		border: 1px solid rgba(99, 102, 241, 0.3);
		border-radius: var(--radius-sm);
		color: #6366f1;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.chat-add-btn:hover:not(:disabled) {
		background: rgba(99, 102, 241, 0.3);
	}

	.chat-add-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.chat-tabs {
		display: flex;
		gap: 0.375rem;
		flex: 1;
		overflow-x: auto;
		scrollbar-width: none;
	}

	.chat-tabs::-webkit-scrollbar {
		display: none;
	}

	.chat-tab {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.375rem 0.75rem;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		font-size: 0.75rem;
		font-family: 'JetBrains Mono', monospace;
		cursor: pointer;
		transition: all 0.15s ease;
		white-space: nowrap;
	}

	.chat-tab:hover {
		background: rgba(255, 255, 255, 0.08);
		color: var(--text-primary);
	}

	.chat-tab.expanded {
		background: rgba(99, 102, 241, 0.15);
		border-color: rgba(99, 102, 241, 0.3);
		color: var(--text-primary);
	}

	.chat-tab.streaming {
		border-color: rgba(245, 158, 11, 0.4);
	}

	.chat-tab.streaming .tab-indicator {
		background: #f59e0b;
		box-shadow: 0 0 6px rgba(245, 158, 11, 0.5);
		animation: pulse 1.5s ease-in-out infinite;
	}

	.app.light .chat-tab {
		background: rgba(0, 0, 0, 0.03);
		border-color: rgba(0, 0, 0, 0.08);
	}

	.tab-indicator {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--text-tertiary);
	}

	.tab-badge {
		padding: 0.125rem 0.375rem;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 9999px;
		font-size: 0.625rem;
		color: var(--text-tertiary);
	}

	.chat-tab.expanded .tab-badge {
		background: rgba(99, 102, 241, 0.2);
		color: #6366f1;
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
