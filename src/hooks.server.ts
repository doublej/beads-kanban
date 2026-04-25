import type { HandleServerError } from '@sveltejs/kit';
import { log } from '$lib/server/logger';
import { findOrphanedDoltPids, killDoltPids } from '$lib/dolt-reaper';
import { readTouchedCwds } from '$lib/touched-cwds';

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
