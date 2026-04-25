#!/usr/bin/env bun
/**
 * CLI entry point for beads-kanban.
 * Validates target directory, checks bd CLI, writes .beads-cwd, starts dev server.
 *
 * Subcommands:
 *   beads-kanban [path]         Start the dev server against [path].
 *   beads-kanban reap [opts]    Reap orphan `dolt sql-server` processes.
 *
 * Reaper helpers below are duplicated from src/lib/{touched-cwds,dolt-reaper}.ts so
 * the CLI stays compilable as a single file via `tsc -p bin/tsconfig.json` (no bundler).
 */

// Type guard for Bun runtime
declare const Bun: unknown | undefined

import { resolve, join, dirname } from 'path'
import { existsSync, writeFileSync, lstatSync, readFileSync, readdirSync, unlinkSync } from 'fs'
import { spawn, execSync, spawnSync } from 'child_process'
import { createInterface } from 'readline'
import { createServer, createConnection } from 'net'
import { homedir } from 'os'

const MIN_BD_VERSION = '1.0.0'
const AGENT_PORT = 9347
const APP_DIR = dirname(new URL('.', import.meta.url).pathname)
const CACHE_DIR = join(homedir(), '.cache', 'beads-kanban')

function parseVersion(v: string): number[] {
	return v.split('.').map(Number)
}

function versionAtLeast(current: string, minimum: string): boolean {
	const c = parseVersion(current)
	const m = parseVersion(minimum)
	for (let i = 0; i < 3; i++) {
		if ((c[i] ?? 0) > (m[i] ?? 0)) return true
		if ((c[i] ?? 0) < (m[i] ?? 0)) return false
	}
	return true
}

function fail(msg: string): never {
	console.error(`Error: ${msg}`)
	process.exit(1)
}

async function confirm(question: string): Promise<boolean> {
	const rl = createInterface({ input: process.stdin, output: process.stdout })
	return new Promise((res) => {
		rl.question(`${question} (y/n) `, (answer) => {
			rl.close()
			res(answer.toLowerCase().startsWith('y'))
		})
	})
}

function isPortInUse(port: number): Promise<boolean> {
	return new Promise((res) => {
		const sock = createConnection({ port, host: '127.0.0.1' })
		sock.on('connect', () => { sock.destroy(); res(true) })
		sock.on('error', () => res(false))
	})
}

function findFreePort(start = 5185): Promise<number> {
	return new Promise((res, rej) => {
		const srv = createServer()
		srv.listen(start, '127.0.0.1', () => {
			srv.close(() => res(start))
		})
		srv.on('error', () => {
			if (start >= 65535) return rej(new Error('No free port found'))
			res(findFreePort(start + 1))
		})
	})
}

// --- Reaper helpers (duplicated from src/lib/dolt-reaper.ts and src/lib/touched-cwds.ts) ---

interface DoltOrphan { pid: number; cwd: string }

function isPidAlive(pid: number): boolean {
	try {
		process.kill(pid, 0)
		return true
	} catch (err) {
		return (err as NodeJS.ErrnoException)?.code === 'EPERM'
	}
}

function readTouchedCwdsFile(file: string): string[] {
	if (!existsSync(file)) return []
	try {
		const data = JSON.parse(readFileSync(file, 'utf-8'))
		return Array.isArray(data) ? data.filter((x: unknown) => typeof x === 'string') : []
	} catch {
		return []
	}
}

function listDoltCandidates(): { pid: number }[] {
	const result = spawnSync('ps', ['-axo', 'pid,command'], { encoding: 'utf-8' })
	if (result.status !== 0 || result.error) return []
	const out: { pid: number }[] = []
	for (const raw of result.stdout.split('\n').slice(1)) {
		const line = raw.trim()
		if (!line) continue
		const m = line.match(/^(\d+)\s+(.*)$/)
		if (!m) continue
		if (!m[2].includes('dolt sql-server')) continue
		out.push({ pid: Number(m[1]) })
	}
	return out
}

function lsofCwd(pid: number): string | null {
	const result = spawnSync('lsof', ['-a', '-d', 'cwd', '-p', String(pid), '-Fn'], {
		encoding: 'utf-8',
		timeout: 3000,
	})
	if (result.status !== 0 || result.error) return null
	for (const line of result.stdout.split('\n')) {
		if (line.startsWith('n')) return line.slice(1)
	}
	return null
}

function isInside(cwd: string, root: string): boolean {
	const c = resolve(cwd)
	const r = resolve(root)
	return c === r || c.startsWith(r.endsWith('/') ? r : r + '/')
}

