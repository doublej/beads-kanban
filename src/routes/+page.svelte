<script lang="ts">
	import { browser } from '$app/environment';
	import { connect, disconnect, getPanes, isConnected, addPane, removePane, sendToPane, type Pane } from '$lib/wsStore.svelte';

	interface Dependency {
		id: string;
		title: string;
		status: string;
		dependency_type: string;
	}

	interface Issue {
		id: string;
		title: string;
		description: string;
		design?: string;
		acceptance_criteria?: string;
		notes?: string;
		status: 'open' | 'in_progress' | 'blocked' | 'closed';
		priority: 1 | 2 | 3 | 4;
		issue_type: string;
		created_at?: string;
		updated_at?: string;
		closed_at?: string;
		assignee?: string;
		labels?: string[];
		dependencies?: Dependency[];
		dependents?: Dependency[];
		dependency_count?: number;
		dependent_count?: number;
		// UI state
		_showDesign?: boolean;
		_showAcceptance?: boolean;
		_showNotes?: boolean;
	}

	let issues = $state<Issue[]>([]);
	let draggedId = $state<string | null>(null);
	let draggedOverColumn = $state<string | null>(null);
	let editingIssue = $state<Issue | null>(null);
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
	}

	function handleMouseUp() {
		draggingPane = null;
		resizingPane = null;
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
		const idx = columns.findIndex(c => c.key === editingIssue.status);
		return idx >= 0 ? idx : 0;
	});

	const columns = [
		{ key: 'open', label: 'Backlog', icon: '○', accent: '#6366f1' },
		{ key: 'in_progress', label: 'In Progress', icon: '◐', accent: '#f59e0b' },
		{ key: 'blocked', label: 'Blocked', icon: '◉', accent: '#ef4444' },
		{ key: 'closed', label: 'Complete', icon: '●', accent: '#10b981' }
	] as const;

	const filteredIssues = $derived(
		issues.filter((issue) => {
			const query = searchQuery.toLowerCase();
			const matchesSearch = !query ||
				issue.id.toLowerCase().includes(query) ||
				issue.title.toLowerCase().includes(query) ||
				issue.description.toLowerCase().includes(query);
			const matchesPriority = filterPriority === 'all' || issue.priority === filterPriority;
			const matchesType = filterType === 'all' || issue.issue_type === filterType;
			return matchesSearch && matchesPriority && matchesType;
		})
	);

	function connectSSE() {
		const eventSource = new EventSource('/api/issues/stream');

		eventSource.onmessage = (event) => {
			const data = JSON.parse(event.data);
			const oldIssuesMap = new Map(issues.map(i => [i.id, i]));
			issues = data.issues;
			data.issues.forEach((issue: Issue) => {
				const oldIssue = oldIssuesMap.get(issue.id);
				if (oldIssue && oldIssue.status !== issue.status) {
					animatingIds.add(issue.id);
					setTimeout(() => animatingIds.delete(issue.id), 1000);
				}
			});
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
	}

	async function setIssuePriority(id: string, priority: number) {
		await updateIssue(id, { priority });
		closeContextMenu();
	}

	async function setIssueType(id: string, issue_type: string) {
		await updateIssue(id, { issue_type });
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
		isCreating = false;
		editingIssue = { ...issue };
		selectedId = issue.id;
		comments = [];
		loadComments(issue.id);
		if (browser && pushState) {
			const url = new URL(window.location.href);
			url.searchParams.set('issue', issue.id);
			history.pushState({ issue: issue.id }, '', url);
		}
	}

	function closePanel(pushState = true) {
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

	function handleDrop(e: DragEvent, status: string) {
		e.preventDefault();
		if (draggedId) {
			const issue = issues.find(i => i.id === draggedId);
			if (issue && status === 'closed' && hasOpenBlockers(issue)) {
				// Prevent moving blocked issues to closed
				draggedId = null;
				draggedOverColumn = null;
				dropIndicatorIndex = null;
				dropTargetColumn = null;
				return;
			}
			updateIssue(draggedId, { status });
			draggedId = null;
			draggedOverColumn = null;
			dropIndicatorIndex = null;
			dropTargetColumn = null;
		}
	}

	function getPriorityConfig(priority: number) {
		const configs = {
			1: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', label: 'Critical', lightBg: 'rgba(239, 68, 68, 0.08)' },
			2: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', label: 'High', lightBg: 'rgba(245, 158, 11, 0.08)' },
			3: { color: '#6366f1', bg: 'rgba(99, 102, 241, 0.12)', label: 'Medium', lightBg: 'rgba(99, 102, 241, 0.08)' },
			4: { color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', label: 'Low', lightBg: 'rgba(16, 185, 129, 0.08)' }
		};
		return configs[priority as keyof typeof configs];
	}

	function getTypeIcon(type: string) {
		const icons: Record<string, string> = {
			task: '◇',
			bug: '⬡',
			feature: '★',
			epic: '◈',
			chore: '○'
		};
		return icons[type] || '◇';
	}

	function hasOpenBlockers(issue: Issue): boolean {
		if (!issue.dependencies || issue.dependencies.length === 0) return false;
		return issue.dependencies.some(dep => dep.status !== 'closed');
	}

	function handleTouchStart(e: TouchEvent) {
		touchStartX = e.changedTouches[0].screenX;
	}

	function handleTouchEnd(e: TouchEvent) {
		touchEndX = e.changedTouches[0].screenX;
		handleSwipe();
	}

	function handleSwipe() {
		const swipeThreshold = 50;
		const diff = touchStartX - touchEndX;
		if (Math.abs(diff) < swipeThreshold) return;
		if (diff > 0 && activeColumnIndex < columns.length - 1) activeColumnIndex++;
		else if (diff < 0 && activeColumnIndex > 0) activeColumnIndex--;
	}

	function formatDate(dateStr?: string) {
		if (!dateStr) return '';
		const date = new Date(dateStr);
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		const days = Math.floor(diff / (1000 * 60 * 60 * 24));
		if (days === 0) return 'Today';
		if (days === 1) return 'Yesterday';
		if (days < 7) return `${days}d ago`;
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	function getCardGrid() {
		return columns.map(col => filteredIssues.filter(i => i.status === col.key));
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
		if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;

		if (e.key === 'n' || e.key === 'N') {
			e.preventDefault();
			openCreatePanel();
			return;
		}

		if (e.key === 'Escape') {
			if (panelOpen) {
				closePanel();
			} else {
				selectedId = null;
			}
			e.preventDefault();
			return;
		}

		if (panelOpen) return;

		if (!selectedId && filteredIssues.length > 0) {
			if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
				selectedId = filteredIssues[0].id;
				e.preventDefault();
				return;
			}
		}

		if (!selectedId) return;

		const pos = findCardPosition(selectedId);
		if (!pos) return;

		let newId: string | null = null;

		if (e.key === 'ArrowUp') {
			newId = getCardAt(pos.col, pos.row - 1);
		} else if (e.key === 'ArrowDown') {
			newId = getCardAt(pos.col, pos.row + 1);
		} else if (e.key === 'ArrowLeft') {
			const grid = getCardGrid();
			for (let c = pos.col - 1; c >= 0; c--) {
				if (grid[c].length > 0) {
					newId = grid[c][Math.min(pos.row, grid[c].length - 1)].id;
					break;
				}
			}
		} else if (e.key === 'ArrowRight') {
			const grid = getCardGrid();
			for (let c = pos.col + 1; c < grid.length; c++) {
				if (grid[c].length > 0) {
					newId = grid[c][Math.min(pos.row, grid[c].length - 1)].id;
					break;
				}
			}
		} else if (e.key === 'Enter') {
			const issue = filteredIssues.find(i => i.id === selectedId);
			if (issue) openEditPanel(issue);
			e.preventDefault();
			return;
		} else if (e.key === 'Delete' || e.key === 'Backspace') {
			deleteIssue(selectedId);
			e.preventDefault();
			return;
		}

		if (newId) {
			selectedId = newId;
			e.preventDefault();
		}
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

<svelte:window onkeydown={handleKeydown} onpopstate={handlePopState} onclick={closeContextMenu} />

{#if contextMenu}
	<div
		class="context-menu"
		style="left: {contextMenu.x}px; top: {contextMenu.y}px"
		onclick={(e) => e.stopPropagation()}
	>
		<div class="context-menu-section">
			<span class="context-menu-label">Priority</span>
			<div class="context-menu-options">
				<button class="context-option" class:active={contextMenu.issue.priority === 1} onclick={() => setIssuePriority(contextMenu.issue.id, 1)}>
					<span class="priority-dot" style="background: #ef4444"></span>Critical
				</button>
				<button class="context-option" class:active={contextMenu.issue.priority === 2} onclick={() => setIssuePriority(contextMenu.issue.id, 2)}>
					<span class="priority-dot" style="background: #f59e0b"></span>High
				</button>
				<button class="context-option" class:active={contextMenu.issue.priority === 3} onclick={() => setIssuePriority(contextMenu.issue.id, 3)}>
					<span class="priority-dot" style="background: #3b82f6"></span>Medium
				</button>
				<button class="context-option" class:active={contextMenu.issue.priority === 4} onclick={() => setIssuePriority(contextMenu.issue.id, 4)}>
					<span class="priority-dot" style="background: #6b7280"></span>Low
				</button>
			</div>
		</div>
		<div class="context-menu-divider"></div>
		<div class="context-menu-section">
			<span class="context-menu-label">Type</span>
			<div class="context-menu-options">
				<button class="context-option" class:active={contextMenu.issue.issue_type === 'task'} onclick={() => setIssueType(contextMenu.issue.id, 'task')}>
					<span class="type-icon">▢</span>Task
				</button>
				<button class="context-option" class:active={contextMenu.issue.issue_type === 'bug'} onclick={() => setIssueType(contextMenu.issue.id, 'bug')}>
					<span class="type-icon">●</span>Bug
				</button>
				<button class="context-option" class:active={contextMenu.issue.issue_type === 'feature'} onclick={() => setIssueType(contextMenu.issue.id, 'feature')}>
					<span class="type-icon">★</span>Feature
				</button>
				<button class="context-option" class:active={contextMenu.issue.issue_type === 'chore'} onclick={() => setIssueType(contextMenu.issue.id, 'chore')}>
					<span class="type-icon">⚙</span>Chore
				</button>
				<button class="context-option" class:active={contextMenu.issue.issue_type === 'epic'} onclick={() => setIssueType(contextMenu.issue.id, 'epic')}>
					<span class="type-icon">◈</span>Epic
				</button>
			</div>
		</div>
	</div>
{/if}

<div class="app" class:light={!isDarkMode} class:panel-open={panelOpen}>
	<header class="header">
		<div class="header-left">
			<div class="logo">
				<span class="logo-icon">◆</span>
				<h1>Beads</h1>
			</div>
		</div>
		<div class="header-center">
			<div class="search-container">
				<svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="11" cy="11" r="8"/>
					<path d="m21 21-4.35-4.35"/>
				</svg>
				<input
					type="text"
					placeholder="Search issues..."
					bind:value={searchQuery}
					class="search-input"
				/>
				{#if searchQuery}
					<button class="search-clear" onclick={() => searchQuery = ''}>×</button>
				{/if}
			</div>
		</div>
		<div class="header-right">
			<div class="filter-group">
				<select bind:value={filterPriority} class="filter-select">
					<option value="all">All Priorities</option>
					<option value={1}>Critical</option>
					<option value={2}>High</option>
					<option value={3}>Medium</option>
					<option value={4}>Low</option>
				</select>
				<select bind:value={filterType} class="filter-select">
					<option value="all">All Types</option>
					<option value="task">Task</option>
					<option value="bug">Bug</option>
					<option value="feature">Feature</option>
					<option value="epic">Epic</option>
					<option value="chore">Chore</option>
				</select>
			</div>
			<button class="theme-toggle" onclick={toggleTheme} aria-label="Toggle theme">
				{#if isDarkMode}
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="12" cy="12" r="5"/>
						<path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
					</svg>
				{:else}
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
					</svg>
				{/if}
			</button>
			<button
				class="pane-toggle"
				class:connected={wsConnected}
				onclick={() => showPaneActivity = !showPaneActivity}
				title={wsConnected ? 'Panes connected' : 'Panes disconnected'}
			>
				<span class="pane-dot"></span>
				<span class="pane-count">{wsPanes.size}</span>
			</button>
			<button class="btn-create" onclick={openCreatePanel}>
				<span class="btn-create-icon">+</span>
				<span class="btn-create-text">New Issue</span>
			</button>
		</div>
	</header>

	<nav class="column-nav">
		{#each columns as column, i}
			<button
				class="column-tab"
				class:active={activeColumnIndex === i}
				onclick={() => (activeColumnIndex = i)}
				style="--accent: {column.accent}"
			>
				<span class="column-tab-icon">{column.icon}</span>
				<span class="column-tab-label">{column.label}</span>
				<span class="column-tab-count">{filteredIssues.filter((x) => x.status === column.key).length}</span>
			</button>
		{/each}
	</nav>

	<div class="main-content">
		<main class="board" ontouchstart={handleTouchStart} ontouchend={handleTouchEnd}>
			{#each columns as column, i}
				{@const columnIssues = filteredIssues.filter((x) => x.status === column.key)}
				{@const isCollapsed = collapsedColumns.has(column.key)}
				<section
					class="column"
					class:mobile-active={activeColumnIndex === i}
					class:drag-over={draggedOverColumn === column.key}
					class:collapsed={isCollapsed}
					style="--accent: {column.accent}"
					ondragover={(e) => handleDragOver(e, column.key)}
					ondragleave={(e) => handleDragLeave(e, column.key)}
					ondrop={(e) => handleDrop(e, column.key)}
				>
					<div class="column-header" onclick={() => isCollapsed && toggleColumnCollapse(column.key)}>
						<div class="column-title">
							<span class="column-icon">{column.icon}</span>
							<h2>{column.label}</h2>
						</div>
						<div class="column-header-actions">
							<span class="column-count">{columnIssues.length}</span>
							<button class="column-collapse-btn" onclick={(e) => { e.stopPropagation(); toggleColumnCollapse(column.key); }} aria-label={isCollapsed ? 'Expand column' : 'Collapse column'}>
								{isCollapsed ? '▶' : '◀'}
							</button>
						</div>
					</div>

					{#if !isCollapsed}
					<div class="cards">
						{#if draggedOverColumn === column.key && dropTargetColumn === column.key && dropIndicatorIndex === 0}
							<div class="drop-indicator"></div>
						{/if}

						{#each columnIssues as issue, idx}
							{@const priorityConfig = getPriorityConfig(issue.priority)}
							{@const isBlocked = hasOpenBlockers(issue)}
							<article
								class="card"
								class:animating={animatingIds.has(issue.id)}
								class:selected={selectedId === issue.id}
								class:editing={editingIssue?.id === issue.id}
								class:dragging={draggedId === issue.id}
								class:has-blockers={isBlocked}
								draggable="true"
								ondragstart={(e) => handleDragStart(e, issue.id)}
								ondragend={handleDragEnd}
								onclick={() => openEditPanel(issue)}
								oncontextmenu={(e) => openContextMenu(e, issue)}
							>
									<div class="card-priority-bar" style="background: {priorityConfig.color}"></div>
								<div class="card-content">
									<div class="card-header">
										<span class="card-id-wrap">
											<span class="card-id">{issue.id}</span>
											<button
												class="btn-copy"
												class:copied={copiedId === issue.id}
												onclick={(e) => { e.stopPropagation(); copyToClipboard(issue.id, issue.id); }}
												aria-label="Copy ID"
											>
												{#if copiedId === issue.id}
													<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>
												{:else}
													<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
												{/if}
											</button>
										</span>
										{#if isBlocked}
											<span class="blocked-indicator" title="Blocked by open dependencies">⊘</span>
										{/if}
										<div class="card-actions">
											{#if issue.updated_at}
												<span class="card-date">{formatDate(issue.updated_at)}</span>
											{/if}
											<button
												class="btn-delete"
												onclick={(e) => { e.stopPropagation(); deleteIssue(issue.id); }}
												aria-label="Delete issue"
											>
												<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
													<path d="M18 6L6 18M6 6l12 12"/>
												</svg>
											</button>
										</div>
									</div>
									<h3 class="card-title">{issue.title}</h3>
									{#if issue.description}
										<p class="card-description">{issue.description}</p>
									{/if}
									{#if issue.assignee}
										<div class="card-assignee">
											<span class="assignee-avatar">{issue.assignee.charAt(0).toUpperCase()}</span>
											<span class="assignee-name">{issue.assignee}</span>
										</div>
									{/if}
									{#if issue.labels && issue.labels.length > 0}
										<div class="card-labels">
											{#each issue.labels.slice(0, 3) as label}
												<span class="label">{label}</span>
											{/each}
											{#if issue.labels.length > 3}
												<span class="label more">+{issue.labels.length - 3}</span>
											{/if}
										</div>
									{/if}
									<div class="card-footer">
										<span
											class="badge priority"
											style="--badge-color: {priorityConfig.color}; --badge-bg: {isDarkMode ? priorityConfig.bg : priorityConfig.lightBg}"
										>
											{priorityConfig.label}
										</span>
										<span class="badge type">
											<span class="type-icon">{getTypeIcon(issue.issue_type)}</span>
											{issue.issue_type}
										</span>
										</div>
									{#if (issue.dependencies && issue.dependencies.length > 0) || (issue.dependents && issue.dependents.length > 0)}
										<div class="card-links">
											{#if issue.dependencies && issue.dependencies.length > 0}
												<div class="link-group blocked-by" title="Blocked by: {issue.dependencies.map(d => d.title).join(', ')}">
													<span class="link-arrow">←</span>
													{#each issue.dependencies.slice(0, 3) as dep}
														<span class="link-id" class:open={dep.status === 'open'} class:in-progress={dep.status === 'in_progress'} class:blocked={dep.status === 'blocked'} class:closed={dep.status === 'closed'}>{dep.id}</span>
													{/each}
													{#if issue.dependencies.length > 3}
														<span class="link-more">+{issue.dependencies.length - 3}</span>
													{/if}
												</div>
											{/if}
											{#if issue.dependents && issue.dependents.length > 0}
												<div class="link-group blocking" title="Blocking: {issue.dependents.map(d => d.title).join(', ')}">
													<span class="link-arrow">→</span>
													{#each issue.dependents.slice(0, 3) as dep}
														<span class="link-id" class:open={dep.status === 'open'} class:in-progress={dep.status === 'in_progress'} class:blocked={dep.status === 'blocked'} class:closed={dep.status === 'closed'}>{dep.id}</span>
													{/each}
													{#if issue.dependents.length > 3}
														<span class="link-more">+{issue.dependents.length - 3}</span>
													{/if}
												</div>
											{/if}
										</div>
									{/if}
									{#if issue.created_at}
										<div class="card-meta">
											<span class="meta-item" title="Created {new Date(issue.created_at).toLocaleString()}">
												{formatDate(issue.created_at)}
											</span>
											{#if issue.closed_at}
												<span class="meta-separator">→</span>
												<span class="meta-item closed" title="Closed {new Date(issue.closed_at).toLocaleString()}">
													{formatDate(issue.closed_at)}
												</span>
											{/if}
										</div>
									{/if}
								</div>
							</article>

							{#if draggedOverColumn === column.key && dropTargetColumn === column.key && dropIndicatorIndex === idx + 1}
								<div class="drop-indicator"></div>
							{/if}
						{/each}

						{#if columnIssues.length === 0}
							<div class="empty-state" class:drop-ready={draggedOverColumn === column.key}>
								<div class="empty-icon">{column.icon}</div>
								<p>No issues</p>
							</div>
						{/if}
					</div>
					{/if}
				</section>
				{#if panelOpen && editingColumnIndex() === i}
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

	<!-- Expanded chat windows -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="chat-windows"
		class:has-large={Object.values(paneSizes).includes('large')}
		onmousemove={handleMouseMove}
		onmouseup={handleMouseUp}
		onmouseleave={handleMouseUp}
	>
		{#each [...wsPanes.values()].filter(p => expandedPanes.has(p.name)) as pane}
			{@const size = getPaneSize(pane.name)}
			{@const customized = isCustomized(pane.name)}
			<div
				class="chat-window {size}"
				class:streaming={pane.streaming}
				class:customized={customized}
				class:dragging={draggingPane === pane.name}
				class:resizing={resizingPane === pane.name}
				data-pane={pane.name}
				style={getPaneStyle(pane.name)}
			>
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="chat-window-header" onmousedown={(e) => startDrag(e, pane.name)}>
					<div class="chat-window-title">
						<span class="window-indicator" class:active={pane.streaming}></span>
						<span class="window-name">{pane.name}</span>
						<span class="window-type">{pane.pane_type}</span>
					</div>
					<div class="chat-window-actions">
						<button class="window-btn size-btn" onclick={() => cyclePaneSize(pane.name)} title={size === 'compact' ? 'Expand' : size === 'medium' ? 'Maximize' : 'Compact'}>
							{#if size === 'compact'}
								<svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12"><path d="M1 4.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1H2v2.5a.5.5 0 0 1-1 0v-3zm14 0a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0 0 1H14v2.5a.5.5 0 0 0 1 0v-3zm0 7a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1 0-1H14V8.5a.5.5 0 0 1 1 0v3zm-14 0a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 0-1H2V8.5a.5.5 0 0 0-1 0v3z"/></svg>
							{:else if size === 'medium'}
								<svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12"><path d="M5.828 10.172a.5.5 0 0 0-.707 0l-4.096 4.096V11.5a.5.5 0 0 0-1 0v3.975a.5.5 0 0 0 .5.5H4.5a.5.5 0 0 0 0-1H1.732l4.096-4.096a.5.5 0 0 0 0-.707zm4.344-4.344a.5.5 0 0 0 .707 0l4.096-4.096V4.5a.5.5 0 1 0 1 0V.525a.5.5 0 0 0-.5-.5H11.5a.5.5 0 0 0 0 1h2.768l-4.096 4.096a.5.5 0 0 0 0 .707z"/></svg>
							{:else}
								<svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12"><path d="M5.5 0a.5.5 0 0 1 .5.5v4A1.5 1.5 0 0 1 4.5 6h-4a.5.5 0 0 1 0-1h4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 1 .5-.5zm5 0a.5.5 0 0 1 .5.5v4a.5.5 0 0 0 .5.5h4a.5.5 0 0 1 0 1h-4A1.5 1.5 0 0 1 10 4.5v-4a.5.5 0 0 1 .5-.5zM0 10.5a.5.5 0 0 1 .5-.5h4A1.5 1.5 0 0 1 6 11.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 1-.5-.5zm10 1a1.5 1.5 0 0 1 1.5-1.5h4a.5.5 0 0 1 0 1h-4a.5.5 0 0 0-.5.5v4a.5.5 0 0 1-1 0v-4z"/></svg>
							{/if}
						</button>
						<button class="window-btn" onclick={() => removePane(pane.name)} title="Remove">×</button>
						<button class="window-btn" onclick={() => { expandedPanes.delete(pane.name); expandedPanes = new Set(expandedPanes); }} title="Minimize">−</button>
					</div>
				</div>
				<div class="chat-messages">
					{#each pane.messages.slice(size === 'large' ? -100 : size === 'medium' ? -40 : -20) as msg}
						<div class="chat-msg" class:user={msg.role === 'user'} class:assistant={msg.role === 'assistant'}>
							<span class="msg-role">{msg.role}</span>
							<p class="msg-content">{size === 'large' ? msg.content : msg.content.slice(0, 500)}{size !== 'large' && msg.content.length > 500 ? '...' : ''}</p>
						</div>
					{/each}
					{#if pane.currentDelta}
						<div class="chat-msg assistant streaming">
							<span class="msg-role">assistant</span>
							<p class="msg-content">{size === 'large' ? pane.currentDelta : pane.currentDelta.slice(-300)}<span class="cursor"></span></p>
						</div>
					{/if}
					{#if pane.messages.length === 0 && !pane.currentDelta}
						<div class="chat-empty">No messages yet</div>
					{/if}
				</div>
				<form class="chat-input-form" onsubmit={(e) => { e.preventDefault(); const msg = paneMessageInputs[pane.name]; if (msg?.trim()) { sendToPane(pane.name, msg.trim()); paneMessageInputs[pane.name] = ''; } }}>
					<input type="text" value={paneMessageInputs[pane.name] || ''} oninput={(e) => paneMessageInputs[pane.name] = e.currentTarget.value} placeholder="Send message..." class="chat-input" />
					<button type="submit" class="chat-send-btn" disabled={!paneMessageInputs[pane.name]?.trim()}>Send</button>
				</form>
				<!-- Resize handle -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="resize-handle" onmousedown={(e) => startResize(e, pane.name)}>
					<svg viewBox="0 0 10 10" width="10" height="10"><path d="M9 1v8H1" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
				</div>
			</div>
		{/each}
	</div>
</div>
</div>

{#snippet detailPanel()}
		<aside class="panel open">
			{#if isCreating}
				<div class="panel-header">
					<h2>New Issue</h2>
					<button class="panel-close" onclick={closePanel} aria-label="Close panel">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M18 6L6 18M6 6l12 12"/>
						</svg>
					</button>
				</div>
				<div class="panel-body">
					<div class="form-group">
						<label for="create-title">Title</label>
						<input
							id="create-title"
							type="text"
							bind:value={createForm.title}
							placeholder="What needs to be done?"
						/>
					</div>
					<div class="form-group">
						<label for="create-desc">Description</label>
						<textarea
							id="create-desc"
							bind:value={createForm.description}
							rows="6"
							placeholder="Add details, context, acceptance criteria..."
						></textarea>
					</div>
					<div class="form-group">
						<label for="create-priority">Priority</label>
						<div class="priority-options">
							{#each [1, 2, 3, 4] as p}
								{@const config = getPriorityConfig(p)}
								<button
									type="button"
									class="priority-option"
									class:selected={createForm.priority === p}
									style="--priority-color: {config.color}"
									onclick={() => createForm.priority = p}
								>
									<span class="priority-dot"></span>
									{config.label}
								</button>
							{/each}
						</div>
					</div>
					<div class="form-group">
						<label for="create-type">Type</label>
						<div class="type-options">
							{#each ['task', 'bug', 'feature', 'epic', 'chore'] as t}
								<button
									type="button"
									class="type-option"
									class:selected={createForm.issue_type === t}
									onclick={() => createForm.issue_type = t}
								>
									<span class="type-icon">{getTypeIcon(t)}</span>
									{t}
								</button>
							{/each}
						</div>
					</div>
				</div>
				<div class="panel-footer">
					<button class="btn-secondary" onclick={closePanel}>Cancel</button>
					<button class="btn-primary" onclick={createIssue}>Create Issue</button>
				</div>
			{:else if editingIssue}
				{@const priorityConfig = getPriorityConfig(editingIssue.priority)}
				<div class="panel-header">
					<div class="panel-header-info">
						<span class="panel-id-wrap">
							<span class="panel-id">{editingIssue.id}</span>
							<button
								class="btn-copy panel-copy"
								class:copied={copiedId === `panel-${editingIssue.id}`}
								onclick={() => copyToClipboard(editingIssue.id, `panel-${editingIssue.id}`)}
								aria-label="Copy ID"
							>
								{#if copiedId === `panel-${editingIssue.id}`}
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>
								{:else}
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
								{/if}
							</button>
						</span>
						<div class="panel-status-bar" style="background: {priorityConfig.color}"></div>
					</div>
					<button class="panel-close" onclick={closePanel} aria-label="Close panel">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M18 6L6 18M6 6l12 12"/>
						</svg>
					</button>
				</div>
				<div class="panel-body">
					<div class="form-group">
						<label for="edit-title">Title</label>
						<input id="edit-title" type="text" bind:value={editingIssue.title} />
					</div>
					<div class="form-group">
						<label for="edit-desc" class="label-with-action">
							Description
							{#if editingIssue.description}
								<button
									class="btn-copy-inline"
									class:copied={copiedId === `desc-${editingIssue.id}`}
									onclick={() => copyToClipboard(editingIssue.description, `desc-${editingIssue.id}`)}
									aria-label="Copy description"
								>
									{#if copiedId === `desc-${editingIssue.id}`}
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>
										copied
									{:else}
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
										copy
									{/if}
								</button>
							{/if}
						</label>
						<textarea id="edit-desc" bind:value={editingIssue.description} rows="6"></textarea>
					</div>
					<div class="form-group">
						<label>Status</label>
						<div class="status-options">
							{#each columns as col}
								<button
									type="button"
									class="status-option"
									class:selected={editingIssue.status === col.key}
									style="--status-color: {col.accent}"
									onclick={() => editingIssue.status = col.key}
								>
									<span class="status-icon">{col.icon}</span>
									{col.label}
								</button>
							{/each}
						</div>
					</div>
					<div class="form-group">
						<label>Priority</label>
						<div class="priority-options">
							{#each [1, 2, 3, 4] as p}
								{@const config = getPriorityConfig(p)}
								<button
									type="button"
									class="priority-option"
									class:selected={editingIssue.priority === p}
									style="--priority-color: {config.color}"
									onclick={() => editingIssue.priority = p}
								>
									<span class="priority-dot"></span>
									{config.label}
								</button>
							{/each}
						</div>
					</div>
					<div class="form-group">
						<label>Type</label>
						<div class="type-options">
							{#each ['task', 'bug', 'feature', 'epic', 'chore'] as t}
								<button
									type="button"
									class="type-option"
									class:selected={editingIssue.issue_type === t}
									onclick={() => editingIssue.issue_type = t}
								>
									<span class="type-icon">{getTypeIcon(t)}</span>
									{t}
								</button>
							{/each}
						</div>
					</div>
					{#if editingIssue.design || editingIssue._showDesign}
						<div class="form-group expandable">
							<label for="edit-design">
								Design Notes
								<button class="btn-collapse" onclick={() => { editingIssue.design = ''; editingIssue._showDesign = false; }} aria-label="Remove section">×</button>
							</label>
							<textarea id="edit-design" bind:value={editingIssue.design} rows="3" placeholder="Technical approach, architecture decisions..."></textarea>
						</div>
					{/if}
					{#if editingIssue.acceptance_criteria || editingIssue._showAcceptance}
						<div class="form-group expandable">
							<label for="edit-acceptance">
								Acceptance Criteria
								<button class="btn-collapse" onclick={() => { editingIssue.acceptance_criteria = ''; editingIssue._showAcceptance = false; }} aria-label="Remove section">×</button>
							</label>
							<textarea id="edit-acceptance" bind:value={editingIssue.acceptance_criteria} rows="3" placeholder="Definition of done, test cases..."></textarea>
						</div>
					{/if}
					{#if editingIssue.notes || editingIssue._showNotes}
						<div class="form-group expandable">
							<label for="edit-notes">
								Implementation Notes
								<button class="btn-collapse" onclick={() => { editingIssue.notes = ''; editingIssue._showNotes = false; }} aria-label="Remove section">×</button>
							</label>
							<textarea id="edit-notes" bind:value={editingIssue.notes} rows="3" placeholder="Progress updates, blockers, learnings..."></textarea>
						</div>
					{/if}
					{#if !editingIssue.design && !editingIssue._showDesign || !editingIssue.acceptance_criteria && !editingIssue._showAcceptance || !editingIssue.notes && !editingIssue._showNotes}
						<div class="add-sections">
							{#if !editingIssue.design && !editingIssue._showDesign}
								<button class="btn-add-section" onclick={() => editingIssue._showDesign = true}>
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
									Design
								</button>
							{/if}
							{#if !editingIssue.acceptance_criteria && !editingIssue._showAcceptance}
								<button class="btn-add-section" onclick={() => editingIssue._showAcceptance = true}>
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
									Acceptance
								</button>
							{/if}
							{#if !editingIssue.notes && !editingIssue._showNotes}
								<button class="btn-add-section" onclick={() => editingIssue._showNotes = true}>
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
									Notes
								</button>
							{/if}
						</div>
					{/if}
					{#if editingIssue.dependencies && editingIssue.dependencies.length > 0}
						<div class="form-group">
							<label>Blocked By</label>
							<div class="dep-list">
								{#each editingIssue.dependencies as dep}
									<div class="dep-item blocked-by">
										<span class="dep-status" class:open={dep.status === 'open'} class:in-progress={dep.status === 'in_progress'} class:closed={dep.status === 'closed'}></span>
										<span class="dep-id">{dep.id}</span>
										<span class="dep-title">{dep.title}</span>
									</div>
								{/each}
							</div>
						</div>
					{/if}
					{#if editingIssue.dependents && editingIssue.dependents.length > 0}
						<div class="form-group">
							<label>Blocking</label>
							<div class="dep-list">
								{#each editingIssue.dependents as dep}
									<div class="dep-item blocking">
										<span class="dep-status" class:open={dep.status === 'open'} class:in-progress={dep.status === 'in_progress'} class:closed={dep.status === 'closed'}></span>
										<span class="dep-id">{dep.id}</span>
										<span class="dep-title">{dep.title}</span>
									</div>
								{/each}
							</div>
						</div>
					{/if}
					<div class="form-group">
						<label>Comments {#if loadingComments}<span class="loading-indicator">...</span>{/if}</label>
						<div class="comments-section">
							{#if comments.length > 0}
								<div class="comments-list">
									{#each comments as comment}
										<div class="comment">
											<div class="comment-header">
												<span class="comment-author">{comment.author}</span>
												<span class="comment-date">{formatDate(comment.created_at)}</span>
											</div>
											<p class="comment-text">{comment.text}</p>
										</div>
									{/each}
								</div>
							{:else if !loadingComments}
								<p class="no-comments">No comments yet</p>
							{/if}
							<div class="comment-input">
								<textarea
									bind:value={newComment}
									rows="2"
									placeholder="Add a comment..."
									onkeydown={(e) => { if (e.key === 'Enter' && e.metaKey) addComment(); }}
								></textarea>
								<button class="btn-comment" onclick={addComment} disabled={!newComment.trim()}>
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
									</svg>
								</button>
							</div>
						</div>
					</div>
				</div>
				<div class="panel-footer">
					<button class="btn-danger" onclick={() => deleteIssue(editingIssue.id)}>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
						</svg>
						Delete
					</button>
					<button class="btn-primary" onclick={() => { updateIssue(editingIssue.id, editingIssue); closePanel(); }}>
						Save Changes
					</button>
				</div>
			{/if}
		</aside>
{/snippet}

<style>
	@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Outfit:wght@400;500;600;700&display=swap');

	:root {
		--bg-primary: #0a0a0b;
		--bg-secondary: #111113;
		--bg-tertiary: #18181b;
		--bg-elevated: #1f1f23;
		--border-subtle: rgba(255, 255, 255, 0.06);
		--border-default: rgba(255, 255, 255, 0.1);
		--border-strong: rgba(255, 255, 255, 0.15);
		--text-primary: #fafafa;
		--text-secondary: #a1a1aa;
		--text-tertiary: #71717a;
		--accent-primary: #6366f1;
		--accent-glow: rgba(99, 102, 241, 0.2);
		--radius-sm: 6px;
		--radius-md: 10px;
		--radius-lg: 14px;
		--transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
		--transition-smooth: 250ms cubic-bezier(0.4, 0, 0.2, 1);
		--transition-bounce: 400ms cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	:global(*) {
		box-sizing: border-box;
		margin: 0;
		padding: 0;
	}

	:global(body) {
		font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
		background: var(--bg-primary);
		color: var(--text-primary);
		line-height: 1.5;
		-webkit-font-smoothing: antialiased;
		overflow: hidden;
	}

	.app {
		display: flex;
		flex-direction: column;
		height: 100vh;
		padding-bottom: 48px;
		background:
			radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99, 102, 241, 0.15), transparent),
			radial-gradient(ellipse 60% 40% at 100% 0%, rgba(168, 85, 247, 0.1), transparent),
			var(--bg-primary);
		transition: background var(--transition-smooth);
	}

	/* Light theme */
	.app.light {
		--bg-primary: #f8fafc;
		--bg-secondary: #ffffff;
		--bg-tertiary: #f1f5f9;
		--bg-elevated: #e2e8f0;
		--border-subtle: rgba(0, 0, 0, 0.06);
		--border-default: rgba(0, 0, 0, 0.1);
		--border-strong: rgba(0, 0, 0, 0.15);
		--text-primary: #0f172a;
		--text-secondary: #475569;
		--text-tertiary: #94a3b8;
		--accent-glow: rgba(99, 102, 241, 0.15);
		background:
			radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99, 102, 241, 0.08), transparent),
			radial-gradient(ellipse 60% 40% at 100% 0%, rgba(168, 85, 247, 0.05), transparent),
			var(--bg-primary);
	}

	/* Header */
	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1.25rem;
		background: rgba(17, 17, 19, 0.8);
		backdrop-filter: blur(12px);
		border-bottom: 1px solid var(--border-subtle);
		gap: 1.25rem;
		z-index: 100;
		flex-shrink: 0;
	}

	.app.light .header {
		background: rgba(255, 255, 255, 0.9);
	}

	.header-left {
		flex-shrink: 0;
	}

	.logo {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.logo-icon {
		font-size: 1.375rem;
		color: var(--accent-primary);
		filter: drop-shadow(0 0 8px var(--accent-glow));
	}

	.logo h1 {
		font-size: 1.125rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		background: linear-gradient(135deg, var(--text-primary), var(--text-secondary));
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.header-center {
		flex: 1;
		max-width: 400px;
	}

	.search-container {
		position: relative;
		display: flex;
		align-items: center;
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
		padding: 0.5rem 2rem;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		color: var(--text-primary);
		font-family: inherit;
		font-size: 0.8125rem;
		transition: all var(--transition-fast);
	}

	.search-input::placeholder {
		color: var(--text-tertiary);
	}

	.search-input:focus {
		outline: none;
		border-color: var(--accent-primary);
		box-shadow: 0 0 0 3px var(--accent-glow);
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
		padding: 0.4375rem 0.625rem;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		color: var(--text-secondary);
		font-family: inherit;
		font-size: 0.75rem;
		cursor: pointer;
		transition: all var(--transition-fast);
		appearance: none;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 0.375rem center;
		padding-right: 1.375rem;
	}

	.filter-select:hover {
		border-color: var(--border-default);
	}

	.filter-select:focus {
		outline: none;
		border-color: var(--accent-primary);
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
		background: var(--bg-tertiary);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		color: var(--text-secondary);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.theme-toggle svg {
		width: 1rem;
		height: 1rem;
	}

	.theme-toggle:hover {
		background: var(--bg-elevated);
		border-color: var(--border-default);
		color: var(--text-primary);
	}

	.btn-create {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.4375rem 0.875rem;
		background: var(--accent-primary);
		border: none;
		border-radius: var(--radius-md);
		color: white;
		font-family: inherit;
		font-size: 0.8125rem;
		font-weight: 600;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.btn-create:hover {
		background: #4f46e5;
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
	}

	.btn-create:active {
		transform: translateY(0);
	}

	.btn-create-icon {
		font-size: 1rem;
		line-height: 1;
	}

	/* Column Navigation (Mobile) */
	.column-nav {
		display: none;
		padding: 0.625rem 0.875rem;
		background: var(--bg-secondary);
		border-bottom: 1px solid var(--border-subtle);
		gap: 0.375rem;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		flex-shrink: 0;
	}

	.column-tab {
		display: flex;
		align-items: center;
		gap: 0.3125rem;
		padding: 0.4375rem 0.75rem;
		background: transparent;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		color: var(--text-secondary);
		font-family: inherit;
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		white-space: nowrap;
		transition: all var(--transition-fast);
	}

	.column-tab:hover {
		background: var(--bg-tertiary);
		border-color: var(--border-default);
	}

	.column-tab.active {
		background: var(--accent);
		border-color: var(--accent);
		color: white;
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
		gap: 0.875rem;
		padding: 1rem;
		flex: 1;
		overflow-x: auto;
		overflow-y: hidden;
		min-height: 0;
		transition: margin-right var(--transition-smooth);
	}

	/* Column */
	.column {
		flex: 1 1 0;
		min-width: 260px;
		max-height: 100%;
		display: flex;
		flex-direction: column;
		background: var(--bg-secondary);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		overflow: hidden;
		transition: all var(--transition-smooth);
	}

	.column.drag-over {
		border-color: var(--accent);
		box-shadow:
			0 0 0 1px var(--accent),
			0 0 24px rgba(99, 102, 241, 0.15),
			inset 0 0 48px rgba(99, 102, 241, 0.05);
	}

	.column-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.875rem 1rem;
		border-bottom: 1px solid var(--border-subtle);
		background: linear-gradient(180deg, var(--bg-tertiary) 0%, var(--bg-secondary) 100%);
		flex-shrink: 0;
	}

	.column-title {
		display: flex;
		align-items: center;
		gap: 0.4375rem;
	}

	.column-icon {
		font-size: 0.8125rem;
		color: var(--accent);
		opacity: 0.9;
	}

	.column-header h2 {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--text-primary);
		letter-spacing: -0.01em;
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
		padding: 0.75rem;
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
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
		background: var(--bg-tertiary);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		cursor: pointer;
		transition: all var(--transition-smooth);
		overflow: hidden;
	}

	.card-priority-bar {
		width: 3px;
		flex-shrink: 0;
	}

	.card-content {
		flex: 1;
		padding: 0.75rem;
		min-width: 0;
	}

	.card::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: linear-gradient(135deg, rgba(255,255,255,0.02) 0%, transparent 50%);
		pointer-events: none;
	}

	.card:hover {
		border-color: var(--border-default);
		transform: translateY(-2px);
		box-shadow:
			0 4px 12px rgba(0, 0, 0, 0.15),
			0 0 1px rgba(255, 255, 255, 0.1);
	}

	.app.light .card:hover {
		box-shadow:
			0 4px 12px rgba(0, 0, 0, 0.08),
			0 0 1px rgba(0, 0, 0, 0.05);
	}

	.card.selected {
		border-color: var(--accent-primary);
		box-shadow:
			0 0 0 2px var(--accent-glow),
			0 4px 16px rgba(99, 102, 241, 0.2);
	}

	.card.editing {
		border-color: var(--accent-primary);
		background: rgba(99, 102, 241, 0.05);
		z-index: 5;
	}


	.card.dragging {
		opacity: 0.5;
		transform: rotate(2deg) scale(1.02);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
	}

	.card.animating {
		animation: cardEnter 1s cubic-bezier(0.34, 1.56, 0.64, 1);
		z-index: 10;
	}

	@keyframes cardEnter {
		0% {
			opacity: 0;
			transform: scale(0.85) translateY(-16px);
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
		width: 1rem;
		height: 1rem;
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
		width: 0.625rem;
		height: 0.625rem;
	}

	.card:hover .btn-copy {
		opacity: 0.6;
	}

	.btn-copy:hover {
		opacity: 1 !important;
		color: var(--text-secondary);
	}

	.btn-copy.copied {
		opacity: 1 !important;
		color: #10b981;
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
		background: linear-gradient(180deg, #ef4444 0%, var(--priority-color, #ef4444) 100%) !important;
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
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--text-primary);
		line-height: 1.35;
		margin-bottom: 0.25rem;
	}

	.card-description {
		font-size: 0.75rem;
		color: var(--text-secondary);
		line-height: 1.45;
		margin-bottom: 0.5rem;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.card-assignee {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		margin-bottom: 0.5rem;
	}

	.assignee-avatar {
		width: 1.25rem;
		height: 1.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--accent-primary);
		border-radius: 50%;
		font-size: 0.625rem;
		font-weight: 600;
		color: white;
	}

	.assignee-name {
		font-size: 0.6875rem;
		color: var(--text-secondary);
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

	.empty-state.drop-ready {
		border-color: var(--accent-primary);
		background: rgba(99, 102, 241, 0.05);
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
		border: 1px solid var(--accent-primary);
		border-radius: var(--radius-lg);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		box-shadow:
			0 0 0 1px var(--accent-glow),
			0 8px 32px rgba(0, 0, 0, 0.3);
		animation: panelSlideIn 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	@keyframes panelSlideIn {
		from {
			opacity: 0;
			transform: scale(0.95) translateX(-20px);
		}
		to {
			opacity: 1;
			transform: scale(1) translateX(0);
		}
	}

	.panel.open {
		/* keep for compatibility */
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1.25rem;
		border-bottom: 1px solid var(--border-subtle);
		background: var(--bg-tertiary);
		flex-shrink: 0;
	}

	.panel-header h2 {
		font-size: 1rem;
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
		border-top: 1px solid var(--border-subtle);
		background: var(--bg-tertiary);
		flex-shrink: 0;
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
		background: var(--bg-tertiary);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		font-family: inherit;
		font-size: 0.875rem;
		transition: all var(--transition-fast);
	}

	.form-group input::placeholder,
	.form-group textarea::placeholder {
		color: var(--text-tertiary);
	}

	.form-group input:focus,
	.form-group textarea:focus {
		outline: none;
		border-color: var(--accent-primary);
		box-shadow: 0 0 0 3px var(--accent-glow);
	}

	.form-group textarea {
		resize: vertical;
		min-height: 100px;
		line-height: 1.5;
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
		gap: 0.375rem;
		padding: 0.5rem 1rem;
		border: none;
		border-radius: var(--radius-md);
		font-family: inherit;
		font-size: 0.8125rem;
		font-weight: 600;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.btn-secondary {
		background: var(--bg-elevated);
		color: var(--text-secondary);
	}

	.btn-secondary:hover {
		background: var(--border-default);
		color: var(--text-primary);
	}

	.btn-primary {
		background: var(--accent-primary);
		color: white;
	}

	.btn-primary:hover {
		background: #4f46e5;
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
	}

	.btn-primary:active {
		transform: translateY(0);
	}

	.btn-danger {
		background: rgba(239, 68, 68, 0.1);
		color: #ef4444;
	}

	.btn-danger:hover {
		background: rgba(239, 68, 68, 0.2);
	}

	.btn-danger svg {
		width: 0.875rem;
		height: 0.875rem;
	}

	/* Mobile */
	@media (max-width: 768px) {
		.header {
			flex-direction: column;
			padding: 0.625rem 0.875rem;
			gap: 0.625rem;
		}

		.header-left,
		.header-center,
		.header-right {
			width: 100%;
		}

		.header-center {
			max-width: 100%;
		}

		.header-right {
			flex-direction: row;
			flex-wrap: wrap;
			gap: 0.5rem;
		}

		.filter-group {
			flex: 1;
		}

		.filter-select {
			flex: 1;
		}

		.btn-create {
			flex: 1;
			justify-content: center;
		}

		.column-nav {
			display: flex;
		}

		.main-content {
			flex-direction: column;
		}

		.board {
			flex-direction: column;
			padding: 0.625rem;
			gap: 0;
			overflow-y: auto;
		}

		.column {
			display: none;
			min-width: 100%;
		}

		.column.mobile-active {
			display: flex;
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
			border-radius: var(--radius-lg) var(--radius-lg) 0 0;
			z-index: 100;
			animation: panelSlideUp 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
			overflow: hidden;
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
			font-size: 0.875rem;
		}

		.card-description {
			font-size: 0.8125rem;
		}
	}

	/* Pane Activity Sidebar */
	.pane-toggle {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.4375rem 0.625rem;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		color: var(--text-secondary);
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.6875rem;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.pane-toggle:hover {
		border-color: var(--border-default);
		background: var(--bg-elevated);
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
		background: rgba(15, 15, 20, 0.98);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: var(--radius-lg);
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
		overflow: hidden;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
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
		border-radius: var(--radius-xl, 16px);
		box-shadow: 0 25px 80px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1);
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
		border-color: rgba(245, 158, 11, 0.3);
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 20px rgba(245, 158, 11, 0.1);
	}

	.chat-window.large.streaming {
		box-shadow: 0 25px 80px rgba(0, 0, 0, 0.5), 0 0 40px rgba(245, 158, 11, 0.15);
	}

	.app.light .chat-window {
		background: rgba(255, 255, 255, 0.98);
		border-color: rgba(0, 0, 0, 0.1);
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
	}

	.app.light .chat-windows.has-large {
		background: rgba(255, 255, 255, 0.7);
	}

	.app.light .chat-window.large {
		box-shadow: 0 25px 80px rgba(0, 0, 0, 0.2);
	}

	/* Customized (dragged/resized) windows */
	.chat-window.customized {
		z-index: 1001;
		overflow: visible;
	}

	.chat-window.dragging,
	.chat-window.resizing {
		transition: none;
	}

	.chat-window.dragging {
		opacity: 0.95;
		cursor: grabbing;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
		z-index: 1002;
	}

	.chat-window.resizing {
		z-index: 1002;
	}

	.app.light .chat-window.dragging {
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
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

	/* Resize handle */
	.resize-handle {
		position: absolute;
		bottom: 0;
		right: 0;
		width: 20px;
		height: 20px;
		cursor: nwse-resize;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-tertiary);
		opacity: 0.4;
		transition: opacity 0.15s ease;
		z-index: 10;
	}

	.resize-handle:hover {
		opacity: 0.8;
	}

	.chat-window.resizing .resize-handle {
		opacity: 1;
		color: #6366f1;
	}

	.chat-window-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.625rem 0.75rem;
		background: rgba(0, 0, 0, 0.3);
		border-bottom: 1px solid rgba(255, 255, 255, 0.04);
		cursor: grab;
	}

	.chat-window.dragging .chat-window-header {
		cursor: grabbing;
	}

	.app.light .chat-window-header {
		background: rgba(0, 0, 0, 0.03);
		border-bottom-color: rgba(0, 0, 0, 0.06);
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
		gap: 0.25rem;
	}

	.window-btn {
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		color: var(--text-tertiary);
		font-size: 1rem;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.window-btn:hover {
		background: rgba(255, 255, 255, 0.1);
		color: var(--text-primary);
	}

	.chat-messages {
		flex: 1;
		overflow-y: auto;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-height: 150px;
		max-height: 250px;
	}

	.chat-msg {
		padding: 0.5rem 0.75rem;
		border-radius: var(--radius-md);
		max-width: 90%;
	}

	.chat-msg.user {
		align-self: flex-end;
		background: rgba(99, 102, 241, 0.2);
		border: 1px solid rgba(99, 102, 241, 0.3);
	}

	.chat-msg.assistant {
		align-self: flex-start;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.06);
	}

	.chat-msg.streaming {
		border-color: rgba(245, 158, 11, 0.3);
	}

	.app.light .chat-msg.assistant {
		background: rgba(0, 0, 0, 0.03);
		border-color: rgba(0, 0, 0, 0.06);
	}

	.msg-role {
		display: block;
		font-size: 0.625rem;
		font-family: 'JetBrains Mono', monospace;
		color: var(--text-tertiary);
		text-transform: uppercase;
		margin-bottom: 0.25rem;
	}

	.msg-content {
		font-size: 0.8125rem;
		line-height: 1.5;
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
		align-items: center;
		justify-content: center;
		color: var(--text-tertiary);
		font-size: 0.75rem;
		font-style: italic;
	}

	.chat-input-form {
		display: flex;
		gap: 0.5rem;
		padding: 0.625rem 0.75rem;
		background: rgba(0, 0, 0, 0.2);
		border-top: 1px solid rgba(255, 255, 255, 0.04);
	}

	.app.light .chat-input-form {
		background: rgba(0, 0, 0, 0.02);
		border-top-color: rgba(0, 0, 0, 0.06);
	}

	.chat-input {
		flex: 1;
		padding: 0.5rem 0.75rem;
		font-size: 0.8125rem;
		font-family: 'JetBrains Mono', monospace;
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: var(--radius-sm);
		color: var(--text-primary);
	}

	.chat-input:focus {
		outline: none;
		border-color: rgba(99, 102, 241, 0.5);
	}

	.chat-input::placeholder {
		color: var(--text-tertiary);
	}

	.app.light .chat-input {
		background: rgba(255, 255, 255, 0.8);
		border-color: rgba(0, 0, 0, 0.1);
	}

	.chat-send-btn {
		padding: 0.5rem 1rem;
		font-size: 0.75rem;
		font-weight: 600;
		background: #6366f1;
		border: none;
		border-radius: var(--radius-sm);
		color: white;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.chat-send-btn:hover:not(:disabled) {
		background: #4f46e5;
	}

	.chat-send-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}

	@media (max-width: 768px) {
		.chat-windows {
			flex-direction: column;
			align-items: stretch;
		}

		.chat-window {
			width: 100%;
			max-width: none;
		}
	}

	/* Context Menu */
	.context-menu {
		position: fixed;
		z-index: 1000;
		background: var(--bg-secondary);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
		padding: 0.5rem;
		min-width: 160px;
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
</style>
