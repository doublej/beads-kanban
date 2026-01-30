import webpush from 'web-push';
import { getVapidKeys, saveVapidKeys } from './push-db';

export function ensureVapidKeys(): { publicKey: string; privateKey: string } {
	const existing = getVapidKeys();
	if (existing) return existing;

	const keys = webpush.generateVAPIDKeys();
	saveVapidKeys(keys.publicKey, keys.privateKey);
	return keys;
}
