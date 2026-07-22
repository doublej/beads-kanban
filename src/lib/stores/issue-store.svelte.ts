import type { Issue, LoadingStatus } from '$lib/types';
import { fetchMutations } from '$lib/mutationStore.svelte';
import { appendProjectParam } from '$lib/project';

/**
 * Backstop poll interval. bd's Dolt backend flushes .beads/issues.jsonl on a delayed,
 * coalesced cadence (several seconds), so the server's fs.watch — which drives
 * external-write events — lags well behind the actual change. Polling refreshIssues()
 * keeps the board live regardless of that cadence. Matches the pre-SSE poll rate.
 */
const POLL_INTERVAL_MS = 2000;

export interface IssueStoreCallbacks {
	onNewIssue: (issue: Issue) => void;
	onStatusChange: (issue: Issue, oldStatus: string) => void;
	getCardPosition: (id: string) => { x: number; y: number; w: number; h: number } | null;
	getPlaceholderPosition: (id: string) => { x: number; y: number; w: number; h: number } | null;
	measureTargetPosition: (targetColumn: string, height: number) => { x: number; y: number; w: number; h: number } | null;
	addPlaceholder: (id: string, targetColumn: string, height: number) => void;
	addFlyingCard: (id: string, from: { x: number; y: number; w: number; h: number }, to: { x: number; y: number; w: number; h: number }, issue: Issue) => void;
	addTeleport: (id: string, from: { x: number; y: number; w: number; h: number }, to: { x: number; y: number; w: number; h: number }) => void;
	addShrinkingSource: (id: string) => void;
	cleanupAnimation: (id: string) => void;
	notifyTicket: (id: string, message: string, type: 'status' | 'priority' | 'assignee', context: { ticketTitle: string; sender: string }) => void;
	onEditingIssueClosedExternally: () => void;
	getEditingIssue: () => Issue | null;
	getIsCreating: () => boolean;
}

