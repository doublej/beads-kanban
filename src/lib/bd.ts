/**
 * bd CLI execution utilities.
 * Centralizes CLI calls with consistent error handling.
 */
import { exec } from 'child_process'
import { promisify } from 'util'
import { getStoredCwd } from './db'

const execAsync = promisify(exec)

/** Env to pass to every `bd` spawn. Enables the 1.0 JSON envelope so output stays self-describing. */
export function bdEnv(): NodeJS.ProcessEnv {
	return { ...process.env, BD_JSON_ENVELOPE: '1' }
}

/** Hard-timeout for `bd dolt push|pull`. Mitigates upstream #3370 (push hangs forever on unreachable remote). */
export const BD_NETWORK_TIMEOUT_MS = (() => {
	const raw = process.env.BEADS_KANBAN_BD_TIMEOUT_MS
	const n = raw ? Number(raw) : NaN
	return Number.isFinite(n) && n > 0 ? n : 15000
})()

/**
 * Parse bd JSON output, unwrapping the 1.0 envelope `{data, schema_version}` if present.
 * Pre-1.0 (or future tools that don't envelope) return their payload directly — both shapes work.
 */
export function unwrapBdJson<T = unknown>(raw: string): T {
	const parsed = JSON.parse(raw)
	if (
		parsed &&
		typeof parsed === 'object' &&
		!Array.isArray(parsed) &&
		'schema_version' in parsed &&
		'data' in parsed
	) {
		return (parsed as { data: T }).data
	}
	return parsed as T
}

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

async function run(cmd: string, cwd?: string, timeoutMs?: number): Promise<BdResult> {
	try {
		const { stdout, stderr } = await execAsync(cmd, { cwd: cwd ?? getStoredCwd(), env: bdEnv(), timeout: timeoutMs })
		return { success: true, stdout: stdout.trim(), warning: stderr || undefined }
	} catch (err: unknown) {
		const e = err as { stderr?: string; message?: string; killed?: boolean; signal?: string }
		const timedOut = e.killed && e.signal === 'SIGTERM'
		const msg = timedOut ? `bd command timed out after ${timeoutMs}ms (set BEADS_KANBAN_BD_TIMEOUT_MS to override)` : (e.stderr || e.message || 'Command failed')
		return { success: false, error: msg }
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
		const parsed = unwrapBdJson<{ id?: string }>(result.stdout)
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

export interface BdPing {
	ok: boolean
	status?: string
	total_ms?: number
	error?: string
}

export async function pingBd(cwd?: string): Promise<BdPing> {
	const result = await run('bd ping --json', cwd)
	if (!result.success || !result.stdout) return { ok: false, error: result.error }
	try {
		const parsed = unwrapBdJson<{ status?: string; total_ms?: number; error?: string }>(result.stdout)
		return { ok: parsed.status === 'ok', status: parsed.status, total_ms: parsed.total_ms, error: parsed.error }
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err.message : String(err) }
	}
}

export interface BdDoctorFinding {
	severity?: string
	message?: string
	fixed?: boolean
}

export interface BdDoctorReport {
	ok: boolean
	findings: BdDoctorFinding[]
	error?: string
}

export async function pushDolt(cwd?: string): Promise<BdResult> {
	return run('bd dolt push', cwd, BD_NETWORK_TIMEOUT_MS)
}

export async function pullDolt(cwd?: string): Promise<BdResult> {
	return run('bd dolt pull', cwd, BD_NETWORK_TIMEOUT_MS)
}

export async function runDoctor(cwd?: string): Promise<BdDoctorReport> {
	const result = await run('bd doctor --fix --json', cwd)
	if (!result.success || !result.stdout) return { ok: false, findings: [], error: result.error }
	try {
		const parsed = unwrapBdJson<{ findings?: BdDoctorFinding[] }>(result.stdout)
		const findings = Array.isArray(parsed?.findings) ? parsed.findings : []
		return { ok: true, findings }
	} catch (err) {
		return { ok: false, findings: [], error: err instanceof Error ? err.message : String(err) }
	}
}
