import type { RequestHandler } from './$types';
import { requireProjectCwd } from '$lib/server/cwd';
import { historyIssue, unwrapBdJson } from '$lib/bd';
import { ok, wrap } from '$lib/server/response';

interface Snapshot {
	id: string;
	title: string;
	status: string;
	priority: number;
	issue_type: string;
	assignee?: string;
	owner?: string;
}

interface RawEntry {
	CommitHash: string;
	Committer: string;
	CommitDate: string;
	Issue: Snapshot;
}

interface HistoryEntry {
	hash: string;
	date: string;
	committer: string;
	changes: string[];
}

const PRIORITY = ['Critical', 'High', 'Medium', 'Low', 'Backlog'];
const prio = (p: number) => PRIORITY[p] ?? String(p);

/** Diff a newer snapshot against the older one it replaced into human-readable change lines. */
function diffSnapshots(newer: Snapshot, older: Snapshot): string[] {
	const changes: string[] = [];
	if (newer.status !== older.status) changes.push(`status ${older.status} → ${newer.status}`);
	if (newer.priority !== older.priority) changes.push(`priority ${prio(older.priority)} → ${prio(newer.priority)}`);
	if (newer.issue_type !== older.issue_type) changes.push(`type ${older.issue_type} → ${newer.issue_type}`);
	if (newer.title !== older.title) changes.push('title edited');
	if ((newer.assignee ?? '') !== (older.assignee ?? '')) changes.push(`assignee ${older.assignee || 'none'} → ${newer.assignee || 'none'}`);
	return changes;
}

export const GET: RequestHandler = wrap(async ({ params, url }) => {
	const cwd = requireProjectCwd(url);
	const result = await historyIssue(params.id, 20, cwd);
	if (!result.success || !result.stdout) return ok({ entries: [] as HistoryEntry[] });

	let raw: RawEntry[];
	try {
		raw = unwrapBdJson<RawEntry[]>(result.stdout) ?? [];
	} catch {
		return ok({ entries: [] as HistoryEntry[] });
	}
	if (!Array.isArray(raw) || raw.length === 0) return ok({ entries: [] as HistoryEntry[] });

	// Snapshots are newest-first; diff each against the next-older. Oldest is the creation.
	const entries: HistoryEntry[] = [];
	for (let i = 0; i < raw.length; i++) {
		const base = { hash: raw[i].CommitHash, date: raw[i].CommitDate, committer: raw[i].Committer };
		if (i === raw.length - 1) {
			entries.push({ ...base, changes: ['created'] });
		} else {
			const changes = diffSnapshots(raw[i].Issue, raw[i + 1].Issue);
			if (changes.length > 0) entries.push({ ...base, changes });
		}
	}

	return ok({ entries });
});
