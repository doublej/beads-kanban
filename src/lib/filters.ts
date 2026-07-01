import type { Issue } from './types';

/** Sentinel assignee token meaning "no assignee". */
export const UNASSIGNED = '@unassigned';

export const ALL_STATUSES = ['open', 'in_progress', 'hooked', 'blocked', 'closed'] as const;

/**
 * Multi-select filter state. Empty arrays mean "no constraint" (match all).
 * `time`/`created`/`due` are single-select ('all' = inactive); `labelMode` picks
 * any-of vs all-of. `excludeLabels` hides issues carrying any listed label.
 */
export interface FilterState {
	search: string;
	statuses: string[];
	priorities: number[];
	types: string[];
	assignees: string[];
	labels: string[];
	labelMode: 'any' | 'all';
	excludeLabels: string[];
	time: string;
	created: string;
	due: string;
	actionable: boolean;
	pinned: boolean;
	deferred: boolean;
	started: boolean;
}

export function emptyFilterState(): FilterState {
	return {
		search: '',
		statuses: [],
		priorities: [],
		types: [],
		assignees: [],
		labels: [],
		labelMode: 'any',
		excludeLabels: [],
		time: 'all',
		created: 'all',
		due: 'all',
		actionable: false,
		pinned: false,
		deferred: false,
		started: false
	};
}

export function isIssueActionable(issue: Issue): boolean {
	if (issue.status === 'blocked') return false;
	if (issue.status === 'in_progress' && issue.assignee) return false;
	const blockingDeps = (issue.dependencies || []).filter(
		d => (d.dependency_type === 'blocks' || d.dependency_type === 'parent-child') && d.status !== 'closed'
	);
	if (blockingDeps.length > 0) return false;
	return true;
}

/** Shared "how recently" bucket matcher for a timestamp (updated/created). */
function matchesRecencyBucket(date: Date, bucket: string): boolean {
	if (bucket === 'all') return true;
	const now = new Date();
	const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
	switch (bucket) {
		case '1h': return diffHours <= 1;
		case '24h': return diffHours <= 24;
		case 'today': {
			const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
			return date >= startOfDay;
		}
		case 'week': {
			const startOfWeek = new Date(now);
			startOfWeek.setDate(now.getDate() - now.getDay());
			startOfWeek.setHours(0, 0, 0, 0);
			return date >= startOfWeek;
		}
		default: return true;
	}
}

export function issueMatchesTimeFilter(issue: Issue, filterTime: string): boolean {
	if (filterTime === 'all') return true;
	const updated = issue.updated_at ? new Date(issue.updated_at) : issue.created_at ? new Date(issue.created_at) : new Date();
	return matchesRecencyBucket(updated, filterTime);
}

export function issueMatchesCreatedFilter(issue: Issue, filterCreated: string): boolean {
	if (filterCreated === 'all') return true;
	if (!issue.created_at) return false;
	return matchesRecencyBucket(new Date(issue.created_at), filterCreated);
}

/**
 * Due-date bucket matcher. Any bucket other than 'all' requires `due_at` to be set,
 * so it doubles as a "has a due date" gate. 'overdue' excludes already-closed issues.
 */
export function issueMatchesDueFilter(issue: Issue, filterDue: string): boolean {
	if (filterDue === 'all') return true;
	if (!issue.due_at) return false;
	if (filterDue === 'has') return true;
	const now = new Date();
	const due = new Date(issue.due_at);
	switch (filterDue) {
		case 'overdue': return due < now && issue.status !== 'closed';
		case 'today': {
			const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
			const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
			return due >= startOfDay && due <= endOfDay;
		}
		case 'week': {
			const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
			const in7 = new Date(now);
			in7.setDate(now.getDate() + 7);
			return due >= startOfDay && due <= in7;
		}
		default: return true;
	}
}

/** True when the issue is deferred to a future time (defer_until in the future). */
export function isIssueDeferred(issue: Issue): boolean {
	if (!issue.defer_until) return false;
	return new Date(issue.defer_until) > new Date();
}

