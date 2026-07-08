/**
 * Read-only database access via `bd sql --json`.
 * Requires bd in Dolt server mode (`bd init --server`); embedded mode does not expose `bd sql`.
 * Min bd version: see MIN_BD_VERSION in bd.ts.
 */
import { spawnSync } from 'child_process';
import { basename, join, resolve } from 'path';
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import type { Issue, Dependency, MutationEntry, Attachment, Comment, AgentModel, AgentEffort } from './types';
import { getMimetype } from './attachments';
import { recordTouchedCwd } from './touched-cwds';
import { bdEnv, unwrapBdJson } from './bd';

const CWD_FILE = process.env.BEADS_KANBAN_CWD_FILE || join(process.cwd(), '.beads-cwd');

/** Resolve BD_DB env var to project root. If path ends with `.beads`, strip it. */
function resolveBdDbFallback(): string | null {
	const raw = process.env.BD_DB;
	if (!raw) return null;
	const resolved = resolve(raw);
	if (!existsSync(resolved)) return null;
	if (basename(resolved) === '.beads') {
		const parent = resolve(resolved, '..');
		return existsSync(parent) ? parent : null;
	}
	return resolved;
}

const doctorRanForCwd = new Set<string>();

/** True the first time this process sees `cwd`; subsequent calls return false. Session-scoped. */
export function markDoctorRan(cwd: string): boolean {
	if (doctorRanForCwd.has(cwd)) return false;
	doctorRanForCwd.add(cwd);
	return true;
}

export function getStoredCwd(): string {
	if (existsSync(CWD_FILE)) {
		const stored = readFileSync(CWD_FILE, 'utf-8').trim();
		if (stored && existsSync(stored)) return stored;
	}
	const bdDb = resolveBdDbFallback();
	if (bdDb) return bdDb;
	return process.cwd();
}

export function setStoredCwd(path: string): void {
	writeFileSync(CWD_FILE, path, 'utf-8');
}

/** Resolve the project cwd from a request URL's ?project= param, falling back to getStoredCwd(). */
export function resolveProjectCwd(url: URL): string {
	const project = url.searchParams.get('project');
	if (project) {
		const resolved = resolve(project);
		if (existsSync(resolved)) return resolved;
	}
	return getStoredCwd();
}

/** Validate issue IDs to prevent SQL injection in interpolated queries. */
function safeId(id: string): string {
	if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error(`Invalid issue ID: ${id}`);
	return id;
}

/** Timeout for a single `bd` read (sql/export). Generous default so a large JSONL
 *  auto-import isn't SIGTERM-killed mid-import. Override via env. */
const BD_SQL_TIMEOUT_MS = (() => {
	const n = Number(process.env.BEADS_KANBAN_BD_SQL_TIMEOUT_MS);
	return Number.isFinite(n) && n > 0 ? n : 30000;
})();

/**
 * Run a SELECT via `bd sql --json`. Backend-agnostic and always correct (bd manages the
 * Dolt server / SQLite and loads the JSONL), but rebuilds a throwaway database from the
 * JSONL on every call, so it is O(JSONL size). Hot read paths use `bdExport` instead;
 * this remains for the events feed and single-purpose queries. Uses spawnSync to avoid
 * shell-quoting issues.
 */
function bdSql<T>(query: string, cwd?: string): T[] {
	const effectiveCwd = cwd ?? getStoredCwd();
	recordTouchedCwd(effectiveCwd);

	const result = spawnSync('bd', ['sql', '--json', query], {
		cwd: effectiveCwd,
		encoding: 'utf-8',
		timeout: BD_SQL_TIMEOUT_MS,
		env: bdEnv()
	});
	// On timeout, spawnSync kills the child (signal SIGTERM, error code ETIMEDOUT) and leaves
	// whatever bd had printed so far in stderr — typically the "auto-importing … into empty
	// database" banner. Surfacing that banner as the error is misleading, so report the timeout.
	const timedOut =
		result.signal === 'SIGTERM' ||
		(result.error as NodeJS.ErrnoException | undefined)?.code === 'ETIMEDOUT';
	if (timedOut) {
		throw new Error(
			`bd sql timed out after ${BD_SQL_TIMEOUT_MS}ms in ${effectiveCwd} — bd is likely ` +
				`re-importing the JSONL on every query. Ensure the project's Dolt server is running, ` +
				`or raise BEADS_KANBAN_BD_SQL_TIMEOUT_MS.`
		);
	}
	if (result.status !== 0 || result.error) {
		const msg = result.stderr?.trim() || result.error?.message || 'bd sql failed';
		throw new Error(msg);
	}
	return unwrapBdJson<T[]>(result.stdout.trim());
}

