import type { Issue, Column, SortBy, ColumnIconName } from './types';

export type { ColumnIconName };

export const columns: Column[] = [
	{ key: 'open', status: 'open', label: 'Backlog', icon: 'circle', accent: '#6366f1' },
	{ key: 'in_progress', status: 'in_progress', label: 'In Progress', icon: 'circle-dot', accent: '#f59e0b' },
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
		'discovered-from': { icon: 'dep-discovered', color: '#f59e0b', label: 'Found' }
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

export function sortIssues(issues: Issue[], sortBy: SortBy): Issue[] {
	return [...issues].sort((a, b) => {
		if (sortBy === 'priority') return a.priority - b.priority;
		if (sortBy === 'created') return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
		return a.title.localeCompare(b.title);
	});
}

export function issueMatchesFilters(
	issue: Issue,
	searchQuery: string,
	filterPriority: number | 'all',
	filterType: string
): boolean {
	const matchesSearch = searchQuery === '' ||
		issue.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
		issue.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
		issue.id.toLowerCase().includes(searchQuery.toLowerCase());
	const matchesPriority = filterPriority === 'all' || issue.priority === filterPriority;
	const matchesType = filterType === 'all' || issue.issue_type === filterType;
	return matchesSearch && matchesPriority && matchesType;
}

export async function copyToClipboard(text: string): Promise<void> {
	await navigator.clipboard.writeText(text);
}
