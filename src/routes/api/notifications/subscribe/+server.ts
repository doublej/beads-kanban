import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { saveSubscription } from '$lib/push-db';

export const POST: RequestHandler = async ({ request }) => {
	const { endpoint, keys } = await request.json();

	if (!endpoint || !keys?.p256dh || !keys?.auth) {
		return json({ error: 'Invalid subscription data' }, { status: 400 });
	}

	saveSubscription(endpoint, keys.p256dh, keys.auth);
	return json({ success: true });
};
