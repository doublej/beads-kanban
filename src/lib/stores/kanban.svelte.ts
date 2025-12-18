import { browser } from '$app/environment';
import { untrack } from 'svelte';
import type { Issue, Attachment, LoadingStatus, Project } from '$lib/types';
import { getIssueColumn, getColumnMoveUpdates } from '$lib/utils';
import { fetchMutations } from '$lib/mutationStore.svelte';

// Core issue state
let issues = $state<Issue[]>([]);
let selectedId = $state<string | null>(null);
let editingIssue = $state<Issue | null>(null);
let originalLabels = $state<string[]>([]);
let isCreating = $state(false);
let createForm = $state({ title: '', description: '', priority: 2, issue_type: 'task', deps: [] as string[] });

// Filter state
let searchQuery = $state('');
let filterPriority = $state<number | 'all'>('all');
let filterType = $state<string>('all');
let filterTime = $state<string>('all');
let isFilterPreviewing = $state(false);

// Loading state
let loadingStatus = $state<LoadingStatus>({
	phase: 'disconnected',
	pollCount: 0,
	lastUpdate: null,
	issueCount: 0,
	hasChanges: false,
	errorMessage: null
});
let initialLoaded = $state(false);
let sseSource = $state<EventSource | null>(null);

// Animation state
let animatingIds = $state<Set<string>>(new Set());

// Detail panel state
let comments = $state<{ id: number; author: string; text: string; created_at: string }[]>([]);
let newComment = $state('');
let loadingComments = $state(false);
let attachments = $state<Attachment[]>([]);
let loadingAttachments = $state(false);
let newLabelInput = $state('');
let issueClosedExternally = $state(false);

// Settings state
let isDarkMode = $state(true);
let colorScheme = $state('default');
let notificationsEnabled = $state(false);
let tickerRange = $state(60 * 24 * 7);
let agentEnabled = $state(true);
let agentHost = $state('localhost');
let agentPort = $state(8765);

// Project state
let projects = $state<Project[]>([]);
let projectName = $state('');
let currentProjectPath = $state('');
let projectColor = $state('#6366f1');
let projectTransition = $state<'idle' | 'wipe-out' | 'wipe-in'>('idle');

// Derived values
const panelOpen = $derived(editingIssue !== null || isCreating);
const hasActiveFilters = $derived(
	searchQuery !== '' || filterPriority !== 'all' || filterType !== 'all' || filterTime !== 'all'
);

function issueMatchesTimeFilter(issue: Issue): boolean {
	if (filterTime === 'all') return true;
	const now = new Date();
	const updated = issue.updated_at ? new Date(issue.updated_at) : (issue.created_at ? new Date(issue.created_at) : now);
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

const filteredIssues = $derived(issues.filter(issueMatchesFilters));

// Notification helper
function sendNotification(title: string, body: string) {
	if (!notificationsEnabled || !browser) return;
	if (!('Notification' in window)) return;
	if (Notification.permission !== 'granted') return;
	new Notification(title, { body, icon: '/favicon.png' });
}

// SSE connection
function connectSSE(callbacks?: {
	onStatusChange?: (id: string, fromStatus: string, toStatus: string) => void;
}) {
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

		// Check if editing issue was closed externally
		const currentEditing = editingIssue;
		if (currentEditing && !isCreating) {
			const updatedIssue = data.issues.find((i: Issue) => i.id === currentEditing.id);
			if (updatedIssue && updatedIssue.status === 'closed' && currentEditing.status !== 'closed') {
				issueClosedExternally = true;
			}
		}

		// Find status changes for animation callbacks
		const statusChanges: { id: string; oldStatus: string; newStatus: string }[] = [];
		data.issues.forEach((issue: Issue) => {
			const oldIssue = oldIssuesMap.get(issue.id);
			if (!oldIssue) {
				sendNotification('New Issue Created', issue.title);
			} else if (oldIssue.status !== issue.status) {
				statusChanges.push({ id: issue.id, oldStatus: oldIssue.status, newStatus: issue.status });
				if (issue.status === 'blocked' && oldIssue.status !== 'blocked') {
					sendNotification('Issue Blocked', `${issue.title} is now blocked`);
				} else if (issue.status !== 'blocked' && oldIssue.status === 'blocked') {
					sendNotification('Issue Unblocked', `${issue.title} is no longer blocked`);
				}
			}
		});

		// Notify callbacks about status changes (for animations)
		if (callbacks?.onStatusChange) {
			statusChanges.forEach(({ id, oldStatus, newStatus }) => {
				callbacks.onStatusChange!(id, oldStatus, newStatus);
			});
		}

		issues = data.issues;
	};

	eventSource.onerror = () => {
		eventSource.close();
		loadingStatus = { ...loadingStatus, phase: 'disconnected' };
		setTimeout(() => connectSSE(callbacks), 3000);
	};

	return eventSource;
}

