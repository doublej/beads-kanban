/**
 * Tracks which project cwds this beads-kanban session has touched via `bd sql`.
 * Used by the dolt reaper to limit kills to processes spawned from this session.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export const CACHE_DIR = join(homedir(), '.cache', 'beads-kanban');

function fileFor(parentPid: number): string {
	return join(CACHE_DIR, `touched-cwds-${parentPid}.json`);
}

export function resolveParentPid(): number {
	const env = process.env.BEADS_KANBAN_PARENT_PID;
	if (env && /^\d+$/.test(env)) return Number(env);
	return process.ppid;
}

function ensureCacheDir(): void {
	if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
}

function readList(parentPid: number): string[] {
	const file = fileFor(parentPid);
	if (!existsSync(file)) return [];
	try {
		const data = JSON.parse(readFileSync(file, 'utf-8'));
		return Array.isArray(data) ? data.filter((x) => typeof x === 'string') : [];
	} catch {
		return [];
	}
}

function writeAtomic(file: string, data: string): void {
	const tmp = `${file}.${process.pid}.tmp`;
	writeFileSync(tmp, data, 'utf-8');
	renameSync(tmp, file);
}

export function recordTouchedCwd(cwd: string, parentPid: number = resolveParentPid()): void {
	try {
		ensureCacheDir();
		const list = readList(parentPid);
		if (list.includes(cwd)) return;
		list.push(cwd);
		writeAtomic(fileFor(parentPid), JSON.stringify(list));
	} catch {
		// best-effort tracking; never throw from a hot read path
	}
}

export function readTouchedCwds(parentPid: number = resolveParentPid()): string[] {
	return readList(parentPid);
}

export function clearTouchedCwds(parentPid: number = resolveParentPid()): void {
	const file = fileFor(parentPid);
	if (existsSync(file)) {
		try { unlinkSync(file); } catch { /* ignore */ }
	}
}

export interface StaleCacheFile {
	parentPid: number;
	file: string;
	cwds: string[];
}

export function listStaleCacheFiles(): StaleCacheFile[] {
	if (!existsSync(CACHE_DIR)) return [];
	const stale: StaleCacheFile[] = [];
	for (const name of readdirSync(CACHE_DIR)) {
		const match = name.match(/^touched-cwds-(\d+)\.json$/);
		if (!match) continue;
		const parentPid = Number(match[1]);
		if (isPidAlive(parentPid)) continue;
		const file = join(CACHE_DIR, name);
		try {
			const data = JSON.parse(readFileSync(file, 'utf-8'));
			const cwds = Array.isArray(data) ? data.filter((x) => typeof x === 'string') : [];
			stale.push({ parentPid, file, cwds });
		} catch {
			stale.push({ parentPid, file, cwds: [] });
		}
	}
	return stale;
}

export function isPidAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch (err) {
		return (err as NodeJS.ErrnoException)?.code === 'EPERM';
	}
}
