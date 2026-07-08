import { browser } from '$app/environment';
import { pushState as svelteKitPushState } from '$app/navigation';
import { fetchMutations } from '$lib/mutationStore.svelte';
import { issueKey, type Issue, type Comment, type Attachment } from '$lib/types';
import { getIssueColumn, columns, getColumnMoveUpdates } from '$lib/utils';
import { formatTicketDelivery as formatTicketDeliveryFn } from '$lib/agent/ticket-delivery';
import type { TicketDeliveryData } from '$lib/agent/ticket-delivery';
import { toastQueue } from '$lib/notifications/toast-queue.svelte';
import { settings } from '$lib/stores/settings.svelte';
import { copyState } from '$lib/stores/copy-state.svelte';
import type { IssueStore } from '$lib/stores/issue-store.svelte';
import { notifyAgentOfTicketUpdate, notifyManagerOfTicketUpdate, addPane, getRunningSessionsForCwd, startSession, type Pane, type AgentSession } from '$lib/wsStore.svelte';
import { updateSession, addSystemMessage, setSessionError, getSessions, setSessions } from '$lib/stores/agent-sessions.svelte';
import { createWorktreeApi } from '$lib/stores/worktree-api';
import {
	getQueueItems,
	enqueueTicket as serverEnqueueTicket,
	cancelQueueItem as serverCancelQueueItem,
	reorderQueue as serverReorderQueue,
} from '$lib/stores/queue.svelte';

export interface PageOpsContext {
	issueStore: IssueStore;
	getIssues: () => Issue[];
	getWsPanes: () => Map<string, Pane>;
	getCurrentProjectPath: () => string;
	setActiveProjectPath?: (path: string) => void;
	getSelectedId: () => string | null;
	setSelectedId: (id: string | null) => void;
	getExpandedPanes: () => Set<string>;
	setExpandedPanes: (v: Set<string>) => void;
}

type AgentQueueItem = {
	ticketId: string;
	agentName: string;
	cwd: string;
	issueSnapshot: Issue;
	useWorktree: boolean;
};

