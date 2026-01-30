/**
 * bd CLI execution utilities.
 * Centralizes CLI calls with consistent error handling.
 */
import { exec } from 'child_process'
import { promisify } from 'util'
import { getBdDbFlag } from './db'

const execAsync = promisify(exec)

export interface BdResult {
	success: boolean
	stdout?: string
	error?: string
	warning?: string
}

const MIN_BD_VERSION = '0.49.0'

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

export async function checkVersion(): Promise<BdVersion> {
	const result = await run('bd --version')
	if (!result.success) return { version: 'unknown', compatible: false }
	const match = result.stdout?.match(/(\d+\.\d+\.\d+)/)
	const version = match?.[1] ?? 'unknown'
	return { version, compatible: versionAtLeast(version, MIN_BD_VERSION) }
}

function escapeArg(val: string): string {
	return val.replace(/"/g, '\\"')
}

async function run(cmd: string): Promise<BdResult> {
	try {
		const { stdout, stderr } = await execAsync(cmd)
		return { success: true, stdout: stdout.trim(), warning: stderr || undefined }
	} catch (err: unknown) {
		const e = err as { stderr?: string; message?: string }
		return { success: false, error: e.stderr || e.message || 'Command failed' }
	}
}

export async function createIssue(
	title: string,
	opts?: { description?: string; priority?: number; issue_type?: string; deps?: string[] }
): Promise<BdResult & { id?: string; issue?: unknown }> {
	let cmd = `bd ${getBdDbFlag()} create "${escapeArg(title)}" --json`
	if (opts?.description) cmd += ` --description "${escapeArg(opts.description)}"`
	if (opts?.priority !== undefined) cmd += ` --priority ${opts.priority}`
	if (opts?.issue_type) cmd += ` --type ${opts.issue_type}`
	if (opts?.deps?.length) cmd += ` --deps ${opts.deps.join(',')}`

	const result = await run(cmd)
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
		pinned?: boolean
	}
): Promise<BdResult> {
	let cmd = `bd ${getBdDbFlag()} update ${id}`
	let hasUpdates = false

	if (updates.status) { cmd += ` --status ${updates.status}`; hasUpdates = true }
	if (updates.title !== undefined) { cmd += ` --title "${escapeArg(updates.title)}"`; hasUpdates = true }
	if (updates.description !== undefined) { cmd += ` --description "${escapeArg(updates.description)}"`; hasUpdates = true }
	if (updates.priority !== undefined) { cmd += ` --priority ${updates.priority}`; hasUpdates = true }
	if (updates.design !== undefined) { cmd += ` --design "${escapeArg(updates.design || '')}"`; hasUpdates = true }
	if (updates.acceptance_criteria !== undefined) { cmd += ` --acceptance "${escapeArg(updates.acceptance_criteria || '')}"`; hasUpdates = true }
	if (updates.notes !== undefined) { cmd += ` --notes "${escapeArg(updates.notes || '')}"`; hasUpdates = true }
	if (updates.assignee !== undefined) { cmd += ` --assignee "${escapeArg(updates.assignee || '')}"`; hasUpdates = true }
	if (updates.appendNotes) { cmd += ` --append-notes "${escapeArg(updates.appendNotes)}"`; hasUpdates = true }
	if (updates.ephemeral === true) { cmd += ' --ephemeral'; hasUpdates = true }
	if (updates.ephemeral === false) { cmd += ' --persistent'; hasUpdates = true }
	if (updates.pinned === true) { cmd += ' --pinned'; hasUpdates = true }
	if (updates.pinned === false) { cmd += ' --unpinned'; hasUpdates = true }

	if (!hasUpdates) return { success: true }
	return run(cmd)
}

export async function deleteIssue(id: string): Promise<BdResult> {
	return run(`bd ${getBdDbFlag()} delete ${id}`)
}

export async function closeIssue(id: string, reason = 'Completed'): Promise<BdResult> {
	return run(`bd ${getBdDbFlag()} close ${id} --reason "${escapeArg(reason)}"`)
}

export async function addDependency(issueId: string, dependsOn: string, depType = 'blocks'): Promise<BdResult> {
	return run(`bd ${getBdDbFlag()} dep add ${issueId} ${dependsOn} --type ${depType}`)
}

export async function removeDependency(issueId: string, dependsOn: string): Promise<BdResult> {
	return run(`bd ${getBdDbFlag()} dep remove ${issueId} ${dependsOn}`)
}

export async function addComment(issueId: string, text: string): Promise<BdResult> {
	return run(`bd ${getBdDbFlag()} comment ${issueId} "${escapeArg(text)}"`)
}

export async function addLabel(issueId: string, label: string): Promise<BdResult> {
	return run(`bd ${getBdDbFlag()} label add ${issueId} ${label}`)
}

export async function removeLabel(issueId: string, label: string): Promise<BdResult> {
	return run(`bd ${getBdDbFlag()} label remove ${issueId} ${label}`)
}

export async function renameIssue(oldId: string, newId: string): Promise<BdResult> {
	return run(`bd ${getBdDbFlag()} rename ${oldId} ${newId}`)
}

export async function getChildren(id: string): Promise<BdResult> {
	return run(`bd ${getBdDbFlag()} children ${id} --json`)
}

export async function getTypes(): Promise<BdResult> {
	return run(`bd ${getBdDbFlag()} types --json`)
}