function disconnectSSE() {
	if (sseSource) {
		sseSource.close();
		sseSource = null;
	}
}

// Issue CRUD operations
async function updateIssue(id: string, updates: Partial<Issue>) {
	const idx = issues.findIndex(i => i.id === id);
	if (idx !== -1) {
		const updated = { ...issues[idx], ...updates, updated_at: new Date().toISOString() };
		issues = [...issues.slice(0, idx), updated, ...issues.slice(idx + 1)];
	}
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
	if (!confirm('Delete this issue permanently?')) return;
	animatingIds = new Set([...animatingIds, id]);
	if (editingIssue?.id === id) {
		editingIssue = null;
	}
	// Remove from UI immediately
	issues = issues.filter(i => i.id !== id);
	setTimeout(() => {
		animatingIds = new Set([...animatingIds].filter(x => x !== id));
	}, 600);
	await fetch(`/api/issues/${id}`, { method: 'DELETE' });
	fetchMutations();
}

async function createIssue() {
	if (!createForm.title.trim()) return;
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
	createForm = { title: '', description: '', priority: 2, issue_type: 'task', deps: [] };
	isCreating = false;

	await fetch('/api/issues', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ title: tempIssue.title, description: tempIssue.description, priority: tempIssue.priority, issue_type: tempIssue.issue_type })
	});
	fetchMutations();
}

// Panel operations
function openCreatePanel() {
	editingIssue = null;
	isCreating = true;
	createForm = { title: '', description: '', priority: 2, issue_type: 'task', deps: [] };
}

function openEditPanel(issue: Issue) {
	isCreating = false;
	createForm = { title: '', description: '', priority: 2, issue_type: 'task', deps: [] };
	editingIssue = { ...issue, labels: issue.labels ? [...issue.labels] : [] };
	originalLabels = issue.labels ? [...issue.labels] : [];
	selectedId = issue.id;
	comments = [];
	loadComments(issue.id);
	loadAttachments(issue.id);
}

function closePanel() {
	editingIssue = null;
	isCreating = false;
	issueClosedExternally = false;
	comments = [];
	attachments = [];
	newComment = '';
}

function hasUnsavedCreate(): boolean {
	return isCreating && (createForm.title.trim() !== '' || createForm.description.trim() !== '');
}

// Comments
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

// Attachments
async function loadAttachments(issueId: string) {
	loadingAttachments = true;
	const res = await fetch(`/api/issues/${issueId}/attachments`);
	if (res.ok) {
		const data = await res.json();
		attachments = data.attachments || [];
	}
	loadingAttachments = false;
}

// Label operations
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

function setEditingColumn(columnKey: string) {
	if (!editingIssue) return;
	const updates = getColumnMoveUpdates(editingIssue, columnKey);
	if (updates.status) editingIssue.status = updates.status;
}

// Dependency operations
async function createDependency(fromId: string, toId: string, depType: string = 'blocks') {
	const res = await fetch(`/api/issues/${fromId}/deps`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ depends_on: toId, dep_type: depType })
	});
	if (!res.ok) {
		const data = await res.json();
		console.error('Failed to create dependency:', data.error);
	}
}

async function removeDependency(issueId: string, dependsOnId: string) {
	const res = await fetch(`/api/issues/${issueId}/deps`, {
		method: 'DELETE',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ depends_on: dependsOnId })
	});
	if (!res.ok) {
		const data = await res.json();
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

// Settings persistence
function loadSettings() {
	if (!browser) return;
	const saved = localStorage.getItem('theme');
	if (saved) {
		isDarkMode = saved === 'dark';
	} else {
		isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
	}
	const savedTickerRange = localStorage.getItem('tickerRange');
	if (savedTickerRange) tickerRange = Number(savedTickerRange);
	const savedAgentEnabled = localStorage.getItem('agentEnabled');
	if (savedAgentEnabled) agentEnabled = savedAgentEnabled === 'true';
	const savedAgentHost = localStorage.getItem('agentHost');
	if (savedAgentHost) agentHost = savedAgentHost;
	const savedAgentPort = localStorage.getItem('agentPort');
	if (savedAgentPort) agentPort = Number(savedAgentPort);
	const savedColorScheme = localStorage.getItem('colorScheme');
	if (savedColorScheme) colorScheme = savedColorScheme;
	const savedNotifications = localStorage.getItem('notificationsEnabled');
	if (savedNotifications) notificationsEnabled = savedNotifications === 'true';
}

function saveSettings() {
	if (!browser) return;
	localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
	localStorage.setItem('tickerRange', String(tickerRange));
	localStorage.setItem('agentEnabled', String(agentEnabled));
	localStorage.setItem('agentHost', agentHost);
	localStorage.setItem('agentPort', String(agentPort));
	localStorage.setItem('colorScheme', colorScheme);
	localStorage.setItem('notificationsEnabled', String(notificationsEnabled));
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

// Project operations
async function loadProjects() {
	if (!browser) return;
	const res = await fetch('/api/cwd');
	const { cwd, name } = await res.json();
	projectName = name || cwd.split('/').pop() || 'project';
	currentProjectPath = cwd;

	const projRes = await fetch('/api/projects', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ path: cwd, name })
	});
	const data = await projRes.json();
	if (data.projects) {
		projects = data.projects;
		const current = projects.find(p => p.path === cwd);
		if (current) projectColor = current.color;
	}
}

