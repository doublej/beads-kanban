import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { getAllSubscriptions, removeSubscription } from '$lib/push-db';
import webpush from 'web-push';

export const POST: RequestHandler = async ({ request }) => {
	const { title, body, data } = await request.json();

	const publicKey = env.VAPID_PUBLIC_KEY;
	const privateKey = env.VAPID_PRIVATE_KEY;
	const subject = env.VAPID_SUBJECT || 'mailto:admin@beadskanban.local';

	if (!publicKey || !privateKey) {
		return json({ error: 'VAPID keys not configured' }, { status: 500 });
	}

	webpush.setVapidDetails(subject, publicKey, privateKey);

	const subscriptions = getAllSubscriptions();
	const payload = JSON.stringify({ title, body, data });

	const results = await Promise.allSettled(
		subscriptions.map(async (sub) => {
			try {
				await webpush.sendNotification(
					{
						endpoint: sub.endpoint,
						keys: { p256dh: sub.p256dh, auth: sub.auth }
					},
					payload
				);
			} catch (err: unknown) {
				const error = err as { statusCode?: number };
				// Remove expired/invalid subscriptions
				if (error.statusCode === 404 || error.statusCode === 410) {
					removeSubscription(sub.endpoint);
				}
				throw err;
			}
		})
	);

	const sent = results.filter((r) => r.status === 'fulfilled').length;
	const failed = results.filter((r) => r.status === 'rejected').length;

	return json({ sent, failed });
};
