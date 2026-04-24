import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';

function findProjectRoot(): string {
	let dir = process.cwd();
	for (let i = 0; i < 10; i++) {
		if (existsSync(join(dir, '.beads'))) return dir;
		const parent = resolve(dir, '..');
		if (parent === dir) break;
		dir = parent;
	}
	return process.cwd();
}

const logDir = join(findProjectRoot(), '.beads');
export const LOG_FILE = join(logDir, 'beads-app.log');

if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });

function fmt(level: string, msg: string, args: unknown[]): string {
	const parts = args.map(a =>
		a instanceof Error ? a.stack || a.message : typeof a === 'string' ? a : JSON.stringify(a)
	);
	return `${new Date().toISOString()} [${level}] ${msg}${parts.length ? ' ' + parts.join(' ') : ''}\n`;
}

function write(level: string, msg: string, ...args: unknown[]) {
	const line = fmt(level, msg, args);
	try {
		appendFileSync(LOG_FILE, line);
	} catch {
		process.stderr.write(line);
	}
}

export const log = {
	error: (msg: string, ...args: unknown[]) => write('ERROR', msg, ...args),
	warn: (msg: string, ...args: unknown[]) => write('WARN', msg, ...args),
	info: (msg: string, ...args: unknown[]) => write('INFO', msg, ...args),
};
