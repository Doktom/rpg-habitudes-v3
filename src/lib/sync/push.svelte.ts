// Notifications push : abonnement de cet appareil (enregistré dans Supabase) et installation de l'app (PWA).
import { readConfig } from './config';
import { sync } from './sync.svelte';

function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
	const pad = '='.repeat((4 - (base64.length % 4)) % 4);
	const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
	const out = new Uint8Array(new ArrayBuffer(raw.length));
	for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
	return out;
}

const device = () => {
	const ua = navigator.userAgent;
	const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : 'Autre';
	return `${os} · ${/Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'navigateur'}`;
};

interface InstallPrompt extends Event {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

class Push {
	supported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
	permission = $state<NotificationPermission>(typeof Notification === 'undefined' ? 'denied' : Notification.permission);
	subscribed = $state(false);
	installable = $state(false);
	installed = $state(typeof window !== 'undefined' && matchMedia('(display-mode: standalone)').matches);
	private installEvent: InstallPrompt | null = null;

	init() {
		addEventListener('beforeinstallprompt', (e) => {
			e.preventDefault();
			this.installEvent = e as InstallPrompt;
			this.installable = true;
		});
		addEventListener('appinstalled', () => {
			this.installed = true;
			this.installable = false;
		});
		if (this.supported)
			navigator.serviceWorker.ready.then(async (reg) => (this.subscribed = !!(await reg.pushManager.getSubscription()))).catch(() => undefined);
	}

	async install() {
		if (!this.installEvent) return;
		await this.installEvent.prompt();
		const { outcome } = await this.installEvent.userChoice;
		if (outcome === 'accepted') this.installed = true;
		this.installEvent = null;
		this.installable = false;
	}

	// Demande la permission, abonne cet appareil et l'enregistre pour le compte connecté.
	async enable() {
		const vapid = readConfig().vapid;
		if (!this.supported) throw new Error('Ce navigateur ne gère pas les notifications push.');
		if (!sync.client || !sync.user) throw new Error('Connecte-toi d’abord à la synchro : les rappels partent du serveur.');
		if (!vapid) throw new Error('Clé VAPID manquante (voir docs/supabase.md).');
		this.permission = await Notification.requestPermission();
		if (this.permission !== 'granted') throw new Error('Notifications refusées : autorise-les dans les réglages du navigateur pour ce site.');
		const reg = await navigator.serviceWorker.ready;
		const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapid) }));
		const json = sub.toJSON();
		const { error } = await sync.client.from('push_subscriptions').upsert({
			endpoint: sub.endpoint,
			user_id: sync.user.id,
			p256dh: json.keys?.p256dh,
			auth: json.keys?.auth,
			device: device()
		});
		if (error) throw error;
		this.subscribed = true;
	}

	async disable() {
		const reg = await navigator.serviceWorker.ready;
		const sub = await reg.pushManager.getSubscription();
		if (sub) {
			await sync.client?.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
			await sub.unsubscribe();
		}
		this.subscribed = false;
	}

	// Envoie une notification d'essai depuis le serveur à tous les appareils du compte.
	async test(): Promise<number> {
		if (!sync.client) throw new Error('Synchro non configurée.');
		const { data, error } = await sync.client.functions.invoke('send-reminders', { body: { test: true } });
		if (error) throw error;
		return (data as { sent: number }).sent;
	}
}

export const push = new Push();
