import { browser } from '$app/environment';
import { pushState as svelteKitPushState } from '$app/navigation';
import { fetchMutations } from '$lib/mutationStore.svelte';
import { appendProjectParam } from '$lib/project';
import type { Issue, Comment, Attachment } from '$lib/types';
import { getIssueColumn, columns, getColumnMoveUpdates } from '$lib/utils';
import {
	loadComments as loadCommentsApi,
	loadAttachmentsApi,
	uploadAttachmentApi,
	deleteAttachmentApi
} from '$lib/api';
import { formatTicketDelivery as formatTicketDeliveryFn } from '$lib/agent/ticket-delivery';
import type { TicketDeliveryData } from '$lib/agent/ticket-delivery';
import { toastQueue } from '$lib/notifications/toast-queue.svelte';
import { settings } from '$lib/stores/settings.svelte';
import type { IssueStore } from '$lib/stores/issue-store.svelte';
import { notifyAgentOfTicketUpdate, addPane, getRunningSessionsForCwd, startSession, type Pane, type AgentSession } from '$lib/wsStore.svelte';
import { updateSession, addSystemMessage, setSessionError, getSessions, setSessions } from '$lib/stores/agent-sessions.svelte';
import { createWorktreeApi } from '$lib/stores/worktree-api';

export interface PageOpsContext {
	issueStore: IssueStore;
	getIssues: () => Issue[];
	getWsPanes: () => Map<string, Pane>;
	getCurrentProjectPath: () => string;
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
	let copiedId = $state<string | null>(null);
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
	let agentQueue = $state<AgentQueueItem[]>([]);
	let isStartingQueuedAgent = $state(false);

	// --- Helpers ---

	function getIssueTitle(id: string): string {
		return ctx.getIssues().find(i => i.id === id)?.title ?? id;
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
		notifyAgentOfTicketUpdate(ticketId, content, notificationType, context, settings.agentTicketNotification);
	}

	function enqueueAgentStart(entry: AgentQueueItem) {
		agentQueue = [...agentQueue, entry];
		toastQueue.show({
			type: 'info',
			title: 'Agent queued',
			message: `${entry.ticketId} will start when active agents finish.`,
			duration: 4000
		});
		void maybeStartQueuedAgent();
	}

	async function startQueuedAgent(entry: AgentQueueItem): Promise<boolean> {
		const currentIssue = ctx.getIssues().find(i => i.id === entry.ticketId) ?? entry.issueSnapshot;
		if (!currentIssue) {
			toastQueue.show({
				type: 'warning',
				title: 'Queue skipped',
				message: `${entry.ticketId} no longer exists.`,
				duration: 4000
			});
			return false;
		}

		let issueComments: Comment[] = [];
		let issueAttachments: Attachment[] = [];
		try {
			[issueComments, issueAttachments] = await Promise.all([
				loadCommentsApi(currentIssue.id),
				loadAttachmentsApi(currentIssue.id)
			]);
		} catch (err: any) {
			toastQueue.show({
				type: 'error',
				title: 'Queue failed',
				message: err?.message ?? `Failed to load context for ${entry.ticketId}.`,
				duration: 5000
			});
			return false;
		}

		const briefing = formatTicketDelivery(entry.agentName, { issue: currentIssue, comments: issueComments, attachments: issueAttachments });

		let effectiveCwd = entry.cwd;
		if (entry.useWorktree) {
			try {
				effectiveCwd = await createWorktreeApi(entry.cwd, entry.ticketId);
			} catch (err: any) {
				toastQueue.show({
					type: 'error',
					title: 'Worktree failed',
					message: err?.message ?? 'Failed to create worktree for queued agent.',
					duration: 5000
				});
				return false;
			}
		}

		addPane(entry.agentName, effectiveCwd, briefing, settings.combinedSystemPrompt, undefined, entry.ticketId, settings.agentModel || undefined);
		if (entry.useWorktree) updateSession(entry.agentName, { worktreePath: effectiveCwd });
		expandPane(entry.agentName);
		return true;
	}

