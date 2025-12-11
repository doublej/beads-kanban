import type { Issue, Column, SortBy } from './types';

// Virtual labels used for column filtering
export const virtualLabels = ['draft', 'feedback', 'review'] as const;

export const columns: Column[] = [
	{ key: 'open', status: 'open', excludeLabels: ['draft', 'feedback', 'review'], label: 'Backlog', icon: '○', accent: '#6366f1' },
	{ key: 'draft', status: 'open', filterLabel: 'draft', label: 'Draft', icon: '◇', accent: '#8b5cf6' },
	{ key: 'in_progress', status: 'in_progress', excludeLabels: ['feedback', 'review'], label: 'In Progress', icon: '◐', accent: '#f59e0b' },
	{ key: 'feedback', status: 'in_progress', filterLabel: 'feedback', label: 'Feedback', icon: '◈', accent: '#ec4899' },
	{ key: 'review', status: 'in_progress', filterLabel: 'review', label: 'Review', icon: '◎', accent: '#06b6d4' },
	{ key: 'blocked', status: 'blocked', label: 'Blocked', icon: '◉', accent: '#ef4444' },
	{ key: 'closed', status: 'closed', label: 'Complete', icon: '●', accent: '#10b981' }
];

// Get the column an issue belongs to based on status and labels
export function getIssueColumn(issue: Issue): Column {
	const issueLabels = issue.labels || [];
	for (const col of columns) {
		if (col.status !== issue.status) continue;
		if (col.filterLabel && !issueLabels.includes(col.filterLabel)) continue;
		if (col.excludeLabels?.some(l => issueLabels.includes(l))) continue;
		return col;
	}
	return columns.find(c => c.status === issue.status) || columns[0];
}

// Compute updates needed to move an issue to a target column
export function getColumnMoveUpdates(issue: Issue, targetColumnKey: string): {
	status?: Issue['status'];
	addLabels?: string[];
	removeLabels?: string[];
} {
	const targetColumn = columns.find(c => c.key === targetColumnKey);
	if (!targetColumn) return {};

	const issueLabels = issue.labels || [];
	const updates: { status?: Issue['status']; addLabels?: string[]; removeLabels?: string[] } = {};

	// Update status if different
	if (issue.status !== targetColumn.status) {
		updates.status = targetColumn.status;
	}

	// Remove all virtual labels first, then add the target one if needed
	const labelsToRemove = virtualLabels.filter(l => issueLabels.includes(l) && l !== targetColumn.filterLabel);
	if (labelsToRemove.length) updates.removeLabels = [...labelsToRemove];

	// Add the target label if this column requires one
	if (targetColumn.filterLabel && !issueLabels.includes(targetColumn.filterLabel)) {
		updates.addLabels = [targetColumn.filterLabel];
	}

	return updates;
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

export function getDepTypeConfig(depType: string): { icon: string; color: string; label: string } {
	const configs: Record<string, { icon: string; color: string; label: string }> = {
		'blocks': { icon: '⊘', color: '#ef4444', label: 'Blocks' },
		'related': { icon: '↔', color: '#3b82f6', label: 'Related' },
		'parent-child': { icon: '↳', color: '#8b5cf6', label: 'Parent' },
		'discovered-from': { icon: '◊', color: '#f59e0b', label: 'Found' }
	};
	return configs[depType] || configs['blocks'];
}

export function getTypeIcon(type: string): string {
	const icons: Record<string, string> = {
		task: '◇',
		bug: '⬡',
		feature: '★',
		epic: '◈',
		chore: '○'
	};
	return icons[type] || '◇';
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
