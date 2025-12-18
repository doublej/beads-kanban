import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { existsSync, statSync } from 'fs';
import { resolve } from 'path';
import { getStoredCwd, setStoredCwd } from '$lib/db';

export const GET: RequestHandler = async () => {
	const cwd = getStoredCwd();
	return json({ cwd, name: cwd.split('/').pop() });
};

export const POST: RequestHandler = async ({ request }) => {
	const { path } = await request.json();
	if (!path || typeof path !== 'string') {
		return json({ error: 'Path required' }, { status: 400 });
	}

	const resolved = resolve(path);
	if (!existsSync(resolved)) {
		return json({ error: 'Path does not exist' }, { status: 400 });
	}
	if (!statSync(resolved).isDirectory()) {
		return json({ error: 'Path is not a directory' }, { status: 400 });
	}

	// Check for .beads directory
	const beadsDir = resolve(resolved, '.beads');
	if (!existsSync(beadsDir)) {
		return json({ error: 'No .beads directory found' }, { status: 400 });
	}

	setStoredCwd(resolved);
	return json({ cwd: resolved, name: resolved.split('/').pop() });
};
