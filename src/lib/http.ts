const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

export async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
	const res = await fetch(url, init);
	return res.json();
}

export async function postJSON<T>(url: string, body: unknown): Promise<T> {
	const res = await fetch(url, {
		method: 'POST',
		headers: JSON_HEADERS,
		body: JSON.stringify(body)
	});
	return res.json();
}

export async function patchJSON<T>(url: string, body: unknown): Promise<T> {
	const res = await fetch(url, {
		method: 'PATCH',
		headers: JSON_HEADERS,
		body: JSON.stringify(body)
	});
	return res.json();
}

export async function deleteJSON<T = void>(url: string, body?: unknown): Promise<T> {
	const init: RequestInit = { method: 'DELETE' };
	if (body !== undefined) {
		init.headers = JSON_HEADERS;
		init.body = JSON.stringify(body);
	}
	const res = await fetch(url, init);
	if (res.headers.get('content-type')?.includes('json')) {
		return res.json();
	}
	return undefined as T;
}

export async function postFormData<T>(url: string, formData: FormData): Promise<T> {
	const res = await fetch(url, { method: 'POST', body: formData });
	return res.json();
}
