<script lang="ts">
	import { browser } from '$app/environment';
	import { connect, disconnect, getPanes, isConnected, addPane, removePane, sendToPane, type Pane } from '$lib/wsStore.svelte';
	import type { Issue, Comment, CardPosition, FlyingCard, ContextMenuState, RopeDragState, SortBy, PaneSize } from '$lib/types';
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

	let issues = $state<Issue[]>([]);
	let draggedId = $state<string | null>(null);
	let draggedOverColumn = $state<string | null>(null);
	let editingIssue = $state<Issue | null>(null);
	let originalLabels = $state<string[]>([]);
	let isCreating = $state(false);
	let createForm = $state({ title: '', description: '', priority: 2, issue_type: 'task' });
	let searchQuery = $state('');
	let filterPriority = $state<number | 'all'>('all');
	let filterType = $state<string>('all');
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
	let teleports = $state<{id: string; from: {x: number; y: number; w: number; h: number}; to: {x: number; y: number; w: number; h: number}; startTime: number}[]>([]);
	let placeholders = $state<{id: string; targetColumn: string; height: number}[]>([]);
	let cardRefs = $state<Map<string, HTMLElement>>(new Map());
	let placeholderRefs = $state<Map<string, HTMLElement>>(new Map());
	let flyingCards = $state<Map<string, {from: {x: number; y: number; w: number; h: number}; to: {x: number; y: number; w: number; h: number}; issue: Issue}>>(new Map());

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

	const editingColumnIndex = $derived(() => {
		if (!editingIssue) return 0; // default for create
		const col = getIssueColumn(editingIssue);
		const idx = columns.findIndex(c => c.key === col.key);
		return idx >= 0 ? idx : 0;
	});

	function issueMatchesFilters(issue: Issue): boolean {
		const query = searchQuery.toLowerCase();
		const matchesSearch = !query ||
			issue.id.toLowerCase().includes(query) ||
			issue.title.toLowerCase().includes(query) ||
			issue.description.toLowerCase().includes(query);
		const matchesPriority = filterPriority === 'all' || issue.priority === filterPriority;
		const matchesType = filterType === 'all' || issue.issue_type === filterType;
		return matchesSearch && matchesPriority && matchesType;
	}

	const hasActiveFilters = $derived(searchQuery !== '' || filterPriority !== 'all' || filterType !== 'all');

	const filteredIssues = $derived(
		issues.filter((issue) => issueMatchesFilters(issue))
	);

	function connectSSE() {
		const eventSource = new EventSource('/api/issues/stream');

		eventSource.onmessage = (event) => {
			const data = JSON.parse(event.data);
			const oldIssuesMap = new Map(issues.map(i => [i.id, i]));

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
			setTimeout(connectSSE, 3000);
		};

		return eventSource;
	}

	async function updateIssue(id: string, updates: Partial<Issue>) {
		await fetch(`/api/issues/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(updates)
		});
	}

	async function deleteIssue(id: string) {
		if (!confirm('Delete this issue?')) return;
		await fetch(`/api/issues/${id}`, { method: 'DELETE' });
		if (editingIssue?.id === id) {
			editingIssue = null;
		}
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
		await fetch('/api/issues', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(createForm)
		});
		createForm = { title: '', description: '', priority: 2, issue_type: 'task' };
		isCreating = false;
	}

	function openCreatePanel() {
		editingIssue = null;
		isCreating = true;
		createForm = { title: '', description: '', priority: 2, issue_type: 'task' };
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
	}

	function openEditPanel(issue: Issue, pushState = true) {
		if (hasUnsavedCreate()) {
			if (!confirm('You have unsaved changes. Discard them?')) return;
		}
		isCreating = false;
		createForm = { title: '', description: '', priority: 2, issue_type: 'task' };
		editingIssue = { ...issue, labels: issue.labels ? [...issue.labels] : [] };
		originalLabels = issue.labels ? [...issue.labels] : [];
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
		// Update labels in editingIssue
		let labels = editingIssue.labels ? [...editingIssue.labels] : [];
		if (updates.removeLabels) labels = labels.filter(l => !updates.removeLabels!.includes(l));
		if (updates.addLabels) labels = [...labels, ...updates.addLabels];
		editingIssue.labels = labels;
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
		isCreating = false;
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

		// Global shortcuts (work even in inputs)
		if (e.key === 'Escape') {
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
		isDarkMode = !isDarkMode;
		if (browser) {
			localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
		}
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
		}
	});

	$effect(() => {
		const source = connectSSE();
		return () => source.close();
	});

	$effect(() => {
		if (browser) connect();
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

<div class="app" class:light={!isDarkMode} class:panel-open={panelOpen} class:show-hotkeys={showHotkeys}>

<KeyboardHelp bind:show={showKeyboardHelp} />
	<Header
		bind:searchQuery
		bind:filterPriority
		bind:filterType
		{isDarkMode}
		wsConnected={wsConnected}
		paneCount={wsPanes.size}
		ontoggleTheme={toggleTheme}
		onopenKeyboardHelp={() => showKeyboardHelp = true}
		onopenCreatePanel={openCreatePanel}
		ontogglePaneActivity={() => showPaneActivity = !showPaneActivity}
	/>

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
				/>
				{#if editingIssue && editingColumnIndex() === i}
					{@render detailPanel()}
				{/if}
			{/each}
		</main>
		</div>

<!-- Chat Bar - Pinned to bottom -->
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

<FlyingCardComponent {teleports} {flyingCards} />
</div>

{#snippet detailPanel()}
	<DetailPanel
		bind:editingIssue
		{isCreating}
		bind:createForm
		{comments}
		{copiedId}
		bind:newLabelInput
		bind:newComment
		{loadingComments}
		{originalLabels}
		{isPanelDragging}
		{panelDragOffset}
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
		padding-bottom: 48px;
		background: var(--bg-primary);
		transition: background var(--transition-smooth);
		position: relative;
		overflow: hidden;
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

	/* Header */
	.header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		padding: 0.875rem 1.5rem;
		background: transparent;
		gap: 1.5rem;
		z-index: 100;
		flex-shrink: 0;
	}

	.header-left {
		flex-shrink: 0;
		display: flex;
		align-items: baseline;
		gap: 1.5rem;
	}

	.header-nav {
		display: flex;
		align-items: baseline;
		gap: 1rem;
	}

	.header-nav a {
		color: rgba(255, 255, 255, 0.7);
		text-decoration: none;
		font-size: 0.8125rem;
		font-weight: 500;
		transition: color 0.15s;
	}

	.header-nav a:hover {
		color: rgba(255, 255, 255, 0.9);
	}

	.app.light .header-nav a {
		color: rgba(0, 0, 0, 0.7);
	}

	.app.light .header-nav a:hover {
		color: rgba(0, 0, 0, 0.9);
	}

	.logo h1 {
		font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif;
		font-size: 1.3rem;
		font-weight: 800;
		letter-spacing: -0.02em;
		color: rgba(255, 255, 255, 0.95);
		text-transform: lowercase;
		text-shadow: 0 0.5px 0 rgba(0, 0, 0, 0.5);
	}

	.header-center {
		flex: 1;
		max-width: 500px;
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.search-container {
		position: relative;
		display: flex;
		align-items: center;
		flex: 1;
	}

	.search-icon {
		position: absolute;
		left: 0.75rem;
		width: 0.9375rem;
		height: 0.9375rem;
		color: var(--text-tertiary);
		pointer-events: none;
	}

	.search-input {
		width: 100%;
		padding: 0.625rem 2.25rem;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: var(--radius-lg);
		color: var(--text-primary);
		font-family: inherit;
		font-size: 0.875rem;
		transition: all var(--transition-fast);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
	}

	.search-input::placeholder {
		color: var(--text-secondary);
	}

	.search-input:focus {
		outline: none;
		background: rgba(255, 255, 255, 0.06);
		border-color: rgba(59, 130, 246, 0.5);
		box-shadow:
			0 2px 8px rgba(0, 0, 0, 0.08),
			0 0 0 3px rgba(59, 130, 246, 0.15);
	}

	.search-clear {
		position: absolute;
		right: 0.5rem;
		width: 1.125rem;
		height: 1.125rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-elevated);
		border: none;
		border-radius: 50%;
		color: var(--text-tertiary);
		font-size: 0.8125rem;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.search-clear:hover {
		background: var(--text-tertiary);
		color: var(--bg-primary);
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		flex-shrink: 0;
	}

	.filter-group {
		display: flex;
		gap: 0.375rem;
	}

	.filter-select {
		padding: 0.375rem 0.5rem;
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		color: var(--text-tertiary);
		font-family: inherit;
		font-size: 0.75rem;
		cursor: pointer;
		transition: all var(--transition-fast);
		appearance: none;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 24 24' fill='none' stroke='%2365656d' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 0.25rem center;
		padding-right: 1.25rem;
	}

	.filter-select:hover {
		background: rgba(255, 255, 255, 0.06);
		color: var(--text-secondary);
	}

	.filter-select:focus {
		outline: none;
		background: rgba(255, 255, 255, 0.06);
		color: var(--text-secondary);
	}

	.filter-select option {
		background: var(--bg-secondary);
	}

	.theme-toggle {
		width: 2rem;
		height: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		color: var(--text-tertiary);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.theme-toggle svg {
		width: 1rem;
		height: 1rem;
	}

	.theme-toggle:hover {
		background: rgba(255, 255, 255, 0.06);
		color: var(--text-secondary);
	}

	.btn-create {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.625rem 1.125rem;
		background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: var(--radius-lg);
		color: white;
		font-family: inherit;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition:
			transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1),
			box-shadow 200ms cubic-bezier(0, 0, 0.2, 1),
			background 150ms ease-out;
		box-shadow:
			0 2px 8px rgba(59, 130, 246, 0.3),
			0 1px 2px rgba(0, 0, 0, 0.1);
	}

	.btn-create:hover {
		background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
		transform: translateY(-2px) scale(1.02);
		box-shadow:
			0 6px 16px rgba(59, 130, 246, 0.45),
			0 3px 6px rgba(0, 0, 0, 0.12);
	}

	.btn-create:active {
		background: linear-gradient(180deg, var(--accent-primary) 0%, #0066cc 100%);
		transform: translateY(0) scale(0.98);
		transition:
			transform 80ms cubic-bezier(0.4, 0, 0.2, 1),
			box-shadow 80ms ease-out;
		box-shadow:
			inset 0 2px 4px rgba(0, 0, 0, 0.2),
			0 1px 2px rgba(0, 0, 0, 0.15);
	}

	.btn-create-icon {
		font-size: 1rem;
		line-height: 1;
	}

	.btn-hotkey {
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 0.625rem;
		font-weight: 500;
		padding: 0.125rem 0.375rem;
		background: rgba(255, 255, 255, 0.15);
		border-radius: 3px;
		margin-left: 0.5rem;
		opacity: 0.8;
	}

	.btn-hotkey-subtle {
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 0.625rem;
		font-weight: 500;
		padding: 0.125rem 0.25rem;
		background: rgba(255, 255, 255, 0.08);
		border-radius: 3px;
		margin-left: 0.375rem;
		color: var(--text-tertiary);
	}

	.btn-hotkey-light {
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 0.625rem;
		font-weight: 500;
		padding: 0.125rem 0.25rem;
		background: rgba(255, 255, 255, 0.2);
		border-radius: 3px;
		margin-left: 0.375rem;
	}

	/* Column Navigation (Mobile) */
	.column-nav {
		display: none;
		padding: 0.5rem 0.75rem;
		padding-left: max(0.75rem, env(safe-area-inset-left));
		padding-right: max(0.75rem, env(safe-area-inset-right));
		background: var(--bg-secondary);
		border-bottom: 1px solid var(--border-subtle);
		gap: 0.5rem;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		flex-shrink: 0;
		scroll-snap-type: x proximity;
		scrollbar-width: none;
	}

	.column-nav::-webkit-scrollbar {
		display: none;
	}

	.column-tab {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.625rem 1rem;
		min-height: 2.75rem; /* 44px touch target */
		background: var(--bg-tertiary);
		border: 1px solid transparent;
		border-radius: var(--radius-lg);
		color: var(--text-secondary);
		font-family: inherit;
		font-size: 0.8125rem;
		font-weight: 500;
		cursor: pointer;
		white-space: nowrap;
		scroll-snap-align: start;
		transition: all 200ms cubic-bezier(0.25, 0.1, 0.25, 1);
	}

	.column-tab:active {
		transform: scale(0.97);
	}

	.column-tab.active {
		background: var(--accent);
		border-color: transparent;
		color: white;
		box-shadow: 0 2px 12px rgba(var(--accent-rgb, 10, 132, 255), 0.35);
	}

	.column-tab-icon {
		font-size: 0.6875rem;
	}

	.column-tab-count {
		padding: 0.0625rem 0.3125rem;
		background: rgba(255, 255, 255, 0.15);
		border-radius: 999px;
		font-size: 0.625rem;
	}

	.column-tab:not(.active) .column-tab-count {
		background: var(--bg-elevated);
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
	}

	/* Column */
	.column {
		flex: 1 1 0;
		min-width: 280px;
		min-height: 0;
		align-self: stretch;
		display: flex;
		flex-direction: column;
		background: transparent;
		border: none;
		border-radius: var(--radius-lg);
		overflow: visible;
		transition: all var(--transition-smooth);
	}

	.column.drag-over {
		background: var(--accent-glow);
	}

	.column-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 0.5rem;
		border-bottom: none;
		background: transparent;
		flex-shrink: 0;
	}

	.column-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.column-icon {
		font-size: 0.75rem;
		color: var(--accent);
	}

	.column-header h2 {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-secondary);
	}

	.column-count {
		padding: 0.1875rem 0.5rem;
		background: var(--bg-elevated);
		border-radius: 999px;
		font-size: 0.6875rem;
		font-weight: 600;
		color: var(--text-secondary);
	}

	.column-header-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.sort-dropdown {
		position: relative;
	}

	.sort-btn {
		width: 2rem;
		height: 2rem;
		min-width: 2.75rem; /* 44px touch target */
		min-height: 2.75rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-sm);
		border: none;
		background: transparent;
		color: var(--text-tertiary);
		cursor: pointer;
		transition: all var(--transition-fast);
		opacity: 0;
	}

	.sort-btn svg {
		width: 0.75rem;
		height: 0.75rem;
	}

	.column-header:hover .sort-btn {
		opacity: 0.6;
	}

	.sort-btn:hover, .sort-btn.active {
		opacity: 1;
		color: var(--accent);
	}

	.sort-menu {
		position: absolute;
		top: 100%;
		right: 0;
		margin-top: 0.25rem;
		background: var(--bg-secondary);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		padding: 0.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		z-index: 50;
		min-width: 80px;
		box-shadow: var(--shadow-md);
	}

	.sort-menu button {
		padding: 0.375rem 0.5rem;
		font-size: 0.625rem;
		font-weight: 500;
		text-align: left;
		border: none;
		background: transparent;
		color: var(--text-secondary);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.sort-menu button:hover {
		background: var(--bg-elevated);
		color: var(--text-primary);
	}

	.sort-menu button.active {
		background: var(--accent-primary);
		color: white;
	}

	.column-collapse-btn {
		width: 1.25rem;
		height: 1.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		color: var(--text-tertiary);
		font-size: 0.5rem;
		cursor: pointer;
		transition: all var(--transition-fast);
		opacity: 0;
	}

	.column-header:hover .column-collapse-btn {
		opacity: 1;
	}

	.column-collapse-btn:hover {
		background: var(--bg-elevated);
		color: var(--text-primary);
	}

	.column.collapsed {
		flex: 0 0 48px;
		min-width: 48px;
	}

	.column.collapsed .column-header {
		flex-direction: column;
		padding: 0.75rem 0.5rem;
		height: 100%;
		cursor: pointer;
	}

	.column.collapsed .column-title {
		flex-direction: column;
		writing-mode: vertical-rl;
		text-orientation: mixed;
	}

	.column.collapsed .column-header-actions {
		flex-direction: column;
	}

	.column.collapsed .column-collapse-btn {
		opacity: 1;
	}

	/* Cards Container */
	.cards {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.75rem 1rem 2rem 0.75rem;
		margin: 0 -0.25rem;
		flex: 1;
		overflow-y: auto;
		overflow-x: visible;
		min-height: 0;
	}

	.cards::-webkit-scrollbar {
		width: 5px;
	}

	.cards::-webkit-scrollbar-track {
		background: transparent;
	}

	.cards::-webkit-scrollbar-thumb {
		background: var(--border-default);
		border-radius: 2.5px;
	}

	.cards::-webkit-scrollbar-thumb:hover {
		background: var(--border-strong);
	}

	/* Drop Indicator */
	.drop-indicator {
		height: 3px;
		background: linear-gradient(90deg, transparent, var(--accent-primary), transparent);
		border-radius: 2px;
		margin: 0.1875rem 0;
		animation: dropPulse 1s ease-in-out infinite;
	}

	@keyframes dropPulse {
		0%, 100% { opacity: 0.6; transform: scaleX(0.95); }
		50% { opacity: 1; transform: scaleX(1); }
	}

	/* Card */
	.card {
		position: relative;
		display: flex;
		flex-shrink: 0;
		margin: 2px 4px;
		background: var(--bg-secondary);
		border: none;
		border-radius: var(--radius-md);
		box-shadow:
			0 4px 12px -2px rgba(0, 0, 0, 0.08),
			0 2px 6px -1px rgba(0, 0, 0, 0.04),
			inset 0 1px 0 rgba(255, 255, 255, 0.12),
			inset 0 -1px 0 rgba(0, 0, 0, 0.2);
		cursor: pointer;
		transition:
			transform 200ms cubic-bezier(0.34, 1.4, 0.64, 1),
			box-shadow 250ms cubic-bezier(0, 0, 0.2, 1),
			background 200ms ease-out;
		overflow: hidden;
	}

	.card:hover {
		transform: translateY(-3px) scale(1.005);
		box-shadow:
			0 8px 20px -4px rgba(0, 0, 0, 0.15),
			0 4px 10px -2px rgba(0, 0, 0, 0.08),
			inset 0 1px 0 rgba(255, 255, 255, 0.15),
			inset 0 -1px 0 rgba(0, 0, 0, 0.2);
	}

	.card:active {
		transform: translateY(-1px) scale(0.995);
		transition:
			transform 100ms cubic-bezier(0.4, 0, 0.2, 1),
			box-shadow 100ms ease-out;
	}

	.card-priority-bar {
		width: 3px;
		flex-shrink: 0;
		position: relative;
		display: flex;
		align-items: flex-start;
		background: var(--priority-bar-color);
	}

	.priority-label {
		position: absolute;
		left: 6px;
		top: 4px;
		writing-mode: vertical-rl;
		text-orientation: mixed;
		font-family: ui-monospace, 'SF Mono', 'Cascadia Code', monospace;
		font-size: 0.4375rem;
		font-weight: 500;
		color: var(--priority-bar-color);
		letter-spacing: 0.02em;
		text-transform: uppercase;
		transform: rotate(180deg);
		white-space: nowrap;
		opacity: 0;
		transition: opacity var(--transition-fast);
	}

	.card:hover .priority-label,
	.card.selected .priority-label {
		opacity: 1;
	}

	.type-indicator {
		position: absolute;
		bottom: 0.5rem;
		right: 0.625rem;
		font-size: 0.5625rem;
		font-family: ui-monospace, 'SF Mono', monospace;
		text-transform: uppercase;
		letter-spacing: 0.02em;
		color: var(--text-tertiary);
		opacity: 0.5;
		z-index: 1;
	}

	.card:hover .type-indicator {
		opacity: 0.8;
	}

	.card-content {
		flex: 1;
		padding: 0.875rem;
		min-width: 0;
		overflow: hidden;
		border-radius: 0 var(--radius-md) var(--radius-md) 0;
	}

	.card::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: linear-gradient(135deg, rgba(255,255,255,0.02) 0%, transparent 50%);
		pointer-events: none;
	}

	.card:active {
		transform: translateY(0);
		transition: transform 100ms ease-out;
	}

	.card.selected {
		box-shadow:
			0 0 0 2px var(--accent-primary),
			var(--shadow-md);
	}

	.card.editing {
		box-shadow:
			0 0 0 1px var(--accent-primary),
			inset 0 0 0 1px rgba(10, 132, 255, 0.2),
			var(--shadow-lg);
		z-index: 5;
	}

	.card.dragging {
		opacity: 0.7;
		transform: rotate(3deg) scale(1.05);
		box-shadow: var(--shadow-lg);
		cursor: grabbing;
	}

	.card.filter-dimmed {
		opacity: 0.25;
		pointer-events: none;
		transform: scale(0.98);
		filter: grayscale(0.5);
	}

	.card.animating {
		animation: cardEnter 600ms cubic-bezier(0.34, 1.56, 0.64, 1);
		z-index: 10;
	}

	.card.flying-hidden {
		opacity: 0;
		pointer-events: none;
	}

	.card.flying-card {
		position: fixed;
		top: 0;
		left: 0;
		width: var(--card-w);
		z-index: 10000;
		pointer-events: none;
		animation: flyCard 500ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
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

	@keyframes cardEnter {
		0% {
			opacity: 0;
			transform: scale(0.9) translateY(-12px);
			box-shadow:
				0 0 0 3px rgba(16, 185, 129, 0.8),
				0 0 40px rgba(16, 185, 129, 0.6),
				0 8px 32px rgba(0, 0, 0, 0.3);
			background: rgba(16, 185, 129, 0.15);
		}
		30% {
			opacity: 1;
			transform: scale(1.03) translateY(0);
			box-shadow:
				0 0 0 3px rgba(16, 185, 129, 0.6),
				0 0 32px rgba(16, 185, 129, 0.5),
				0 12px 40px rgba(0, 0, 0, 0.25);
		}
		60% {
			transform: scale(0.98) translateY(0);
			box-shadow:
				0 0 0 2px rgba(99, 102, 241, 0.4),
				0 0 20px rgba(99, 102, 241, 0.3),
				0 4px 16px rgba(0, 0, 0, 0.15);
		}
		100% {
			transform: scale(1) translateY(0);
			box-shadow: none;
			background: var(--bg-tertiary);
		}
	}

	/* Teleport Ghost Strobe Effect */
	.teleport-ghost {
		position: fixed;
		top: 0;
		left: 0;
		width: var(--ghost-w);
		height: var(--ghost-h);
		background: linear-gradient(135deg, rgba(59, 130, 246, 0.3) 0%, rgba(99, 102, 241, 0.2) 100%);
		border: 2px solid rgba(59, 130, 246, 0.6);
		border-radius: var(--radius-md);
		pointer-events: none;
		z-index: 9999;
		opacity: var(--opacity);
		animation: teleportStrobe 600ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
		animation-delay: var(--delay);
		box-shadow:
			0 0 20px rgba(59, 130, 246, 0.4),
			0 0 40px rgba(99, 102, 241, 0.2),
			inset 0 0 20px rgba(59, 130, 246, 0.1);
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

	/* Placeholder slot that makes room for incoming teleported card */
	.placeholder-slot {
		height: 0;
		overflow: hidden;
		animation: placeholderExpand 300ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
		margin-bottom: var(--space-sm);
	}

	@keyframes placeholderExpand {
		from {
			height: 0;
		}
		to {
			height: var(--placeholder-height);
		}
	}

	.card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.375rem;
		gap: 0.5rem;
	}

	.card-id-wrap {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
	}

	.card-id {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.625rem;
		font-weight: 500;
		color: var(--text-tertiary);
		letter-spacing: 0.02em;
	}

	.btn-copy {
		width: 1.5rem;
		height: 1.5rem;
		min-width: 2.75rem; /* 44px touch target */
		min-height: 2.75rem;
		margin: -0.625rem; /* Expand touch area without visual change */
		padding: 0.625rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		color: var(--text-tertiary);
		cursor: pointer;
		opacity: 0;
		transition: all var(--transition-fast);
		padding: 0;
	}

	.btn-copy svg {
		width: 0.75rem;
		height: 0.75rem;
		transition: transform 150ms ease-out;
	}

	.card:hover .btn-copy {
		opacity: 0.6;
	}

	.btn-copy:hover {
		opacity: 1 !important;
		color: var(--text-secondary);
		background: var(--bg-elevated);
	}

	.btn-copy:hover svg {
		transform: scale(1.1);
	}

	.btn-copy:active svg {
		transform: scale(0.9);
	}

	.btn-copy.copied {
		opacity: 1 !important;
		color: #34c759;
		animation: copySuccess 400ms ease-out;
	}

	@keyframes copySuccess {
		0% { transform: scale(1); }
		50% { transform: scale(1.2); }
		100% { transform: scale(1); }
	}

	.blocked-indicator {
		color: #ef4444;
		font-size: 0.875rem;
		margin-left: 0.25rem;
		cursor: help;
	}

	.card.has-blockers {
		border-left: 3px solid #ef4444;
	}

	.card.has-blockers .card-priority-bar {
		background: linear-gradient(180deg, #ef4444 0%, var(--priority-bar-color, #ef4444) 100%) !important;
	}

	.card-actions {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	.card-date {
		font-size: 0.625rem;
		color: var(--text-tertiary);
		opacity: 0;
		transition: opacity var(--transition-fast);
	}

	.card:hover .card-date {
		opacity: 1;
	}

	.btn-delete {
		width: 1.25rem;
		height: 1.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		color: var(--text-tertiary);
		cursor: pointer;
		opacity: 0;
		transition: all var(--transition-fast);
	}

	.btn-delete svg {
		width: 0.75rem;
		height: 0.75rem;
	}

	.card:hover .btn-delete {
		opacity: 1;
	}

	.btn-delete:hover {
		background: rgba(239, 68, 68, 0.15);
		color: #ef4444;
	}

	.card-title {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text-primary);
		line-height: 1.35;
		margin-bottom: 0.25rem;
	}

	.card-description {
		font-size: 0.6875rem;
		color: var(--text-tertiary);
		line-height: 1.4;
		margin-bottom: 0.5rem;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.badge.assignee {
		margin-left: auto;
		background: rgba(99, 102, 241, 0.12);
		color: var(--text-secondary);
	}

	.assignee-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: currentColor;
	}

	/* Agent Chip - Prominent AI worker indicator */
	.agent-chip {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.25rem 0.5rem 0.25rem 0.375rem;
		background: linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(6, 182, 212, 0.12) 100%);
		border: 1px solid rgba(16, 185, 129, 0.25);
		border-radius: 1rem;
		margin-bottom: 0.5rem;
		position: relative;
		overflow: hidden;
		width: fit-content;
	}

	.agent-pulse {
		position: absolute;
		inset: 0;
		background: linear-gradient(90deg, transparent 0%, rgba(16, 185, 129, 0.1) 50%, transparent 100%);
		animation: agent-pulse-sweep 2.5s ease-in-out infinite;
	}

	@keyframes agent-pulse-sweep {
		0%, 100% { transform: translateX(-100%); opacity: 0; }
		50% { transform: translateX(100%); opacity: 1; }
	}

	.agent-icon {
		width: 14px;
		height: 14px;
		color: #10b981;
		animation: agent-icon-spin 8s linear infinite;
		flex-shrink: 0;
	}

	@keyframes agent-icon-spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}

	.agent-name {
		font-size: 0.6875rem;
		font-weight: 600;
		color: #10b981;
		text-transform: capitalize;
		letter-spacing: 0.01em;
	}

	.agent-status {
		font-size: 0.5625rem;
		font-weight: 500;
		color: rgba(16, 185, 129, 0.7);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding-left: 0.25rem;
		border-left: 1px solid rgba(16, 185, 129, 0.2);
	}

	.card-labels {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		margin-bottom: 0.5rem;
	}

	.label {
		padding: 0.125rem 0.375rem;
		background: var(--bg-elevated);
		border-radius: var(--radius-sm);
		font-size: 0.5625rem;
		font-weight: 500;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}

	.label.more {
		background: var(--accent-glow);
		color: var(--accent-primary);
	}

	.card-footer {
		display: flex;
		gap: 0.3125rem;
		flex-wrap: wrap;
	}

	/* Card Links (dependencies/dependents) */
	.card-links {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		margin-top: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid var(--border-subtle);
	}

	.link-group {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.5625rem;
	}

	.link-group.blocked-by .link-arrow { color: #ef4444; }
	.link-group.blocking .link-arrow { color: #10b981; }

	.link-arrow {
		font-weight: 600;
		opacity: 0.7;
	}

	.link-id {
		font-family: 'JetBrains Mono', monospace;
		padding: 0.125rem 0.25rem;
		background: var(--bg-elevated);
		border-radius: 3px;
		border-left: 2px solid var(--text-tertiary);
	}

	.link-id.open { border-left-color: #6366f1; }
	.link-id.in-progress { border-left-color: #f59e0b; }
	.link-id.blocked { border-left-color: #ef4444; }
	.link-id.closed { border-left-color: #10b981; opacity: 0.6; }

	.link-more {
		font-size: 0.5rem;
		color: var(--text-tertiary);
		padding: 0.125rem 0.25rem;
	}

	/* Badges */
	.badge {
		display: inline-flex;
		align-items: center;
		gap: 0.1875rem;
		padding: 0.1875rem 0.375rem;
		border-radius: var(--radius-sm);
		font-size: 0.625rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.badge.priority {
		background: var(--badge-bg);
		color: var(--badge-color);
	}

	.badge.type {
		background: var(--bg-elevated);
		color: var(--text-secondary);
	}

	.badge.deps {
		background: rgba(239, 68, 68, 0.12);
		color: #ef4444;
	}

	.badge.dependents {
		background: rgba(16, 185, 129, 0.12);
		color: #10b981;
	}

	.badge-icon {
		width: 0.625rem;
		height: 0.625rem;
	}

	.card-footer .type-icon {
		font-size: 0.5625rem;
		opacity: 0.7;
	}

	/* Card Meta (timestamps) */
	.card-meta {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		margin-top: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid var(--border-subtle);
		font-size: 0.625rem;
		color: var(--text-tertiary);
	}

	.meta-item {
		display: flex;
		align-items: center;
		gap: 0.1875rem;
	}

	.meta-item.closed {
		color: #10b981;
	}

	.meta-separator {
		opacity: 0.5;
	}

	/* Empty State */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
		color: var(--text-tertiary);
		text-align: center;
		border: 2px dashed var(--border-subtle);
		border-radius: var(--radius-md);
		transition: all var(--transition-smooth);
		flex: 1;
	}

	.empty-icon {
		font-size: 1.5rem;
		margin-bottom: 0.375rem;
		opacity: 0.3;
	}

	.empty-state p {
		font-size: 0.75rem;
	}

	/* Panel - Inline between columns */
	.panel {
		position: relative;
		flex: 0 0 460px;
		min-width: 460px;
		max-width: 460px;
		background: var(--bg-secondary);
		border: none;
		border-radius: var(--radius-xl);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		box-shadow: var(--shadow-lg);
		animation: panelSlideIn 350ms cubic-bezier(0.25, 0.1, 0.25, 1);
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

	.panel-drag-handle {
		display: none; /* Hidden on desktop, shown in mobile media query */
	}

	.panel.open {
		/* keep for compatibility */
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.125rem 1.5rem;
		border-bottom: 0.5px solid var(--border-subtle);
		background: transparent;
		flex-shrink: 0;
	}

	.panel-header h2 {
		font-size: 1.0625rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.panel-header-info {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.panel-id-wrap {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
	}

	.panel-id {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--text-secondary);
	}

	.btn-copy.panel-copy {
		opacity: 0.6;
		width: 1.125rem;
		height: 1.125rem;
	}

	.btn-copy.panel-copy svg {
		width: 0.75rem;
		height: 0.75rem;
	}

	.btn-copy.panel-copy:hover {
		opacity: 1;
	}

	.label-with-action {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.btn-copy-inline {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		background: transparent;
		border: none;
		color: var(--text-tertiary);
		font-size: 0.625rem;
		cursor: pointer;
		padding: 0.125rem 0.375rem;
		border-radius: var(--radius-sm);
		transition: all var(--transition-fast);
	}

	.btn-copy-inline svg {
		width: 0.625rem;
		height: 0.625rem;
	}

	.btn-copy-inline:hover {
		color: var(--text-secondary);
		background: var(--bg-tertiary);
	}

	.btn-copy-inline.copied {
		color: #10b981;
	}

	.panel-status-bar {
		width: 3px;
		height: 1.25rem;
		border-radius: 2px;
	}

	.panel-close {
		width: 1.75rem;
		height: 1.75rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		color: var(--text-tertiary);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.panel-close svg {
		width: 1rem;
		height: 1rem;
	}

	.panel-close:hover {
		background: var(--bg-elevated);
		color: var(--text-primary);
	}

	.panel-body {
		flex: 1;
		padding: 1.25rem;
		overflow-y: auto;
		overflow-x: hidden;
	}

	.panel-footer {
		display: flex;
		gap: 0.625rem;
		justify-content: space-between;
		padding: 1rem 1.25rem;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
		background: rgba(255, 255, 255, 0.02);
		flex-shrink: 0;
	}

	.app.light .panel-footer {
		border-top-color: rgba(0, 0, 0, 0.04);
		background: rgba(0, 0, 0, 0.02);
	}

	/* Form Groups */
	.form-group {
		margin-bottom: 1.25rem;
	}

	.form-group:last-child {
		margin-bottom: 0;
	}

	.form-group label {
		display: block;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-secondary);
		margin-bottom: 0.5rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.form-group input,
	.form-group textarea {
		width: 100%;
		padding: 0.625rem 0.875rem;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		font-family: inherit;
		font-size: 0.875rem;
		transition: all var(--transition-fast);
	}

	.app.light .form-group input,
	.app.light .form-group textarea {
		background: rgba(255, 255, 255, 0.8);
		border-color: rgba(0, 0, 0, 0.08);
	}

	.form-group input::placeholder,
	.form-group textarea::placeholder {
		color: var(--text-tertiary);
	}

	.form-group input:focus,
	.form-group textarea:focus {
		outline: none;
		background: rgba(255, 255, 255, 0.06);
		border-color: rgba(10, 132, 255, 0.5);
		box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.1);
	}

	.app.light .form-group input:focus,
	.app.light .form-group textarea:focus {
		background: rgba(255, 255, 255, 0.95);
		border-color: rgba(0, 122, 255, 0.5);
		box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
	}

	.form-group textarea {
		resize: vertical;
		min-height: 100px;
		line-height: 1.5;
	}

	/* Label Editor */
	.label-editor {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.label-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}

	.label-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.25rem 0.5rem;
		background: var(--bg-elevated);
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--text-secondary);
	}

	.label-remove {
		background: none;
		border: none;
		color: var(--text-tertiary);
		cursor: pointer;
		padding: 0;
		font-size: 0.875rem;
		line-height: 1;
		transition: color var(--transition-fast);
	}

	.label-remove:hover {
		color: #ef4444;
	}

	.label-input-wrap {
		display: flex;
		gap: 0.5rem;
	}

	.label-input {
		flex: 1;
		padding: 0.5rem;
		background: var(--bg-secondary);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-sm);
		color: var(--text-primary);
		font-size: 0.875rem;
	}

	.label-add-btn {
		padding: 0.5rem 0.75rem;
		background: var(--accent-primary);
		border: none;
		border-radius: var(--radius-sm);
		color: white;
		font-weight: 600;
		cursor: pointer;
		transition: opacity var(--transition-fast);
	}

	.label-add-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Dependency List */
	.dep-list {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.dep-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		font-size: 0.75rem;
	}

	.dep-item.blocked-by {
		border-left: 3px solid #ef4444;
	}

	.dep-item.blocking {
		border-left: 3px solid #10b981;
	}

	.dep-status {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--text-tertiary);
		flex-shrink: 0;
	}

	.dep-status.open {
		background: #6366f1;
	}

	.dep-status.in-progress {
		background: #f59e0b;
	}

	.dep-status.closed {
		background: #10b981;
	}

	.dep-id {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.625rem;
		color: var(--text-tertiary);
		flex-shrink: 0;
	}

	.dep-title {
		color: var(--text-secondary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: 1;
	}

	.dep-remove {
		background: none;
		border: none;
		color: var(--text-tertiary);
		cursor: pointer;
		padding: 0;
		font-size: 0.875rem;
		line-height: 1;
		opacity: 0;
		transition: opacity 0.15s;
	}

	.dep-item:hover .dep-remove {
		opacity: 1;
	}

	.dep-remove:hover {
		color: #ef4444;
	}

	.dep-type-indicator {
		font-size: 0.625rem;
		margin-right: 0.125rem;
	}

	.dep-type-badge {
		padding: 0.125rem 0.25rem;
		border-radius: var(--radius-sm);
		font-size: 0.625rem;
		font-weight: 600;
		flex-shrink: 0;
	}

	/* Dependency Type Modal */
	.dep-type-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.dep-type-modal {
		background: var(--bg-secondary);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-lg);
		padding: 1.5rem;
		max-width: 320px;
		width: 90%;
	}

	.dep-type-modal h3 {
		font-size: 1rem;
		margin-bottom: 0.5rem;
		color: var(--text-primary);
	}

	.dep-type-hint {
		font-size: 0.75rem;
		color: var(--text-secondary);
		margin-bottom: 1rem;
	}

	.dep-type-hint strong {
		color: var(--accent-primary);
		font-family: ui-monospace, 'SF Mono', monospace;
	}

	.dep-type-options {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.dep-type-btn {
		display: grid;
		grid-template-columns: 24px 1fr;
		grid-template-rows: auto auto;
		gap: 0 0.5rem;
		padding: 0.75rem;
		background: var(--bg-elevated);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		text-align: left;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.dep-type-btn:hover {
		border-color: var(--accent-primary);
		background: var(--accent-glow);
	}

	.dep-type-icon {
		grid-row: span 2;
		font-size: 1.25rem;
		align-self: center;
	}

	.dep-type-label {
		font-weight: 600;
		font-size: 0.875rem;
		color: var(--text-primary);
	}

	.dep-type-desc {
		font-size: 0.75rem;
		color: var(--text-tertiary);
	}

	.dep-type-cancel {
		width: 100%;
		margin-top: 1rem;
		padding: 0.5rem;
		background: none;
		border: 1px solid var(--border-default);
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.dep-type-cancel:hover {
		background: var(--bg-tertiary);
	}

	/* Comments */
	.comments-section {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.comments-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		max-height: 200px;
		overflow-y: auto;
	}

	.comment {
		padding: 0.625rem 0.75rem;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
	}

	.comment-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.25rem;
	}

	.comment-author {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--accent-primary);
	}

	.comment-date {
		font-size: 0.625rem;
		color: var(--text-tertiary);
	}

	.comment-text {
		font-size: 0.8125rem;
		color: var(--text-secondary);
		line-height: 1.45;
		white-space: pre-wrap;
	}

	.no-comments {
		font-size: 0.75rem;
		color: var(--text-tertiary);
		text-align: center;
		padding: 1rem;
	}

	.comment-input {
		display: flex;
		gap: 0.5rem;
		align-items: flex-end;
	}

	.comment-input textarea {
		flex: 1;
		min-height: 60px;
		resize: none;
	}

	.btn-comment {
		width: 2.5rem;
		height: 2.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--accent-primary);
		border: none;
		border-radius: var(--radius-md);
		color: white;
		cursor: pointer;
		transition: all var(--transition-fast);
		flex-shrink: 0;
	}

	.btn-comment:hover:not(:disabled) {
		background: #4f46e5;
		transform: translateY(-1px);
	}

	.btn-comment:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.btn-comment svg {
		width: 1rem;
		height: 1rem;
	}

	.loading-indicator {
		color: var(--text-tertiary);
		font-weight: normal;
	}

	/* Expandable sections */
	.form-group.expandable label {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.btn-collapse {
		width: 1.25rem;
		height: 1.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		color: var(--text-tertiary);
		font-size: 0.875rem;
		cursor: pointer;
		opacity: 0;
		transition: all var(--transition-fast);
	}

	.form-group.expandable:hover .btn-collapse {
		opacity: 1;
	}

	.btn-collapse:hover {
		background: rgba(239, 68, 68, 0.15);
		color: #ef4444;
	}

	.add-sections {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		padding: 0.5rem 0;
	}

	.btn-add-section {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.375rem 0.625rem;
		background: transparent;
		border: 1px dashed var(--border-default);
		border-radius: var(--radius-md);
		color: var(--text-tertiary);
		font-family: inherit;
		font-size: 0.6875rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.btn-add-section svg {
		width: 0.75rem;
		height: 0.75rem;
	}

	.btn-add-section:hover {
		border-color: var(--accent-primary);
		color: var(--accent-primary);
		background: var(--accent-glow);
	}

	/* Option Buttons */
	.status-options,
	.priority-options,
	.type-options {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}

	.status-option,
	.priority-option,
	.type-option {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.4375rem 0.75rem;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		color: var(--text-secondary);
		font-family: inherit;
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		transition: all var(--transition-fast);
		text-transform: capitalize;
	}

	.status-option:hover,
	.priority-option:hover,
	.type-option:hover {
		border-color: var(--border-default);
		background: var(--bg-elevated);
	}

	.status-option.selected {
		border-color: var(--status-color);
		background: var(--status-color);
		color: white;
	}

	.priority-option.selected {
		border-color: var(--priority-color);
		color: var(--priority-color);
		background: rgba(0, 0, 0, 0.2);
	}

	.app.light .priority-option.selected {
		background: rgba(255, 255, 255, 0.8);
	}

	.type-option.selected {
		border-color: var(--accent-primary);
		color: var(--accent-primary);
	}

	.status-icon {
		font-size: 0.6875rem;
	}

	.priority-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--priority-color);
	}

	.type-icon {
		font-size: 0.75rem;
		opacity: 0.8;
	}

	/* Buttons */
	.btn-secondary,
	.btn-primary,
	.btn-danger {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.625rem 1.25rem;
		border: none;
		border-radius: var(--radius-lg);
		font-family: inherit;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.btn-secondary {
		background: var(--bg-tertiary);
		color: var(--text-primary);
	}

	.btn-secondary:hover {
		background: var(--bg-elevated);
	}

	.btn-secondary:active {
		transform: scale(0.98);
	}

	.btn-primary {
		background: var(--accent-primary);
		color: white;
	}

	.btn-primary:hover {
		filter: brightness(1.1);
	}

	.btn-primary:active {
		filter: brightness(0.95);
		transform: scale(0.98);
	}

	.btn-danger {
		background: rgba(255, 59, 48, 0.12);
		color: #ff3b30;
	}

	.btn-danger:hover {
		background: rgba(255, 59, 48, 0.18);
	}

	.btn-danger:active {
		transform: scale(0.98);
	}

	.btn-danger svg {
		width: 0.875rem;
		height: 0.875rem;
	}

	/* ===== MOBILE DESIGN SYSTEM ===== */
	@media (max-width: 768px) {
		/* --- Variables for consistency --- */
		--mobile-control-height: 2.75rem;
		--mobile-radius: 0.75rem;
		--mobile-bg: rgba(255, 255, 255, 0.06);
		--mobile-border: inset 0 0 0 1px rgba(255, 255, 255, 0.1);
		--mobile-padding: 0.75rem;

		/* --- Header: Single row search, second row filters --- */
		.header {
			display: flex;
			flex-direction: column;
			padding: var(--mobile-padding);
			padding-top: max(var(--mobile-padding), env(safe-area-inset-top));
			padding-left: max(var(--mobile-padding), env(safe-area-inset-left));
			padding-right: max(var(--mobile-padding), env(safe-area-inset-right));
			gap: 0.5rem;
		}

		.header-left {
			display: none;
		}

		.header-center {
			display: flex;
			width: 100%;
			max-width: 100%;
			gap: 0.5rem;
		}

		.header-right {
			display: flex;
			width: 100%;
			gap: 0.5rem;
		}

		/* --- All controls: same height & radius --- */
		.search-input,
		.filter-select,
		.btn-create {
			height: var(--mobile-control-height);
			min-height: var(--mobile-control-height);
			border-radius: var(--mobile-radius);
		}

		/* --- Search --- */
		.search-container {
			flex: 1;
			min-width: 0;
		}

		.search-input {
			width: 100%;
			padding: 0 2.25rem 0 2.5rem;
			font-size: 1rem;
			background: var(--mobile-bg);
			border: none;
			box-shadow: var(--mobile-border);
		}

		.search-input:focus {
			background: rgba(255, 255, 255, 0.1);
			box-shadow: inset 0 0 0 2px var(--accent-primary);
		}

		.search-icon {
			left: 0.75rem;
			width: 1.125rem;
			height: 1.125rem;
		}

		.search-clear {
			right: 0.625rem;
		}

		.hotkey-hint {
			display: none;
		}

		/* --- Create Button (square) --- */
		.btn-create {
			flex: 0 0 var(--mobile-control-height);
			width: var(--mobile-control-height);
			padding: 0;
			justify-content: center;
			border: none;
		}

		.btn-create-text,
		.btn-create .btn-hotkey {
			display: none;
		}

		.btn-create-icon {
			font-size: 1.5rem;
			line-height: 1;
		}

		/* --- Filters --- */
		.filter-group {
			display: flex;
			flex: 1;
			gap: 0.5rem;
		}

		.filter-select {
			flex: 1;
			min-width: 0;
			padding: 0 1.75rem 0 0.75rem;
			font-size: 0.875rem;
			background: var(--mobile-bg);
			border: none;
			box-shadow: var(--mobile-border);
			color: var(--text-secondary);
			background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2398989d' stroke-width='3'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
			background-repeat: no-repeat;
			background-position: right 0.5rem center;
		}

		.filter-select:focus {
			background-color: rgba(255, 255, 255, 0.1);
			box-shadow: inset 0 0 0 2px var(--accent-primary);
			outline: none;
		}

		.pane-toggle,
		.theme-toggle {
			display: none;
		}

		/* --- Column Tabs --- */
		.column-nav {
			display: flex;
			padding: 0.375rem var(--mobile-padding);
			padding-left: max(var(--mobile-padding), env(safe-area-inset-left));
			padding-right: max(var(--mobile-padding), env(safe-area-inset-right));
			gap: 0.375rem;
			background: transparent;
			border: none;
			overflow-x: auto;
			scrollbar-width: none;
		}

		.column-nav::-webkit-scrollbar {
			display: none;
		}

		.column-tab {
			flex: 1;
			height: 2.5rem;
			min-height: 2.5rem;
			padding: 0 0.625rem;
			border-radius: var(--mobile-radius);
			font-size: 0.8125rem;
			background: var(--mobile-bg);
			border: none;
			box-shadow: none;
			justify-content: center;
		}

		.column-tab.active {
			background: var(--accent);
			box-shadow: none;
		}

		.column-tab-icon {
			font-size: 1rem;
		}

		.column-tab-label {
			display: none;
		}

		.column-tab-count {
			font-size: 0.75rem;
			padding: 0 0.25rem;
			background: rgba(255, 255, 255, 0.2);
			min-width: 1.25rem;
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

		.column {
			display: none;
			min-width: 100%;
		}

		.column.mobile-active {
			display: flex;
		}

		.column-header {
			display: none;
		}

		.card {
			margin: 0;
			border-radius: var(--mobile-radius);
		}

		.card-content {
			padding: 0.75rem;
		}

		.card-title {
			font-size: 0.9375rem;
		}

		.card-description {
			font-size: 0.8125rem;
			-webkit-line-clamp: 2;
		}

		.card-priority-bar {
			width: 4px;
			border-radius: var(--mobile-radius) 0 0 var(--mobile-radius);
		}

		.panel {
			position: fixed;
			bottom: 0;
			left: 0;
			right: 0;
			top: auto;
			width: 100% !important;
			min-width: 100% !important;
			max-width: 100% !important;
			flex: none !important;
			max-height: 85vh;
			border-radius: var(--radius-xl) var(--radius-xl) 0 0;
			z-index: 100;
			animation: panelSlideUp 350ms cubic-bezier(0.32, 0.72, 0, 1);
			overflow: hidden;
			touch-action: pan-y;
			backdrop-filter: saturate(180%) blur(20px);
			-webkit-backdrop-filter: saturate(180%) blur(20px);
			background: rgba(39, 39, 42, 0.92);
			box-shadow: 0 -4px 32px rgba(0, 0, 0, 0.4);
			padding-bottom: env(safe-area-inset-bottom);
		}

		.panel.dragging {
			animation: none;
			transition: none;
		}

		.panel-drag-handle {
			display: block;
			width: 2.25rem;
			height: 0.3125rem;
			background: rgba(255, 255, 255, 0.2);
			border-radius: 3px;
			margin: 0.625rem auto 0.25rem;
			transition: background 150ms ease;
		}

		.panel:active .panel-drag-handle,
		.panel.dragging .panel-drag-handle {
			background: rgba(255, 255, 255, 0.4);
		}

		.flow-connector {
			display: none;
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

		.panel-footer {
			flex-direction: column;
		}

		.btn-secondary,
		.btn-primary,
		.btn-danger {
			width: 100%;
			justify-content: center;
			padding: 0.75rem;
		}
	}

	/* Wide screens */
	@media (min-width: 1400px) {
		.card-description {
			-webkit-line-clamp: 3;
		}

		.column {
			min-width: 300px;
		}

		.panel {
			flex: 0 0 520px;
			min-width: 520px;
			max-width: 520px;
		}
	}

	@media (min-width: 1800px) {
		.card-description {
			-webkit-line-clamp: 4;
		}

		.column {
			min-width: 340px;
		}

		.panel {
			flex: 0 0 580px;
			min-width: 580px;
			max-width: 580px;
		}

		.card-content {
			padding: 1rem;
		}

		.card-title {
			font-size: 0.9375rem;
		}

		.card-description {
			font-size: 0.75rem;
		}
	}

	/* Pane Activity Sidebar */
	.pane-toggle {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.375rem 0.5rem;
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		color: var(--text-tertiary);
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.6875rem;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.pane-toggle:hover {
		background: rgba(255, 255, 255, 0.06);
		color: var(--text-secondary);
	}

	.pane-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #ef4444;
		transition: all var(--transition-fast);
	}

	.pane-toggle.connected .pane-dot {
		background: #22d3ee;
		box-shadow: 0 0 8px rgba(34, 211, 238, 0.6);
		animation: pulseDot 2s ease-in-out infinite;
	}

	@keyframes pulseDot {
		0%, 100% { opacity: 1; transform: scale(1); }
		50% { opacity: 0.7; transform: scale(1.2); }
	}

	.pane-count {
		font-weight: 500;
		letter-spacing: 0.05em;
	}

	.pane-activity {
		flex: 0 0 300px;
		min-width: 300px;
		background: linear-gradient(180deg, #0c0c0e 0%, #0a0a0b 100%);
		border: 1px solid rgba(34, 211, 238, 0.1);
		border-radius: var(--radius-lg);
		margin: 1rem;
		margin-left: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		position: relative;
	}

	.pane-activity::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 1px;
		background: linear-gradient(90deg, transparent, rgba(34, 211, 238, 0.3), transparent);
	}

	.app.light .pane-activity {
		background: linear-gradient(180deg, #f1f5f9 0%, #e2e8f0 100%);
		border-color: rgba(99, 102, 241, 0.15);
	}

	.app.light .pane-activity::before {
		background: linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.2), transparent);
	}

	.pane-activity-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.875rem 1rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.04);
		background: rgba(0, 0, 0, 0.3);
		border-radius: var(--radius-lg) var(--radius-lg) 0 0;
	}

	.app.light .pane-activity-header {
		background: rgba(255, 255, 255, 0.5);
		border-bottom-color: rgba(0, 0, 0, 0.06);
	}

	.pane-add-form {
		display: flex;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.04);
		background: rgba(0, 0, 0, 0.15);
	}

	.app.light .pane-add-form {
		background: rgba(0, 0, 0, 0.03);
		border-bottom-color: rgba(0, 0, 0, 0.06);
	}

	.pane-add-input {
		flex: 1;
		padding: 0.375rem 0.625rem;
		font-size: 0.75rem;
		font-family: 'JetBrains Mono', monospace;
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: var(--radius-sm);
		color: var(--text-primary);
	}

	.pane-add-input:focus {
		outline: none;
		border-color: rgba(99, 102, 241, 0.5);
	}

	.pane-add-input::placeholder {
		color: var(--text-tertiary);
	}

	.app.light .pane-add-input {
		background: rgba(255, 255, 255, 0.8);
		border-color: rgba(0, 0, 0, 0.1);
	}

	.pane-add-btn {
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

	.pane-add-btn:hover:not(:disabled) {
		background: rgba(99, 102, 241, 0.3);
	}

	.pane-add-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.pane-remove-btn {
		padding: 0.125rem 0.375rem;
		font-size: 0.875rem;
		line-height: 1;
		background: transparent;
		border: none;
		color: var(--text-tertiary);
		cursor: pointer;
		opacity: 0;
		transition: all 0.15s ease;
	}

	.pane-item:hover .pane-remove-btn {
		opacity: 1;
	}

	.pane-remove-btn:hover {
		color: #ef4444;
	}

	.pane-send-form {
		display: flex;
		gap: 0.375rem;
		margin-top: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid rgba(255, 255, 255, 0.04);
	}

	.app.light .pane-send-form {
		border-top-color: rgba(0, 0, 0, 0.06);
	}

	.pane-send-input {
		flex: 1;
		padding: 0.25rem 0.5rem;
		font-size: 0.6875rem;
		font-family: 'JetBrains Mono', monospace;
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: var(--radius-sm);
		color: var(--text-primary);
	}

	.pane-send-input:focus {
		outline: none;
		border-color: rgba(99, 102, 241, 0.4);
	}

	.pane-send-input::placeholder {
		color: var(--text-tertiary);
	}

	.app.light .pane-send-input {
		background: rgba(255, 255, 255, 0.6);
		border-color: rgba(0, 0, 0, 0.08);
	}

	.pane-send-btn {
		padding: 0.25rem 0.5rem;
		font-size: 0.6875rem;
		background: rgba(99, 102, 241, 0.15);
		border: 1px solid rgba(99, 102, 241, 0.25);
		border-radius: var(--radius-sm);
		color: #6366f1;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.pane-send-btn:hover:not(:disabled) {
		background: rgba(99, 102, 241, 0.25);
	}

	.pane-send-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.pane-activity-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.terminal-prompt {
		color: #22d3ee;
		font-size: 0.875rem;
		font-weight: 700;
	}

	.app.light .terminal-prompt {
		color: #6366f1;
	}

	.pane-activity-header h3 {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-primary);
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.ws-indicator {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.25rem 0.5rem;
		background: rgba(239, 68, 68, 0.1);
		border: 1px solid rgba(239, 68, 68, 0.2);
		border-radius: var(--radius-sm);
	}

	.ws-indicator.connected {
		background: rgba(34, 211, 238, 0.08);
		border-color: rgba(34, 211, 238, 0.2);
	}

	.app.light .ws-indicator.connected {
		background: rgba(16, 185, 129, 0.1);
		border-color: rgba(16, 185, 129, 0.2);
	}

	.ws-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #ef4444;
	}

	.ws-indicator.connected .ws-dot {
		background: #22d3ee;
		box-shadow: 0 0 6px rgba(34, 211, 238, 0.5);
		animation: pulseDot 2s ease-in-out infinite;
	}

	.app.light .ws-indicator.connected .ws-dot {
		background: #10b981;
		box-shadow: 0 0 6px rgba(16, 185, 129, 0.5);
	}

	.ws-label {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.5625rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		color: #ef4444;
	}

	.ws-indicator.connected .ws-label {
		color: #22d3ee;
	}

	.app.light .ws-indicator.connected .ws-label {
		color: #10b981;
	}

	.pane-list {
		flex: 1;
		overflow-y: auto;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}

	.pane-list::-webkit-scrollbar {
		width: 4px;
	}

	.pane-list::-webkit-scrollbar-track {
		background: transparent;
	}

	.pane-list::-webkit-scrollbar-thumb {
		background: rgba(34, 211, 238, 0.2);
		border-radius: 2px;
	}

	.pane-item {
		padding: 0.75rem;
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid rgba(255, 255, 255, 0.04);
		border-radius: var(--radius-md);
		transition: all var(--transition-smooth);
		position: relative;
		overflow: hidden;
	}

	.pane-item::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		width: 2px;
		height: 100%;
		background: var(--text-tertiary);
		transition: all var(--transition-fast);
	}

	.pane-item.idle::before {
		background: var(--text-tertiary);
	}

	.pane-item.active {
		background: rgba(245, 158, 11, 0.04);
		border-color: rgba(245, 158, 11, 0.15);
	}

	.pane-item.active::before {
		background: #f59e0b;
		box-shadow: 0 0 8px rgba(245, 158, 11, 0.4);
	}

	.pane-item.busy {
		background: rgba(34, 211, 238, 0.04);
		border-color: rgba(34, 211, 238, 0.15);
	}

	.pane-item.busy::before {
		background: #22d3ee;
		box-shadow: 0 0 8px rgba(34, 211, 238, 0.4);
		animation: busyPulse 1.5s ease-in-out infinite;
	}

	@keyframes busyPulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}

	.app.light .pane-item {
		background: rgba(0, 0, 0, 0.02);
		border-color: rgba(0, 0, 0, 0.06);
	}

	.app.light .pane-item.active {
		background: rgba(245, 158, 11, 0.06);
		border-color: rgba(245, 158, 11, 0.2);
	}

	.app.light .pane-item.busy {
		background: rgba(99, 102, 241, 0.06);
		border-color: rgba(99, 102, 241, 0.2);
	}

	.app.light .pane-item.busy::before {
		background: #6366f1;
		box-shadow: 0 0 8px rgba(99, 102, 241, 0.4);
	}

	.pane-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.5rem;
	}

	.pane-identity {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.pane-status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--text-tertiary);
		transition: all var(--transition-fast);
	}

	.pane-item.active .pane-status-dot {
		background: #f59e0b;
		box-shadow: 0 0 6px rgba(245, 158, 11, 0.5);
	}

	.pane-item.busy .pane-status-dot {
		background: #22d3ee;
		box-shadow: 0 0 6px rgba(34, 211, 238, 0.5);
		animation: pulseDot 1s ease-in-out infinite;
	}

	.app.light .pane-item.busy .pane-status-dot {
		background: #6366f1;
		box-shadow: 0 0 6px rgba(99, 102, 241, 0.5);
	}

	.pane-name {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-primary);
		letter-spacing: 0.02em;
	}

	.pane-status-badge {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.5rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		padding: 0.125rem 0.375rem;
		border-radius: 3px;
		background: rgba(255, 255, 255, 0.05);
		color: var(--text-tertiary);
		border: 1px solid rgba(255, 255, 255, 0.05);
	}

	.pane-item.active .pane-status-badge {
		background: rgba(245, 158, 11, 0.1);
		border-color: rgba(245, 158, 11, 0.2);
		color: #f59e0b;
	}

	.pane-item.busy .pane-status-badge {
		background: rgba(34, 211, 238, 0.1);
		border-color: rgba(34, 211, 238, 0.2);
		color: #22d3ee;
	}

	.app.light .pane-status-badge {
		background: rgba(0, 0, 0, 0.04);
		border-color: rgba(0, 0, 0, 0.06);
	}

	.app.light .pane-item.busy .pane-status-badge {
		background: rgba(99, 102, 241, 0.1);
		border-color: rgba(99, 102, 241, 0.2);
		color: #6366f1;
	}

	.pane-message-container {
		display: flex;
		gap: 0.375rem;
		margin-bottom: 0.5rem;
		padding: 0.375rem 0.5rem;
		background: rgba(255, 255, 255, 0.02);
		border-radius: var(--radius-sm);
	}

	.message-prefix {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.5625rem;
		font-weight: 500;
		color: var(--text-tertiary);
		flex-shrink: 0;
	}

	.pane-message {
		font-size: 0.6875rem;
		color: var(--text-secondary);
		line-height: 1.4;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pane-delta-container {
		background: rgba(0, 0, 0, 0.3);
		border-radius: var(--radius-sm);
		overflow: hidden;
	}

	.app.light .pane-delta-container {
		background: rgba(0, 0, 0, 0.04);
	}

	.delta-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.25rem 0.5rem;
		background: rgba(34, 211, 238, 0.05);
		border-bottom: 1px solid rgba(34, 211, 238, 0.1);
	}

	.app.light .delta-header {
		background: rgba(99, 102, 241, 0.05);
		border-bottom-color: rgba(99, 102, 241, 0.1);
	}

	.delta-prefix {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.5rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: #22d3ee;
	}

	.app.light .delta-prefix {
		color: #6366f1;
	}

	.delta-cursor {
		width: 6px;
		height: 10px;
		background: #22d3ee;
		animation: cursorBlink 1s step-end infinite;
	}

	.app.light .delta-cursor {
		background: #6366f1;
	}

	@keyframes cursorBlink {
		0%, 50% { opacity: 1; }
		51%, 100% { opacity: 0; }
	}

	.pane-delta {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.625rem;
		color: rgba(34, 211, 238, 0.8);
		line-height: 1.5;
		padding: 0.5rem;
		margin: 0;
		white-space: pre-wrap;
		word-break: break-word;
		max-height: 120px;
		overflow-y: auto;
	}

	.app.light .pane-delta {
		color: rgba(99, 102, 241, 0.9);
	}

	.pane-delta::-webkit-scrollbar {
		width: 3px;
	}

	.pane-delta::-webkit-scrollbar-thumb {
		background: rgba(34, 211, 238, 0.3);
		border-radius: 1.5px;
	}

	.pane-idle-state {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.375rem 0;
	}

	.idle-dots {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.75rem;
		color: var(--text-tertiary);
		letter-spacing: 0.2em;
		animation: idlePulse 2s ease-in-out infinite;
	}

	@keyframes idlePulse {
		0%, 100% { opacity: 0.3; }
		50% { opacity: 0.6; }
	}

	.idle-text {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.5625rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--text-tertiary);
	}

	.pane-empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2rem 1rem;
		text-align: center;
	}

	.empty-terminal {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		margin-bottom: 1rem;
		padding: 0.5rem 0.75rem;
		background: rgba(0, 0, 0, 0.3);
		border-radius: var(--radius-sm);
		border: 1px solid rgba(255, 255, 255, 0.04);
	}

	.app.light .empty-terminal {
		background: rgba(0, 0, 0, 0.04);
		border-color: rgba(0, 0, 0, 0.06);
	}

	.empty-prompt {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.875rem;
		font-weight: 600;
		color: #22d3ee;
	}

	.app.light .empty-prompt {
		color: #6366f1;
	}

	.empty-cursor {
		width: 8px;
		height: 14px;
		background: #22d3ee;
		animation: cursorBlink 1s step-end infinite;
	}

	.app.light .empty-cursor {
		background: #6366f1;
	}

	.empty-text {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--text-secondary);
		margin-bottom: 0.25rem;
	}

	.empty-hint {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.625rem;
		color: var(--text-tertiary);
	}

	@media (max-width: 768px) {
		.pane-toggle {
			display: none;
		}
		.pane-activity {
			display: none;
		}
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

	/* Chat Windows */
	.chat-windows {
		display: flex;
		gap: 0.75rem;
		padding: 0 1rem 0.5rem;
		pointer-events: auto;
		flex-wrap: wrap;
		justify-content: flex-end;
		align-items: flex-end;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.chat-windows.has-large {
		position: fixed;
		inset: 0;
		bottom: auto;
		padding: 1rem;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(4px);
		z-index: 999;
		justify-content: center;
		align-items: center;
	}

	.chat-window {
		position: relative;
		width: 320px;
		max-height: 400px;
		display: flex;
		flex-direction: column;
		background: linear-gradient(
			145deg,
			rgba(38, 38, 42, 0.92) 0%,
			rgba(28, 28, 32, 0.95) 100%
		);
		border: none;
		border-radius: 1rem;
		box-shadow:
			0 0 0 0.5px rgba(255, 255, 255, 0.08),
			0 2px 8px rgba(0, 0, 0, 0.12),
			0 8px 32px rgba(0, 0, 0, 0.24),
			inset 0 1px 0 rgba(255, 255, 255, 0.04);
		backdrop-filter: saturate(180%) blur(24px);
		-webkit-backdrop-filter: saturate(180%) blur(24px);
		overflow: hidden;
		transition: transform 200ms ease, box-shadow 200ms ease;
	}

	/* Compact size (default) */
	.chat-window.compact {
		width: 320px;
		max-height: 400px;
	}

	/* Medium size */
	.chat-window.medium {
		width: 480px;
		max-height: 560px;
	}

	.chat-window.medium .chat-messages {
		min-height: 280px;
		max-height: 400px;
	}

	/* Large/maximized size */
	.chat-window.large {
		width: min(90vw, 900px);
		max-height: 85vh;
		border-radius: 1.25rem;
		box-shadow:
			0 0 0 0.5px rgba(255, 255, 255, 0.1),
			0 4px 16px rgba(0, 0, 0, 0.15),
			0 24px 64px rgba(0, 0, 0, 0.35),
			inset 0 1px 0 rgba(255, 255, 255, 0.06);
	}

	.chat-window.large .chat-messages {
		min-height: 400px;
		max-height: calc(85vh - 120px);
	}

	.chat-window.large .chat-window-header {
		padding: 0.875rem 1rem;
	}

	.chat-window.large .window-name {
		font-size: 1rem;
	}

	.chat-window.large .chat-msg {
		padding: 0.75rem 1rem;
		max-width: 85%;
	}

	.chat-window.large .msg-content {
		font-size: 0.875rem;
		line-height: 1.6;
	}

	.chat-window.large .chat-input-form {
		padding: 0.875rem 1rem;
	}

	.chat-window.large .chat-input {
		padding: 0.75rem 1rem;
		font-size: 0.875rem;
	}

	.chat-window.streaming {
		box-shadow:
			0 0 0 1px rgba(245, 158, 11, 0.2),
			0 2px 8px rgba(0, 0, 0, 0.12),
			0 8px 32px rgba(0, 0, 0, 0.24),
			0 0 24px rgba(245, 158, 11, 0.08),
			inset 0 1px 0 rgba(255, 255, 255, 0.04);
	}

	.chat-window.large.streaming {
		box-shadow:
			0 0 0 1px rgba(245, 158, 11, 0.25),
			0 4px 16px rgba(0, 0, 0, 0.15),
			0 24px 64px rgba(0, 0, 0, 0.35),
			0 0 40px rgba(245, 158, 11, 0.1),
			inset 0 1px 0 rgba(255, 255, 255, 0.06);
	}

	.app.light .chat-window {
		background: linear-gradient(
			145deg,
			rgba(255, 255, 255, 0.95) 0%,
			rgba(248, 248, 250, 0.98) 100%
		);
		box-shadow:
			0 0 0 0.5px rgba(0, 0, 0, 0.06),
			0 2px 8px rgba(0, 0, 0, 0.06),
			0 8px 32px rgba(0, 0, 0, 0.1),
			inset 0 1px 0 rgba(255, 255, 255, 0.8);
	}

	.app.light .chat-windows.has-large {
		background: rgba(0, 0, 0, 0.3);
		backdrop-filter: blur(8px);
	}

	.app.light .chat-window.large {
		box-shadow:
			0 0 0 0.5px rgba(0, 0, 0, 0.08),
			0 4px 16px rgba(0, 0, 0, 0.08),
			0 24px 64px rgba(0, 0, 0, 0.15),
			inset 0 1px 0 rgba(255, 255, 255, 0.9);
	}

	/* Customized (dragged/resized) windows */
	.chat-window.customized {
		z-index: 1001;
	}

	.chat-window.dragging,
	.chat-window.resizing {
		transition: none;
	}

	.chat-window.dragging {
		cursor: grabbing;
		transform: scale(1.02);
		box-shadow:
			0 0 0 0.5px rgba(255, 255, 255, 0.1),
			0 8px 24px rgba(0, 0, 0, 0.2),
			0 32px 80px rgba(0, 0, 0, 0.4),
			inset 0 1px 0 rgba(255, 255, 255, 0.06);
		z-index: 1002;
	}

	.chat-window.resizing {
		z-index: 1002;
	}

	.app.light .chat-window.dragging {
		box-shadow:
			0 0 0 0.5px rgba(0, 0, 0, 0.08),
			0 8px 24px rgba(0, 0, 0, 0.1),
			0 32px 80px rgba(0, 0, 0, 0.2),
			inset 0 1px 0 rgba(255, 255, 255, 0.9);
	}

	/* Size button styling */
	.window-btn.size-btn {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.window-btn.size-btn svg {
		opacity: 0.7;
		transition: opacity 0.15s ease;
	}

	.window-btn.size-btn:hover svg {
		opacity: 1;
	}

	/* Resize handle - invisible but functional */
	.resize-handle {
		position: absolute;
		bottom: 0;
		right: 0;
		width: 16px;
		height: 16px;
		cursor: nwse-resize;
		z-index: 10;
		opacity: 0;
	}

	.resize-handle svg {
		display: none;
	}

	.chat-window-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.625rem 0.625rem 0.5rem 0.875rem;
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, transparent 100%);
		border: none;
		cursor: grab;
		-webkit-user-select: none;
		user-select: none;
	}

	.chat-window.dragging .chat-window-header {
		cursor: grabbing;
	}

	.app.light .chat-window-header {
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.5) 0%, transparent 100%);
	}

	.chat-window-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.window-indicator {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--text-tertiary);
	}

	.window-indicator.active {
		background: #f59e0b;
		box-shadow: 0 0 8px rgba(245, 158, 11, 0.5);
		animation: pulse 1.5s ease-in-out infinite;
	}

	.window-name {
		font-size: 0.8125rem;
		font-weight: 600;
		font-family: 'JetBrains Mono', monospace;
		color: var(--text-primary);
	}

	.window-type {
		font-size: 0.625rem;
		padding: 0.125rem 0.375rem;
		background: rgba(99, 102, 241, 0.15);
		border-radius: var(--radius-sm);
		color: #6366f1;
		text-transform: uppercase;
	}

	.chat-window-actions {
		display: flex;
		gap: 0.125rem;
	}

	.window-btn {
		width: 1.75rem;
		height: 1.75rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(255, 255, 255, 0.08);
		border: none;
		border-radius: 50%;
		color: var(--text-tertiary);
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 120ms ease;
	}

	.window-btn:hover {
		background: rgba(255, 255, 255, 0.15);
		color: var(--text-primary);
	}

	.window-btn:active {
		transform: scale(0.92);
	}

	.app.light .window-btn {
		background: rgba(0, 0, 0, 0.06);
	}

	.app.light .window-btn:hover {
		background: rgba(0, 0, 0, 0.1);
	}

	.chat-messages {
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-height: 150px;
		max-height: 250px;
		overscroll-behavior: contain;
		-webkit-overflow-scrolling: touch;
		scroll-behavior: smooth;
	}

	.chat-msg {
		padding: 0.5rem 0.875rem;
		max-width: 85%;
		border: none;
		animation: msgIn 250ms cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
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

	.chat-msg.user {
		align-self: flex-end;
		background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
		color: white;
		border-radius: 1.125rem 1.125rem 0.25rem 1.125rem;
		box-shadow: 0 1px 2px rgba(99, 102, 241, 0.3);
	}

	.chat-msg.user .msg-content {
		color: white;
	}

	.chat-msg.assistant {
		align-self: flex-start;
		background: rgba(255, 255, 255, 0.08);
		border-radius: 1.125rem 1.125rem 1.125rem 0.25rem;
	}

	.chat-msg.tool {
		align-self: flex-start;
		background: rgba(245, 158, 11, 0.12);
		border-radius: 0.75rem;
		font-size: 0.6875rem;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		padding: 0.375rem 0.625rem;
		max-width: 95%;
	}

	.chat-msg.tool .msg-content {
		font-size: inherit;
		font-family: inherit;
		opacity: 0.9;
	}

	.chat-msg.streaming {
		background: rgba(245, 158, 11, 0.15);
	}

	.app.light .chat-msg.user {
		background: linear-gradient(135deg, #007aff 0%, #0056b3 100%);
	}

	.app.light .chat-msg.assistant {
		background: rgba(0, 0, 0, 0.05);
	}

	.msg-role {
		display: none;
	}

	.msg-content {
		font-size: 0.8125rem;
		line-height: 1.45;
		color: var(--text-primary);
		word-break: break-word;
		white-space: pre-wrap;
	}

	.cursor {
		display: inline-block;
		width: 2px;
		height: 1em;
		background: #f59e0b;
		animation: blink 0.8s step-end infinite;
		vertical-align: text-bottom;
		margin-left: 2px;
	}

	@keyframes blink {
		50% { opacity: 0; }
	}

	.chat-empty {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		color: var(--text-tertiary);
		font-size: 0.8125rem;
		padding: 2rem;
	}

	.chat-empty::before {
		content: '💬';
		font-size: 2rem;
		opacity: 0.4;
	}

	.chat-input-form {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.625rem;
		background: linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.05) 100%);
		border: none;
	}

	.app.light .chat-input-form {
		background: linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.02) 100%);
	}

	.chat-input {
		flex: 1;
		padding: 0.625rem 1rem;
		font-size: 0.875rem;
		font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif;
		background: rgba(255, 255, 255, 0.08);
		border: none;
		border-radius: 1.25rem;
		color: var(--text-primary);
		transition: background 150ms ease;
	}

	.chat-input:focus {
		outline: none;
		background: rgba(255, 255, 255, 0.12);
	}

	.chat-input::placeholder {
		color: var(--text-tertiary);
	}

	.app.light .chat-input {
		background: rgba(0, 0, 0, 0.05);
	}

	.app.light .chat-input:focus {
		background: rgba(0, 0, 0, 0.08);
	}

	.chat-send-btn {
		width: 2rem;
		height: 2rem;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1rem;
		background: #6366f1;
		border: none;
		border-radius: 50%;
		color: white;
		cursor: pointer;
		transition: all 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
		flex-shrink: 0;
	}

	.chat-send-btn::after {
		content: '↑';
		font-weight: 700;
		font-size: 0.875rem;
	}

	.chat-send-btn:hover:not(:disabled) {
		background: #4f46e5;
		transform: scale(1.05);
	}

	.chat-send-btn:active:not(:disabled) {
		transform: scale(0.95);
	}

	.chat-send-btn:disabled {
		background: rgba(255, 255, 255, 0.1);
		color: var(--text-tertiary);
		cursor: default;
	}

	.app.light .chat-send-btn {
		background: #007aff;
	}

	.app.light .chat-send-btn:hover:not(:disabled) {
		background: #0056b3;
	}

	.app.light .chat-send-btn:disabled {
		background: rgba(0, 0, 0, 0.08);
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}

	@media (max-width: 768px) {
		.chat-windows {
			flex-direction: column;
			align-items: stretch;
			padding: 0.5rem;
			gap: 0.5rem;
		}

		.chat-windows.has-large {
			padding: 0;
			background: rgba(0, 0, 0, 0.85);
		}

		.chat-window {
			width: 100%;
			max-width: none;
			border-radius: var(--radius-xl);
		}

		.chat-window.large {
			width: 100%;
			max-height: 100vh;
			border-radius: 0;
		}

		.chat-window.large .chat-messages {
			max-height: calc(100vh - 140px);
			min-height: 60vh;
		}

		.chat-window-header {
			padding: 0.75rem 1rem;
			padding-top: max(0.75rem, env(safe-area-inset-top));
		}

		.chat-messages {
			padding: 0.875rem;
		}

		.chat-msg {
			max-width: 80%;
		}

		.chat-input-form {
			padding: 0.625rem 0.75rem;
			padding-bottom: max(0.625rem, env(safe-area-inset-bottom));
		}

		.chat-input {
			padding: 0.75rem 1rem;
			font-size: 1rem;
			min-height: 2.75rem;
		}

		.chat-send-btn {
			width: 2.5rem;
			height: 2.5rem;
		}

		.chat-send-btn::after {
			font-size: 1rem;
		}
	}

	/* Context Menu */
	.context-menu {
		position: fixed;
		z-index: 1000;
		background: var(--bg-secondary);
		border: none;
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
		padding: 0.5rem;
		min-width: 180px;
		backdrop-filter: saturate(180%) blur(20px);
		-webkit-backdrop-filter: saturate(180%) blur(20px);
		animation: contextMenuIn 200ms cubic-bezier(0.25, 0.1, 0.25, 1);
		transform-origin: top left;
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

	.context-menu-section {
		padding: 0.25rem 0;
	}

	.context-menu-label {
		display: block;
		font-size: 0.625rem;
		font-weight: 600;
		color: var(--text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 0.25rem 0.5rem;
	}

	.context-menu-options {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.context-option {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.375rem 0.5rem;
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		font-size: 0.75rem;
		cursor: pointer;
		transition: all var(--transition-fast);
		text-align: left;
	}

	.context-option:hover {
		background: var(--bg-elevated);
		color: var(--text-primary);
	}

	.context-option.active {
		background: var(--accent-glow);
		color: var(--accent-primary);
	}

	.context-menu-divider {
		height: 1px;
		background: var(--border-subtle);
		margin: 0.375rem 0;
	}

	.app.light .context-menu {
		background: rgba(255, 255, 255, 0.92);
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15), 0 0 0 0.5px rgba(0, 0, 0, 0.08);
	}

	.app.light .context-option:hover {
		background: rgba(0, 0, 0, 0.04);
	}

	.app.light .context-option.active {
		background: rgba(0, 122, 255, 0.12);
	}

	.rope-handle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.625rem;
		background: linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(16, 185, 129, 0.15) 100%);
		border: 1px dashed rgba(99, 102, 241, 0.3);
		border-radius: var(--radius-md);
		cursor: grab;
		transition: all 0.2s ease;
		color: var(--text-secondary);
		font-size: 0.75rem;
	}

	.rope-handle:hover {
		background: linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(16, 185, 129, 0.25) 100%);
		border-color: rgba(99, 102, 241, 0.5);
		color: var(--text-primary);
	}

	.rope-handle:active {
		cursor: grabbing;
		transform: scale(0.98);
	}

	.rope-icon {
		width: 16px;
		height: 16px;
		color: #6366f1;
	}

	.rope-tip {
		margin-left: auto;
		font-size: 0.875rem;
		color: #10b981;
		animation: ropeTipPulse 1.5s ease-in-out infinite;
	}

	@keyframes ropeTipPulse {
		0%, 100% { opacity: 0.6; transform: scale(1); }
		50% { opacity: 1; transform: scale(1.2); }
	}

	/* Energy beam link animation */
	.energy-flow {
		animation: energyFlow 0.8s linear infinite;
	}

	@keyframes energyFlow {
		from { stroke-dashoffset: 0; }
		to { stroke-dashoffset: -16; }
	}

	.target-ring {
		transition: r 0.2s ease-out, stroke 0.2s ease-out;
	}

	.target-ring.locked {
		animation: ringPulse 1.2s ease-in-out infinite;
	}

	.target-core.locked {
		animation: corePulse 1.2s ease-in-out infinite;
	}

	@keyframes ringPulse {
		0%, 100% { stroke-opacity: 0.8; }
		50% { stroke-opacity: 1; }
	}

	@keyframes corePulse {
		0%, 100% { transform: scale(1); }
		50% { transform: scale(1.1); }
	}

	.target-label-energy {
		animation: labelGlow 0.2s ease-out;
	}

	@keyframes labelGlow {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.app.light .rope-handle {
		background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%);
		border-color: rgba(99, 102, 241, 0.2);
	}

	.priority-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.context-option .type-icon {
		font-size: 0.625rem;
		width: 14px;
		text-align: center;
	}

	/* Keyboard Help Overlay */
	.keyboard-help-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(8px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		animation: fadeIn 200ms ease-out;
	}

	.keyboard-help {
		background: var(--bg-secondary);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-xl);
		padding: 1.5rem;
		max-width: 480px;
		width: 90%;
		box-shadow: var(--shadow-lg);
		animation: slideUp 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	@keyframes slideUp {
		from { opacity: 0; transform: translateY(20px) scale(0.95); }
		to { opacity: 1; transform: translateY(0) scale(1); }
	}

	.keyboard-help-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1.25rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid var(--border-subtle);
	}

	.keyboard-help-header h2 {
		font-size: 1rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.keyboard-help-close {
		background: transparent;
		border: none;
		cursor: pointer;
		padding: 0.25rem;
	}

	.keyboard-help-close kbd {
		font-size: 0.625rem;
	}

	.keyboard-help-content {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: 1.25rem;
	}

	.shortcut-group h3 {
		font-size: 0.625rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-tertiary);
		margin-bottom: 0.625rem;
	}

	.shortcut {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		margin-bottom: 0.5rem;
		font-size: 0.75rem;
	}

	.shortcut span {
		color: var(--text-secondary);
		margin-left: auto;
	}

	.shortcut kbd, .keyboard-help kbd {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.25rem;
		height: 1.25rem;
		padding: 0 0.375rem;
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 0.625rem;
		font-weight: 500;
		color: var(--text-primary);
		background: var(--bg-tertiary);
		border: 1px solid var(--border-default);
		border-radius: 4px;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
	}

	/* Hotkey Hints */
	.hotkey-hint {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1rem;
		height: 1rem;
		padding: 0 0.25rem;
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 0.5rem;
		font-weight: 600;
		color: var(--text-tertiary);
		background: var(--bg-tertiary);
		border: 1px solid var(--border-subtle);
		border-radius: 3px;
		opacity: 0.5;
		transition: opacity 200ms ease;
	}

	.show-hotkeys .hotkey-hint,
	.hotkey-hint:hover {
		opacity: 1;
	}

	.hotkey-hint-inline {
		position: absolute;
		right: 0.5rem;
		top: 50%;
		transform: translateY(-50%);
		opacity: 0;
	}

	.show-hotkeys .hotkey-hint-inline {
		opacity: 0.8;
	}

	.hotkey-hint-column {
		margin-right: 0.25rem;
		opacity: 0;
	}

	.show-hotkeys .hotkey-hint-column {
		opacity: 0.7;
	}

	.hotkey-hint-close {
		position: absolute;
		bottom: -0.375rem;
		right: -0.375rem;
		font-size: 0.4375rem;
		opacity: 0;
	}

	.show-hotkeys .hotkey-hint-close,
	.panel-close:hover .hotkey-hint-close {
		opacity: 0.8;
	}

	/* Card contextual hotkeys */
	.card-hotkeys {
		position: absolute;
		bottom: 0.375rem;
		left: 1rem;
		display: flex;
		align-items: center;
		gap: 0.25rem;
		opacity: 0;
		transition: opacity 200ms ease;
		pointer-events: none;
	}

	.card.selected .card-hotkeys,
	.show-hotkeys .card.selected .card-hotkeys {
		opacity: 0.7;
	}

	.hotkey-nav {
		display: flex;
		gap: 2px;
		margin-left: 0.375rem;
		padding-left: 0.375rem;
		border-left: 1px solid var(--border-subtle);
	}

	.hotkey-nav .hotkey-hint {
		min-width: 0.875rem;
		height: 0.875rem;
		font-size: 0.4375rem;
	}

	/* Search hint */
	.search-container .hotkey-hint {
		position: absolute;
		right: 0.75rem;
		top: 50%;
		transform: translateY(-50%);
	}

	/* Keyboard Help Button */
	.keyboard-help-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.keyboard-help-btn:hover {
		background: rgba(255, 255, 255, 0.06);
	}

	.keyboard-help-btn kbd {
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 0.6875rem;
		font-weight: 500;
		color: var(--text-tertiary);
		background: none;
		border: none;
		box-shadow: none;
	}

	.keyboard-help-btn:hover kbd {
		color: var(--text-secondary);
	}

	/* Position relative for buttons with inline hints */
	.theme-toggle, .btn-create {
		position: relative;
	}
</style>
