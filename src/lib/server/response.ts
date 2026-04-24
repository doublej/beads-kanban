/**
 * Unified JSON response envelope for every API route.
 *
 *  ok  -> { ok: true, data }
 *  err -> { ok: false, error: { message, code?, details? } }
 *
 * Binary responses (file downloads) bypass the envelope.
 */
import { json, type RequestEvent, type RequestHandler } from '@sveltejs/kit';
import { extractErrorMessage } from '$lib/server-utils';

export class ApiError extends Error {
	constructor(
		message: string,
		public status = 500,
		public code?: string,
		public details?: unknown
	) {
		super(message);
		this.name = 'ApiError';
	}
}

export const ok = <T>(data: T, init?: ResponseInit): Response =>
	json({ ok: true, data }, init);

export const err = (
	message: string,
	status = 500,
	code?: string,
	details?: unknown
): Response =>
	json({ ok: false, error: { message, code, details } }, { status });

/** Wrap a handler so thrown ApiErrors become structured responses and unexpected errors become 500s. */
export function wrap<E extends RequestEvent = RequestEvent>(
	fn: (event: E) => Response | Promise<Response>
): RequestHandler {
	return (async (event) => {
		try {
			return await fn(event as unknown as E);
		} catch (e) {
			if (e instanceof ApiError) return err(e.message, e.status, e.code, e.details);
			return err(extractErrorMessage(e, 'Unexpected error'));
		}
	}) as RequestHandler;
}
