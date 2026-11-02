/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
// Service worker : l'app s'ouvre même hors ligne (fichiers en cache) et reçoit les rappels push.
import { version } from '$app/env';
import { assets, immutable } from '$app/manifest';

const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `sillage-${version}`;
// Chemins relatifs au chemin de base (/rpg-habitudes-v3/ sur GitHub Pages) : on les rend absolus.
const SCOPE = new URL(sw.registration.scope).pathname;
const ASSETS = [SCOPE, ...[...immutable, ...assets].map((f) => SCOPE + f.path.replace(/^\//, ''))];

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(ASSETS))
			.then(() => sw.skipWaiting())
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k.startsWith('sillage-')).map((k) => caches.delete(k))))
			.then(() => sw.clients.claim())
	);
});

sw.addEventListener('fetch', (event) => {
	const req = event.request;
	if (req.method !== 'GET') return;
	const url = new URL(req.url);
	if (url.origin !== location.origin) return; // Supabase et le reste : toujours en direct

	// Fichiers de la version : depuis le cache. Page : réseau d'abord, cache si hors ligne.
	if (ASSETS.includes(url.pathname)) {
		event.respondWith(caches.match(req).then((hit) => hit ?? fetch(req)));
		return;
	}
	if (req.mode === 'navigate') {
		event.respondWith(
			fetch(req)
				.then((res) => {
					const copy = res.clone();
					caches.open(CACHE).then((c) => c.put(req, copy));
					return res;
				})
				.catch(async () => (await caches.match(req)) ?? (await caches.match(sw.registration.scope)) ?? Response.error())
		);
	}
});

// --- Notifications ---

sw.addEventListener('push', (event) => {
	let msg: { title?: string; body?: string; url?: string; tag?: string } = {};
	try {
		msg = event.data?.json() ?? {};
	} catch {
		msg = { body: event.data?.text() };
	}
	event.waitUntil(
		sw.registration.showNotification(msg.title ?? 'Le Sillage', {
			body: msg.body ?? '',
			icon: 'icon-192.png',
			badge: 'favicon.png',
			tag: msg.tag,
			data: { url: msg.url ?? '#/' },
			lang: 'fr'
		})
	);
});

sw.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const target = new URL(event.notification.data?.url ?? '#/', sw.registration.scope).href;
	event.waitUntil(
		sw.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
			const open = wins.find((w) => w.url.startsWith(sw.registration.scope));
			if (open) return open.navigate(target).then((w) => (w ?? open).focus());
			return sw.clients.openWindow(target);
		})
	);
});