/** Scalar issue fields shared by the `bd sql` and `bd export` (ExportIssue) shapes. */
interface IssueScalarFields {
	estimated_minutes?: number | null;
	external_ref?: string | null;
	spec_id?: string | null;
	ephemeral?: number | boolean | null;
	wisp_type?: string | null;
	pinned?: number | boolean | null;
	due_at?: string | null;
	defer_until?: string | null;
	started_at?: string | null;
	agent_state?: string | null;
	close_reason?: string | null;
}

/** Map shared bd-1.0 issue columns onto the Issue shape. */
function mapIssueFields(row: IssueScalarFields) {
	return {
		estimated_minutes: row.estimated_minutes ?? undefined,
		external_ref: row.external_ref || undefined,
		spec_id: row.spec_id || undefined,
		ephemeral: row.ephemeral ? true : undefined,
		wisp_type: row.wisp_type || undefined,
		pinned: row.pinned ? true : undefined,
		due_at: row.due_at || undefined,
		defer_until: row.defer_until || undefined,
		started_at: row.started_at || undefined,
		agent_state: row.agent_state || undefined,
		close_reason: row.close_reason || undefined,
	};
}

interface IssueMetadata {
	agent_model?: AgentModel;
	agent_effort?: AgentEffort;
}

function parseMetadata(raw: string | object | null | undefined): IssueMetadata {
	if (!raw) return {};
	if (typeof raw === 'object') return raw as IssueMetadata;
	try {
		return JSON.parse(raw) as IssueMetadata;
	} catch {
		return {};
	}
}

interface ExportDep {
	issue_id: string;
	depends_on_id: string;
	type: string;
}

interface ExportComment {
	id: string;
	author: string;
	text: string;
	created_at: string;
}

/** One issue line from `bd export` (JSONL). bd omits empty/null fields, so most are optional. */
interface ExportIssue extends IssueScalarFields {
	_type?: string;
	id: string;
	title: string;
	description?: string;
	design?: string;
	acceptance_criteria?: string;
	notes?: string;
	status: string;
	priority: number;
	issue_type: string;
	assignee?: string;
	created_at: string;
	updated_at?: string;
	closed_at?: string;
	metadata?: string | object;
	labels?: string[];
	dependencies?: ExportDep[];
	comments?: ExportComment[];
}

/**
 * Read all issues via `bd export` (JSONL). Unlike `bd sql` — which rebuilds a throwaway
 * database from the JSONL on every call (O(size), seconds) — bd serves this from the live
 * database it manages, so it is fast (~0.5s) and correct. Full-fidelity: dependencies,
 * labels and comments are inline. Empty/null columns are omitted, mapping to `undefined`.
 */
function bdExport(cwd?: string): ExportIssue[] {
	const effectiveCwd = cwd ?? getStoredCwd();
	recordTouchedCwd(effectiveCwd);

	const result = spawnSync('bd', ['export'], {
		cwd: effectiveCwd,
		encoding: 'utf-8',
		timeout: BD_SQL_TIMEOUT_MS,
		maxBuffer: 256 * 1024 * 1024,
		env: bdEnv()
	});
	const timedOut =
		result.signal === 'SIGTERM' ||
		(result.error as NodeJS.ErrnoException | undefined)?.code === 'ETIMEDOUT';
	if (timedOut) {
		throw new Error(
			`bd export timed out after ${BD_SQL_TIMEOUT_MS}ms in ${effectiveCwd}. Ensure the ` +
				`project's bd database is healthy, or raise BEADS_KANBAN_BD_SQL_TIMEOUT_MS.`
		);
	}
	if (result.status !== 0 || result.error) {
		const msg = result.stderr?.trim() || result.error?.message || 'bd export failed';
		throw new Error(msg);
	}

	const issues: ExportIssue[] = [];
	for (const line of result.stdout.split('\n')) {
		const t = line.trim();
		if (t[0] !== '{') continue; // skip blanks / any stray banner line
		let obj: ExportIssue;
		try {
			obj = JSON.parse(t);
		} catch {
			continue;
		}
		if (obj._type === 'memory' || !obj.id || !obj.title) continue; // memories aren't issues
		issues.push(obj);
	}
	return issues;
}

interface DepView {
	id: string;
	title: string;
	status: string;
	dependency_type: string;
}

