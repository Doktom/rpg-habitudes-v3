import { addDays, today } from './dates';
import { CAMPAIGN_TEMPLATES, campaignFromTemplate } from './templates';
import type { AppData, Habit, ISODate } from './types';

const tiers = (min: string, normal: string, excellent: string) => ({ min, normal, excellent });

// Configuration de départ issue du cahier des charges. Le contenu des routines se remplit au fil de l'eau.
export function seed(today: ISODate): AppData {
	const habits: Habit[] = [
		{
			id: 'reveil',
			name: 'Réveil musculaire',
			form: 'routine',
			kind: 'obligatory',
			frequency: { type: 'daily' },
			tiers: tiers('1 min', '3-5 min', '5 min + gainage'),
			moment: 'morning',
			difficulty: 'easy',
			domains: [
				{ domainId: 'mobilite', weight: 70 },
				{ domainId: 'sport', weight: 30 }
			],
			routine: [{ from: today, exercises: [] }],
			createdAt: today
		},
		{
			id: 'kine-matin',
			name: 'Kiné matin',
			form: 'routine',
			kind: 'obligatory',
			frequency: { type: 'daily' },
			tiers: tiers('Étirements seuls', 'Étirements + renfos', 'Tout + 1 série en plus'),
			moment: 'morning',
			difficulty: 'medium',
			domains: [{ domainId: 'mobilite', weight: 100 }],
			routine: [{ from: today, exercises: [] }],
			createdAt: today
		},
		{
			id: 'kine-soir',
			name: 'Kiné soir',
			form: 'routine',
			kind: 'obligatory',
			frequency: { type: 'daily' },
			tiers: tiers('Étirements seuls', 'Étirements + renfos', 'Tout + 1 série en plus'),
			moment: 'evening',
			difficulty: 'medium',
			domains: [{ domainId: 'mobilite', weight: 100 }],
			routine: [{ from: today, exercises: [] }],
			createdAt: today
		},
		{
			id: 'mini-seance',
			name: 'Mini-séance sport',
			form: 'simple',
			kind: 'bonus',
			frequency: { type: 'daily' },
			tiers: tiers('5 min', '15 min', '25 min'),
			moment: 'day',
			difficulty: 'easy',
			domains: [{ domainId: 'sport', weight: 100 }],
			createdAt: today
		},
		{
			id: 'salle',
			name: 'Salle',
			form: 'program',
			kind: 'obligatory',
			frequency: { type: 'weekly', times: 3 },
			tiers: tiers('Séance courte', 'Séance complète', 'Séance + record'),
			moment: 'day',
			difficulty: 'hard',
			domains: [{ domainId: 'sport', weight: 100 }],
			sessions: ['Séance A', 'Séance B', 'Séance C'],
			createdAt: today
		},
		{
			id: 'trading-analyse',
			name: 'Analyse / journal de trading',
			form: 'simple',
			kind: 'obligatory',
			frequency: { type: 'days', days: [1, 2, 3, 4, 5] },
			tiers: tiers('Lecture du marché 5 min', 'Analyse + journal', 'Analyse + journal + étude'),
			moment: 'day',
			difficulty: 'medium',
			domains: [{ domainId: 'trading', weight: 100 }],
			campaignId: 'camp-trading',
			createdAt: today
		}
	];

	const data: AppData = {
		version: 1,
		domains: [
			{ id: 'danse', name: 'Danse', stat: 'Rythme', color: '#db2777' },
			{ id: 'salsa', name: 'Salsa', stat: 'Salsa', color: '#e11d48', parentId: 'danse' },
			{ id: 'bachata', name: 'Bachata', stat: 'Bachata', color: '#c026d3', parentId: 'danse' },
			{ id: 'kizomba', name: 'Kizomba', stat: 'Kizomba', color: '#9333ea', parentId: 'danse' },
			{ id: 'sport', name: 'Sport', stat: 'Force', color: '#ea580c' },
			{ id: 'mobilite', name: 'Mobilité / kiné', stat: 'Souplesse', color: '#0d9488' },
			{ id: 'trading', name: 'Trading', stat: 'Stratégie', color: '#2563eb' },
			{ id: 'projets', name: 'Projets perso', stat: 'Créativité', color: '#ca8a04' },
			{ id: 'bienetre', name: 'Bien-être', stat: 'Sérénité', color: '#16a34a' }
		],
		habits,
		habitLogs: [],
		danceClasses: [],
		danceParties: [],
		vacations: [],
		danceLogs: [],
		campaigns: [
			{
				id: 'camp-trading',
				name: 'Système de trading',
				intent: 'Construire un système de trading rigoureux, fondé sur un process plutôt que sur les résultats.',
				domainId: 'trading',
				status: 'active',
				chapters: [
					{ id: 'ch-t1', name: 'Définir ma stratégie', quests: [] },
					{ id: 'ch-t2', name: 'Backtester', quests: [] },
					{ id: 'ch-t3', name: 'Trader en démo', quests: [] },
					{ id: 'ch-t4', name: 'Passer en réel avec un plan', quests: [] }
				]
			},
			{
				id: 'camp-maison',
				name: 'Aménagement et déco de la maison',
				intent: 'Aménager la maison pièce par pièce, à mon rythme.',
				domainId: 'projets',
				status: 'active',
				chapters: [{ id: 'ch-m1', name: 'Première pièce (à définir)', quests: [] }]
			}
		],
		tasks: [],
		reviews: [],
		events: [],
		restDays: [],
		minimumModeDays: [],
		shieldedDays: [],
		shieldDeclined: [],
		dismissedTips: [],
		lastProcessedDay: undefined,
		ship: { modules: {} },
		skills: {},
		trophies: {},
		notebook: []
	};
	return addContent(data, today);
}

