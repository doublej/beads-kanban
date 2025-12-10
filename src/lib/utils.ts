import type { Issue, Column, SortBy } from './types';

export const columns: Column[] = [
	{ key: 'open', label: 'Backlog', icon: '○', accent: '#6366f1' },
	{ key: 'in_progress', label: 'In Progress', icon: '◐', accent: '#f59e0b' },
	{ key: 'blocked', label: 'Blocked', icon: '◉', accent: '#ef4444' },
	{ key: 'closed', label: 'Complete', icon: '●', accent: '#10b981' }
];

export function getPriorityConfig(priority: number) {
	const configs = {
		1: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', label: 'Critical', lightBg: 'rgba(239, 68, 68, 0.08)' },
		2: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', label: 'High', lightBg: 'rgba(245, 158, 11, 0.08)' },
		3: { color: '#6366f1', bg: 'rgba(99, 102, 241, 0.12)', label: 'Medium', lightBg: 'rgba(99, 102, 241, 0.08)' },
		4: { color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', label: 'Low', lightBg: 'rgba(16, 185, 129, 0.08)' }
	};
	return configs[priority as keyof typeof configs];
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
