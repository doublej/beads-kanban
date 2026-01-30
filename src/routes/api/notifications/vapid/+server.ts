import { json } from '@sveltejs/kit';
import { ensureVapidKeys } from '$lib/vapid';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const { publicKey } = ensureVapidKeys();
	return json({ publicKey });
};