/** Lexical string compare (ISO-8601 timestamps sort chronologically this way). */
function cmp(a: string, b: string): number {
	return a < b ? -1 : a > b ? 1 : 0;
}

function pushInto<V>(map: Map<string, V[]>, key: string, val: V): void {
	const list = map.get(key);
	if (list) list.push(val);
	else map.set(key, [val]);
}

function mapExportIssue(
	r: ExportIssue,
	seqMap: Map<string, number>,
	depsMap: Map<string, DepView[]>,
	dependentsMap: Map<string, DepView[]>,
	attachmentsMap: Map<string, Attachment[]>
): Issue {
	const meta = parseMetadata(r.metadata);
	const dependencies = depsMap.get(r.id) ?? [];
	const dependents = dependentsMap.get(r.id) ?? [];
	return {
		id: r.id,
		seq: seqMap.get(r.id) ?? 0,
		title: r.title,
		description: r.description ?? '',
		design: r.design || undefined,
		acceptance_criteria: r.acceptance_criteria || undefined,
		notes: r.notes || undefined,
		status: r.status as Issue['status'],
		priority: r.priority as Issue['priority'],
		issue_type: r.issue_type,
		assignee: r.assignee || undefined,
		created_at: r.created_at,
		updated_at: r.updated_at,
		closed_at: r.closed_at || undefined,
		labels: r.labels ?? [],
		dependencies,
		dependents,
		dependency_count: dependencies.length,
		dependent_count: dependents.length,
		attachments: attachmentsMap.get(r.id) ?? [],
		comments: [...(r.comments ?? [])]
			.sort((a, b) => cmp(a.created_at, b.created_at))
			.map((c) => ({ id: c.id, author: c.author, text: c.text, created_at: c.created_at })),
		agent_model: meta.agent_model,
		agent_effort: meta.agent_effort,
		...mapIssueFields(r)
	};
}

export function getAllIssues(cwd?: string): Issue[] {
	const rows = bdExport(cwd).filter((r) => r.status !== 'tombstone');
	const byId = new Map(rows.map((r) => [r.id, r]));

	// seq mirrors `ROW_NUMBER() OVER (ORDER BY created_at)`: the oldest issue is 1.
	const seqMap = new Map<string, number>();
	[...rows]
		.sort((a, b) => cmp(a.created_at, b.created_at) || cmp(a.id, b.id))
		.forEach((r, i) => seqMap.set(r.id, i + 1));

	// Outgoing deps (this issue depends on X) and their reverse (dependents), keeping only
	// edges whose other endpoint still exists — matching the INNER JOINs of the sql path.
	const depsMap = new Map<string, DepView[]>();
	const dependentsMap = new Map<string, DepView[]>();
	for (const r of rows) {
		for (const d of r.dependencies ?? []) {
			const target = byId.get(d.depends_on_id);
			if (target) pushInto(depsMap, d.issue_id, { id: d.depends_on_id, title: target.title, status: target.status, dependency_type: d.type });
			const source = byId.get(d.issue_id);
			if (source) pushInto(dependentsMap, d.depends_on_id, { id: d.issue_id, title: source.title, status: source.status, dependency_type: d.type });
		}
	}

	const attachmentsMap = getAllAttachments(cwd);

	return rows
		.sort((a, b) => b.priority - a.priority || cmp(b.created_at, a.created_at))
		.map((r) => mapExportIssue(r, seqMap, depsMap, dependentsMap, attachmentsMap));
}

export function getIssueById(id: string, cwd?: string): Issue | null {
	const sid = safeId(id);
	return getAllIssues(cwd).find((issue) => issue.id === sid) ?? null;
}

interface DbEvent {
	id: number;
	issue_id: string;
	event_type: string;
	actor: string;
	old_value: string | null;
	new_value: string | null;
	comment: string | null;
	created_at: string;
}

const priorityLabels: Record<number, string> = {
	0: 'Critical', 1: 'High', 2: 'Medium', 3: 'Low', 4: 'Backlog'
};

