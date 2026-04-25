import type { RequestHandler } from './$types';
import { ok, wrap } from '$lib/server/response';
import { resolveProjectCwd, markDoctorRan } from '$lib/db';
import { pingBd, runDoctor, type BdDoctorFinding } from '$lib/bd';

export const GET: RequestHandler = wrap(async ({ url }) => {
	const cwd = resolveProjectCwd(url);
	const ping = await pingBd(cwd);
	let doctor: { findings: BdDoctorFinding[] } | undefined;
	if (ping.ok && markDoctorRan(cwd)) {
		const report = await runDoctor(cwd);
		const noteworthy = report.findings.filter((f) => (f.severity ?? 'info') !== 'info' || f.fixed);
		if (noteworthy.length > 0) doctor = { findings: noteworthy };
	}
	return ok({ ping, doctor });
});
