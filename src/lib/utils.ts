import type { Issue, Column, SortBy, ColumnIconName } from './types';

export type { ColumnIconName };

export const columns: Column[] = [
	{ key: 'open', status: 'open', label: 'Backlog', icon: 'circle', accent: '#6366f1' },
	{ key: 'in_progress', status: 'in_progress', label: 'In Progress', icon: 'circle-dot', accent: '#f59e0b' },
	{ key: 'hooked', status: 'hooked', label: 'Hooked', icon: 'circle-dot', accent: '#8b5cf6' },
	{ key: 'blocked', status: 'blocked', label: 'Blocked', icon: 'circle-slash', accent: '#ef4444' },
	{ key: 'closed', status: 'closed', label: 'Complete', icon: 'check-circle', accent: '#10b981' }
];

export function getIssueColumn(issue: Issue): Column {
	return columns.find(c => c.status === issue.status) || columns[0];
}

export function getColumnMoveUpdates(issue: Issue, targetColumnKey: string): { status?: Issue['status'] } {
	const targetColumn = columns.find(c => c.key === targetColumnKey);
	if (!targetColumn || issue.status === targetColumn.status) return {};
	return { status: targetColumn.status };
}

export function getPriorityConfig(priority: number) {
	const configs: Record<number, { color: string; bg: string; label: string; lightBg: string }> = {
		0: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', label: 'Critical', lightBg: 'rgba(239, 68, 68, 0.08)' },
		1: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', label: 'High', lightBg: 'rgba(245, 158, 11, 0.08)' },
		2: { color: '#6366f1', bg: 'rgba(99, 102, 241, 0.12)', label: 'Medium', lightBg: 'rgba(99, 102, 241, 0.08)' },
		3: { color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', label: 'Low', lightBg: 'rgba(16, 185, 129, 0.08)' },
		4: { color: '#6b7280', bg: 'rgba(107, 114, 128, 0.12)', label: 'Backlog', lightBg: 'rgba(107, 114, 128, 0.08)' }
	};
	return configs[priority] || configs[2];
}

export type DepTypeIconName = 'dep-blocks' | 'dep-related' | 'dep-parent' | 'dep-discovered';

export function getDepTypeConfig(depType: string): { icon: DepTypeIconName; color: string; label: string } {
	const configs: Record<string, { icon: DepTypeIconName; color: string; label: string }> = {
		'blocks': { icon: 'dep-blocks', color: '#ef4444', label: 'Blocks' },
		'related': { icon: 'dep-related', color: '#3b82f6', label: 'Related' },
		'parent-child': { icon: 'dep-parent', color: '#8b5cf6', label: 'Parent' },
		'discovered-from': { icon: 'dep-discovered', color: '#f59e0b', label: 'Found' },
		'replies-to': { icon: 'dep-related', color: '#06b6d4', label: 'Replies' },
		'relates-to': { icon: 'dep-related', color: '#3b82f6', label: 'Relates' },
		'duplicates': { icon: 'dep-related', color: '#9ca3af', label: 'Duplicates' },
		'supersedes': { icon: 'dep-blocks', color: '#f97316', label: 'Supersedes' },
		'tracks': { icon: 'dep-parent', color: '#14b8a6', label: 'Tracks' }
	};
	return configs[depType] || configs['blocks'];
}

export type TypeIconName = 'task' | 'bug' | 'feature' | 'epic' | 'chore';

export function getTypeIcon(type: string): TypeIconName {
	const icons: Record<string, TypeIconName> = {
		task: 'task',
		bug: 'bug',
		feature: 'feature',
		epic: 'epic',
		chore: 'chore'
	};
	return icons[type] || 'task';
}

export function hasOpenBlockers(issue: Issue): boolean {
	if (!issue.dependencies || issue.dependencies.length === 0) return false;
	return issue.dependencies.some(dep => dep.status !== 'closed');
}

export function formatDate(dateStr?: string): string {
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

export function formatTimestamp(dateStr?: string): { relative: string; absolute: string; time: string } {
	if (!dateStr) return { relative: '', absolute: '', time: '' };
	const date = new Date(dateStr);
	const now = new Date();
	const diff = now.getTime() - date.getTime();
	const mins = Math.floor(diff / 60000);
	const hours = Math.floor(mins / 60);
	const days = Math.floor(hours / 24);

	let relative: string;
	if (mins < 1) relative = 'Just now';
	else if (mins < 60) relative = `${mins}m ago`;
	else if (hours < 24) relative = `${hours}h ago`;
	else if (days === 1) relative = 'Yesterday';
	else if (days < 7) relative = `${days}d ago`;
	else if (days < 30) relative = `${Math.floor(days / 7)}w ago`;
	else relative = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

	const absolute = date.toLocaleDateString('en-US', {
		month: 'short', day: 'numeric', year: 'numeric'
	});
	const time = date.toLocaleTimeString('en-US', {
		hour: 'numeric', minute: '2-digit', hour12: true
	});
	return { relative, absolute, time };
}

export function formatDuration(startDate?: string, endDate?: string): string {
	if (!startDate || !endDate) return '';
	const start = new Date(startDate).getTime();
	const end = new Date(endDate).getTime();
	const diff = end - start;
	const hours = Math.floor(diff / 3600000);
	const days = Math.floor(hours / 24);
	if (days > 0) return `${days}d ${hours % 24}h`;
	if (hours > 0) return `${hours}h`;
	return `${Math.floor(diff / 60000)}m`;
}

export type DueLevel = 'overdue' | 'soon' | 'normal';

/** Classify and label a due date for compact badges. Returns null if unset/invalid. */
export function getDueInfo(dueAt?: string): { label: string; level: DueLevel; absolute: string } | null {
	if (!dueAt) return null;
	const due = new Date(dueAt);
	const dueMs = due.getTime();
	if (Number.isNaN(dueMs)) return null;

	const dayMs = 86400000;
	const startToday = new Date();
	startToday.setHours(0, 0, 0, 0);
	// bd stores date-only due dates as UTC midnight; read the calendar day in UTC so
	// the badge doesn't shift back a day for users west of UTC (and stays consistent
	// with the YYYY-MM-DD shown in the date input).
	const dueDay = new Date(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
	const dayDiff = Math.round((dueDay.getTime() - startToday.getTime()) / dayMs);

	const level: DueLevel = dayDiff < 0 ? 'overdue' : dayDiff <= 2 ? 'soon' : 'normal';
	let label: string;
	if (dayDiff === 0) label = 'today';
	else if (dayDiff === 1) label = 'tomorrow';
	else if (dayDiff === -1) label = '1d late';
	else if (dayDiff < 0) label = `${-dayDiff}d late`;
	else if (dayDiff < 7) label = `${dayDiff}d`;
	else label = dueDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

	const absolute = dueDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	return { label, level, absolute };
}

/** Format a minute estimate as a compact "2h 30m" / "45m" / "3d" string. */
export function formatMinutes(minutes?: number): string {
	if (!minutes || minutes <= 0) return '';
	const days = Math.floor(minutes / 1440);
	const hours = Math.floor((minutes % 1440) / 60);
	const mins = minutes % 60;
	if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
	if (hours > 0) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
	return `${mins}m`;
}

/** True when an open issue hasn't been updated within `days` (default 30). */
export function isStale(issue: Issue, days = 30): boolean {
	if (issue.status === 'closed') return false;
	if (!issue.updated_at) return false;
	const updated = new Date(issue.updated_at).getTime();
	if (Number.isNaN(updated)) return false;
	return Date.now() - updated > days * 86400000;
}

/**
 * Split labels into bd operational-state dimensions (`dimension:value`) and plain labels.
 * Operational state is stored as `<dimension>:<value>` labels (see `bd set-state`).
 */
export function parseStateLabels(labels?: string[]): { states: { dimension: string; value: string }[]; plain: string[] } {
	const states: { dimension: string; value: string }[] = [];
	const plain: string[] = [];
	for (const l of labels ?? []) {
		const idx = l.indexOf(':');
		if (idx > 0 && idx < l.length - 1) {
			states.push({ dimension: l.slice(0, idx), value: l.slice(idx + 1) });
		} else {
			plain.push(l);
		}
	}
	return { states, plain };
}

export function sortIssues(issues: Issue[], sortBy: SortBy): Issue[] {
	return [...issues].sort((a, b) => {
		if (sortBy === 'priority') return a.priority - b.priority;
		if (sortBy === 'created') return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
		return a.title.localeCompare(b.title);
	});
}


export async function copyToClipboard(text: string): Promise<void> {
	await navigator.clipboard.writeText(text);
}

/**
 * Calculate impact score for an issue based on:
 * - Dependent count (how many issues are blocked by this one): 30% weight
 * - Priority (inverted, higher priority = higher score): 20% weight
 * - Staleness (days since last update, capped): 15% weight
 * - Blocker ratio (if this issue has blockers): 15% weight
 * Returns a score from 0-100
 */
export function calculateImpactScore(issue: Issue): number {
	// Dependent score: each dependent adds 10 points, max 30
	const dependentCount = issue.dependent_count || issue.dependents?.length || 0;
	const dependentScore = Math.min(dependentCount * 10, 30);

	// Priority score: P0=20, P1=16, P2=12, P3=8, P4=4
	const priorityScore = (4 - issue.priority) * 4 + 4;

	// Staleness score: 1 point per day stale, max 15
	const daysSinceUpdate = issue.updated_at
		? Math.floor((Date.now() - new Date(issue.updated_at).getTime()) / (1000 * 60 * 60 * 24))
		: 0;
	const stalenessScore = Math.min(daysSinceUpdate, 15);

	// Blocker ratio: if this issue has unresolved dependencies, it's less impactful to work on
	// Invert this: if it has NO blockers, add bonus
	const hasBlockers = hasOpenBlockers(issue);
	const blockerBonus = hasBlockers ? 0 : 10;

	// Type bonus: bugs and blockers get priority
	const typeBonus = issue.issue_type === 'bug' ? 5 : 0;

	return Math.min(dependentScore + priorityScore + stalenessScore + blockerBonus + typeBonus, 100);
}

export function getImpactLevel(score: number): { level: 'critical' | 'high' | 'medium' | 'low'; color: string; label: string } {
	if (score >= 60) return { level: 'critical', color: '#ef4444', label: 'Critical Impact' };
	if (score >= 40) return { level: 'high', color: '#f59e0b', label: 'High Impact' };
	if (score >= 20) return { level: 'medium', color: '#6366f1', label: 'Medium Impact' };
	return { level: 'low', color: '#6b7280', label: 'Low Impact' };
}

export function isAgentAssignee(assignee: string | null | undefined): boolean {
	if (!assignee) return false;
	const a = assignee.toLowerCase();
	return a.includes('agent') || a === 'claude' || assignee.startsWith('@');
}
