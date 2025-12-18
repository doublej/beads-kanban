import { json } from '@sveltejs/kit';
import { spawn } from 'child_process';
import { join } from 'path';
import type { RequestHandler } from './$types';

// Use process.cwd() which is project root in SvelteKit
const AGENT_DIR = join(process.cwd(), 'src/lib/server/agent');
let agentProcess: ReturnType<typeof spawn> | null = null;

export const POST: RequestHandler = async ({ request }) => {
	const { action } = await request.json();

	if (action === 'start') {
		if (agentProcess && !agentProcess.killed) {
			return json({ success: true, message: 'Agent already running' });
		}

		agentProcess = spawn('bun', ['run', 'index.ts'], {
			cwd: AGENT_DIR,
			stdio: 'ignore',
			detached: true
		});

		agentProcess.unref();
		agentProcess.on('error', (err) => {
			console.error('Agent process error:', err);
			agentProcess = null;
		});
		agentProcess.on('exit', () => {
			agentProcess = null;
		});

		// Give it a moment to start
		await new Promise(r => setTimeout(r, 500));
		return json({ success: true, message: 'Agent started' });
	}

	if (action === 'stop') {
		if (agentProcess && !agentProcess.killed) {
			agentProcess.kill();
			agentProcess = null;
			return json({ success: true, message: 'Agent stopped' });
		}
		return json({ success: true, message: 'Agent not running' });
	}

	if (action === 'restart') {
		if (agentProcess && !agentProcess.killed) {
			agentProcess.kill();
			agentProcess = null;
		}
		await new Promise(r => setTimeout(r, 300));

		agentProcess = spawn('bun', ['run', 'index.ts'], {
			cwd: AGENT_DIR,
			stdio: 'ignore',
			detached: true
		});

		agentProcess.unref();
		agentProcess.on('error', (err) => {
			console.error('Agent process error:', err);
			agentProcess = null;
		});
		agentProcess.on('exit', () => {
			agentProcess = null;
		});

		await new Promise(r => setTimeout(r, 500));
		return json({ success: true, message: 'Agent restarted' });
	}

	return json({ error: 'Invalid action' }, { status: 400 });
};
