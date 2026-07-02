/**
 * Enriches stored projects with beads activity + atlas metadata for the
 * project switcher. All reads are best-effort: a missing .beads or atlas cache
 * degrades to no stats/meta rather than failing the request.
 */
import { readFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import type { Project, ProjectStats, ProjectMeta } from '$lib/types';

const ATLAS_CACHE_FILE = '.atlas-cache.json';

function stripSlash(p: string): string {
	return p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p;
}

// --- Atlas metadata (cached in-memory, re-read when the file changes) ---

interface AtlasEntry {
	path: string;
	name?: string;
	relativePath?: string;
	description?: string;
	type?: string;
	framework?: string;
	runner?: string;
	devCommand?: string;
	deploy?: Array<{ platform?: string; url?: string }>;
	archived?: boolean;
	git?: string;
	gitBranch?: string;
	modifiedAt?: string;
}

let atlasCache: { path: string; mtimeMs: number; byPath: Map<string, AtlasEntry> } | null = null;

/** Walk up from each project path to find the nearest .atlas-cache.json. */
function findAtlasCachePath(fromPaths: string[]): string | null {
	for (const start of fromPaths) {
		let dir = stripSlash(start);
		for (let i = 0; i < 8 && dir && dir !== '/'; i++) {
			const candidate = join(dir, ATLAS_CACHE_FILE);
			if (existsSync(candidate)) return candidate;
			dir = dirname(dir);
		}
	}
	return null;
}

async function loadAtlas(fromPaths: string[]): Promise<Map<string, AtlasEntry>> {
	const cachePath = findAtlasCachePath(fromPaths);
	if (!cachePath) return new Map();
	try {
		const mtimeMs = (await stat(cachePath)).mtimeMs;
		if (atlasCache && atlasCache.path === cachePath && atlasCache.mtimeMs === mtimeMs) {
			return atlasCache.byPath;
		}
		const parsed = JSON.parse(await readFile(cachePath, 'utf-8'));
		const entries: AtlasEntry[] = parsed?.projects ?? parsed?.entries ?? [];
		const byPath = new Map<string, AtlasEntry>();
		for (const e of entries) {
			if (e?.path) byPath.set(stripSlash(e.path), e);
		}
		atlasCache = { path: cachePath, mtimeMs, byPath };
		return byPath;
	} catch {
		return new Map();
	}
}

function clean(v: string | undefined): string | undefined {
	if (!v || v === 'unknown' || v === '__HAS_README__') return undefined;
	return v;
}

function metaFrom(entry: AtlasEntry | undefined): ProjectMeta | undefined {
	if (!entry) return undefined;
	const meta: ProjectMeta = {};
	if (clean(entry.name)) meta.title = entry.name;
	if (clean(entry.relativePath)) meta.relativePath = entry.relativePath;
	if (clean(entry.description)) meta.description = entry.description;
	if (clean(entry.type)) meta.type = entry.type;
	if (clean(entry.framework)) meta.framework = entry.framework;
	if (clean(entry.runner)) meta.runner = entry.runner;
	const platforms = (entry.deploy ?? [])
		.map((d) => clean(d?.platform))
		.filter((p): p is string => Boolean(p));
	if (platforms.length) meta.deploy = [...new Set(platforms)];
	if (entry.archived) meta.archived = true;
	if (clean(entry.git)) meta.git = entry.git;
	if (clean(entry.gitBranch)) meta.gitBranch = entry.gitBranch;
	return Object.keys(meta).length ? meta : undefined;
}

// --- Beads activity, read directly from the project's JSONL export ---

async function readBeadsStats(projectPath: string, sinceISO: string): Promise<ProjectStats | undefined> {
	const jsonl = join(projectPath, '.beads', 'issues.jsonl');
	if (!existsSync(jsonl)) return undefined;
	let raw: string;
	try {
		raw = await readFile(jsonl, 'utf-8');
	} catch {
		return undefined;
	}

	// Dedup by id (JSONL is an append log — keep the latest record per issue).
	const latest = new Map<string, { status?: string; updated_at?: string }>();
	for (const line of raw.split('\n')) {
		if (!line) continue;
		let rec: { _type?: string; id?: string; status?: string; updated_at?: string };
		try {
			rec = JSON.parse(line);
		} catch {
			continue;
		}
		if (rec._type !== 'issue' || !rec.id) continue;
		const prev = latest.get(rec.id);
		if (!prev || (rec.updated_at ?? '') >= (prev.updated_at ?? '')) latest.set(rec.id, rec);
	}

	const since = Date.parse(sinceISO);
	let active = 0;
	let changed = 0;
	let lastActivity: string | null = null;
	for (const rec of latest.values()) {
		if (rec.status !== 'closed') active++;
		if (rec.updated_at) {
			if (!lastActivity || rec.updated_at > lastActivity) lastActivity = rec.updated_at;
			if (Number.isFinite(since) && Date.parse(rec.updated_at) > since) changed++;
		}
	}
	return { active, total: latest.size, changed, lastActivity };
}

/** Attach `stats` (beads) and `meta` (atlas) to each project. Runs reads in parallel. */
export async function enrichProjects(projects: Project[]): Promise<Project[]> {
	const atlas = await loadAtlas(projects.map((p) => p.path));
	return Promise.all(
		projects.map(async (p) => ({
			...p,
			stats: await readBeadsStats(p.path, p.lastAccess),
			meta: metaFrom(atlas.get(stripSlash(p.path))),
		})),
	);
}
