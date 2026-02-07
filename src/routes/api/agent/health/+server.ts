import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		const res = await fetch('http://localhost:9347/health', {
			signal: AbortSignal.timeout(2000)
		});
		return json({ ok: res.ok });
	} catch {
		return json({ ok: false });
	}
};
