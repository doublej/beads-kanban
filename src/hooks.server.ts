import type { HandleServerError } from '@sveltejs/kit';
import { log } from '$lib/server/logger';

export const handleError: HandleServerError = ({ error, event }) => {
	log.error(`Unhandled [${event.request.method} ${event.url.pathname}]:`, error as Error);
};
