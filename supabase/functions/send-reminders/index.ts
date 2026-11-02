// Fonction serveur Supabase : envoie les rappels push à l'heure choisie dans les Réglages de l'app.
// Appelée toutes les 10 minutes par pg_cron (supabase/cron.sql). Elle lit les données synchronisées de chaque
// utilisateur pour écrire un rappel utile (ce qui reste à faire, la série en jeu) ; rien n'est envoyé s'il n'y a rien à dire.
// Fichier autonome (pas d'import de l'app) pour pouvoir le coller tel quel dans l'éditeur de fonctions Supabase.
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const WINDOW_MIN = 15; // un rappel part dans les 15 minutes qui suivent son heure

type ISODate = string;
interface Habit {
	id: string;
	name: string;
	kind: 'obligatory' | 'bonus';
	moment: 'morning' | 'day' | 'evening';
	frequency: { type: 'daily' } | { type: 'weekly'; times: number } | { type: 'days'; days: number[] };
	tiers: { min: string; normal: string; excellent: string };
	cue?: string;
	createdAt: ISODate;
	archived?: boolean;
}
interface Data {
	habits: Habit[];
	habitLogs: { habitId: string; date: ISODate }[];
	restDays: ISODate[];
	shieldedDays?: ISODate[];
	reviews: { type: 'weekly' | 'monthly'; periodStart: ISODate }[];
	settings?: { tz?: string; reminders?: { kind: string; time: string; on: boolean }[] };
}
interface Message {
	title: string;
	body: string;
	url: string;
}

const SECTORS = ['Aube', 'Forge', 'Zénith', 'Jonction', 'Éclat', 'Dérive', 'Havre'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

const parse = (d: ISODate) => new Date(d + 'T00:00:00Z');
const addDays = (d: ISODate, n: number) => {
	const x = parse(d);
	x.setUTCDate(x.getUTCDate() + n);
	return x.toISOString().slice(0, 10);
};
const weekday = (d: ISODate) => parse(d).getUTCDay();
const monday = (d: ISODate) => addDays(d, -((weekday(d) + 6) % 7));

// Date et heure locales de l'utilisateur.
function localNow(tz: string): { date: ISODate; minutes: number } {
	const parts = Object.fromEntries(
		new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
			.formatToParts(new Date())
			.map((p) => [p.type, p.value])
	);
	return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: +parts.hour * 60 + +parts.minute };
}

const due = (h: Habit, d: ISODate) =>
	!h.archived && h.createdAt <= d && (h.frequency.type === 'daily' || (h.frequency.type === 'days' && h.frequency.days.includes(weekday(d))));
const logged = (data: Data, id: string, d: ISODate) => data.habitLogs.some((l) => l.habitId === id && l.date === d);
const rest = (data: Data, d: ISODate) => data.restDays.includes(d);

function streak(data: Data, h: Habit, d: ISODate): number {
	let n = 0;
	for (let x = addDays(d, -1), i = 0; x >= h.createdAt && i < 400; x = addDays(x, -1), i++) {
		if (!due(h, x)) continue;
		if (logged(data, h.id, x)) n++;
		else if (rest(data, x) || data.shieldedDays?.includes(x)) continue;
		else break;
	}
	return n;
}

const list = (names: string[]) => (names.length <= 2 ? names.join(' et ') : `${names.slice(0, 2).join(', ')} et ${names.length - 2} autre${names.length > 3 ? 's' : ''}`);

