/**
 * Reaps `dolt sql-server` processes whose cwd is inside a supplied directory
 * list. The cwd-scope check is the safety net (works on macOS launchd and
 * Linux systemd reparenting). Pure stdlib so it can be imported from both
 * the SvelteKit server and the CLI entry point.
 */
import { spawnSync } from 'child_process';
import { resolve } from 'path';

export interface DoltOrphan {
	pid: number;
	cwd: string;
}

export interface ReapResult {
	killed: number[];
	failed: { pid: number; err: string }[];
}

const DOLT_CMD_MARKER = 'dolt sql-server';

function listDoltCandidates(): { pid: number }[] {
	const result = spawnSync('ps', ['-axo', 'pid,command'], { encoding: 'utf-8' });
	if (result.status !== 0 || result.error) return [];
	const lines = result.stdout.split('\n').slice(1);
	const out: { pid: number }[] = [];
	for (const raw of lines) {
		const line = raw.trim();
		if (!line) continue;
		const match = line.match(/^(\d+)\s+(.*)$/);
		if (!match) continue;
		if (!match[2].includes(DOLT_CMD_MARKER)) continue;
		out.push({ pid: Number(match[1]) });
	}
	return out;
}

function lsofCwd(pid: number): string | null {
	const result = spawnSync('lsof', ['-a', '-d', 'cwd', '-p', String(pid), '-Fn'], {
		encoding: 'utf-8',
		timeout: 3000
	});
	if (result.status !== 0 || result.error) return null;
	for (const line of result.stdout.split('\n')) {
		if (line.startsWith('n')) return line.slice(1);
	}
	return null;
}

function isInside(cwd: string, root: string): boolean {
	const c = resolve(cwd);
	const r = resolve(root);
	return c === r || c.startsWith(r.endsWith('/') ? r : r + '/');
}

/** Find orphan dolt sql-server PIDs whose cwd is inside any of the supplied directories. */
export function findOrphanedDoltPids(cwds: string[]): DoltOrphan[] {
	if (cwds.length === 0) return [];
	const roots = cwds.map((c) => resolve(c));
	const out: DoltOrphan[] = [];
	for (const { pid } of listDoltCandidates()) {
		const cwd = lsofCwd(pid);
		if (!cwd) continue;
		if (roots.some((r) => isInside(cwd, r))) out.push({ pid, cwd });
	}
	return out;
}

/** Find every orphan dolt sql-server whose cwd path contains `/.beads/dolt`. */
export function findAllOrphanedDoltPids(): DoltOrphan[] {
	const out: DoltOrphan[] = [];
	for (const { pid } of listDoltCandidates()) {
		const cwd = lsofCwd(pid);
		if (!cwd) continue;
		if (cwd.includes('/.beads/dolt')) out.push({ pid, cwd });
	}
	return out;
}

/** Send SIGTERM to each PID. No SIGKILL escalation. */
export function killDoltPids(pids: number[]): ReapResult {
	const killed: number[] = [];
	const failed: { pid: number; err: string }[] = [];
	for (const pid of pids) {
		try {
			process.kill(pid, 'SIGTERM');
			killed.push(pid);
		} catch (err) {
			failed.push({ pid, err: err instanceof Error ? err.message : String(err) });
		}
	}
	return { killed, failed };
}
