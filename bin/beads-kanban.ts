#!/usr/bin/env bun
/**
 * CLI entry point for beads-kanban.
 * Validates target directory, checks bd CLI, writes .beads-cwd, starts dev server.
 */
import { resolve, join, dirname } from 'path'
import { existsSync } from 'fs'
import { writeFileSync } from 'fs'
import { spawn, execSync } from 'child_process'
import { createInterface } from 'readline'
import { createServer } from 'net'

const MIN_BD_VERSION = '0.49.0'
const APP_DIR = dirname(import.meta.dirname)

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
	const target = resolve(Bun.argv[2] ?? process.cwd())

	if (!existsSync(target)) fail(`Directory not found: ${target}`)
	const stat = Bun.file(target)
	// Bun.file doesn't check dirs well, use lstatSync
	const { lstatSync } = await import('fs')
	if (!lstatSync(target).isDirectory()) fail(`Not a directory: ${target}`)

	// Check bd is installed
	let bdVersion: string
	try {
		const output = execSync('bd --version', { encoding: 'utf-8' }).trim()
		const match = output.match(/(\d+\.\d+\.\d+)/)
		bdVersion = match?.[1] ?? 'unknown'
	} catch {
		fail('bd CLI not found. Install with: brew install bd')
	}

	if (bdVersion === 'unknown' || !versionAtLeast(bdVersion, MIN_BD_VERSION)) {
		fail(`bd ${bdVersion} is too old (need >= ${MIN_BD_VERSION}). Upgrade with: brew upgrade bd`)
	}

	// Check beads is initialized
	if (!existsSync(join(target, '.beads'))) {
		const yes = await confirm(`No .beads/ found in ${target}. Initialize beads?`)
		if (!yes) process.exit(1)
		try {
			execSync('bd init', { cwd: target, stdio: 'inherit' })
		} catch {
			fail('bd init failed')
		}
		try {
			execSync('bd doctor --fix --yes', { cwd: target, stdio: 'inherit' })
		} catch {
			console.warn('Warning: bd doctor --fix had issues')
		}
	}

	// Write .beads-cwd
	const cwdFile = join(APP_DIR, '.beads-cwd')
	writeFileSync(cwdFile, target, 'utf-8')
	console.log(`Targeting: ${target}`)

	// Start dev server on a free port
	const port = await findFreePort()
	const child = spawn('bunx', ['vite', 'dev', '--host', '--port', String(port)], {
		cwd: APP_DIR,
		stdio: 'inherit',
	})

	child.on('exit', (code) => process.exit(code ?? 0))
	process.on('SIGINT', () => child.kill('SIGINT'))
	process.on('SIGTERM', () => child.kill('SIGTERM'))
}

main()
