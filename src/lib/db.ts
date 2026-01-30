/**
 * Read-only SQLite access to beads database.
 * SAFETY: Opens in readonly mode - cannot modify data.
 */
import Database from 'better-sqlite3';
import { join, resolve } from 'path';
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import type { Issue, Dependency, MutationEntry, MutationType, Attachment, Comment } from './types';
import { getMimetype } from './attachments';

const CONFIG_FILE = '/Users/jurrejan/Documents/development/_management/beads-kanban/.beads-cwd';

export function getStoredCwd(): string {
	if (existsSync(CONFIG_FILE)) {
		const stored = readFileSync(CONFIG_FILE, 'utf-8').trim();
		if (stored && existsSync(stored)) return stored;
	}
	// Fallback: BD_DB env var (extract dir from db path) or process.cwd()
	if (process.env.BD_DB) {
		const dir = process.env.BD_DB.replace(/\/.beads\/beads\.db$/, '');
		if (existsSync(dir)) return dir;
	}
	return process.cwd();
}

/** Returns --db flag to ensure bd targets the correct project database */
export function getBdDbFlag(): string {
	return `--db "${join(getStoredCwd(), '.beads', 'beads.db')}"`;
}

export function setStoredCwd(path: string): void {
	writeFileSync(CONFIG_FILE, path, 'utf-8');
}

function getDbPath(): string {
	return join(getStoredCwd(), '.beads', 'beads.db');
}

