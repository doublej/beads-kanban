import { json } from '@sveltejs/kit';
import { spawn } from 'child_process';
import type { RequestHandler } from './$types';

const AGENT_DIR = '/Users/jurrejan/Documents/development/_management/kanban_claude';
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

	return json({ error: 'Invalid action' }, { status: 400 });
};
