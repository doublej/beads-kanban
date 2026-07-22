import type { HandleServerError } from '@sveltejs/kit';
import { exec } from 'child_process';
import { log } from '$lib/server/logger';
import { findOrphanedDoltPids, killDoltPids } from '$lib/dolt-reaper';
import { readTouchedCwds } from '$lib/touched-cwds';
import { getStoredCwd } from '$lib/db';

export const handleError: HandleServerError = ({ error, event }) => {
	log.error(`Unhandled [${event.request.method} ${event.url.pathname}]:`, error as Error);
};

const PERIODIC_REAP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

function periodicReap(): void {
	try {
		const cwds = readTouchedCwds();
		if (cwds.length === 0) return;
		const orphans = findOrphanedDoltPids(cwds);
		if (orphans.length === 0) return;
		const { killed, failed } = killDoltPids(orphans);
		log.info(`periodic reap: stopped ${killed.length} dolt server(s)${failed.length ? `; ${failed.length} failed` : ''}`);
	} catch (err) {
		log.error('periodic reap error', err as Error);
	}
}

if (process.env.BEADS_KANBAN_AUTO_REAP !== '0') {
	const handle = setInterval(periodicReap, PERIODIC_REAP_INTERVAL_MS);
	if (typeof handle.unref === 'function') handle.unref();
}

// Non-blocking bd-engine prewarm on server boot: the first SSR `bd export` then hits
// a warm dolt engine / OS cache instead of paying the ~2.7s cold penalty. Output is
// discarded; any dolt server it boots is handled by the periodic reaper above.
if (process.env.BEADS_KANBAN_PREWARM !== '0') {
	try {
		exec('bd export', { cwd: getStoredCwd(), maxBuffer: 256 * 1024 * 1024 }, () => {});
	} catch {
		/* prewarm is best-effort; a failure here must not block server boot */
	}
}
