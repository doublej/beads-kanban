/**
 * bd CLI execution utilities.
 * Centralizes CLI calls with consistent error handling.
 */
import { exec } from 'child_process'
import { promisify } from 'util'
import { getStoredCwd } from './db'

const execAsync = promisify(exec)

export interface BdResult {
	success: boolean
	stdout?: string
	error?: string
	warning?: string
}

const MIN_BD_VERSION = '1.0.0'

export interface BdVersion {
	version: string
	compatible: boolean
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

export async function checkVersion(cwd?: string): Promise<BdVersion> {
	const result = await run('bd --version', cwd)
	if (!result.success) return { version: 'unknown', compatible: false }
	const match = result.stdout?.match(/(\d+\.\d+\.\d+)/)
	const version = match?.[1] ?? 'unknown'
	return { version, compatible: versionAtLeast(version, MIN_BD_VERSION) }
}

function escapeArg(val: string): string {
	return val.replace(/"/g, '\\"')
}

async function run(cmd: string, cwd?: string): Promise<BdResult> {
	try {
		const { stdout, stderr } = await execAsync(cmd, { cwd: cwd ?? getStoredCwd() })
		return { success: true, stdout: stdout.trim(), warning: stderr || undefined }
	} catch (err: unknown) {
		const e = err as { stderr?: string; message?: string }
		return { success: false, error: e.stderr || e.message || 'Command failed' }
	}
}

export async function createIssue(
	title: string,
	opts?: { description?: string; priority?: number; issue_type?: string; deps?: string[] },
	cwd?: string
): Promise<BdResult & { id?: string; issue?: unknown }> {
	let cmd = `bd create "${escapeArg(title)}" --json`
	if (opts?.description) cmd += ` --description "${escapeArg(opts.description)}"`
	if (opts?.priority !== undefined) cmd += ` --priority ${opts.priority}`
	if (opts?.issue_type) cmd += ` --type ${opts.issue_type}`
	if (opts?.deps?.length) cmd += ` --deps ${opts.deps.join(',')}`

	const result = await run(cmd, cwd)
	if (result.success && result.stdout) {
		const parsed = JSON.parse(result.stdout)
		return { ...result, id: parsed.id, issue: parsed }
	}
	return result
}

export async function updateIssue(
	id: string,
	updates: {
		status?: string
		title?: string
		description?: string
		priority?: number
		design?: string
		acceptance_criteria?: string
		notes?: string
		assignee?: string
		appendNotes?: string
		ephemeral?: boolean
	},
	cwd?: string
): Promise<BdResult> {
	let cmd = `bd update ${id}`
	let hasUpdates = false

	type StringField = keyof Pick<typeof updates, 'title' | 'description' | 'design' | 'acceptance_criteria' | 'notes' | 'assignee'>;
	const stringFields: [StringField, string][] = [
		['title', '--title'],
		['description', '--description'],
		['design', '--design'],
		['acceptance_criteria', '--acceptance'],
		['notes', '--notes'],
		['assignee', '--assignee'],
	];
	for (const [field, flag] of stringFields) {
		if (updates[field] !== undefined) {
			cmd += ` ${flag} "${escapeArg(String(updates[field] ?? ''))}"`;
			hasUpdates = true;
		}
	}

	if (updates.status) { cmd += ` --status ${updates.status}`; hasUpdates = true }
	if (updates.priority !== undefined) { cmd += ` --priority ${updates.priority}`; hasUpdates = true }
	if (updates.appendNotes) { cmd += ` --append-notes "${escapeArg(updates.appendNotes)}"`; hasUpdates = true }
	if (updates.ephemeral === true) { cmd += ' --ephemeral'; hasUpdates = true }
	if (updates.ephemeral === false) { cmd += ' --persistent'; hasUpdates = true }

	if (!hasUpdates) return { success: true }
	return run(cmd, cwd)
}

export async function deleteIssue(id: string, cwd?: string): Promise<BdResult> {
	return run(`bd delete ${id}`, cwd)
}

export async function closeIssue(id: string, reason = 'Completed', cwd?: string): Promise<BdResult> {
	return run(`bd close ${id} --reason "${escapeArg(reason)}"`, cwd)
}

export async function addDependency(issueId: string, dependsOn: string, depType = 'blocks', cwd?: string): Promise<BdResult> {
	return run(`bd dep add ${issueId} ${dependsOn} --type ${depType}`, cwd)
}

export async function removeDependency(issueId: string, dependsOn: string, cwd?: string): Promise<BdResult> {
	return run(`bd dep remove ${issueId} ${dependsOn}`, cwd)
}

export async function addComment(issueId: string, text: string, cwd?: string): Promise<BdResult> {
	return run(`bd comments add ${issueId} "${escapeArg(text)}"`, cwd)
}

export async function addLabel(issueId: string, label: string, cwd?: string): Promise<BdResult> {
	return run(`bd label add ${issueId} ${label}`, cwd)
}

export async function removeLabel(issueId: string, label: string, cwd?: string): Promise<BdResult> {
	return run(`bd label remove ${issueId} ${label}`, cwd)
}

export async function setMetadata(id: string, key: string, value: string, cwd?: string): Promise<BdResult> {
	return run(`bd update ${id} --set-metadata ${key}=${value}`, cwd)
}

export async function unsetMetadata(id: string, key: string, cwd?: string): Promise<BdResult> {
	return run(`bd update ${id} --unset-metadata ${key}`, cwd)
}

export async function getChildren(id: string, cwd?: string): Promise<BdResult> {
	return run(`bd children ${id} --json`, cwd)
}
