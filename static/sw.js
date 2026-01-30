/**
 * Service worker for Beads Kanban push notifications.
 * Handles push events and notification clicks.
 */

self.addEventListener('push', (event) => {
	if (!event.data) return;

	let data;
	try {
		data = event.data.json();
	} catch {
		data = { title: 'Beads Kanban', body: event.data.text() };
	}

	const options = {
		body: data.body || '',
		icon: '/icons/icon-192.png',
		badge: '/icons/icon-192.png',
		data: {
			issueId: data.data?.issueId,
			eventType: data.data?.eventType,
			url: data.data?.url || '/'
		},
		tag: data.data?.eventType || 'default',
		renotify: true
	};

	event.waitUntil(self.registration.showNotification(data.title || 'Beads Kanban', options));
});

self.addEventListener('notificationclick', (event) => {
	event.notification.close();

	const url = event.notification.data?.url || '/';
	const issueId = event.notification.data?.issueId;
	const targetUrl = issueId ? `/?issue=${issueId}` : url;

	event.waitUntil(
		self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
			// Focus existing window if available
			for (const client of clients) {
				if (client.url.includes(self.location.origin)) {
					client.focus();
					if (issueId) {
						client.postMessage({ type: 'NAVIGATE_TO_ISSUE', issueId });
					}
					return;
				}
			}
			// Open new window
			return self.clients.openWindow(targetUrl);
		})
	);
});

// Minimal install/activate handlers
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
