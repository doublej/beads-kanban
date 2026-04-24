import { appendProjectParam } from './project';

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

export interface ApiErrorPayload {
	message: string;
	code?: string;
	details?: unknown;
}

export class ApiClientError extends Error {
	constructor(
		message: string,
		public status: number,
		public code?: string,
		public details?: unknown,
	) {
		super(message);
		this.name = 'ApiClientError';
	}
}

interface Envelope<T> {
	ok: true;
	data: T;
}
interface ErrorEnvelope {
	ok: false;
	error: ApiErrorPayload;
}

async function parseEnvelope<T>(res: Response): Promise<T> {
	const ct = res.headers.get('content-type') ?? '';
	if (!ct.includes('json')) {
		if (!res.ok) throw new ApiClientError(res.statusText || 'Request failed', res.status);
		return undefined as T;
	}
	const payload = (await res.json()) as Envelope<T> | ErrorEnvelope | T;
	if (payload && typeof payload === 'object' && 'ok' in payload) {
		if (payload.ok) return payload.data;
		throw new ApiClientError(
			payload.error.message,
			res.status,
			payload.error.code,
			payload.error.details,
		);
	}
	if (!res.ok) throw new ApiClientError('Request failed', res.status);
	return payload as T;
}

export async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
	const res = await fetch(appendProjectParam(url), init);
	return parseEnvelope<T>(res);
}

export async function postJSON<T>(url: string, body: unknown): Promise<T> {
	const res = await fetch(appendProjectParam(url), {
		method: 'POST',
		headers: JSON_HEADERS,
		body: JSON.stringify(body),
	});
	return parseEnvelope<T>(res);
}

export async function patchJSON<T>(url: string, body: unknown): Promise<T> {
	const res = await fetch(appendProjectParam(url), {
		method: 'PATCH',
		headers: JSON_HEADERS,
		body: JSON.stringify(body),
	});
	return parseEnvelope<T>(res);
}

export async function deleteJSON<T = void>(url: string, body?: unknown): Promise<T> {
	const init: RequestInit = { method: 'DELETE' };
	if (body !== undefined) {
		init.headers = JSON_HEADERS;
		init.body = JSON.stringify(body);
	}
	const res = await fetch(appendProjectParam(url), init);
	return parseEnvelope<T>(res);
}

export async function postFormData<T>(url: string, formData: FormData): Promise<T> {
	const res = await fetch(appendProjectParam(url), { method: 'POST', body: formData });
	return parseEnvelope<T>(res);
}
