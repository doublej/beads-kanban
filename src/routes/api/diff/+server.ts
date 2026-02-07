import { json } from '@sveltejs/kit';
import { execSync } from 'child_process';
import type { RequestHandler } from './$types';
import { getAllIssues, resolveProjectCwd } from '$lib/db';
import type { DiffChange, DiffResult } from '$lib/types';

interface JsonlIssue {
	id: string;
	title: string;
	status: string;
	priority: number;
	issue_type: string;
}

function parseJsonl(raw: string): Map<string, JsonlIssue> {
	const map = new Map<string, JsonlIssue>();
	for (const line of raw.split('\n')) {
		if (!line.trim()) continue;
		try {
			const issue = JSON.parse(line) as JsonlIssue;
			if (issue.id) map.set(issue.id, issue);
		} catch { /* skip malformed lines */ }
	}
	return map;
}

function getHistoricalIssues(rev: string, cwd: string): Map<string, JsonlIssue> {
	const raw = execSync(`git show ${rev}:.beads/issues.jsonl`, {
		cwd,
		encoding: 'utf-8',
		timeout: 10000
	});
	return parseJsonl(raw);
}

function getRecentCommits(cwd: string, limit = 20): { hash: string; message: string; date: string }[] {
	const raw = execSync(
		`git log --oneline --format="%H|%s|%ai" -${limit} -- .beads/issues.jsonl`,
		{ cwd, encoding: 'utf-8', timeout: 10000 }
	).trim();
	if (!raw) return [];
	return raw.split('\n').map(line => {
		const [hash, message, date] = line.split('|');
		return { hash, message, date };
	});
}

function computeDiff(
	current: Map<string, JsonlIssue>,
	historical: Map<string, JsonlIssue>
): DiffChange[] {
	const changes: DiffChange[] = [];

	// New issues (in current but not historical)
	for (const [id, issue] of current) {
		if (!historical.has(id)) {
			changes.push({ issue, changeType: 'added' });
		}
	}

	// Closed/reopened/changed issues
	for (const [id, oldIssue] of historical) {
		const newIssue = current.get(id);
		if (!newIssue) {
			// Deleted (treat as closed)
			changes.push({ issue: oldIssue, changeType: 'closed' });
			continue;
		}
		if (oldIssue.status === 'closed' && newIssue.status !== 'closed') {
			changes.push({ issue: newIssue, changeType: 'reopened', oldValue: 'closed', newValue: newIssue.status });
		} else if (oldIssue.status !== 'closed' && newIssue.status === 'closed') {
			changes.push({ issue: newIssue, changeType: 'closed', oldValue: oldIssue.status, newValue: 'closed' });
		} else if (oldIssue.status !== newIssue.status) {
			changes.push({ issue: newIssue, changeType: 'status_changed', oldValue: oldIssue.status, newValue: newIssue.status });
		}
		if (oldIssue.priority !== newIssue.priority) {
			changes.push({ issue: newIssue, changeType: 'priority_changed', oldValue: String(oldIssue.priority), newValue: String(newIssue.priority) });
		}
	}

	return changes;
}

export const GET: RequestHandler = async ({ url }) => {
	const cwd = resolveProjectCwd(url);
	const rev = url.searchParams.get('rev') || 'HEAD~1';

	// Sanitise rev to prevent command injection
	if (!/^[a-zA-Z0-9~^.\-_/]+$/.test(rev)) {
		return json({ error: 'Invalid revision format' }, { status: 400 });
	}

	try {
		const currentIssues = getAllIssues(cwd);
		const currentMap = new Map(currentIssues.map(i => [i.id, {
			id: i.id, title: i.title, status: i.status,
			priority: i.priority, issue_type: i.issue_type
		}]));

		const historicalMap = getHistoricalIssues(rev, cwd);
		const changes = computeDiff(currentMap, historicalMap);
		const commits = getRecentCommits(cwd);

		const result: DiffResult = {
			rev,
			revLabel: rev,
			currentCount: currentMap.size,
			historicalCount: historicalMap.size,
			changes,
			commits
		};

		return json(result);
	} catch (err: unknown) {
		const error = err as { message?: string; stderr?: string };
		const msg = error.stderr || error.message || 'Failed to compute diff';
		return json({ error: msg }, { status: 500 });
	}
};
