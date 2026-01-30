import type { Issue, LoadingStatus } from '$lib/types';
import { fetchMutations } from '$lib/mutationStore.svelte';

export interface IssueStoreCallbacks {
	onNewIssue: (issue: Issue) => void;
	onStatusChange: (issue: Issue, oldStatus: string) => void;
	getCardPosition: (id: string) => { x: number; y: number; w: number; h: number } | null;
	getPlaceholderPosition: (id: string) => { x: number; y: number; w: number; h: number } | null;
	addPlaceholder: (id: string, targetColumn: string, height: number) => void;
	addFlyingCard: (id: string, from: { x: number; y: number; w: number; h: number }, to: { x: number; y: number; w: number; h: number }, issue: Issue) => void;
	addTeleport: (id: string, from: { x: number; y: number; w: number; h: number }, to: { x: number; y: number; w: number; h: number }) => void;
	cleanupAnimation: (id: string) => void;
	notifyTicket: (id: string, message: string, type: 'status' | 'priority' | 'assignee', context: { ticketTitle: string; sender: string }) => void;
	onEditingIssueClosedExternally: () => void;
	getEditingIssue: () => Issue | null;
	getIsCreating: () => boolean;
}

export function createIssueStore(callbacks: IssueStoreCallbacks) {
	let issues = $state<Issue[]>([]);
	let pendingUpdates = $state<Map<string, { updates: Partial<Issue>; timestamp: number }>>(new Map());
	let pendingDeletes = $state<Set<string>>(new Set());
	let animatingIds = $state<Set<string>>(new Set());
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

	function mergeWithPendingUpdates(sseIssues: Issue[]): Issue[] {
		const now = Date.now();
		const PENDING_TIMEOUT = 10000;

		const filtered = sseIssues.filter(issue => !pendingDeletes.has(issue.id));

		// Clean up confirmed deletes
		const sseIds = new Set(sseIssues.map(i => i.id));
		const originalSize = pendingDeletes.size;
		for (const id of pendingDeletes) {
			if (!sseIds.has(id)) pendingDeletes.delete(id);
		}
		if (pendingDeletes.size !== originalSize) {
			pendingDeletes = new Set(pendingDeletes);
		}

		return filtered.map(issue => {
			const pending = pendingUpdates.get(issue.id);
			if (!pending) return issue;

			const record = issue as unknown as Record<string, unknown>;
			const isConfirmed = Object.entries(pending.updates).every(
				([key, value]) => record[key] === value
			);

			if (isConfirmed || now - pending.timestamp > PENDING_TIMEOUT) {
				pendingUpdates.delete(issue.id);
				pendingUpdates = new Map(pendingUpdates);
				return issue;
			}

			return { ...issue, ...pending.updates };
		});
	}

	function handleStatusChanges(data: { issues: Issue[] }, oldIssuesMap: Map<string, Issue>) {
		const statusChanges: { id: string; fromPos: { x: number; y: number; w: number; h: number }; newStatus: string; height: number }[] = [];

		for (const issue of data.issues) {
			const oldIssue = oldIssuesMap.get(issue.id);
			if (!oldIssue) {
				callbacks.onNewIssue(issue);
			} else if (oldIssue.status !== issue.status) {
				const fromPos = callbacks.getCardPosition(issue.id);
				if (fromPos) {
					statusChanges.push({ id: issue.id, fromPos, newStatus: issue.status, height: fromPos.h });
				}
				callbacks.onStatusChange(issue, oldIssue.status);
			}
		}

		if (statusChanges.length === 0) {
			issues = mergeWithPendingUpdates(data.issues);
			return;
		}

		// Create placeholders first
		for (const { id, newStatus, height } of statusChanges) {
			callbacks.addPlaceholder(id, newStatus, height);
		}

		// Wait for placeholder expansion, then animate
		setTimeout(() => {
			const targets = statusChanges
				.map(({ id, fromPos }) => ({
					id,
					fromPos,
					toPos: callbacks.getPlaceholderPosition(id),
					issue: oldIssuesMap.get(id)
				}))
				.filter(t => t.toPos !== null && t.issue);

			for (const { id, fromPos, toPos, issue } of targets) {
				callbacks.addFlyingCard(id, fromPos, toPos!, issue!);
			}

			issues = mergeWithPendingUpdates(data.issues);

			for (const { id, fromPos, toPos } of targets) {
				callbacks.addTeleport(id, fromPos, toPos!);
				setTimeout(() => callbacks.cleanupAnimation(id), 600);
			}
		}, 350);
	}

	function checkEditingIssueClosed(data: { issues: Issue[] }) {
		const editing = callbacks.getEditingIssue();
		if (!editing || callbacks.getIsCreating()) return;

		const updated = data.issues.find((i: Issue) => i.id === editing.id);
		if (updated && updated.status === 'closed' && editing.status !== 'closed') {
			callbacks.onEditingIssueClosedExternally();
		}
	}

	function connectSSE(): EventSource {
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

			const oldIssuesMap = new Map(issues.map(i => [i.id, i]));
			checkEditingIssueClosed(msg);
			handleStatusChanges(msg, oldIssuesMap);
		};

		eventSource.onerror = () => {
			eventSource.close();
			loadingStatus = { ...loadingStatus, phase: 'disconnected' };
			setTimeout(() => connectSSE(), 3000);
		};

		return eventSource;
	}

	function addAnimatingId(id: string) {
		animatingIds = new Set([...animatingIds, id]);
		setTimeout(() => {
			animatingIds = new Set([...animatingIds].filter(x => x !== id));
		}, 600);
	}

	async function updateIssue(id: string, updates: Partial<Issue>) {
		const original = issues.find(i => i.id === id);
		const title = original?.title ?? id;

		// Track pending update
		pendingUpdates.set(id, { updates, timestamp: Date.now() });
		pendingUpdates = new Map(pendingUpdates);

		// Optimistic update
		const idx = issues.findIndex(i => i.id === id);
		if (idx !== -1) {
			const updated = { ...issues[idx], ...updates, updated_at: new Date().toISOString() };
			issues = [...issues.slice(0, idx), updated, ...issues.slice(idx + 1)];
		}
		addAnimatingId(id);

		await fetch(`/api/issues/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(updates)
		});
		fetchMutations();

		// Notify agents about field changes
		const ctx = { ticketTitle: title, sender: 'user' };
		if (updates.status && original?.status !== updates.status) {
			callbacks.notifyTicket(id, `Status changed: ${original?.status} \u2192 ${updates.status}`, 'status', ctx);
		}
		if (updates.priority !== undefined && original?.priority !== updates.priority) {
			callbacks.notifyTicket(id, `Priority changed: ${original?.priority} \u2192 ${updates.priority}`, 'priority', ctx);
		}
		if (updates.assignee !== undefined && original?.assignee !== updates.assignee) {
			callbacks.notifyTicket(id, `Assignee changed: ${original?.assignee || 'unassigned'} \u2192 ${updates.assignee || 'unassigned'}`, 'assignee', ctx);
		}
	}

	async function deleteIssue(id: string): Promise<boolean> {
		if (!confirm('Delete this issue permanently?')) return false;
		addAnimatingId(id);
		pendingDeletes.add(id);
		pendingDeletes = new Set(pendingDeletes);
		issues = issues.filter(i => i.id !== id);

		await fetch(`/api/issues/${id}`, { method: 'DELETE' });
		fetchMutations();
		return true;
	}

	async function createIssue(form: { title: string; description: string; priority: number; issue_type: string }): Promise<void> {
		if (!form.title.trim()) return;

		const tempId = `temp-${Date.now()}`;
		const tempIssue: Issue = {
			id: tempId,
			title: form.title,
			description: form.description,
			status: 'open',
			priority: form.priority as Issue['priority'],
			issue_type: form.issue_type,
			labels: [],
			dependencies: [],
			dependents: [],
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString()
		};
		issues = [tempIssue, ...issues];
		addAnimatingId(tempId);

		const res = await fetch('/api/issues', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(form)
		});
		await res.json();
		fetchMutations();
	}

	async function createIssueAndGetId(form: { title: string; description: string; priority: number; issue_type: string }): Promise<string | null> {
		if (!form.title.trim()) return null;

		const tempId = `temp-${Date.now()}`;
		const tempIssue: Issue = {
			id: tempId,
			title: form.title,
			description: form.description,
			status: 'open',
			priority: form.priority as Issue['priority'],
			issue_type: form.issue_type,
			labels: [],
			dependencies: [],
			dependents: [],
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString()
		};
		issues = [tempIssue, ...issues];
		addAnimatingId(tempId);

		const res = await fetch('/api/issues', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(form)
		});
		const data = await res.json();
		fetchMutations();
		return data.id ?? null;
	}

	function closeSse() {
		if (sseSource) {
			sseSource.close();
			sseSource = null;
		}
	}

	function setIssues(newIssues: Issue[]) {
		issues = newIssues;
	}

	return {
		get issues() { return issues; },
		get animatingIds() { return animatingIds; },
		get loadingStatus() { return loadingStatus; },
		get initialLoaded() { return initialLoaded; },
		get sseSource() { return sseSource; },
		set initialLoaded(v: boolean) { initialLoaded = v; },
		connectSSE,
		closeSse,
		setIssues,
		updateIssue,
		deleteIssue,
		createIssue,
		createIssueAndGetId
	};
}

export type IssueStore = ReturnType<typeof createIssueStore>;
