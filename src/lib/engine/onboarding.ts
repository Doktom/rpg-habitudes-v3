// Prise en main : les missions des premiers jours, qui apprennent l'app en la vivant.
// Chaque mission se valide toute seule quand l'action est faite, et rapporte un petit butin.
// Elles se débloquent jour après jour (commencer petit) ; rien n'est jamais perdu si on prend son temps.
import { daysBetween } from '../dates';
import type { AppData, ISODate, Loot } from '../types';
import { habitStreak } from './regularity';
import { moduleTotal } from './ship';

export interface DeviceContext {
	signedIn: boolean; // connecté à la synchro
	subscribed: boolean; // rappels push activés sur cet appareil
	installed: boolean; // app installée (écran d'accueil)
}

export interface Mission {
	id: string;
	day: number; // jour de déblocage (1 = le premier jour)
	title: string;
	text: string;
	href?: string;
	reward: { xp: number; loot: Loot };
	test: (data: AppData, device: DeviceContext) => boolean;
}

export const GUIDE_DAYS = [
	{ day: 1, name: 'Prise de commandes', lore: 'Tu découvres le cockpit.' },
	{ day: 2, name: 'Mise en orbite', lore: 'Le Sillage te suit partout.' },
	{ day: 3, name: 'Premier palier', lore: 'Le rythme s’installe.' },
	{ day: 5, name: 'Le chantier', lore: 'Le vaisseau se répare.' },
	{ day: 7, name: 'Premier amarrage', lore: 'Une orbite complète.' }
];

const small = { xp: 15, loot: { metal: 3 } };
const medium = { xp: 25, loot: { metal: 3, energy: 2 } };

export const MISSIONS: Mission[] = [
	{
		id: 'first-habit',
		day: 1,
		title: 'Valider une première routine',
		text: 'Sur Aujourd’hui, choisis un palier (Min, Normal ou Excellent) sur une habitude faite.',
		href: '#/',
		reward: small,
		test: (d) => d.habitLogs.length > 0 || d.danceLogs.length > 0
	},
	{
		id: 'tune-habits',
		day: 1,
		title: 'Ajuster tes habitudes',
		text: 'Ouvre Habitudes : garde celles qui te parlent, passe les autres en bonus ou archive-les.',
		href: '#/habitudes',
		reward: small,
		test: (d) => d.onboarding.hints.includes('habitudes')
	},
	{
		id: 'first-task',
		day: 1,
		title: 'Livrer un premier colis',
		text: 'Ajoute une petite tâche à faire aujourd’hui, puis coche-la.',
		href: '#/',
		reward: small,
		test: (d) => d.tasks.some((t) => t.done)
	},
	{
		id: 'sync',
		day: 2,
		title: 'Relier le téléphone et le PC',
		text: 'Dans Réglages, crée ton compte de bord : tes données se sauvegardent et se retrouvent partout.',
		href: '#/reglages',
		reward: medium,
		test: (_d, dev) => dev.signedIn
	},
	{
		id: 'install',
		day: 2,
		title: 'Installer le Sillage',
		text: 'Sur ton téléphone, ajoute l’app à l’écran d’accueil : elle s’ouvre comme une vraie app, même hors ligne.',
		href: '#/reglages',
		reward: small,
		test: (_d, dev) => dev.installed
	},
	{
		id: 'notify',
		day: 2,
		title: 'Activer les transmissions',
		text: 'Autorise les rappels : le copilote te prévient au bon moment, jamais plus que nécessaire.',
		href: '#/reglages',
		reward: small,
		test: (_d, dev) => dev.subscribed
	},
	{
		id: 'minimum',
		day: 3,
		title: 'Oser le minimum',
		text: 'Un jour sans énergie, valide une habitude au palier Min : un petit pas garde la série vivante.',
		href: '#/',
		reward: small,
		test: (d) => d.habitLogs.some((l) => l.tier === 'min')
	},
	{
		id: 'complete-day',
		day: 3,
		title: 'Allumer un secteur',
		text: 'Fais toutes les obligations d’une journée : le secteur s’allume sur l’orbite.',
		href: '#/',
		reward: medium,
		test: (d) => d.events.some((e) => e.source.startsWith('reg:day:'))
	},
	{
		id: 'streak-3',
		day: 3,
		title: 'Trois jours d’affilée',
		text: 'Tiens la même habitude trois jours de suite : la flamme de série apparaît.',
		href: '#/',
		reward: medium,
		test: (d) => d.habits.some((h) => h.frequency.type !== 'weekly' && habitStreak(d, h, lastLogDate(d, h.id)) >= 3)
	},
	{
		id: 'ship',
		day: 5,
		title: 'Première réparation',
		text: 'Au Vaisseau, dépense tes matériaux pour améliorer un module.',
		href: '#/vaisseau',
		reward: medium,
		test: (d) => moduleTotal(d) > 0
	},
	{
		id: 'quest',
		day: 5,
		title: 'Avancer une campagne',
		text: 'Dans Campagnes, coche une quête (ou démarre une campagne à partir d’un modèle).',
		href: '#/campagnes',
		reward: medium,
		test: (d) => d.events.some((e) => e.source.startsWith('quest:'))
	},
	{
		id: 'review',
		day: 7,
		title: 'Amarrer au Havre',
		text: 'Le dimanche, fais ta première revue : bilan, cap de la semaine et butin d’orbite.',
		href: '#/revue',
		reward: { xp: 40, loot: { energy: 3, crystal: 1 } },
		test: (d) => d.reviews.some((r) => r.type === 'weekly')
	}
];

function lastLogDate(d: AppData, habitId: string): ISODate {
	let last = '';
	for (const l of d.habitLogs) if (l.habitId === habitId && l.date > last) last = l.date;
	return last || d.onboarding.startedAt;
}

// Jour du voyage (1 = jour de démarrage).
export const guideDay = (d: AppData, asOf: ISODate) => Math.max(1, daysBetween(d.onboarding.startedAt, asOf) + 1);

export function missionsState(d: AppData, asOf: ISODate) {
	const day = guideDay(d, asOf);
	const done = MISSIONS.filter((m) => d.onboarding.missions[m.id]);
	const open = MISSIONS.filter((m) => !d.onboarding.missions[m.id] && m.day <= day);
	const next = MISSIONS.find((m) => !d.onboarding.missions[m.id] && m.day > day);
	return { day, done: done.length, total: MISSIONS.length, open, next, finished: done.length === MISSIONS.length };
}

// Missions réussies et pas encore récompensées (toutes, même pas encore débloquées : l'effort compte).
export const newlyDone = (d: AppData, device: DeviceContext) => MISSIONS.filter((m) => !d.onboarding.missions[m.id] && m.test(d, device));
