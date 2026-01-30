<script lang="ts">
	import type { Issue } from '$lib/types';
	import StatsCharts from './StatsCharts.svelte';

	interface Props {
		issues: Issue[];
	}

	let { issues }: Props = $props();

	// Time-based metrics
	const timeStats = $derived.by(() => {
		const now = Date.now();
		const day = 24 * 60 * 60 * 1000;

		const closedIssues = issues.filter(i => i.status === 'closed' && i.closed_at);
		const cycleTimes = closedIssues.map(i => {
			const created = new Date(i.created_at || 0).getTime();
			const closed = new Date(i.closed_at!).getTime();
			return (closed - created) / day;
		});

		const cycleDistribution = {
			'< 1 day': cycleTimes.filter(t => t < 1).length,
			'1-3 days': cycleTimes.filter(t => t >= 1 && t < 3).length,
			'3-7 days': cycleTimes.filter(t => t >= 3 && t < 7).length,
			'1-2 weeks': cycleTimes.filter(t => t >= 7 && t < 14).length,
			'> 2 weeks': cycleTimes.filter(t => t >= 14).length
		};

		const avgCycleTime = cycleTimes.length ? cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length : 0;

		// Last 14 days activity
		const activity: { date: string; created: number; closed: number }[] = [];
		for (let i = 13; i >= 0; i--) {
			const dayStart = now - i * day;
			const dayEnd = dayStart + day;
			const dateStr = new Date(dayStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
			const created = issues.filter(iss => {
				const t = new Date(iss.created_at || 0).getTime();
				return t >= dayStart && t < dayEnd;
			}).length;
			const closed = issues.filter(iss => {
				if (!iss.closed_at) return false;
				const t = new Date(iss.closed_at).getTime();
				return t >= dayStart && t < dayEnd;
			}).length;
			activity.push({ date: dateStr, created, closed });
		}

		// Burndown (remaining open issues over time)
		const burndown: { date: string; remaining: number }[] = [];
		for (let i = 13; i >= 0; i--) {
			const dayEnd = now - i * day;
			const dateStr = new Date(dayEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
			const remaining = issues.filter(iss => {
				const created = new Date(iss.created_at || 0).getTime();
				if (created > dayEnd) return false;
				if (iss.status === 'closed' && iss.closed_at) {
					const closed = new Date(iss.closed_at).getTime();
					if (closed <= dayEnd) return false;
				}
				return true;
			}).length;
			burndown.push({ date: dateStr, remaining });
		}

		return { cycleDistribution, avgCycleTime, activity, burndown };
	});

	// Status distribution
	const statusStats = $derived({
		open: issues.filter(i => i.status === 'open').length,
		in_progress: issues.filter(i => i.status === 'in_progress').length,
		blocked: issues.filter(i => i.status === 'blocked').length,
		closed: issues.filter(i => i.status === 'closed').length
	});

	// Priority distribution
	const priorityStats = $derived({
		critical: issues.filter(i => i.priority === 0).length,
		high: issues.filter(i => i.priority === 1).length,
		medium: issues.filter(i => i.priority === 2).length,
		low: issues.filter(i => i.priority === 3).length,
		backlog: issues.filter(i => i.priority === 4).length
	});

	// Type distribution
	const typeStats = $derived.by(() => {
		const counts: Record<string, number> = {};
		for (const i of issues) {
			counts[i.issue_type] = (counts[i.issue_type] || 0) + 1;
		}
		return counts;
	});
</script>

<div class="stats-view">
	<div class="stats-header">
		<span class="stats-count">{issues.length} total issues</span>
	</div>

	<StatsCharts
		{issues}
		{statusStats}
		{priorityStats}
		{typeStats}
		{timeStats}
	/>
</div>

<style>
	.stats-view {
		flex: 1;
		display: flex;
		flex-direction: column;
		padding: 1rem 1.5rem;
		overflow: auto;
	}

	.stats-header {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
		margin-bottom: 1rem;
	}

	.stats-count {
		font-size: 0.75rem;
		color: var(--text-tertiary);
	}
</style>
