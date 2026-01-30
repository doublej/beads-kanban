import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { getAllSubscriptions, removeSubscription } from '$lib/push-db';
import { ensureVapidKeys } from '$lib/vapid';
import webpush from 'web-push';

export const POST: RequestHandler = async () => {
	const { publicKey, privateKey } = ensureVapidKeys();
	const subject = env.VAPID_SUBJECT || 'mailto:admin@beadskanban.local';

	webpush.setVapidDetails(subject, publicKey, privateKey);

	const subscriptions = getAllSubscriptions();
	if (subscriptions.length === 0) {
		return json({ error: 'No push subscriptions registered' }, { status: 404 });
	}

	const payload = JSON.stringify({
		title: 'Beads Kanban',
		body: 'Test notification — push is working!',
		data: { type: 'test' }
	});

	const results = await Promise.allSettled(
		subscriptions.map(async (sub) => {
			try {
				await webpush.sendNotification(
					{ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
					payload
				);
			} catch (err: unknown) {
				const error = err as { statusCode?: number };
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