async function switchProject(project: Project) {
	if (project.path === currentProjectPath) return;

	const WIPE_DURATION = 350;
	projectTransition = 'wipe-out';

	disconnectSSE();

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

	const issuesRes = await fetch('/api/issues');
	const issuesData = await issuesRes.json();

	issues = issuesData.issues || [];
	currentProjectPath = project.path;
	projectName = project.name;
	projectColor = project.color;
	initialLoaded = true;
	selectedId = null;
	editingIssue = null;
	isCreating = false;

	projectTransition = 'wipe-in';
	connectSSE();

	await new Promise(r => setTimeout(r, WIPE_DURATION));
	projectTransition = 'idle';
}

// Single store object with getter/setter properties for reactive state
export const kanban = {
	// Core issue state
	get issues() { return issues; },
	set issues(v: Issue[]) { issues = v; },
	get selectedId() { return selectedId; },
	set selectedId(v: string | null) { selectedId = v; },
	get editingIssue() { return editingIssue; },
	set editingIssue(v: Issue | null) { editingIssue = v; },
	get originalLabels() { return originalLabels; },
	get isCreating() { return isCreating; },
	set isCreating(v: boolean) { isCreating = v; },
	get createForm() { return createForm; },
	set createForm(v: typeof createForm) { createForm = v; },

	// Filters
	get searchQuery() { return searchQuery; },
	set searchQuery(v: string) { searchQuery = v; },
	get filterPriority() { return filterPriority; },
	set filterPriority(v: number | 'all') { filterPriority = v; },
	get filterType() { return filterType; },
	set filterType(v: string) { filterType = v; },
	get filterTime() { return filterTime; },
	set filterTime(v: string) { filterTime = v; },
	get isFilterPreviewing() { return isFilterPreviewing; },
	set isFilterPreviewing(v: boolean) { isFilterPreviewing = v; },
	get hasActiveFilters() { return hasActiveFilters; },
	get filteredIssues() { return filteredIssues; },

	// Loading state
	get loadingStatus() { return loadingStatus; },
	get initialLoaded() { return initialLoaded; },
	get animatingIds() { return animatingIds; },

	// Detail panel
	get comments() { return comments; },
	get newComment() { return newComment; },
	set newComment(v: string) { newComment = v; },
	get loadingComments() { return loadingComments; },
	get attachments() { return attachments; },
	set attachments(v: Attachment[]) { attachments = v; },
	get loadingAttachments() { return loadingAttachments; },
	get newLabelInput() { return newLabelInput; },
	set newLabelInput(v: string) { newLabelInput = v; },
	get issueClosedExternally() { return issueClosedExternally; },
	set issueClosedExternally(v: boolean) { issueClosedExternally = v; },
	get panelOpen() { return panelOpen; },

	// Settings
	get isDarkMode() { return isDarkMode; },
	set isDarkMode(v: boolean) { isDarkMode = v; },
	get colorScheme() { return colorScheme; },
	set colorScheme(v: string) { colorScheme = v; },
	get notificationsEnabled() { return notificationsEnabled; },
	get tickerRange() { return tickerRange; },
	set tickerRange(v: number) { tickerRange = v; },
	get agentEnabled() { return agentEnabled; },
	set agentEnabled(v: boolean) { agentEnabled = v; },
	get agentHost() { return agentHost; },
	set agentHost(v: string) { agentHost = v; },
	get agentPort() { return agentPort; },
	set agentPort(v: number) { agentPort = v; },

	// Project state
	get projects() { return projects; },
	get projectName() { return projectName; },
	get currentProjectPath() { return currentProjectPath; },
	get projectColor() { return projectColor; },
	get projectTransition() { return projectTransition; },
};

// Export functions
export {
	connectSSE,
	disconnectSSE,
	updateIssue,
	deleteIssue,
	createIssue,
	openCreatePanel,
	openEditPanel,
	closePanel,
	hasUnsavedCreate,
	loadComments,
	addComment,
	loadAttachments,
	addLabelToEditing,
	removeLabelFromEditing,
	setEditingColumn,
	createDependency,
	removeDependency,
	loadSettings,
	saveSettings,
	toggleNotifications,
	loadProjects,
	switchProject,
	issueMatchesFilters,
	sendNotification
};