export function issueMatchesFilters(issue: Issue, f: FilterState): boolean {
	const query = f.search.trim().toLowerCase();
	const matchesSearch = !query ||
		issue.id.toLowerCase().includes(query) ||
		issue.title.toLowerCase().includes(query) ||
		(issue.description || '').toLowerCase().includes(query);

	const matchesStatus = f.statuses.length === 0 || f.statuses.includes(issue.status);
	const matchesPriority = f.priorities.length === 0 || f.priorities.includes(issue.priority);
	const matchesType = f.types.length === 0 || f.types.includes(issue.issue_type);

	const matchesAssignee = f.assignees.length === 0 || f.assignees.some(a =>
		a === UNASSIGNED ? !issue.assignee : issue.assignee === a
	);

	const issueLabels = issue.labels || [];
	const matchesLabel = f.labels.length === 0 || (
		f.labelMode === 'all'
			? f.labels.every(l => issueLabels.includes(l))
			: f.labels.some(l => issueLabels.includes(l))
	);
	const matchesExcludeLabel = f.excludeLabels.length === 0 || !f.excludeLabels.some(l => issueLabels.includes(l));

	const matchesTime = issueMatchesTimeFilter(issue, f.time);
	const matchesCreated = issueMatchesCreatedFilter(issue, f.created);
	const matchesDue = issueMatchesDueFilter(issue, f.due);
	const matchesActionable = !f.actionable || isIssueActionable(issue);
	const matchesPinned = !f.pinned || !!issue.pinned;
	const matchesDeferred = !f.deferred || isIssueDeferred(issue);
	const matchesStarted = !f.started || !!issue.started_at;

	return matchesSearch && matchesStatus && matchesPriority && matchesType &&
		matchesAssignee && matchesLabel && matchesExcludeLabel && matchesTime &&
		matchesCreated && matchesDue && matchesActionable && matchesPinned &&
		matchesDeferred && matchesStarted;
}

export function hasActiveFilters(f: FilterState): boolean {
	return f.search.trim() !== '' || f.statuses.length > 0 || f.priorities.length > 0 ||
		f.types.length > 0 || f.assignees.length > 0 || f.labels.length > 0 ||
		f.excludeLabels.length > 0 || f.time !== 'all' || f.created !== 'all' ||
		f.due !== 'all' || f.actionable || f.pinned || f.deferred || f.started;
}

/** Count of active filter dimensions, for badges. */
export function countActiveFilters(f: FilterState): number {
	return (f.search.trim() !== '' ? 1 : 0) +
		(f.statuses.length > 0 ? 1 : 0) +
		(f.priorities.length > 0 ? 1 : 0) +
		(f.types.length > 0 ? 1 : 0) +
		(f.assignees.length > 0 ? 1 : 0) +
		(f.labels.length > 0 ? 1 : 0) +
		(f.excludeLabels.length > 0 ? 1 : 0) +
		(f.time !== 'all' ? 1 : 0) +
		(f.created !== 'all' ? 1 : 0) +
		(f.due !== 'all' ? 1 : 0) +
		(f.actionable ? 1 : 0) +
		(f.pinned ? 1 : 0) +
		(f.deferred ? 1 : 0) +
		(f.started ? 1 : 0);
}

/**
 * Coerce a (possibly legacy v1) recipe filters object into the current v2 shape.
 * v1 used single-value fields (searchQuery/filterStatus/filterPriority/…) with
 * an 'all' sentinel and a '!status' negation for status.
 */
export function normalizeFilterState(raw: unknown): FilterState {
	const base = emptyFilterState();
	if (!raw || typeof raw !== 'object') return base;
	const r = raw as Record<string, unknown>;

	// Already v2? (arrays are copied so the result is a safe clone)
	if (Array.isArray(r.statuses) || Array.isArray(r.priorities) || 'labelMode' in r) {
		return {
			search: typeof r.search === 'string' ? r.search : '',
			statuses: Array.isArray(r.statuses) ? [...(r.statuses as string[])] : [],
			priorities: Array.isArray(r.priorities) ? [...(r.priorities as number[])] : [],
			types: Array.isArray(r.types) ? [...(r.types as string[])] : [],
			assignees: Array.isArray(r.assignees) ? [...(r.assignees as string[])] : [],
			labels: Array.isArray(r.labels) ? [...(r.labels as string[])] : [],
			labelMode: r.labelMode === 'all' ? 'all' : 'any',
			excludeLabels: Array.isArray(r.excludeLabels) ? [...(r.excludeLabels as string[])] : [],
			time: typeof r.time === 'string' ? r.time : 'all',
			created: typeof r.created === 'string' ? r.created : 'all',
			due: typeof r.due === 'string' ? r.due : 'all',
			actionable: !!r.actionable,
			pinned: !!r.pinned,
			deferred: !!r.deferred,
			started: !!r.started
		};
	}

	// Legacy v1
	base.search = typeof r.searchQuery === 'string' ? r.searchQuery : '';
	if (r.filterPriority !== undefined && r.filterPriority !== 'all') base.priorities = [Number(r.filterPriority)];
	if (typeof r.filterType === 'string' && r.filterType !== 'all') base.types = [r.filterType];
	if (typeof r.filterLabel === 'string' && r.filterLabel !== 'all') base.labels = [r.filterLabel];
	base.time = typeof r.filterTime === 'string' ? r.filterTime : 'all';
	base.actionable = !!r.filterActionable;
	const fs = r.filterStatus;
	if (typeof fs === 'string' && fs !== 'all') {
		if (fs.startsWith('!')) {
			const excluded = fs.slice(1);
			base.statuses = ALL_STATUSES.filter(s => s !== excluded);
		} else {
			base.statuses = [fs];
		}
	}
	return base;
}
