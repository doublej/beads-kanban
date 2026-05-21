/**
 * Read-only database access via `bd sql --json`.
 * Requires bd in Dolt server mode (`bd init --server`); embedded mode does not expose `bd sql`.
 * Min bd version: see MIN_BD_VERSION in bd.ts.
 */
import { spawnSync } from 'child_process';
import { join, resolve } from 'path';
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import type { Issue, Dependency, MutationEntry, Attachment, Comment, AgentModel, AgentEffort } from './types';
import { getMimetype } from './attachments';
import { recordTouchedCwd } from './touched-cwds';
import { bdEnv, unwrapBdJson } from './bd';

const CONFIG_FILE = join(process.cwd(), '.beads-cwd');

const doctorRanForCwd = new Set<string>();

/** True the first time this process sees `cwd`; subsequent calls return false. Session-scoped. */
export function markDoctorRan(cwd: string): boolean {
	if (doctorRanForCwd.has(cwd)) return false;
	doctorRanForCwd.add(cwd);
	return true;
}

export function getStoredCwd(): string {
	if (existsSync(CONFIG_FILE)) {
		const stored = readFileSync(CONFIG_FILE, 'utf-8').trim();
		if (stored && existsSync(stored)) return stored;
	}
	return process.cwd();
}

export function setStoredCwd(path: string): void {
	writeFileSync(CONFIG_FILE, path, 'utf-8');
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

function buildMap<T, V>(rows: T[], key: (r: T) => string, val: (r: T) => V): Map<string, V[]> {
	const map = new Map<string, V[]>();
	for (const r of rows) {
		const list = map.get(key(r)) ?? [];
		list.push(val(r));
		map.set(key(r), list);
	}
	return map;
}

/** Run a SELECT query via `bd sql --json`. Uses spawnSync to avoid shell-quoting issues. */
function bdSql<T>(query: string, cwd?: string): T[] {
	const effectiveCwd = cwd ?? getStoredCwd();
	recordTouchedCwd(effectiveCwd);
	const result = spawnSync('bd', ['sql', '--json', query], {
		cwd: effectiveCwd,
		encoding: 'utf-8',
		timeout: 10000,
		env: bdEnv()
	});
	if (result.status !== 0 || result.error) {
		const msg = result.stderr?.trim() || result.error?.message || 'bd sql failed';
		throw new Error(msg);
	}
	return unwrapBdJson<T[]>(result.stdout.trim());
}

interface DbIssue {
	id: string;
	seq: number;
	title: string;
	description: string;
	design: string;
	acceptance_criteria: string;
	notes: string;
	status: string;
	priority: number;
	issue_type: string;
	assignee: string | null;
	created_at: string;
	updated_at: string;
	closed_at: string | null;
	metadata: string | null;
}

interface IssueMetadata {
	agent_model?: AgentModel;
	agent_effort?: AgentEffort;
}

function parseMetadata(raw: string | null): IssueMetadata {
	if (!raw) return {};
	try {
		return JSON.parse(raw) as IssueMetadata;
	} catch {
		return {};
	}
}

interface DbDependency {
	issue_id: string;
	depends_on_id: string;
	type: string;
	dep_title: string;
	dep_status: string;
}

interface DbLabel {
	issue_id: string;
	label: string;
}

export function getAllIssues(cwd?: string): Issue[] {
	const issues = bdSql<DbIssue>(`
		SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as seq,
		       title, description, design, acceptance_criteria, notes,
		       status, priority, issue_type, assignee, created_at, updated_at, closed_at, metadata
		FROM issues
		WHERE status <> 'tombstone'
		ORDER BY priority DESC, created_at DESC
	`, cwd);

	const deps = bdSql<DbDependency>(`
		SELECT d.issue_id, d.depends_on_id, d.type, i.title as dep_title, i.status as dep_status
		FROM dependencies d
		JOIN issues i ON i.id = d.depends_on_id
	`, cwd);

	const dependents = bdSql<{ issue_id: string; dependent_id: string; type: string; title: string; status: string }>(`
		SELECT d.depends_on_id as issue_id, d.issue_id as dependent_id, d.type, i.title, i.status
		FROM dependencies d
		JOIN issues i ON i.id = d.issue_id
	`, cwd);

	const labels = bdSql<DbLabel>(`SELECT issue_id, label FROM labels`, cwd);

	// Build lookup maps
	const depsMap = buildMap(deps, d => d.issue_id, d => ({ id: d.depends_on_id, title: d.dep_title, status: d.dep_status, dependency_type: d.type }));
	const dependentsMap = buildMap(dependents, d => d.issue_id, d => ({ id: d.dependent_id, title: d.title, status: d.status, dependency_type: d.type }));
	const labelsMap = buildMap(labels, l => l.issue_id, l => l.label);

	const attachmentsMap = getAllAttachments(cwd);
	const commentsMap = getAllComments(cwd);

	return issues.map((row) => {
		const meta = parseMetadata(row.metadata);
		return {
			id: row.id,
			seq: row.seq,
			title: row.title,
			description: row.description,
			design: row.design || undefined,
			acceptance_criteria: row.acceptance_criteria || undefined,
			notes: row.notes || undefined,
			status: row.status as Issue['status'],
			priority: row.priority as Issue['priority'],
			issue_type: row.issue_type,
			assignee: row.assignee ?? undefined,
			created_at: row.created_at,
			updated_at: row.updated_at,
			closed_at: row.closed_at ?? undefined,
			labels: labelsMap.get(row.id) ?? [],
			dependencies: depsMap.get(row.id) ?? [],
			dependents: dependentsMap.get(row.id) ?? [],
			dependency_count: depsMap.get(row.id)?.length ?? 0,
			dependent_count: dependentsMap.get(row.id)?.length ?? 0,
			attachments: attachmentsMap.get(row.id) ?? [],
			comments: commentsMap.get(row.id) ?? [],
			agent_model: meta.agent_model,
			agent_effort: meta.agent_effort
		};
	});
}

export function getIssueById(id: string, cwd?: string): Issue | null {
	const sid = safeId(id);
	const issues = bdSql<DbIssue>(`
		SELECT id, seq, title, description, design, acceptance_criteria, notes,
		       status, priority, issue_type, assignee, created_at, updated_at, closed_at, metadata
		FROM (
			SELECT *, ROW_NUMBER() OVER (ORDER BY created_at) as seq
			FROM issues
			WHERE status <> 'tombstone'
		) t WHERE id = '${sid}'
	`, cwd);

	const issue = issues[0];
	if (!issue) return null;

	const deps = bdSql<DbDependency>(`
		SELECT d.depends_on_id, d.type, i.title as dep_title, i.status as dep_status
		FROM dependencies d
		JOIN issues i ON i.id = d.depends_on_id
		WHERE d.issue_id = '${sid}'
	`, cwd);

	const dependents = bdSql<{ dependent_id: string; type: string; title: string; status: string }>(`
		SELECT d.issue_id as dependent_id, d.type, i.title, i.status
		FROM dependencies d
		JOIN issues i ON i.id = d.issue_id
		WHERE d.depends_on_id = '${sid}'
	`, cwd);

	const labels = bdSql<{ label: string }>(`
		SELECT label FROM labels WHERE issue_id = '${sid}'
	`, cwd);

	const attachmentsMap = getAllAttachments(cwd);
	const commentsMap = getAllComments(cwd);
	const meta = parseMetadata(issue.metadata);

	return {
		id: issue.id,
		seq: issue.seq,
		title: issue.title,
		description: issue.description,
		design: issue.design || undefined,
		acceptance_criteria: issue.acceptance_criteria || undefined,
		notes: issue.notes || undefined,
		status: issue.status as Issue['status'],
		priority: issue.priority as Issue['priority'],
		issue_type: issue.issue_type,
		assignee: issue.assignee || undefined,
		created_at: issue.created_at,
		updated_at: issue.updated_at || undefined,
		closed_at: issue.closed_at || undefined,
		labels: labels.map(l => l.label),
		dependencies: deps.map(d => ({
			id: d.depends_on_id,
			title: d.dep_title,
			status: d.dep_status,
			dependency_type: d.type
		})),
		dependents: dependents.map(d => ({
			id: d.dependent_id,
			title: d.title,
			status: d.status,
			dependency_type: d.type
		})),
		dependency_count: deps.length,
		dependent_count: dependents.length,
		attachments: attachmentsMap.get(id) ?? [],
		comments: commentsMap.get(id) ?? [],
		agent_model: meta.agent_model,
		agent_effort: meta.agent_effort
	};
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

function parseEventToMutation(ev: DbEvent): MutationEntry | null {
	const oldVal = ev.old_value ? JSON.parse(ev.old_value) : null;
	const newVal = ev.new_value ? JSON.parse(ev.new_value) : null;
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
	id: number;
	issue_id: string;
	author: string;
	text: string;
	created_at: string;
}

export function getComments(issueId: string, cwd?: string): Comment[] {
	const sid = safeId(issueId);
	const rows = bdSql<DbComment>(`
		SELECT id, issue_id, author, text, created_at
		FROM comments WHERE issue_id = '${sid}' ORDER BY created_at ASC
	`, cwd);

	return rows.map(c => ({ id: c.id, author: c.author, text: c.text, created_at: c.created_at }));
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
