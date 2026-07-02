#!/usr/bin/env bun
/**
 * CLI entry point for bdk (beads-kanban).
 * Validates target directory, checks bd CLI, writes .beads-cwd, starts dev server.
 *
 * Subcommands:
 *   bdk [path]            Start the dev server against [path] (default: cwd).
 *   bdk zen <ids>         Start the server and open focus review for the given ids.
 *   bdk reap [opts]       Reap orphan `dolt sql-server` processes.
 *   bdk help              Show usage.
 *
 * Reaper helpers below are duplicated from src/lib/{touched-cwds,dolt-reaper}.ts so
 * the CLI stays compilable as a single file via `tsc -p bin/tsconfig.json` (no bundler).
 * Keep behavior in sync between the two; future bundler swap can dedupe.
 */

// Type guard for Bun runtime
declare const Bun: unknown | undefined

import { resolve, join, dirname } from 'path'
import { existsSync, mkdirSync, writeFileSync, lstatSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync } from 'fs'
import { spawn, execSync, spawnSync } from 'child_process'
import { createInterface } from 'readline'
import { createServer, createConnection } from 'net'
import { homedir } from 'os'

const MIN_BD_VERSION = '1.0.0'
const AGENT_PORT = 9347
const APP_DIR = dirname(new URL('.', import.meta.url).pathname)
const CACHE_DIR = join(homedir(), '.cache', 'beads-kanban')
/** Tracks the most-recently-started board so `bdk open` can reuse it instead of spawning another. */
const ACTIVE_SERVER_FILE = join(CACHE_DIR, 'active-server.json')

interface ActiveServer { cwd: string; port: number; pid: number }

function writeActiveServer(cwd: string, port: number): void {
	try {
		if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true })
		const record: ActiveServer = { cwd, port, pid: process.pid }
		writeFileSync(ACTIVE_SERVER_FILE, JSON.stringify(record), 'utf-8')
	} catch { /* best-effort — reuse is an optimization, not required */ }
}

function readActiveServer(): ActiveServer | null {
	if (!existsSync(ACTIVE_SERVER_FILE)) return null
	try {
		const r = JSON.parse(readFileSync(ACTIVE_SERVER_FILE, 'utf-8'))
		if (typeof r?.cwd === 'string' && typeof r?.port === 'number' && typeof r?.pid === 'number') return r
	} catch { /* stale/corrupt — treat as none */ }
	return null
}

function clearActiveServer(): void {
	// Only clear if the record belongs to this process; a newer board may have overwritten it.
	const r = readActiveServer()
	if (r && r.pid === process.pid && existsSync(ACTIVE_SERVER_FILE)) {
		try { unlinkSync(ACTIVE_SERVER_FILE) } catch { /* ignore */ }
	}
}

/** Env to pass to every `bd` spawn. Enables bd 1.0 JSON envelope so output stays self-describing. */
function bdEnv(): NodeJS.ProcessEnv {
	return { ...process.env, BD_JSON_ENVELOPE: '1' }
}

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

function tryDoltStop(cwd: string): boolean {
	const result = spawnSync('bd', ['dolt', 'stop'], {
		cwd,
		encoding: 'utf-8',
		timeout: 5000,
		env: bdEnv(),
	})
	return result.status === 0 && !result.error
}