export function createPageOps(ctx: PageOpsContext) {
	let editingIssue = $state<Issue | null>(null);
	let originalLabels = $state<string[]>([]);
	let panelColumnIndex = $state<number | null>(null);
	let isCreating = $state(false);
	let createForm = $state({ title: '', description: '', priority: 2, issue_type: 'task', deps: [] as string[] });
	let comments = $state<Comment[]>([]);
	let newComment = $state('');
	let loadingComments = $state(false);
	let attachments = $state<Attachment[]>([]);
	let loadingAttachments = $state(false);
	let newLabelInput = $state('');

	let issueClosedExternally = $state(false);
	let ropeDrag = $state<{ fromId: string; startX: number; startY: number; currentX: number; currentY: number; targetId: string | null } | null>(null);
	let pendingDep = $state<{ fromId: string; toId: string } | null>(null);
	let contextMenu = $state<{ x: number; y: number; issue: Issue } | null>(null);
	let sortMenuOpen = $state<string | null>(null);
	let cwdConflict = $state<{
		ticketId: string;
		agentName: string;
		conflicts: string[];
		cwd: string;
		issue: Issue;
		briefing: string;
	} | null>(null);

	// --- Helpers ---

	function getIssueByKey(key: string): Issue | undefined {
		return ctx.getIssues().find((issue) => issue.key === key);
	}

	function getIssueByIdentity(idOrKey: string): Issue | undefined {
		return getIssueByKey(idOrKey)
			?? ctx.getIssues().find((issue) => issue.id === idOrKey && issue.projectPath === ctx.getCurrentProjectPath());
	}

	function getIssueTitle(id: string): string {
		return ctx.getIssues().find((issue) => issue.id === id && issue.projectPath === ctx.getCurrentProjectPath())?.title ?? id;
	}

	function appendProjectPath(url: string, path: string): string {
		const separator = url.includes('?') ? '&' : '?';
		return `${url}${separator}project=${encodeURIComponent(path)}`;
	}

	function getEffectiveModel(issue: Issue): string | undefined {
		return issue.agent_model || settings.agentModel || undefined;
	}

	function formatTicketDelivery(agentName: string, data: TicketDeliveryData): string {
		return formatTicketDeliveryFn(agentName, data, settings.agentTicketDelivery);
	}

	function expandPane(agentName: string) {
		const expanded = ctx.getExpandedPanes();
		expanded.add(agentName);
		ctx.setExpandedPanes(new Set(expanded));
	}

	function getWorktreeRelPath(fullPath: string): string {
		return fullPath.split('/').slice(-2).join('/');
	}

	function createPlaceholderSession(agentName: string, cwd: string, ticketId: string) {
		const sessions = getSessions();
		sessions.set(agentName, {
			id: crypto.randomUUID(),
			name: agentName,
			cwd,
			streaming: false,
			messages: [],
			currentDelta: '',
			pane_type: 'agent',
			backend: 'claude',
			ticketId
		});
		setSessions(new Map(sessions));
	}

	function notifyTicket(
		ticketId: string,
		content: string,
		notificationType: 'comment' | 'dependency' | 'attachment' | 'status' | 'priority' | 'assignee' | 'label',
		context?: { ticketTitle?: string; sender?: string }
	) {
		const deliveredToWorker = notifyAgentOfTicketUpdate(ticketId, content, notificationType, context, settings.agentTicketNotification);
		const isClose = notificationType === 'status' && content.includes('closed');
		if (!deliveredToWorker || isClose) {
			notifyManagerOfTicketUpdate(ctx.getCurrentProjectPath(), ticketId, content, notificationType, context, settings.agentTicketNotification);
		}
	}

	function enqueueAgentStart(entry: AgentQueueItem) {
		serverEnqueueTicket({
			ticketId: entry.ticketId,
			agentName: entry.agentName,
			cwd: entry.cwd,
			title: entry.issueSnapshot.title,
			description: entry.issueSnapshot.description || '',
			priority: entry.issueSnapshot.priority ?? 2,
			issueType: entry.issueSnapshot.issue_type || 'task',
			useWorktree: entry.useWorktree,
			enqueuedAt: new Date().toISOString(),
		});
		toastQueue.show({
			type: 'info',
			title: 'Agent queued',
			message: `${entry.ticketId} will start when active agents finish.`,
			duration: 4000
		});
	}

	function cancelQueueItem(ticketId: string) {
		serverCancelQueueItem(ticketId);
		toastQueue.show({
			type: 'info',
			title: 'Agent cancelled',
			message: `${ticketId} removed from queue.`,
			duration: 3000
		});
	}

	function reorderQueue(fromIndex: number, toIndex: number) {
		if (fromIndex === toIndex) return;
		serverReorderQueue(fromIndex, toIndex);
	}

	// --- Panel operations ---

	function hasUnsavedCreate(): boolean {
		return isCreating && (createForm.title.trim() !== '' || createForm.description.trim() !== '');
	}

	function openEditPanel(issue: Issue, pushState = true) {
		if (hasUnsavedCreate()) {
			if (!confirm('You have unsaved changes. Discard them?')) return;
		}
		isCreating = false;
		createForm = { title: '', description: '', priority: 2, issue_type: 'task', deps: [] };
		if (issue.projectPath) ctx.setActiveProjectPath?.(issue.projectPath);
		editingIssue = { ...issue, labels: issue.labels ? [...issue.labels] : [] };
		originalLabels = issue.labels ? [...issue.labels] : [];
		const col = getIssueColumn(issue);
		const idx = columns.findIndex(c => c.key === col.key);
		panelColumnIndex = idx >= 0 ? idx : 0;
		ctx.setSelectedId(issue.key);
		comments = [];
		loadComments(issue.key);
		loadAttachments(issue.key);
		if (browser && pushState) {
			const url = new URL(window.location.href);
			url.searchParams.set('issue', issue.key);
			svelteKitPushState(url, { issue: issue.key });
		}
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
			svelteKitPushState(url, {});
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

	function setEditingColumn(columnKey: string) {
		if (!editingIssue) return;
		const updates = getColumnMoveUpdates(editingIssue, columnKey);
		if (updates.status) editingIssue.status = updates.status;
	}

	function openIssueById(id: string, pushState = true) {
		const issue = getIssueByIdentity(id);
		if (issue) {
			openEditPanel(issue, pushState);
			return;
		}
		// Issue not found in current project — clean up URL and notify user
		if (browser) {
			const url = new URL(window.location.href);
			if (url.searchParams.has('issue')) {
				url.searchParams.delete('issue');
				svelteKitPushState(url.pathname + url.search, {});
			}
			toastQueue.show({ type: 'warning', title: 'Issue not found', message: `Issue ${id} not found in this project`, duration: 4000 });
		}
	}

	function handlePopState(e: PopStateEvent) {
		const issueId = e.state?.issue || new URL(window.location.href).searchParams.get('issue');
		if (issueId) openIssueById(issueId, false);
		else closePanel(false);
	}

	// --- Labels ---

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

	// --- Operational state (bd set-state) ---

	/** Set a `dimension:value` operational state on the open issue (immediate write + event bead). */
	async function setIssueState(dimension: string, value: string, reason?: string) {
		if (!editingIssue) return;
		const id = editingIssue.id;
		// Optimistic: replace any existing label for this dimension with the new value.
		const others = (editingIssue.labels || []).filter(l => !l.startsWith(`${dimension}:`));
		editingIssue.labels = [...others, `${dimension}:${value}`];
		await fetch(appendProjectPath(`/api/issues/${id}/state`, editingIssue.projectPath), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ dimension, value, reason })
		});
	}

	/** Promote the open wisp to a permanent bead (bd promote). */
	async function promoteWisp(reason?: string) {
		if (!editingIssue || !editingIssue.ephemeral) return;
		const id = editingIssue.id;
		editingIssue.ephemeral = undefined; // optimistic
		await fetch(appendProjectPath(`/api/issues/${id}/promote`, editingIssue.projectPath), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ reason })
		});
	}

	// --- Comments ---

	async function loadComments(issueId: string) {
		loadingComments = true;
		const issue = getIssueByKey(issueId) || (editingIssue?.key === issueId ? editingIssue : null);
		if (!issue) {
			comments = [];
			loadingComments = false;
			return;
		}
		const res = await fetch(appendProjectPath(`/api/issues/${issue.id}/comments`, issue.projectPath));
		const payload = await res.json();
		comments = payload?.ok ? (payload.data?.comments ?? []) : [];
		loadingComments = false;
	}

	async function addComment() {
		if (!editingIssue || !newComment.trim()) return;
		const commentText = newComment.trim();
		await fetch(appendProjectPath(`/api/issues/${editingIssue.id}/comments`, editingIssue.projectPath), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ text: commentText })
		});
		notifyTicket(
			editingIssue.id,
			`Comment: "${commentText.slice(0, 100)}${commentText.length > 100 ? '...' : ''}"`,
			'comment',
			{ ticketTitle: editingIssue.title, sender: 'user' }
		);
		newComment = '';
		await loadComments(editingIssue.key);
		fetchMutations();
	}

	// --- Attachments ---

	async function loadAttachments(issueId: string) {
		loadingAttachments = true;
		const issue = getIssueByKey(issueId) || (editingIssue?.key === issueId ? editingIssue : null);
		if (!issue) {
			attachments = [];
			loadingAttachments = false;
			return;
		}
		const res = await fetch(appendProjectPath(`/api/issues/${issue.id}/attachments`, issue.projectPath));
		const payload = await res.json();
		attachments = payload?.ok ? (payload.data?.attachments ?? []) : [];
		loadingAttachments = false;
	}

	async function handleUploadAttachment(file: File) {
		if (!editingIssue) return;
		const formData = new FormData();
		formData.append('file', file);
		const res = await fetch(appendProjectPath(`/api/issues/${editingIssue.id}/attachments`, editingIssue.projectPath), {
			method: 'POST',
			body: formData
		});
		const payload = await res.json();
		const attachment = payload?.ok ? (payload.data?.attachment ?? null) : null;
		if (attachment) {
			attachments = [...attachments, attachment];
			notifyTicket(editingIssue.id, `Attachment added: ${file.name}`, 'attachment', { ticketTitle: editingIssue.title, sender: 'user' });
		}
	}

	async function handleDeleteAttachment(filename: string) {
		if (!editingIssue) return;
		await fetch(appendProjectPath(`/api/issues/${editingIssue.id}/attachments/${encodeURIComponent(filename)}`, editingIssue.projectPath), {
			method: 'DELETE'
		});
		attachments = attachments.filter(a => a.filename !== filename);
		notifyTicket(editingIssue.id, `Attachment removed: ${filename}`, 'attachment', { ticketTitle: editingIssue.title, sender: 'user' });
	}

	// --- Issue CRUD (delegating to issueStore) ---

	async function createIssue() {
		if (!createForm.title.trim()) return;
		const form = { title: createForm.title, description: createForm.description, priority: createForm.priority, issue_type: createForm.issue_type };
		createForm = { title: '', description: '', priority: 2, issue_type: 'task', deps: [] };
		isCreating = false;
		await ctx.issueStore.createIssue(form);
	}

	async function createIssueAndStartAgent() {
		if (!createForm.title.trim()) return;
		const savedForm = { title: createForm.title, description: createForm.description, priority: createForm.priority, issue_type: createForm.issue_type };
		createForm = { title: '', description: '', priority: 2, issue_type: 'task', deps: [] };
		isCreating = false;

		const newId = await ctx.issueStore.createIssue(savedForm);
		if (newId) {
			const agentName = `${newId}-agent`;
			const cwd = ctx.getCurrentProjectPath();
			// Estimate seq as max + 1 (will be corrected by SSE)
			const maxSeq = ctx.getIssues().reduce((max, i) => Math.max(max, i.seq ?? 0), 0);
			const newIssue: Issue = {
				id: newId,
				key: issueKey(cwd, newId),
				seq: maxSeq + 1,
				title: savedForm.title,
				description: savedForm.description || '',
				status: 'open',
				priority: (savedForm.priority || 2) as Issue["priority"],
				issue_type: savedForm.issue_type || 'task',
				projectPath: cwd
			};
			const briefing = formatTicketDelivery(agentName, { issue: newIssue });
			launchOrConflict(newId, agentName, cwd, newIssue, briefing);
		}
	}

	async function updateIssue(id: string, updates: Partial<Issue>) {
		await ctx.issueStore.updateIssue(id, updates);
	}

	async function deleteIssue(id: string) {
		const deleted = await ctx.issueStore.deleteIssue(id);
		if (deleted && editingIssue?.key === id) editingIssue = null;
	}

	// --- Agent operations ---

	function launchOrConflict(ticketId: string, agentName: string, cwd: string, issue: Issue, briefing: string): boolean {
		const conflicts = getRunningSessionsForCwd(cwd);
		if (conflicts.length > 0) {
			cwdConflict = { ticketId, agentName, conflicts, cwd, issue, briefing };
			const strategy = settings.conflictStrategy;
			if (strategy !== 'ask') {
				setTimeout(() => resolveConflict(strategy), 50);
			}
			return false;
		}
		addPane(agentName, cwd, briefing, settings.combinedSystemPrompt, undefined, ticketId, getEffectiveModel(issue));
		expandPane(agentName);
		return true;
	}

	async function startAgentForIssue(issue: Issue) {
		const agentName = `${issue.id}-agent`;
		const cwd = ctx.getCurrentProjectPath();
		const [commentsRes, attachmentsRes] = await Promise.all([
			fetch(appendProjectPath(`/api/issues/${issue.id}/comments`, issue.projectPath)),
			fetch(appendProjectPath(`/api/issues/${issue.id}/attachments`, issue.projectPath))
		]);
		const [commentsPayload, attachmentsPayload] = await Promise.all([
			commentsRes.json(),
			attachmentsRes.json()
		]);
		const issueComments = commentsPayload?.ok ? (commentsPayload.data?.comments ?? []) : [];
		const issueAttachments = attachmentsPayload?.ok ? (attachmentsPayload.data?.attachments ?? []) : [];
		const briefing = formatTicketDelivery(agentName, { issue, comments: issueComments, attachments: issueAttachments });

		if (launchOrConflict(issue.id, agentName, cwd, issue, briefing)) {
			editingIssue = null;
			isCreating = false;
		}
	}

	async function resolveConflict(action: 'worktree' | 'queue' | 'same') {
		if (!cwdConflict) return;
		const { agentName, cwd, issue, briefing, ticketId } = cwdConflict;
		cwdConflict = null;

		if (action === 'queue') {
			enqueueAgentStart({
				ticketId,
				agentName,
				cwd,
				issueSnapshot: issue,
				useWorktree: false
			});
			editingIssue = null;
			isCreating = false;
			return;
		}

		// STEP 1: Create empty pane IMMEDIATELY (show UI without starting agent)
		createPlaceholderSession(agentName, cwd, ticketId);
		expandPane(agentName);

		let effectiveCwd = cwd;

		try {
			if (action === 'worktree') {
				addSystemMessage(agentName, 'Creating isolated worktree...', 'worktree_progress');
				effectiveCwd = await createWorktreeApi(cwd, ticketId);
				addSystemMessage(agentName, `Worktree created at .git/${getWorktreeRelPath(effectiveCwd)}`, 'worktree_progress');
			}

			addSystemMessage(agentName, 'Initializing agent...', 'worktree_progress');
			updateSession(agentName, { cwd: effectiveCwd });

			setTimeout(() => {
				startSession(agentName, effectiveCwd, briefing, settings.combinedSystemPrompt, undefined, ticketId, getEffectiveModel(issue));
				if (action === 'worktree') updateSession(agentName, { worktreePath: effectiveCwd });
			}, 100);

		} catch (err: any) {
			setSessionError(agentName, err.message || 'Unknown error during startup');
			console.error(`[agent:${agentName}] startup error:`, err);
		}

		editingIssue = null;
		isCreating = false;
	}

	function dismissConflict() {
		cwdConflict = null;
	}

	function openAgentPane(paneName: string) {
		const wsPanes = ctx.getWsPanes();
		if (wsPanes.has(paneName)) {
			expandPane(paneName);
		}
	}

	function openTicketFromPane(ticketId: string) {
		const issue = ctx.getIssues().find((i) => i.id === ticketId && i.projectPath === ctx.getCurrentProjectPath());
		if (issue) {
			editingIssue = issue;
			ctx.setSelectedId(issue.key);
			isCreating = false;
		}
	}

	function extractTicketIdFromName(name: string): string | undefined {
		if (name.endsWith('-agent')) return name.slice(0, -6);
		return undefined;
	}

	// --- Context menu & priority ---

	function openContextMenu(e: MouseEvent, issue: Issue) {
		e.preventDefault();
		e.stopPropagation();
		contextMenu = { x: e.clientX, y: e.clientY, issue };
	}

	function closeContextMenu() {
		contextMenu = null;
		sortMenuOpen = null;
	}

	async function setIssuePriority(id: string, priority: Issue["priority"]) {
		await updateIssue(id, { priority });
		closeContextMenu();
	}

	// --- Clipboard ---

	async function copyToClipboard(text: string, id?: string) {
		await navigator.clipboard.writeText(text);
		copyState.set(id ?? text);
	}

	// --- Rope drag (dependency drawing) ---

	function handleMouseMove(e: MouseEvent) {
		if (ropeDrag) {
			ropeDrag = { ...ropeDrag, currentX: e.clientX, currentY: e.clientY };
			const elements = document.elementsFromPoint(e.clientX, e.clientY);
			const card = elements.find(el => el.classList.contains('card')) as HTMLElement | null;
			const targetId = card?.dataset.cardId || null;
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

	// --- Dependencies ---

	async function confirmDependency(depType: string) {
		if (!pendingDep) return;
		const { fromId, toId } = pendingDep;
		const fromIssue = getIssueByKey(fromId);
		const toIssue = getIssueByKey(toId);
		if (!fromIssue) return;
		await fetch(appendProjectPath(`/api/issues/${fromIssue.id}/deps`, fromIssue.projectPath), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ depends_on: toIssue?.id ?? toId, dep_type: depType })
		});
		notifyTicket(fromIssue.id, `Dependency added: ${depType} → ${toIssue?.id ?? toId}`, 'dependency', { ticketTitle: getIssueTitle(fromIssue.id), sender: 'user' });
		if (toIssue) notifyTicket(toIssue.id, `Dependency added: ${fromIssue.id} ${depType} this`, 'dependency', { ticketTitle: getIssueTitle(toIssue.id), sender: 'user' });
		closeContextMenu();
	}

	function cancelDependency() {
		pendingDep = null;
	}

	async function createDependency(fromId: string, toId: string) {
		const fromIssue = getIssueByKey(fromId);
		const toIssue = getIssueByKey(toId);
		if (!fromIssue) return;
		const res = await fetch(appendProjectPath(`/api/issues/${fromIssue.id}/deps`, fromIssue.projectPath), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ depends_on: toIssue?.id ?? toId, dep_type: 'blocks' })
		});
		const payload = await res.json();
		if (!res.ok || !payload?.ok) {
			console.error('Failed to create dependency:', payload?.error?.message);
			return;
		}
		notifyTicket(fromIssue.id, `Dependency added: blocks → ${toIssue?.id ?? toId}`, 'dependency', { ticketTitle: getIssueTitle(fromIssue.id), sender: 'user' });
		if (toIssue) notifyTicket(toIssue.id, `Dependency added: ${fromIssue.id} blocks this`, 'dependency', { ticketTitle: getIssueTitle(toIssue.id), sender: 'user' });
		closeContextMenu();
	}

	async function removeDependency(issueId: string, dependsOnId: string) {
		const issue = getIssueByKey(issueId) || (editingIssue?.key === issueId ? editingIssue : null);
		const dependsOnIssue = getIssueByKey(dependsOnId);
		if (!issue) return;
		const res = await fetch(appendProjectPath(`/api/issues/${issue.id}/deps`, issue.projectPath), {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ depends_on: dependsOnIssue?.id ?? dependsOnId })
		});
		const payload = await res.json();
		if (!res.ok || !payload?.ok) {
			console.error('Failed to remove dependency:', payload?.error?.message);
			return;
		}
		if (editingIssue) {
			if (editingIssue.dependencies) {
				editingIssue.dependencies = editingIssue.dependencies.filter(d => d.id !== (dependsOnIssue?.id ?? dependsOnId));
			}
			if (editingIssue.dependents) {
				editingIssue.dependents = editingIssue.dependents.filter(d => d.id !== issue.id);
			}
		}
		notifyTicket(issue.id, `Dependency removed: → ${dependsOnIssue?.id ?? dependsOnId}`, 'dependency', { ticketTitle: getIssueTitle(issue.id), sender: 'user' });
		if (dependsOnIssue) notifyTicket(dependsOnIssue.id, `Dependency removed: ${issue.id} no longer blocks`, 'dependency', { ticketTitle: getIssueTitle(dependsOnIssue.id), sender: 'user' });
	}

	return {
		// State with getters/setters
		get editingIssue() { return editingIssue; },
		set editingIssue(v) { editingIssue = v; },
		get originalLabels() { return originalLabels; },
		get panelColumnIndex() { return panelColumnIndex; },
		set panelColumnIndex(v) { panelColumnIndex = v; },
		get isCreating() { return isCreating; },
		set isCreating(v) { isCreating = v; },
		get createForm() { return createForm; },
		set createForm(v) { createForm = v; },
		get comments() { return comments; },
		set comments(v) { comments = v; },
		get newComment() { return newComment; },
		set newComment(v) { newComment = v; },
		get loadingComments() { return loadingComments; },
		get attachments() { return attachments; },
		get loadingAttachments() { return loadingAttachments; },
		get newLabelInput() { return newLabelInput; },
		set newLabelInput(v) { newLabelInput = v; },
		get copiedId() { return copyState.copiedId; },
		get issueClosedExternally() { return issueClosedExternally; },
		set issueClosedExternally(v) { issueClosedExternally = v; },
		get ropeDrag() { return ropeDrag; },
		set ropeDrag(v) { ropeDrag = v; },
		get pendingDep() { return pendingDep; },
		set pendingDep(v) { pendingDep = v; },
		get contextMenu() { return contextMenu; },
		set contextMenu(v) { contextMenu = v; },
		get sortMenuOpen() { return sortMenuOpen; },
		set sortMenuOpen(v) { sortMenuOpen = v; },
		get cwdConflict() { return cwdConflict; },
		get agentQueue() { return getQueueItems(); },
		get panelOpen() { return editingIssue !== null || isCreating; },

		// Functions
		openEditPanel,
		closePanel,
		openCreatePanel,
		hasUnsavedCreate,
		setEditingColumn,
		addLabelToEditing,
		removeLabelFromEditing,
		setIssueState,
		promoteWisp,
		loadComments,
		addComment,
		loadAttachments,
		handleUploadAttachment,
		handleDeleteAttachment,
		createIssue,
		createIssueAndStartAgent,
		startAgentForIssue,
		resolveConflict,
		cancelQueueItem,
		reorderQueue,
		dismissConflict,
		openAgentPane,
		openTicketFromPane,
		extractTicketIdFromName,
		formatTicketDelivery,
		notifyTicket,
		copyToClipboard,
		openIssueById,
		handlePopState,
		updateIssue,
		deleteIssue,
		setIssuePriority,
		openContextMenu,
		closeContextMenu,
		handleMouseMove,
		handleMouseUp,
		startRopeDrag,
		confirmDependency,
		cancelDependency,
		createDependency,
		removeDependency,
		getIssueTitle,
	};
}

export type PageOps = ReturnType<typeof createPageOps>;
