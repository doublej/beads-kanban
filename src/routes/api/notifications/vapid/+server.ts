import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const publicKey = env.VAPID_PUBLIC_KEY;
	if (!publicKey) {
		return json({ error: 'VAPID keys not configured' }, { status: 500 });
	}
	return json({ publicKey });
};