/** Parse an event's old/new value JSON. bd sometimes stores a plain (non-JSON) string
 *  such as a close reason, so this must tolerate parse failures instead of throwing. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeParseVal(raw: string | null): any {
	if (!raw) return null;
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

function parseEventToMutation(ev: DbEvent): MutationEntry | null {
	const oldVal = safeParseVal(ev.old_value);
	const newVal = safeParseVal(ev.new_value);
	const title = newVal?.title || oldVal?.title || ev.issue_id;
	const ts = new Date(ev.created_at.replace(' ', 'T')).getTime();

	const base = { id: String(ev.id), timestamp: ts, ticketId: ev.issue_id, ticketTitle: title };

	switch (ev.event_type) {
		case 'created':
			return { ...base, mutationType: 'created', field: 'issue', previousValue: null, newValue: 'created' };
		case 'closed':
			return { ...base, mutationType: 'closed', field: 'status', previousValue: oldVal?.status || 'open', newValue: 'closed' };
		case 'reopened':
			return { ...base, mutationType: 'status', field: 'status', previousValue: 'closed', newValue: newVal?.status || 'open' };
		case 'status_changed':
			return { ...base, mutationType: 'status', field: 'status', previousValue: oldVal?.status, newValue: newVal?.status };
		case 'dependency_added':
		case 'dependency_removed': {
			const depMatch = ev.comment?.match(/dependency:\s*(\S+)\s+blocks\s+(\S+)/i);
			if (!depMatch) return null;
			const action = ev.event_type === 'dependency_added' ? '+' : '-';
			return { ...base, mutationType: 'dependency', field: 'dependency', previousValue: null, newValue: `${action}${depMatch[2]}` };
		}
		case 'label_added':
		case 'label_removed': {
			const labelMatch = ev.comment?.match(/label:\s*(.+)/i);
			if (!labelMatch) return null;
			const labelAction = ev.event_type === 'label_added' ? '+' : '-';
			return { ...base, mutationType: 'label', field: 'label', previousValue: null, newValue: `${labelAction}${labelMatch[1].trim()}` };
		}
		case 'updated':
			if (oldVal && newVal) {
				if (oldVal.priority !== newVal.priority) {
					return { ...base, mutationType: 'priority', field: 'priority', previousValue: priorityLabels[oldVal.priority], newValue: priorityLabels[newVal.priority] };
				}
				if (oldVal.assignee !== newVal.assignee) {
					return { ...base, mutationType: 'assignee', field: 'assignee', previousValue: oldVal.assignee || null, newValue: newVal.assignee || 'unassigned' };
				}
			}
			return null;
		default:
			return null;
	}
}

export function getRecentEvents(limit = 100, cwd?: string): MutationEntry[] {
	const rows = bdSql<DbEvent>(`
		SELECT id, issue_id, event_type, actor, old_value, new_value, comment, created_at
		FROM events ORDER BY created_at DESC LIMIT ${Math.floor(limit)}
	`, cwd);

	return rows.map(parseEventToMutation).filter((m): m is MutationEntry => m !== null);
}

interface DbComment {
	id: string;
	issue_id: string;
	author: string;
	text: string;
	created_at: string;
}

export function getComments(issueId: string, cwd?: string): Comment[] {
	// Comments are inline in `bd export`; reuse the fast issue read (sorted created_at ASC).
	return getIssueById(issueId, cwd)?.comments ?? [];
}

export function getAllComments(cwd?: string): Map<string, Comment[]> {
	const rows = bdSql<DbComment>(`
		SELECT id, issue_id, author, text, created_at
		FROM comments ORDER BY created_at ASC
	`, cwd);

	const result = new Map<string, Comment[]>();
	for (const c of rows) {
		const list = result.get(c.issue_id) ?? [];
		list.push({ id: c.id, author: c.author, text: c.text, created_at: c.created_at });
		result.set(c.issue_id, list);
	}
	return result;
}

export function getAttachmentsForIssue(issueId: string, cwd?: string): Attachment[] {
	const dir = join(cwd ?? getStoredCwd(), '.beads', 'attachments', issueId);
	if (!existsSync(dir)) return [];

	return readdirSync(dir).map((filename) => {
		const filePath = join(dir, filename);
		const stats = statSync(filePath);
		return {
			filename,
			size: stats.size,
			mimetype: getMimetype(filename),
			created_at: stats.birthtime.toISOString(),
		};
	});
}

export function getAllAttachments(cwd?: string): Map<string, Attachment[]> {
	const attachmentsDir = join(cwd ?? getStoredCwd(), '.beads', 'attachments');
	if (!existsSync(attachmentsDir)) return new Map();

	const result = new Map<string, Attachment[]>();
	for (const issueId of readdirSync(attachmentsDir)) {
		const issueDir = join(attachmentsDir, issueId);
		const stat = statSync(issueDir);
		if (!stat.isDirectory()) continue;

		const attachments = getAttachmentsForIssue(issueId, cwd);
		if (attachments.length > 0) result.set(issueId, attachments);
	}
	return result;
}
