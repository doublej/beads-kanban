<script lang="ts">
	import type { Issue } from '$lib/types';
	import { getPriorityConfig } from '$lib/utils';

	interface TimeStats {
		cycleDistribution: Record<string, number>;
		avgCycleTime: number;
		activity: { date: string; created: number; closed: number }[];
		burndown: { date: string; remaining: number }[];
	}

	interface Props {
		issues: Issue[];
		statusStats: { open: number; in_progress: number; blocked: number; closed: number };
		priorityStats: Record<string, number>;
		typeStats: Record<string, number>;
		timeStats: TimeStats;
	}

	let { issues, statusStats, priorityStats, typeStats, timeStats }: Props = $props();

	const maxActivity = $derived(Math.max(...timeStats.activity.map(a => Math.max(a.created, a.closed)), 1));
	const maxBurndown = $derived(Math.max(...timeStats.burndown.map(b => b.remaining), 1));
	const maxCycle = $derived(Math.max(...Object.values(timeStats.cycleDistribution), 1));
</script>

<div class="stats-grid">
	<!-- Burndown Chart -->
	<div class="stat-card">
		<div class="card-header">
			<span class="card-title">Burndown (14 days)</span>
		</div>
		<div class="chart burndown-chart">
			{#each timeStats.burndown as point}
				<div class="chart-bar-wrap" style="--height: {(point.remaining / maxBurndown) * 100}%">
					<div class="chart-bar burndown-bar"></div>
					<span class="chart-label">{point.date.split(' ')[1]}</span>
				</div>
			{/each}
		</div>
	</div>

	<!-- Activity Chart -->
	<div class="stat-card">
		<div class="card-header">
			<span class="card-title">Created vs Closed (14 days)</span>
			<div class="legend-inline">
				<span class="legend-dot created"></span> Created
				<span class="legend-dot closed"></span> Closed
			</div>
		</div>
		<div class="chart activity-chart">
			{#each timeStats.activity as day}
				<div class="activity-day">
					<div class="activity-bars">
						<div class="activity-bar created" style="--height: {(day.created / maxActivity) * 100}%"></div>
						<div class="activity-bar closed" style="--height: {(day.closed / maxActivity) * 100}%"></div>
					</div>
					<span class="chart-label">{day.date.split(' ')[1]}</span>
				</div>
			{/each}
		</div>
	</div>

	<!-- Cycle Time Distribution -->
	<div class="stat-card">
		<div class="card-header">
			<span class="card-title">Cycle Time Distribution</span>
			<span class="avg-label">Avg: {timeStats.avgCycleTime.toFixed(1)} days</span>
		</div>
		<div class="horizontal-bars">
			{#each Object.entries(timeStats.cycleDistribution) as [label, count]}
				<div class="h-bar-row">
					<span class="h-bar-label">{label}</span>
					<div class="h-bar-track">
						<div class="h-bar" style="--width: {(count / maxCycle) * 100}%"></div>
					</div>
					<span class="h-bar-value">{count}</span>
				</div>
			{/each}
		</div>
	</div>

	<!-- Status Overview -->
	<div class="stat-card compact">
		<div class="card-header">
			<span class="card-title">By Status</span>
		</div>
		<div class="horizontal-bars">
			<div class="h-bar-row">
				<span class="h-bar-label">Open</span>
				<div class="h-bar-track">
					<div class="h-bar status-open" style="--width: {(statusStats.open / issues.length) * 100}%"></div>
				</div>
				<span class="h-bar-value">{statusStats.open}</span>
			</div>
			<div class="h-bar-row">
				<span class="h-bar-label">In Progress</span>
				<div class="h-bar-track">
					<div class="h-bar status-progress" style="--width: {(statusStats.in_progress / issues.length) * 100}%"></div>
				</div>
				<span class="h-bar-value">{statusStats.in_progress}</span>
			</div>
			<div class="h-bar-row">
				<span class="h-bar-label">Blocked</span>
				<div class="h-bar-track">
					<div class="h-bar status-blocked" style="--width: {(statusStats.blocked / issues.length) * 100}%"></div>
				</div>
				<span class="h-bar-value">{statusStats.blocked}</span>
			</div>
			<div class="h-bar-row">
				<span class="h-bar-label">Closed</span>
				<div class="h-bar-track">
					<div class="h-bar status-closed" style="--width: {(statusStats.closed / issues.length) * 100}%"></div>
				</div>
				<span class="h-bar-value">{statusStats.closed}</span>
			</div>
		</div>
	</div>

	<!-- Priority Overview -->
	<div class="stat-card compact">
		<div class="card-header">
			<span class="card-title">By Priority</span>
		</div>
		<div class="horizontal-bars">
			{#each Object.entries(priorityStats) as [label, count]}
				{@const config = getPriorityConfig(['critical', 'high', 'medium', 'low', 'backlog'].indexOf(label))}
				<div class="h-bar-row">
					<span class="h-bar-label">{label}</span>
					<div class="h-bar-track">
						<div class="h-bar" style="--width: {(count / issues.length) * 100}%; background: {config.color}"></div>
					</div>
					<span class="h-bar-value">{count}</span>
				</div>
			{/each}
		</div>
	</div>

	<!-- Type Overview -->
	<div class="stat-card compact">
		<div class="card-header">
			<span class="card-title">By Type</span>
		</div>
		<div class="horizontal-bars">
			{#each Object.entries(typeStats) as [type, count]}
				<div class="h-bar-row">
					<span class="h-bar-label">{type}</span>
					<div class="h-bar-track">
						<div class="h-bar type-bar" style="--width: {(count / issues.length) * 100}%"></div>
					</div>
					<span class="h-bar-value">{count}</span>
				</div>
			{/each}
		</div>
	</div>
</div>

<style>
	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 1rem;
	}

	.stat-card {
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: var(--radius-md);
		padding: 1rem;
	}

	.stat-card.compact {
		padding: 0.75rem;
	}

	.card-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 0.75rem;
	}

	.card-title {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--text-secondary);
	}

	.avg-label {
		font-size: 0.6875rem;
		color: var(--text-tertiary);
	}

	.legend-inline {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.6875rem;
		color: var(--text-tertiary);
	}

	.legend-dot {
		width: 8px;
		height: 8px;
		border-radius: 2px;
	}

	.legend-dot.created {
		background: #6366f1;
	}

	.legend-dot.closed {
		background: #10b981;
	}

	/* Vertical bar charts */
	.chart {
		display: flex;
		align-items: flex-end;
		gap: 4px;
		height: 100px;
		padding-top: 0.5rem;
	}

	.chart-bar-wrap {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		height: 100%;
	}

	.chart-bar {
		width: 100%;
		height: var(--height);
		border-radius: 2px 2px 0 0;
		transition: height 0.3s ease;
	}

	.burndown-bar {
		background: linear-gradient(to top, #6366f1, #818cf8);
	}

	.chart-label {
		font-size: 0.5625rem;
		color: var(--text-tertiary);
		margin-top: 4px;
	}

	/* Activity dual bars */
	.activity-chart {
		gap: 6px;
	}

	.activity-day {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		height: 100%;
	}

	.activity-bars {
		flex: 1;
		display: flex;
		gap: 2px;
		align-items: flex-end;
		width: 100%;
	}

	.activity-bar {
		flex: 1;
		border-radius: 2px 2px 0 0;
		transition: height 0.3s ease;
	}

	.activity-bar.created {
		background: #6366f1;
		height: var(--height);
	}

	.activity-bar.closed {
		background: #10b981;
		height: var(--height);
	}

	/* Horizontal bars */
	.horizontal-bars {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.h-bar-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.h-bar-label {
		font-size: 0.6875rem;
		color: var(--text-tertiary);
		width: 70px;
		text-transform: capitalize;
	}

	.h-bar-track {
		flex: 1;
		height: 14px;
		background: rgba(255, 255, 255, 0.04);
		border-radius: 3px;
		overflow: hidden;
	}

	.h-bar {
		height: 100%;
		width: var(--width);
		background: #6366f1;
		border-radius: 3px;
		transition: width 0.3s ease;
	}

	.h-bar.status-open { background: #6366f1; }
	.h-bar.status-progress { background: #f59e0b; }
	.h-bar.status-blocked { background: #ef4444; }
	.h-bar.status-closed { background: #10b981; }
	.h-bar.type-bar { background: #8b5cf6; }

	.h-bar-value {
		font-size: 0.6875rem;
		font-family: 'IBM Plex Mono', monospace;
		color: var(--text-tertiary);
		width: 24px;
		text-align: right;
	}
</style>
