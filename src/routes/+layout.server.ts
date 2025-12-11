import type { LayoutServerLoad } from './$types';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

function getProjectName(projectDir: string): string {
	const fallback = projectDir.split('/').pop() || projectDir;
	const tomlPath = join(projectDir, 'pyproject.toml');
	let content: string;
	try { content = readFileSync(tomlPath, 'utf-8'); } catch { return fallback; }
	const match = content.match(/^name\s*=\s*"([^"]+)"/m);
	return match ? match[1] : fallback;
}

export const load: LayoutServerLoad = async () => {
	const dbPath = process.env.BD_DB || '';
	const cwd = dbPath ? dirname(dirname(dbPath)) : process.cwd();
	const folderName = getProjectName(cwd);
	return { cwd, folderName };
};