	async function maybeStartQueuedAgent() {
		if (isStartingQueuedAgent) return;
		if (agentQueue.length === 0) return;

		const next = agentQueue[0];
		if (getRunningSessionsForCwd(next.cwd).length > 0) return;

		isStartingQueuedAgent = true;
		agentQueue = agentQueue.slice(1);
		try {
			const started = await startQueuedAgent(next);
			if (!started && agentQueue.length > 0) {
				setTimeout(() => { void maybeStartQueuedAgent(); }, 50);
			}
		} finally {
			isStartingQueuedAgent = false;
		}
	}

	function cancelQueueItem(ticketId: string) {
		agentQueue = agentQueue.filter(item => item.ticketId !== ticketId);
		toastQueue.show({
			type: 'info',
			title: 'Agent cancelled',
			message: `${ticketId} removed from queue.`,
			duration: 3000
		});
	}

	function reorderQueue(fromIndex: number, toIndex: number) {
		if (fromIndex === toIndex) return;
		const newQueue = [...agentQueue];
		const [moved] = newQueue.splice(fromIndex, 1);
		newQueue.splice(toIndex, 0, moved);
		agentQueue = newQueue;
		void maybeStartQueuedAgent();
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
		editingIssue = { ...issue, labels: issue.labels ? [...issue.labels] : [] };
		originalLabels = issue.labels ? [...issue.labels] : [];
		const col = getIssueColumn(issue);
		const idx = columns.findIndex(c => c.key === col.key);
		panelColumnIndex = idx >= 0 ? idx : 0;
		ctx.setSelectedId(issue.id);
		comments = [];
		loadComments(issue.id);
		loadAttachments(issue.id);
		if (browser && pushState) {
			const url = new URL(window.location.href);
			url.searchParams.set('issue', issue.id);
			svelteKitPushState(url, { issue: issue.id });
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
		const issue = ctx.getIssues().find(i => i.id === id);
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

	// --- Comments ---

	async function loadComments(issueId: string) {
		loadingComments = true;
		const res = await fetch(appendProjectParam(`/api/issues/${issueId}/comments`));
		const data = await res.json();
		comments = data.comments || [];
		loadingComments = false;
	}

	async function addComment() {
		if (!editingIssue || !newComment.trim()) return;
		const commentText = newComment.trim();
		await fetch(appendProjectParam(`/api/issues/${editingIssue.id}/comments`), {
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
		await loadComments(editingIssue.id);
		fetchMutations();
	}

	// --- Attachments ---

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
			notifyTicket(editingIssue.id, `Attachment added: ${file.name}`, 'attachment', { ticketTitle: editingIssue.title, sender: 'user' });
		}
	}

	async function handleDeleteAttachment(filename: string) {
		if (!editingIssue) return;
		await deleteAttachmentApi(editingIssue.id, filename);
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

		const newId = await ctx.issueStore.createIssueAndGetId(savedForm);
		if (newId) {
			const agentName = `${newId}-agent`;
			const cwd = ctx.getCurrentProjectPath();
			const newIssue: Issue = {
				id: newId,
				title: savedForm.title,
				description: savedForm.description || '',
				status: 'open',
				priority: (savedForm.priority || 2) as Issue["priority"],
				issue_type: savedForm.issue_type || 'task'
			};
			const briefing = formatTicketDelivery(agentName, { issue: newIssue });

			const conflicts = getRunningSessionsForCwd(cwd);
			if (conflicts.length > 0) {
				// Check if user wants to always skip modal
				if (settings.conflictStrategy === 'ask') {
					cwdConflict = { ticketId: newId, agentName, conflicts, cwd, issue: newIssue, briefing };
					return;
				} else {
					// Auto-resolve with configured strategy
					cwdConflict = { ticketId: newId, agentName, conflicts, cwd, issue: newIssue, briefing };
					setTimeout(() => resolveConflict(settings.conflictStrategy), 50);
					return;
				}
			}

			addPane(agentName, cwd, briefing, settings.combinedSystemPrompt, undefined, newId, settings.agentModel || undefined);
			expandPane(agentName);
		}
	}

	async function updateIssue(id: string, updates: Partial<Issue>) {
		await ctx.issueStore.updateIssue(id, updates);
	}

	async function deleteIssue(id: string) {
		const deleted = await ctx.issueStore.deleteIssue(id);
		if (deleted && editingIssue?.id === id) editingIssue = null;
	}

	// --- Agent operations ---

	async function startAgentForIssue(issue: Issue) {
		const agentName = `${issue.id}-agent`;
		const cwd = ctx.getCurrentProjectPath();
		const [issueComments, issueAttachments] = await Promise.all([
			loadCommentsApi(issue.id),
			loadAttachmentsApi(issue.id)
		]);
		const briefing = formatTicketDelivery(agentName, { issue, comments: issueComments, attachments: issueAttachments });

		const conflicts = getRunningSessionsForCwd(cwd);
		if (conflicts.length > 0) {
			// Check if user wants to always skip modal
			if (settings.conflictStrategy === 'ask') {
				cwdConflict = { ticketId: issue.id, agentName, conflicts, cwd, issue, briefing };
				return;
			} else {
				// Auto-resolve with configured strategy
				cwdConflict = { ticketId: issue.id, agentName, conflicts, cwd, issue, briefing };
				setTimeout(() => resolveConflict(settings.conflictStrategy), 50);
				return;
			}
		}

		addPane(agentName, cwd, briefing, settings.combinedSystemPrompt, undefined, issue.id, settings.agentModel || undefined);
		expandPane(agentName);
		editingIssue = null;
		isCreating = false;
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
				startSession(agentName, effectiveCwd, briefing, settings.combinedSystemPrompt, undefined, ticketId);
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
		const issue = ctx.getIssues().find(i => i.id === ticketId);
		if (issue) {
			editingIssue = issue;
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
		copiedId = id ?? text;
		setTimeout(() => copiedId = null, 1500);
	}

	// --- Rope drag (dependency drawing) ---

	function handleMouseMove(e: MouseEvent) {
		if (ropeDrag) {
			ropeDrag = { ...ropeDrag, currentX: e.clientX, currentY: e.clientY };
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
		const { createDependencyApi } = await import('$lib/api');
		await createDependencyApi(fromId, toId, depType);
		notifyTicket(fromId, `Dependency added: ${depType} → ${toId}`, 'dependency', { ticketTitle: getIssueTitle(fromId), sender: 'user' });
		notifyTicket(toId, `Dependency added: ${fromId} ${depType} this`, 'dependency', { ticketTitle: getIssueTitle(toId), sender: 'user' });
		closeContextMenu();
	}

	function cancelDependency() {
		pendingDep = null;
	}

	async function createDependency(fromId: string, toId: string) {
		const res = await fetch(appendProjectParam(`/api/issues/${fromId}/deps`), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ depends_on: toId, dep_type: 'blocks' })
		});
		const data = await res.json();
		if (!res.ok) {
			console.error('Failed to create dependency:', data.error);
			return;
		}
		notifyTicket(fromId, `Dependency added: blocks → ${toId}`, 'dependency', { ticketTitle: getIssueTitle(fromId), sender: 'user' });
		notifyTicket(toId, `Dependency added: ${fromId} blocks this`, 'dependency', { ticketTitle: getIssueTitle(toId), sender: 'user' });
		closeContextMenu();
	}

	async function removeDependency(issueId: string, dependsOnId: string) {
		const res = await fetch(appendProjectParam(`/api/issues/${issueId}/deps`), {
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
		notifyTicket(issueId, `Dependency removed: → ${dependsOnId}`, 'dependency', { ticketTitle: getIssueTitle(issueId), sender: 'user' });
		notifyTicket(dependsOnId, `Dependency removed: ${issueId} no longer blocks`, 'dependency', { ticketTitle: getIssueTitle(dependsOnId), sender: 'user' });
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
		get copiedId() { return copiedId; },
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
		get agentQueue() { return agentQueue; },
		get panelOpen() { return editingIssue !== null || isCreating; },

		// Functions
		openEditPanel,
		closePanel,
		openCreatePanel,
		hasUnsavedCreate,
		setEditingColumn,
		addLabelToEditing,
		removeLabelFromEditing,
		loadComments,
		addComment,
		loadAttachments,
		handleUploadAttachment,
		handleDeleteAttachment,
		createIssue,
		createIssueAndStartAgent,
		startAgentForIssue,
		resolveConflict,
		maybeStartQueuedAgent,
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
