#!/usr/bin/env bun
/**
 * CLI entry point for beads-kanban.
 * Validates target directory, checks bd CLI, writes .beads-cwd, starts dev server.
 */

// Type guard for Bun runtime
declare const Bun: unknown | undefined

import { resolve, join, dirname } from 'path'
import { existsSync, writeFileSync, lstatSync } from 'fs'
import { spawn, execSync } from 'child_process'
import { createInterface } from 'readline'
import { createServer, createConnection } from 'net'

const MIN_BD_VERSION = '0.49.0'
const AGENT_PORT = 9347
const APP_DIR = dirname(new URL('.', import.meta.url).pathname)

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

async function main() {
	const target = resolve(process.argv[2] ?? process.cwd())

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

	// Spawn agent WebSocket server (optional — vite continues if it crashes)
	let agentChild: ReturnType<typeof spawn> | null = null
	const agentPortInUse = await isPortInUse(AGENT_PORT)
	if (agentPortInUse) {
		console.log(`Agent server already running on port ${AGENT_PORT}, reusing`)
	} else {
		agentChild = spawn('bun', ['run', join(APP_DIR, 'src/lib/server/agent/index.ts')], {
			cwd: APP_DIR,
			stdio: 'inherit',
		})
		agentChild.on('exit', (code) => {
			if (code !== 0 && code !== null) console.warn(`Agent server exited with code ${code}`)
		})
	}

	const launcher = typeof Bun !== 'undefined' ? 'bunx' : 'npx'
	const child = spawn(launcher, ['vite', 'dev', '--host', '--port', String(await findFreePort())], {
		cwd: APP_DIR,
		stdio: 'inherit',
	})

	child.on('exit', (code) => {
		agentChild?.kill()
		process.exit(code ?? 0)
	})
	;(['SIGINT', 'SIGTERM'] as const).forEach((sig) =>
		process.on(sig, () => {
			agentChild?.kill(sig)
			child.kill(sig)
		})
	)
}

main()