function message(kind: string, data: Data, date: ISODate): Message | null {
	const sector = SECTORS[(weekday(date) + 6) % 7];
	const pending = data.habits.filter((h) => due(h, date) && !logged(data, h.id, date));

	if (kind === 'morning' || kind === 'day' || kind === 'evening') {
		if (rest(data, date)) return null;
		const here = pending.filter((h) => h.moment === kind);
		if (!here.length) return null;
		const first = here.find((h) => h.cue) ?? here[0];
		const titles = { morning: `Secteur ${sector} : le Sillage se réveille`, day: 'Point de mi-orbite', evening: 'Le soir tombe sur Kronos' };
		return {
			title: titles[kind],
			body: `${list(here.map((h) => h.name))} t'attend${here.length > 1 ? 'ent' : ''}.${first.cue ? ` ${first.cue} : ${first.name}.` : ''}`,
			url: '#/'
		};
	}

	if (kind === 'dayCheck') {
		if (rest(data, date)) return null;
		const duties = pending.filter((h) => h.kind === 'obligatory');
		if (!duties.length) return null;
		const atRisk = duties.map((h) => ({ h, n: streak(data, h, date) })).sort((a, b) => b.n - a.n)[0];
		const left = duties.length;
		return {
			title: left === 1 ? 'Plus qu’une obligation' : `Encore ${left} obligations`,
			body:
				atRisk && atRisk.n >= 3
					? `Ta série de ${atRisk.n} jours sur ${atRisk.h.name} est en jeu. Même le minimum (${atRisk.h.tiers.min}) la garde en vie.`
					: `${list(duties.map((h) => h.name))} pour boucler la journée. Le minimum compte aussi.`,
			url: '#/'
		};
	}

	if (kind === 'review') {
		if (weekday(date) !== 0) return null;
		if (data.reviews.some((r) => r.type === 'weekly' && r.periodStart === monday(date))) return null;
		return { title: 'Le Havre est en vue', body: 'Dix minutes pour amarrer : le bilan de la semaine, ton cap, et le butin d’orbite.', url: '#/revue' };
	}

	if (kind === 'month') {
		if (addDays(date, 1).slice(8) !== '01') return null; // dernier jour du mois seulement
		const start = date.slice(0, 8) + '01';
		if (data.reviews.some((r) => r.type === 'monthly' && r.periodStart === start)) return null;
		return {
			title: `Le récit de ${MONTHS[+date.slice(5, 7) - 1]} est prêt`,
			body: 'Un mois de voyage à bord du Sillage, raconté. Viens lire ton chapitre et fixer le cap du suivant.',
			url: '#/revue?mois'
		};
	}
	return null;
}

const CORS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info'
};

Deno.serve(async (req) => {
	if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
	webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com', Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!);
	const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

	// Bouton « Tester » des Réglages : l'utilisateur connecté reçoit une notification sur tous ses appareils.
	const secret = Deno.env.get('CRON_SECRET');
	if (!secret || req.headers.get('x-cron-secret') !== secret) {
		const token = req.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
		const { data: auth } = await db.auth.getUser(token);
		if (!auth.user) return new Response('interdit', { status: 401, headers: CORS });
		const { data: mine } = await db.from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', auth.user.id);
		let ok = 0;
		for (const s of mine ?? []) {
			try {
				await webpush.sendNotification(
					{ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
					JSON.stringify({ title: 'Transmission reçue', body: 'Les rappels du Sillage arrivent bien sur cet appareil.', url: '#/', tag: 'test' })
				);
				ok++;
			} catch (e) {
				const code = (e as { statusCode?: number }).statusCode;
				if (code === 404 || code === 410) await db.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
			}
		}
		return Response.json({ sent: ok }, { headers: CORS });
	}

	const { data: subs, error } = await db.from('push_subscriptions').select('endpoint, user_id, p256dh, auth');
	if (error) return new Response(error.message, { status: 500 });
	const users = [...new Set((subs ?? []).map((s) => s.user_id))];
	let sent = 0;

	for (const userId of users) {
		const { data: row } = await db.from('app_state').select('data').eq('user_id', userId).maybeSingle();
		if (!row) continue;
		const data = row.data as Data;
		const tz = data.settings?.tz || 'Europe/Paris';
		const now = localNow(tz);
		for (const r of data.settings?.reminders ?? []) {
			if (!r.on) continue;
			const [hh, mm] = r.time.split(':').map(Number);
			const delta = now.minutes - (hh * 60 + mm);
			if (delta < 0 || delta >= WINDOW_MIN) continue;
			const key = `${r.kind}:${now.date}`;
			// La ligne du journal sert de verrou : si elle existe déjà, le rappel est parti.
			const { error: dup } = await db.from('reminder_log').insert({ user_id: userId, key });
			if (dup) continue;
			const msg = message(r.kind, data, now.date);
			if (!msg) continue;
			for (const s of (subs ?? []).filter((x) => x.user_id === userId)) {
				try {
					await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ ...msg, tag: r.kind }));
					sent++;
				} catch (e) {
					// Abonnement expiré (appareil désinstallé, permission retirée) : on le retire.
					const code = (e as { statusCode?: number }).statusCode;
					if (code === 404 || code === 410) await db.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
				}
			}
		}
	}
	// Ménage : on ne garde que deux semaines de journal.
	await db.from('reminder_log').delete().lt('sent_at', new Date(Date.now() - 14 * 86_400_000).toISOString());
	return Response.json({ users: users.length, sent });
});
