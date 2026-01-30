/**
 * Writable SQLite database for app-specific data (push subscriptions).
 * Separate from the read-only beads issue database.
 */
import Database from 'better-sqlite3';
import { join } from 'path';
import { getStoredCwd } from './db';

const APP_DB_NAME = 'beads-app.db';

function getAppDbPath(): string {
	return join(getStoredCwd(), '.beads', APP_DB_NAME);
}

function openAppDb(): Database.Database {
	const db = new Database(getAppDbPath());
	db.pragma('journal_mode = WAL');
	db.exec(`
		CREATE TABLE IF NOT EXISTS push_subscriptions (
			endpoint TEXT PRIMARY KEY,
			p256dh TEXT NOT NULL,
			auth TEXT NOT NULL,
			created_at TEXT DEFAULT (datetime('now'))
		)
	`);
	return db;
}

export function saveSubscription(endpoint: string, p256dh: string, auth: string): void {
	const db = openAppDb();
	db.prepare(`
		INSERT OR REPLACE INTO push_subscriptions (endpoint, p256dh, auth)
		VALUES (?, ?, ?)
	`).run(endpoint, p256dh, auth);
	db.close();
}

export function getAllSubscriptions(): Array<{ endpoint: string; p256dh: string; auth: string }> {
	const db = openAppDb();
	const subs = db.prepare('SELECT endpoint, p256dh, auth FROM push_subscriptions').all() as Array<{
		endpoint: string;
		p256dh: string;
		auth: string;
	}>;
	db.close();
	return subs;
}

export function removeSubscription(endpoint: string): void {
	const db = openAppDb();
	db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
	db.close();
}