function killDoltPids(orphans: DoltOrphan[]): { killed: DoltOrphan[]; failed: { orphan: DoltOrphan; err: string }[] } {
	const killed: DoltOrphan[] = []
	const failed: { orphan: DoltOrphan; err: string }[] = []
	for (const o of orphans) {
		if (tryDoltStop(o.cwd)) {
			killed.push(o)
			continue
		}
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
	console.log(`Usage: bdk reap [--touched|--all|--scan-cwd <dir>]

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

function autoReapEnabled(): boolean {
	return process.env.BEADS_KANBAN_AUTO_REAP !== '0'
}

const LOG_ROTATE_MAX_BYTES = 10 * 1024 * 1024 // 10 MB

function rotateIfLarge(file: string): void {
	if (!existsSync(file)) return
	try {
		if (statSync(file).size <= LOG_ROTATE_MAX_BYTES) return
		const backup = `${file}.1`
		if (existsSync(backup)) unlinkSync(backup)
		renameSync(file, backup)
	} catch (err) {
		console.error(`[beads-kanban] log rotation failed for ${file}: ${err instanceof Error ? err.message : String(err)}`)
	}
}

function rotateLogs(target: string): void {
	rotateIfLarge(join(target, '.beads', 'dolt-server.log'))
	rotateIfLarge(join(target, '.beads', 'daemon.log'))
}

function reapOnShutdown(parentPid: number): void {
	const file = join(CACHE_DIR, `touched-cwds-${parentPid}.json`)
	const cwds = readTouchedCwdsFile(file)
	if (autoReapEnabled() && cwds.length > 0) {
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

// --- Browser open + readiness ---

function openBrowser(url: string): void {
	const cmd = process.platform === 'darwin' ? 'open'
		: process.platform === 'win32' ? 'start'
		: 'xdg-open'
	try {
		const child = spawn(cmd, [url], {
			stdio: 'ignore',
			detached: true,
			shell: process.platform === 'win32',
		})
		child.on('error', () => console.log(`Open manually: ${url}`))
		child.unref()
	} catch {
		console.log(`Open manually: ${url}`)
	}
}

function delay(ms: number): Promise<void> {
	return new Promise((res) => setTimeout(res, ms))
}

async function waitForPort(port: number, timeoutMs = 30000): Promise<boolean> {
	const deadline = Date.now() + timeoutMs
	while (Date.now() < deadline) {
		if (await isPortInUse(port)) return true
		await delay(250)
	}
	return false
}

// --- Server startup ---

async function preflight(target: string): Promise<void> {
	if (!existsSync(target)) fail(`Directory not found: ${target}`)
	if (!lstatSync(target).isDirectory()) fail(`Not a directory: ${target}`)

	// Check bd version
	try {
		const output = execSync('bd --version', { encoding: 'utf-8', env: bdEnv() }).trim()
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
			execSync('bd init', { cwd: target, stdio: 'inherit', env: bdEnv() })
			execSync('bd doctor --fix --yes', { cwd: target, stdio: 'inherit', env: bdEnv() })
		} catch (err) {
			fail(`bd init failed: ${err instanceof Error ? err.message : 'unknown error'}`)
		}
	}

	// Rotate large logs (>10 MB) before they grow further this session
	rotateLogs(target)
}

async function startServer(target: string, opts: { openPath?: string } = {}): Promise<void> {
	await preflight(target)

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

	const port = await findFreePort()
	writeActiveServer(target, port)
	const launcher = typeof Bun !== 'undefined' ? 'bunx' : 'npx'
	const child = spawn(launcher, ['vite', 'dev', '--host', '--port', String(port)], {
		cwd: APP_DIR,
		stdio: 'inherit',
		env: childEnv,
	})

	// Once the dev server is listening, open the requested deep link (vite uses HTTPS).
	if (opts.openPath) {
		const url = `https://localhost:${port}${opts.openPath}`
		waitForPort(port).then((up) => {
			if (up) { console.log(`Opening ${url}`); openBrowser(url) }
			else console.log(`Server not ready in time. Open manually: ${url}`)
		})
	}

	let shuttingDown = false
	const shutdown = (sig: NodeJS.Signals | null) => {
		if (shuttingDown) return
		shuttingDown = true
		if (sig) {
			agentChild?.kill(sig)
			child.kill(sig)
		}
		reapOnShutdown(process.pid)
		clearActiveServer()
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

// --- zen subcommand ---

function parseIds(args: string[]): string[] {
	return args.flatMap((a) => a.split(',')).map((s) => s.trim()).filter(Boolean)
}

async function runZen(args: string[]): Promise<void> {
	if (args.includes('-h') || args.includes('--help')) {
		console.log(`Usage: bdk zen <id[,id ...]>

  Starts the board against the current directory and opens distraction-free
  focus review for the given issue ids. Ids may be comma- or space-separated:
    bdk zen pm-1,pm-2
    bdk zen pm-1 pm-2 pm-3`)
		return
	}
	const ids = parseIds(args)
	if (ids.length === 0) {
		fail('zen requires at least one issue id. Usage: bdk zen <id[,id ...]>')
	}
	const target = resolve(process.cwd())
	const openPath = `/?zen=${ids.map(encodeURIComponent).join(',')}`
	await startServer(target, { openPath })
}

// --- open subcommand (bdk:// URL scheme handler) ---

/** Extract the issue id from a `bdk://<id>` URL or a bare id. Tolerates slashes, query, and hash. */
function parseIssueRef(arg: string): string {
	let s = arg.trim().replace(/^bdk:\/\//i, '')
	s = s.split(/[?#]/)[0]            // drop query/hash
	s = s.replace(/^\/+|\/+$/g, '')   // drop leading/trailing slashes
	try { s = decodeURIComponent(s) } catch { /* leave as-is if not encoded */ }
	return s
}

function readTargetCwd(): string {
	const stored = join(APP_DIR, '.beads-cwd')
	if (existsSync(stored)) {
		try {
			const cwd = readFileSync(stored, 'utf-8').trim()
			if (cwd && existsSync(cwd)) return cwd
		} catch { /* fall through */ }
	}
	return resolve(process.cwd())
}

async function runOpen(arg: string | undefined): Promise<void> {
	if (!arg || arg === '-h' || arg === '--help') {
		console.log(`Usage: bdk open <bdk://id | id>

  Focus the board on an issue. Reuses a running board if one is up,
  otherwise starts one against the last-targeted project.
    bdk open bdk://pm-1
    bdk open pm-1`)
		if (!arg) process.exitCode = 2
		return
	}
	const id = parseIssueRef(arg)
	if (!id) fail(`Could not parse an issue id from: ${arg}`)
	const openPath = `/?issue=${encodeURIComponent(id)}`

	// Reuse a live board if one is running.
	const active = readActiveServer()
	if (active && isPidAlive(active.pid) && await isPortInUse(active.port)) {
		const url = `https://localhost:${active.port}${openPath}`
		console.log(`Opening ${url}`)
		openBrowser(url)
		return
	}

	// No live board — start one against the last-targeted project.
	await startServer(readTargetCwd(), { openPath })
}

// --- dispatch ---

function printHelp(): void {
	console.log(`bdk — Kanban board for the Beads issue tracker

Usage:
  bdk [path]            Start the board against [path] (default: current directory)
  bdk open <bdk://id>   Focus an issue (reuses a running board; handles the bdk:// scheme)
  bdk zen <ids>         Open distraction-free focus review for the given issue ids
  bdk reap [opts]       Reap orphan 'dolt sql-server' processes (see 'bdk reap --help')
  bdk help              Show this help

Examples:
  bdk                   Start against the current directory
  bdk ~/code/myproject  Start against another project
  bdk open bdk://pm-1   Open the board focused on issue pm-1
  bdk zen pm-1,pm-2     Review issues pm-1 and pm-2`)
}

async function main() {
	const [cmd, ...rest] = process.argv.slice(2)
	switch (cmd) {
		case 'reap':
			process.exit(await runReap(rest))
		case 'open':
			await runOpen(rest[0])
			return
		case 'zen':
			await runZen(rest)
			return
		case 'help':
		case '-h':
		case '--help':
			printHelp()
			return
		default:
			// A bdk:// URL (from the macOS scheme handler) → treat as `open`.
			if (cmd?.startsWith('bdk://')) {
				await runOpen(cmd)
				return
			}
			// No subcommand → cmd is an optional [path] (defaults to cwd).
			await startServer(resolve(cmd ?? process.cwd()))
	}
}

main()
