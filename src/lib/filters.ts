import type { Issue } from './types';

export interface FilterState {
	searchQuery: string;
	filterPriority: number | 'all';
	filterType: string;
	filterTime: string;
	filterStatus: string;
	filterLabel: string;
	filterActionable: boolean;
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

export function issueMatchesTimeFilter(issue: Issue, filterTime: string): boolean {
	if (filterTime === 'all') return true;
	const now = new Date();
	const updated = issue.updated_at ? new Date(issue.updated_at) : issue.created_at ? new Date(issue.created_at) : now;
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

export function issueMatchesFilters(issue: Issue, filters: FilterState): boolean {
	const query = filters.searchQuery.toLowerCase();
	const matchesSearch = !query ||
		issue.id.toLowerCase().includes(query) ||
		issue.title.toLowerCase().includes(query) ||
		issue.description.toLowerCase().includes(query);
	const matchesPriority = filters.filterPriority === 'all' || issue.priority === filters.filterPriority;
	const matchesType = filters.filterType === 'all' || issue.issue_type === filters.filterType;
	const matchesTime = issueMatchesTimeFilter(issue, filters.filterTime);
	const matchesStatus = filters.filterStatus === 'all' ||
		(filters.filterStatus.startsWith('!') ? issue.status !== filters.filterStatus.slice(1) : issue.status === filters.filterStatus);
	const matchesLabel = filters.filterLabel === 'all' || (issue.labels || []).includes(filters.filterLabel);
	const matchesActionable = !filters.filterActionable || isIssueActionable(issue);
	return matchesSearch && matchesPriority && matchesType && matchesTime && matchesStatus && matchesLabel && matchesActionable;
}

export function hasActiveFilters(filters: FilterState): boolean {
	return filters.searchQuery !== '' || filters.filterPriority !== 'all' || filters.filterType !== 'all' || filters.filterTime !== 'all' || filters.filterStatus !== 'all' || filters.filterLabel !== 'all' || filters.filterActionable;
}