export function createIssueStore(callbacks: IssueStoreCallbacks, initialIssues: Issue[] = []) {
	// SSR can seed the board so it paints filled on first load. When seeded, mark it
	// ready (InitialLoader won't flash) and prime lastSnapshotHash below so the first
	// live refresh doesn't re-animate every card.
	const seeded = initialIssues.length > 0;
	let issues = $state<Issue[]>(initialIssues);
	let pendingUpdates = $state<Map<string, { updates: Partial<Issue>; timestamp: number }>>(new Map());
	let pendingDeletes = $state<Set<string>>(new Set());
	let animatingIds = $state<Set<string>>(new Set());
	let loadingStatus = $state<LoadingStatus>({
		phase: seeded ? 'ready' : 'disconnected',
		pollCount: 0,
		lastUpdate: null,
		issueCount: initialIssues.length,
		hasChanges: false,
		errorMessage: null
	});
	let initialLoaded = $state(seeded);
	let sseSource = $state<EventSource | null>(null);
	let pollTimer: ReturnType<typeof setInterval> | null = null;

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
		const statusChanges: { id: string; newStatus: string }[] = [];

		for (const issue of data.issues) {
			const oldIssue = oldIssuesMap.get(issue.id);
			if (!oldIssue) {
				callbacks.onNewIssue(issue);
			} else if (oldIssue.status !== issue.status) {
				statusChanges.push({ id: issue.id, newStatus: issue.status });
				callbacks.onStatusChange(issue, oldIssue.status);
			}
		}

		if (statusChanges.length === 0) {
			issues = mergeWithPendingUpdates(data.issues);
			return;
		}

		// PRE-FLIGHT: Measure positions before any DOM changes
		const measurements = statusChanges.map(({ id, newStatus }) => {
			const fromPos = callbacks.getCardPosition(id);
			const cardEl = document.querySelector(`[data-card-id="${id}"]`);
			const height = cardEl?.getBoundingClientRect().height ?? 80;
			const toPos = callbacks.measureTargetPosition(newStatus, height);
			return { id, fromPos, toPos, newStatus, height };
		});

		// START ANIMATIONS: Source shrink + target expand
		for (const { id, newStatus, height } of measurements) {
			callbacks.addShrinkingSource(id);
			callbacks.addPlaceholder(id, newStatus, height);
		}

		// Update state immediately (cards will shrink, not hide)
		issues = mergeWithPendingUpdates(data.issues);

		// FLYING CARD: Delay 150ms for visual overlap
		setTimeout(() => {
			for (const { id, fromPos, toPos } of measurements) {
				if (toPos && fromPos) {
					const issue = issues.find(i => i.id === id);
					callbacks.addFlyingCard(id, fromPos, toPos, issue!);
					callbacks.addTeleport(id, fromPos, toPos);
				}
			}
		}, 150);

		// CLEANUP: Remove all animation artifacts
		setTimeout(() => {
			for (const { id } of measurements) {
				callbacks.cleanupAnimation(id);
			}
		}, 750);
	}

	function checkEditingIssueClosed(data: { issues: Issue[] }) {
		const editing = callbacks.getEditingIssue();
		if (!editing || callbacks.getIsCreating()) return;

		const updated = data.issues.find((i: Issue) => i.id === editing.id);
		if (updated && updated.status === 'closed' && editing.status !== 'closed') {
			callbacks.onEditingIssueClosedExternally();
		}
	}

	let pollCount = 0;

	function snapshotHash(items: Issue[]): string {
		return items.map((i) => `${i.id}:${i.updated_at ?? ''}:${i.status}`).join('|');
	}

	// Primed from SSR-seeded issues so the first live refresh diffs against what's
	// already on screen instead of re-animating every card.
	let lastSnapshotHash = snapshotHash(initialIssues);

	async function refreshIssues() {
		try {
			if (!initialLoaded && loadingStatus.phase !== 'loading') {
				loadingStatus = { ...loadingStatus, phase: 'loading' };
			}
			const res = await fetch(appendProjectParam('/api/issues'));
			const payload = await res.json();
			if (!payload?.ok) {
				loadingStatus = { ...loadingStatus, phase: 'error', errorMessage: payload?.error?.message ?? 'Load failed' };
				return;
			}
			const data = { issues: payload.data?.issues ?? [] };
			pollCount += 1;

			const hash = snapshotHash(data.issues);
			const hasChanges = hash !== lastSnapshotHash;
			lastSnapshotHash = hash;

			loadingStatus = {
				...loadingStatus,
				phase: 'ready',
				pollCount,
				lastUpdate: Date.now(),
				issueCount: data.issues.length,
				hasChanges,
				errorMessage: null,
			};
			if (!initialLoaded) {
				initialLoaded = true;
			}
			if (!hasChanges) return;

			const oldIssuesMap = new Map(issues.map((i) => [i.id, i]));
			checkEditingIssueClosed(data);
			handleStatusChanges(data, oldIssuesMap);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			loadingStatus = { ...loadingStatus, phase: 'error', errorMessage: msg };
		}
	}

	function connectSSE(): EventSource {
		if (!initialLoaded) {
			loadingStatus = { ...loadingStatus, phase: 'connecting' };
		}
		const eventSource = new EventSource(appendProjectParam('/api/events/stream'));
		sseSource = eventSource;

		// Initial snapshot fires on open; subsequent refreshes triggered by events.
		// Skip the immediate fetch when SSR already seeded the board — the backstop
		// poll and SSE events keep it live. Net: zero client-side exports on cold load.
		if (!initialLoaded) void refreshIssues();

		// Backstop poll (de-duped via snapshotHash, so no UI churn when nothing changed):
		// SSE events fire instantly for in-app writes but lag several seconds for external
		// (agent/CLI) writes because they hinge on bd's delayed issues.jsonl export.
		if (pollTimer) clearInterval(pollTimer);
		pollTimer = setInterval(() => void refreshIssues(), POLL_INTERVAL_MS);

		eventSource.onmessage = (event) => {
			let msg: { type?: string; name?: string };
			try { msg = JSON.parse(event.data); } catch { return; }
			if (msg.type === 'event') {
				void refreshIssues();
			}
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

		await fetch(appendProjectParam(`/api/issues/${id}`), {
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

		await fetch(appendProjectParam(`/api/issues/${id}`), { method: 'DELETE' });
		fetchMutations();
		return true;
	}

	async function createIssue(form: { title: string; description: string; priority: number; issue_type: string }): Promise<string | null> {
		if (!form.title.trim()) return null;

		const tempId = `temp-${Date.now()}`;
		// Estimate next seq as current max + 1 (will be corrected by SSE)
		const maxSeq = issues.reduce((max, i) => Math.max(max, i.seq ?? 0), 0);
		const tempIssue: Issue = {
			id: tempId,
			seq: maxSeq + 1,
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

		const res = await fetch(appendProjectParam('/api/issues'), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(form)
		});
		const payload = await res.json();
		const id = payload?.ok ? payload.data?.id : null;
		fetchMutations();
		return id ?? null;
	}

	function closeSse() {
		if (pollTimer) {
			clearInterval(pollTimer);
			pollTimer = null;
		}
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
		createIssue
	};
}

export type IssueStore = ReturnType<typeof createIssueStore>;