function findOrphanedDoltPids(cwds: string[]): DoltOrphan[] {
	if (cwds.length === 0) return []
	const roots = cwds.map((c) => resolve(c))
	const out: DoltOrphan[] = []
	for (const { pid } of listDoltCandidates()) {
		const cwd = lsofCwd(pid)
		if (!cwd) continue
		if (roots.some((r) => isInside(cwd, r))) out.push({ pid, cwd })
	}
	return out
}

function findAllOrphanedDoltPids(): DoltOrphan[] {
	const out: DoltOrphan[] = []
	for (const { pid } of listDoltCandidates()) {
		const cwd = lsofCwd(pid)
		if (!cwd) continue
		if (cwd.includes('/.beads/dolt')) out.push({ pid, cwd })
	}
	return out
}

function killDoltPids(orphans: DoltOrphan[]): { killed: DoltOrphan[]; failed: { orphan: DoltOrphan; err: string }[] } {
	const killed: DoltOrphan[] = []
	const failed: { orphan: DoltOrphan; err: string }[] = []
	for (const o of orphans) {
		try {
			process.kill(o.pid, 'SIGTERM')
			killed.push(o)
		} catch (err) {
			failed.push({ orphan: o, err: err instanceof Error ? err.message : String(err) })
		}
	}
	return { killed, failed }
}

function printReapResult(label: string, killed: DoltOrphan[], failed: { orphan: DoltOrphan; err: string }[]): void {
	for (const o of killed) console.log(`[beads-kanban] ${label} reaped pid=${o.pid} cwd=${o.cwd}`)
	for (const f of failed) console.error(`[beads-kanban] ${label} failed pid=${f.orphan.pid} cwd=${f.orphan.cwd}: ${f.err}`)
}

function reapTouched(): { killed: DoltOrphan[]; failed: { orphan: DoltOrphan; err: string }[]; cleared: number } {
	if (!existsSync(CACHE_DIR)) return { killed: [], failed: [], cleared: 0 }
	const cwds = new Set<string>()
	const filesToClear: string[] = []
	for (const name of readdirSync(CACHE_DIR)) {
		const m = name.match(/^touched-cwds-(\d+)\.json$/)
		if (!m) continue
		const parentPid = Number(m[1])
		if (isPidAlive(parentPid)) continue
		const file = join(CACHE_DIR, name)
		filesToClear.push(file)
		for (const cwd of readTouchedCwdsFile(file)) cwds.add(cwd)
	}
	const orphans = findOrphanedDoltPids([...cwds])
	const result = killDoltPids(orphans)
	for (const f of filesToClear) {
		try { unlinkSync(f) } catch { /* ignore */ }
	}
	return { ...result, cleared: filesToClear.length }
}

function reapAll(): { killed: DoltOrphan[]; failed: { orphan: DoltOrphan; err: string }[] } {
	const orphans = findAllOrphanedDoltPids()
	return killDoltPids(orphans)
}

function reapScanCwd(dir: string): { killed: DoltOrphan[]; failed: { orphan: DoltOrphan; err: string }[] } {
	const orphans = findOrphanedDoltPids([dir])
	return killDoltPids(orphans)
}

function printReapHelp(): void {
	console.log(`Usage: beads-kanban reap [--touched|--all|--scan-cwd <dir>]

  --touched          Default. Reap dolt servers from cache files of dead beads-kanban sessions.
  --all              Reap any orphan dolt sql-server whose cwd contains /.beads/dolt. Use with care.
  --scan-cwd <dir>   Reap only dolt servers whose cwd is inside <dir>.
`)
}

async function runReap(args: string[]): Promise<number> {
	if (args.includes('-h') || args.includes('--help')) {
		printReapHelp()
		return 0
	}
	const allFlag = args.includes('--all')
	const scanIdx = args.indexOf('--scan-cwd')
	if (allFlag && scanIdx >= 0) {
		console.error('Error: --all and --scan-cwd are mutually exclusive')
		return 2
	}
	if (allFlag) {
		const { killed, failed } = reapAll()
		printReapResult('all', killed, failed)
		console.log(`[beads-kanban] reaped ${killed.length} dolt server(s); ${failed.length} failed`)
		return failed.length === 0 ? 0 : 1
	}
	if (scanIdx >= 0) {
		const dir = args[scanIdx + 1]
		if (!dir) {
			console.error('Error: --scan-cwd requires a directory argument')
			return 2
		}
		const resolved = resolve(dir)
		if (!existsSync(resolved)) {
			console.error(`Error: directory not found: ${resolved}`)
			return 2
		}
		const { killed, failed } = reapScanCwd(resolved)
		printReapResult('scan-cwd', killed, failed)
		console.log(`[beads-kanban] reaped ${killed.length} dolt server(s) under ${resolved}; ${failed.length} failed`)
		return failed.length === 0 ? 0 : 1
	}
	// default: --touched
	const { killed, failed, cleared } = reapTouched()
	printReapResult('touched', killed, failed)
	console.log(`[beads-kanban] reaped ${killed.length} dolt server(s); cleared ${cleared} stale cache file(s); ${failed.length} failed`)
	return failed.length === 0 ? 0 : 1
}