// Complète des données plus anciennes (importées ou déjà stockées) avec les champs ajoutés depuis.
export function withDefaults(data: AppData): AppData {
	data.ship ??= { modules: {} };
	data.ship.modules ??= {};
	data.skills ??= {};
	data.trophies ??= {};
	data.notebook ??= [];
	data.shieldedDays ??= [];
	data.shieldDeclined ??= [];
	data.dismissedTips ??= [];
	return addContent(data, today());
}

// Contenus ajoutés après coup, versés une seule fois (une habitude supprimée ensuite ne revient pas).
const CONTENT_VERSION = 3;

export function addContent(data: AppData, date: ISODate): AppData {
	const version = data.contentVersion ?? 1;
	if (version >= CONTENT_VERSION) return data;

	if (version < 2) {
		const addDomain = (d: AppData['domains'][number]) => data.domains.some((x) => x.id === d.id) || data.domains.push(d);
		const addHabit = (h: Habit) => data.habits.some((x) => x.id === h.id) || data.habits.push(h);
		const addList = (l: AppData['notebook'][number]) => data.notebook.some((x) => x.id === l.id) || data.notebook.push(l);

		addDomain({ id: 'culture', name: 'Lecture & culture', stat: 'Savoir', color: '#4f46e5' });
		addDomain({ id: 'maison', name: 'Maison', stat: 'Intendance', color: '#b45309' });
		addHabit({
			id: 'lecture',
			name: 'Lecture',
			form: 'simple',
			kind: 'bonus',
			frequency: { type: 'daily' },
			tiers: tiers('5 min', '10 min', '30 min'),
			moment: 'evening',
			difficulty: 'easy',
			domains: [{ domainId: 'culture', weight: 100 }],
			createdAt: date
		});
		addHabit({
			id: 'menage',
			name: 'Ménage express',
			form: 'simple',
			kind: 'bonus',
			frequency: { type: 'daily' },
			tiers: tiers('5 min de rangement', '15 min de ménage', "Une pièce à fond"),
			moment: 'day',
			difficulty: 'easy',
			domains: [{ domainId: 'maison', weight: 100 }],
			createdAt: date
		});
		addHabit({
			id: 'air',
			name: "Prendre l'air",
			form: 'simple',
			kind: 'bonus',
			frequency: { type: 'daily' },
			tiers: tiers('5 min dehors', '20 min de marche', '1 h dehors'),
			moment: 'day',
			difficulty: 'easy',
			domains: [{ domainId: 'bienetre', weight: 100 }],
			createdAt: date
		});

		const list = (id: string, name: string, icon: string, color: string) =>
			addList({ id, name, kind: 'list', icon, color, items: [], createdAt: date });
		list('nb-courses', 'Courses', 'cart', '#16a34a');
		list('nb-deco', 'Déco à acheter', 'sofa', '#b45309');
		list('nb-essayer', 'À essayer', 'sparkles', '#9333ea');
		list('nb-visiter', 'À visiter', 'pin', '#0284c7');
		list('nb-livres', 'Livres à lire', 'book', '#4f46e5');
		addList({ id: 'nb-penser', name: 'À penser', kind: 'note', icon: 'bulb', color: '#e11d48', items: [], body: '', createdAt: date });
	}

	// v3 : un déclencheur pour les habitudes de départ, et des quêtes pour la campagne Trading restée vide.
	if (version < 3) {
		const cues: Record<string, string> = {
			reveil: 'Au saut du lit',
			'kine-matin': 'Après le réveil musculaire',
			'kine-soir': 'Avant de me coucher',
			'mini-seance': 'En rentrant du travail',
			'trading-analyse': 'À la clôture du marché',
			lecture: 'Au lit, avant d’éteindre',
			menage: 'Après le dîner',
			air: 'Pendant la pause du midi'
		};
		for (const h of data.habits) if (!h.cue && cues[h.id]) h.cue = cues[h.id];
		const trading = data.campaigns.find((c) => c.id === 'camp-trading');
		const model = CAMPAIGN_TEMPLATES.find((t) => t.key === 'trading-process');
		if (trading && model && trading.chapters.every((ch) => ch.quests.length === 0)) {
			const filled = campaignFromTemplate(model, date, addDays);
			for (const ch of trading.chapters) {
				const same = filled.chapters.find((x) => x.name === ch.name);
				if (same) ch.quests = same.quests;
			}
		}
	}

	data.contentVersion = CONTENT_VERSION;
	return data;
}