interface DbIssue {
	id: string;
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

function openReadonly(): Database.Database {
	return new Database(getDbPath(), { readonly: true, fileMustExist: true });
}

export function getAllIssues(): Issue[] {
	const db = openReadonly();

	const issues = db.prepare(`
		SELECT id, title, description, design, acceptance_criteria, notes,
		       status, priority, issue_type, assignee, created_at, updated_at, closed_at
		FROM issues
		WHERE status != 'tombstone'
		ORDER BY priority DESC, created_at DESC
	`).all() as DbIssue[];

	const deps = db.prepare(`
		SELECT d.issue_id, d.depends_on_id, d.type, i.title as dep_title, i.status as dep_status
		FROM dependencies d
		JOIN issues i ON i.id = d.depends_on_id
	`).all() as DbDependency[];

	const dependents = db.prepare(`
		SELECT d.depends_on_id as issue_id, d.issue_id as dependent_id, d.type, i.title, i.status
		FROM dependencies d
		JOIN issues i ON i.id = d.issue_id
	`).all() as { issue_id: string; dependent_id: string; type: string; title: string; status: string }[];

	const labels = db.prepare(`SELECT issue_id, label FROM labels`).all() as DbLabel[];

	db.close();

	// Build lookup maps
	const depsMap = new Map<string, Dependency[]>();
	for (const d of deps) {
		const list = depsMap.get(d.issue_id) ?? [];
		list.push({ id: d.depends_on_id, title: d.dep_title, status: d.dep_status, dependency_type: d.type });
		depsMap.set(d.issue_id, list);
	}

	const dependentsMap = new Map<string, Dependency[]>();
	for (const d of dependents) {
		const list = dependentsMap.get(d.issue_id) ?? [];
		list.push({ id: d.dependent_id, title: d.title, status: d.status, dependency_type: d.type });
		dependentsMap.set(d.issue_id, list);
	}

	const labelsMap = new Map<string, string[]>();
	for (const l of labels) {
		const list = labelsMap.get(l.issue_id) ?? [];
		list.push(l.label);
		labelsMap.set(l.issue_id, list);
	}

	// Get all attachments and comments in one pass
	const attachmentsMap = getAllAttachments();
	const commentsMap = getAllComments();

	return issues.map((row) => ({
		id: row.id,
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
		comments: commentsMap.get(row.id) ?? []
	}));
}

export function getIssueById(id: string): Issue | null {
	const db = openReadonly();

	const issue = db.prepare(`
		SELECT id, title, description, design, acceptance_criteria, notes,
		       status, priority, issue_type, assignee, created_at, updated_at, closed_at
		FROM issues
		WHERE id = ? AND status != 'tombstone'
	`).get(id) as DbIssue | undefined;

	if (!issue) {
		db.close();
		return null;
	}

	const deps = db.prepare(`
		SELECT d.depends_on_id, d.type, i.title as dep_title, i.status as dep_status
		FROM dependencies d
		JOIN issues i ON i.id = d.depends_on_id
		WHERE d.issue_id = ?
	`).all(id) as DbDependency[];

	const dependents = db.prepare(`
		SELECT d.issue_id as dependent_id, d.type, i.title, i.status
		FROM dependencies d
		JOIN issues i ON i.id = d.issue_id
		WHERE d.depends_on_id = ?
	`).all(id) as { dependent_id: string; type: string; title: string; status: string }[];

	const labels = db.prepare(`
		SELECT label FROM labels WHERE issue_id = ?
	`).all(id) as { label: string }[];

	db.close();

	// Get attachments and comments
	const attachmentsMap = getAllAttachments();
	const commentsMap = getAllComments();

	return {
		id: issue.id,
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
		comments: commentsMap.get(id) ?? []
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
			// Parse from comment: "Added dependency: X blocks Y" or "Removed dependency: X blocks Y"
			const depMatch = ev.comment?.match(/dependency:\s*(\S+)\s+blocks\s+(\S+)/i);
			if (!depMatch) return null;
			const action = ev.event_type === 'dependency_added' ? '+' : '-';
			return { ...base, mutationType: 'dependency', field: 'dependency', previousValue: null, newValue: `${action}${depMatch[2]}` };
		}
		case 'label_added':
		case 'label_removed': {
			// Parse from comment: "Added label: foo" or "Removed label: foo"
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
			return null; // Skip generic updates we can't categorize
		default:
			return null;
	}
}

export function getRecentEvents(limit = 100): MutationEntry[] {
	const db = openReadonly();
	const rows = db.prepare(`
		SELECT id, issue_id, event_type, actor, old_value, new_value, comment, created_at
		FROM events ORDER BY created_at DESC LIMIT ?
	`).all(limit) as DbEvent[];
	db.close();

	return rows.map(parseEventToMutation).filter((m): m is MutationEntry => m !== null);
}

interface DbComment {
	id: number;
	issue_id: string;
	author: string;
	text: string;
	created_at: string;
}

export function getComments(issueId: string): Comment[] {
	const db = openReadonly();
	const rows = db.prepare(`
		SELECT id, issue_id, author, text, created_at
		FROM comments WHERE issue_id = ? ORDER BY created_at ASC
	`).all(issueId) as DbComment[];
	db.close();

	return rows.map(c => ({ id: c.id, author: c.author, text: c.text, created_at: c.created_at }));
}

export function getAllComments(): Map<string, Comment[]> {
	const db = openReadonly();
	const rows = db.prepare(`
		SELECT id, issue_id, author, text, created_at
		FROM comments ORDER BY created_at ASC
	`).all() as DbComment[];
	db.close();

	const result = new Map<string, Comment[]>();
	for (const c of rows) {
		const list = result.get(c.issue_id) ?? [];
		list.push({ id: c.id, author: c.author, text: c.text, created_at: c.created_at });
		result.set(c.issue_id, list);
	}
	return result;
}

export function getAttachmentsForIssue(issueId: string): Attachment[] {
	const dir = join(getStoredCwd(), '.beads', 'attachments', issueId);
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

export function getAllAttachments(): Map<string, Attachment[]> {
	const attachmentsDir = join(getStoredCwd(), '.beads', 'attachments');
	if (!existsSync(attachmentsDir)) return new Map();

	const result = new Map<string, Attachment[]>();
	for (const issueId of readdirSync(attachmentsDir)) {
		const issueDir = join(attachmentsDir, issueId);
		const stat = statSync(issueDir);
		if (!stat.isDirectory()) continue;

		const attachments = getAttachmentsForIssue(issueId);
		if (attachments.length > 0) result.set(issueId, attachments);
	}
	return result;
}