function reapOnShutdown(parentPid: number): void {
	const file = join(CACHE_DIR, `touched-cwds-${parentPid}.json`)
	const cwds = readTouchedCwdsFile(file)
	if (process.env.BEADS_KANBAN_AUTO_REAP === '1' && cwds.length > 0) {
		try {
			const orphans = findOrphanedDoltPids(cwds)
			const { killed, failed } = killDoltPids(orphans)
			console.error(`[beads-kanban] reaped ${killed.length} dolt server(s)${failed.length ? `; ${failed.length} failed` : ''}`)
		} catch (err) {
			console.error(`[beads-kanban] auto-reap error: ${err instanceof Error ? err.message : String(err)}`)
		}
	}
	if (existsSync(file)) {
		try { unlinkSync(file) } catch { /* ignore */ }
	}
}

async function main() {
	const argv = process.argv.slice(2)
	if (argv[0] === 'reap') {
		process.exit(await runReap(argv.slice(1)))
	}

	const target = resolve(argv[0] ?? process.cwd())

	if (!existsSync(target)) fail(`Directory not found: ${target}`)
	if (!lstatSync(target).isDirectory()) fail(`Not a directory: ${target}`)

	// Check bd version
	try {
		const output = execSync('bd --version', { encoding: 'utf-8' }).trim()
		const bdVersion = output.match(/(\d+\.\d+\.\d+)/)?.[1]
		if (!bdVersion || !versionAtLeast(bdVersion, MIN_BD_VERSION)) {
			fail(`bd ${bdVersion ?? 'unknown'} is too old (need >= ${MIN_BD_VERSION}). Upgrade with: brew upgrade bd`)
		}
	} catch {
		fail('bd CLI not found. Install with: brew install bd')
	}

	// Initialize beads if needed
	if (!existsSync(join(target, '.beads'))) {
		if (!await confirm(`No .beads/ found in ${target}. Initialize beads?`)) process.exit(1)
		try {
			execSync('bd init', { cwd: target, stdio: 'inherit' })
			execSync('bd doctor --fix --yes', { cwd: target, stdio: 'inherit' })
		} catch (err) {
			fail(`bd init failed: ${err instanceof Error ? err.message : 'unknown error'}`)
		}
	}

	// Write .beads-cwd and start server
	writeFileSync(join(APP_DIR, '.beads-cwd'), target, 'utf-8')
	console.log(`Targeting: ${target}`)

	const childEnv = { ...process.env, BEADS_KANBAN_PARENT_PID: String(process.pid) }

	// Spawn agent WebSocket server (optional — vite continues if it crashes)
	let agentChild: ReturnType<typeof spawn> | null = null
	const agentPortInUse = await isPortInUse(AGENT_PORT)
	if (agentPortInUse) {
		console.log(`Agent server already running on port ${AGENT_PORT}, reusing`)
	} else {
		agentChild = spawn('bun', ['run', join(APP_DIR, 'src/lib/server/agent/index.ts')], {
			cwd: APP_DIR,
			stdio: 'inherit',
			env: childEnv,
		})
		agentChild.on('exit', (code) => {
			if (code !== 0 && code !== null) console.warn(`Agent server exited with code ${code}`)
		})
	}

	const launcher = typeof Bun !== 'undefined' ? 'bunx' : 'npx'
	const child = spawn(launcher, ['vite', 'dev', '--host', '--port', String(await findFreePort())], {
		cwd: APP_DIR,
		stdio: 'inherit',
		env: childEnv,
	})

	let shuttingDown = false
	const shutdown = (sig: NodeJS.Signals | null) => {
		if (shuttingDown) return
		shuttingDown = true
		if (sig) {
			agentChild?.kill(sig)
			child.kill(sig)
		}
		reapOnShutdown(process.pid)
	}

	child.on('exit', (code) => {
		shutdown(null)
		agentChild?.kill()
		process.exit(code ?? 0)
	})
	;(['SIGINT', 'SIGTERM'] as const).forEach((sig) =>
		process.on(sig, () => shutdown(sig))
	)
}

main()
