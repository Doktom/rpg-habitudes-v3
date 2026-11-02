// Contenus prêts à l'emploi : habitudes à essayer et modèles de campagnes.
// Les habitudes démarrent en bonus avec un palier minimum minuscule et un déclencheur : commencer petit, accrocher à un moment.
import { uid } from './id';
import type { Campaign, Difficulty, Domain, Habit, ISODate, Moment } from './types';

export interface HabitIdea {
	key: string;
	name: string;
	why: string; // une ligne pour donner envie, sans promesse miracle
	domain: Domain; // créée si absente
	moment: Moment;
	cue: string;
	tiers: [string, string, string];
	difficulty: Difficulty;
}

const D = {
	culture: { id: 'culture', name: 'Lecture & culture', stat: 'Savoir', color: '#4f46e5' },
	maison: { id: 'maison', name: 'Maison', stat: 'Intendance', color: '#b45309' },
	bienetre: { id: 'bienetre', name: 'Bien-être', stat: 'Sérénité', color: '#16a34a' },
	sport: { id: 'sport', name: 'Sport', stat: 'Force', color: '#ea580c' },
	mobilite: { id: 'mobilite', name: 'Mobilité / kiné', stat: 'Souplesse', color: '#0d9488' },
	projets: { id: 'projets', name: 'Projets perso', stat: 'Créativité', color: '#ca8a04' },
	danse: { id: 'danse', name: 'Danse', stat: 'Rythme', color: '#db2777' },
	trading: { id: 'trading', name: 'Trading', stat: 'Stratégie', color: '#2563eb' }
} satisfies Record<string, Domain>;

export const HABIT_IDEAS: HabitIdea[] = [
	{ key: 'lecture', name: 'Lecture', why: 'Quelques pages chaque soir, et les livres s’enchaînent.', domain: D.culture, moment: 'evening', cue: 'Au lit, avant d’éteindre', tiers: ['5 min', '10 min', '30 min'], difficulty: 'easy' },
	{ key: 'menage', name: 'Ménage express', why: 'Un peu chaque jour plutôt qu’un grand ménage qui pèse.', domain: D.maison, moment: 'day', cue: 'Après le dîner', tiers: ['5 min de rangement', '15 min de ménage', 'Une pièce à fond'], difficulty: 'easy' },
	{ key: 'air', name: "Prendre l'air", why: 'Lumière du jour et marche : l’humeur et le sommeil suivent.', domain: D.bienetre, moment: 'day', cue: 'Pendant la pause du midi', tiers: ['5 min dehors', '20 min de marche', '1 h dehors'], difficulty: 'easy' },
	{ key: 'eau', name: 'Boire de l’eau', why: 'Le plus simple des gestes, à accrocher aux repas.', domain: D.bienetre, moment: 'day', cue: 'À chaque repas', tiers: ['1 verre', '1,5 L dans la journée', '2 L dans la journée'], difficulty: 'easy' },
	{ key: 'gratitude', name: 'Trois mercis', why: 'Noter trois bonnes choses du jour entraîne l’attention vers ce qui va.', domain: D.bienetre, moment: 'evening', cue: 'Après m’être brossé les dents', tiers: ['1 chose', '3 choses', '3 choses + pourquoi'], difficulty: 'easy' },
	{ key: 'ecran', name: 'Pas d’écran au lit', why: 'Un vrai sas avant de dormir.', domain: D.bienetre, moment: 'evening', cue: 'Quand je me mets au lit', tiers: ['Téléphone hors du lit', 'Hors de la chambre', 'Plus d’écran 1 h avant'], difficulty: 'medium' },
	{ key: 'etirements', name: 'Étirements', why: 'Quelques minutes suffisent pour garder la souplesse acquise.', domain: D.mobilite, moment: 'evening', cue: 'Pendant que l’eau du thé chauffe', tiers: ['2 min', '10 min', '20 min'], difficulty: 'easy' },
	{ key: 'pas', name: 'Marcher', why: 'Bouger un peu tous les jours compte plus que l’intensité.', domain: D.sport, moment: 'day', cue: 'En rentrant du travail', tiers: ['10 min', '30 min', '8 000 pas'], difficulty: 'easy' },
	{ key: 'pratique-danse', name: 'Pratique danse', why: 'Un pas de base revu chaque jour, et ça se voit en soirée.', domain: D.danse, moment: 'evening', cue: 'Avant le dîner, une musique', tiers: ['1 chanson', '15 min', '30 min de travail'], difficulty: 'medium' },
	{ key: 'apprendre', name: 'Apprendre un peu', why: 'Une langue, un instrument, un cours : la régularité bat l’intensité.', domain: D.culture, moment: 'day', cue: 'Avec mon café', tiers: ['5 min', '15 min', '30 min'], difficulty: 'medium' },
	{ key: 'planif', name: 'Préparer demain', why: 'Deux minutes le soir pour un lendemain plus léger.', domain: D.projets, moment: 'evening', cue: 'Après le dîner', tiers: ['Les 3 tâches de demain', 'Tâches + agenda', 'Tâches + agenda + sac prêt'], difficulty: 'easy' },
	{ key: 'journal-trading', name: 'Journal de trading', why: 'Noter chaque décision, même sans trade : on progresse sur le process.', domain: D.trading, moment: 'day', cue: 'À la clôture du marché', tiers: ['Une ligne', 'Journal complet', 'Journal + leçon du jour'], difficulty: 'medium' }
];

// Crée l'habitude (en bonus) et sa catégorie si besoin.
export function habitFromIdea(idea: HabitIdea, domains: Domain[], today: ISODate): { habit: Habit; domain?: Domain } {
	const exists = domains.some((d) => d.id === idea.domain.id);
	return {
		habit: {
			id: `${idea.key}-${uid().slice(0, 4)}`,
			name: idea.name,
			form: 'simple',
			kind: 'bonus',
			frequency: { type: 'daily' },
			tiers: { min: idea.tiers[0], normal: idea.tiers[1], excellent: idea.tiers[2] },
			moment: idea.moment,
			difficulty: idea.difficulty,
			domains: [{ domainId: idea.domain.id, weight: 100 }],
			cue: idea.cue,
			createdAt: today
		},
		domain: exists ? undefined : idea.domain
	};
}

// --- Campagnes ---

type QuestSpec = string | { name: string; xp?: number; boss?: boolean };

export interface CampaignTemplate {
	key: string;
	name: string;
	intent: string;
	domain: Domain;
	weeks: number; // durée indicative, pour l'arrivée visée
	chapters: { name: string; quests: QuestSpec[] }[];
}

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
	{
		key: 'lecture-12',
		name: 'Douze livres dans l’année',
		intent: 'Retrouver le plaisir de lire, un livre par mois, sans pression.',
		domain: D.culture,
		weeks: 52,
		chapters: [
			{ name: 'Préparer la pile', quests: ['Noter 12 livres envies dans le Carnet', 'Choisir le premier livre', 'Installer un coin lecture'] },
			{ name: 'Premier trimestre', quests: ['Livre 1', 'Livre 2', { name: 'Livre 3', xp: 150 }] },
			{ name: 'Deuxième trimestre', quests: ['Livre 4', 'Livre 5', { name: 'Livre 6', xp: 150 }] },
			{ name: 'Troisième trimestre', quests: ['Livre 7', 'Livre 8', { name: 'Livre 9', xp: 150 }] },
			{ name: 'Dernière ligne droite', quests: ['Livre 10', 'Livre 11', { name: 'Livre 12 : le dernier', xp: 400, boss: true }] }
		]
	},
	{
		key: 'maison-propre',
		name: 'Une maison qui respire',
		intent: 'Trier et organiser la maison pièce par pièce, pour qu’elle reste facile à tenir.',
		domain: D.maison,
		weeks: 12,
		chapters: [
			{ name: 'Cuisine', quests: ['Trier placards et frigo', 'Nettoyer à fond', 'Ranger pour gagner du temps'] },
			{ name: 'Salon', quests: ['Désencombrer les surfaces', 'Trier papiers et objets', 'Nettoyer à fond'] },
			{ name: 'Chambre', quests: ['Trier les vêtements (donner, jeter, garder)', 'Ranger le dressing', 'Nettoyer à fond'] },
			{ name: 'Salle de bain', quests: ['Trier les produits', 'Nettoyer à fond'] },
			{ name: 'Le grand défi', quests: [{ name: 'La pièce que j’évite (cave, garage, débarras)', xp: 400, boss: true }] }
		]
	},
	{
		key: 'deco',
		name: 'Déco : un intérieur qui me ressemble',
		intent: 'Aménager et décorer à mon goût, pièce par pièce, avec un budget clair.',
		domain: D.projets,
		weeks: 16,
		chapters: [
			{ name: 'Inspiration', quests: ['Rassembler 20 images qui me plaisent', 'Choisir 3 couleurs et matières', 'Choisir la première pièce'] },
			{ name: 'Plan et budget', quests: ['Mesurer la pièce', 'Lister les achats dans le Carnet « Déco à acheter »', 'Fixer le budget'] },
			{ name: 'Mise en place', quests: ['Peinture ou murs', 'Mobilier principal', 'Textiles et lumière', 'Objets et plantes'] },
			{ name: 'Finitions', quests: [{ name: 'Pièce terminée : photo avant / après', xp: 300, boss: true }] }
		]
	},
	{
		key: 'forme-12',
		name: 'Remise en forme en 12 semaines',
		intent: 'Construire une base solide : régularité d’abord, intensité ensuite.',
		domain: D.sport,
		weeks: 12,
		chapters: [
			{ name: 'Fondations (sem. 1-4)', quests: ['Noter mon point de départ (poids, tour de taille, 1 test)', '4 semaines à 3 séances', 'Trouver mes horaires fixes'] },
			{ name: 'Progression (sem. 5-8)', quests: ['Augmenter les charges ou la durée', '4 semaines à 3 séances', 'Ajouter 1 séance cardio'] },
			{ name: 'Consolidation (sem. 9-12)', quests: ['4 semaines à 3 séances', 'Préparer le test de fin'] },
			{ name: 'Bilan', quests: [{ name: 'Refaire le test de départ et comparer', xp: 400, boss: true }] }
		]
	},
	{
		key: 'danse-niveau',
		name: 'Passer un cap en danse',
		intent: 'Gagner en aisance et en musicalité, et oser inviter en soirée.',
		domain: D.danse,
		weeks: 12,
		chapters: [
			{ name: 'Bases solides', quests: ['Revoir les pas de base chaque semaine', 'Filmer une passe pour me voir', 'Travailler la posture'] },
			{ name: 'Musicalité', quests: ['Reconnaître les temps sur 10 morceaux', 'Danser sur un morceau inconnu sans se perdre', 'Apprendre 2 jeux de pieds'] },
			{ name: 'Soirées', quests: ['Aller à 2 soirées', 'Inviter 5 personnes en une soirée', { name: 'Danser toute une soirée sans pause', xp: 300, boss: true }] }
		]
	},
	{
		key: 'trading-process',
		name: 'Trading : le process avant le profit',
		intent: 'Construire un système rigoureux, mesuré sur le respect du plan, jamais sur les gains.',
		domain: D.trading,
		weeks: 26,
		chapters: [
			{ name: 'Définir ma stratégie', quests: ['Choisir les marchés et horaires', 'Écrire les règles d’entrée et de sortie', 'Fixer le risque par trade', { name: 'Valider le plan par écrit', xp: 200, boss: true }] },
			{ name: 'Backtester', quests: ['Collecter les données', 'Backtester 100 situations', 'Analyser les résultats', { name: 'Backtest complet et conclusions', xp: 300, boss: true }] },
			{ name: 'Trader en démo', quests: ['20 trades démo en respectant le plan', 'Journal de chaque trade', 'Revue mensuelle du process'] },
			{ name: 'Passer en réel avec un plan', quests: ['Petite taille, 20 trades', 'Respect du plan > 90 %', { name: 'Un mois en réel sans enfreindre une règle', xp: 500, boss: true }] }
		]
	},
	{
		key: 'routine-matin',
		name: 'Des matins qui démarrent bien',
		intent: 'Une routine du matin courte et solide, qui tient même les jours pressés.',
		domain: D.bienetre,
		weeks: 6,
		chapters: [
			{ name: 'Choisir', quests: ['Fixer une heure de lever réaliste', 'Choisir 3 gestes de moins de 10 min', 'Préparer la veille ce qu’il faut'] },
			{ name: 'Tenir', quests: ['1 semaine complète', '2 semaines complètes', { name: '30 matins tenus', xp: 400, boss: true }] }
		]
	}
];

export function campaignFromTemplate(t: CampaignTemplate, today: ISODate, addDays: (d: ISODate, n: number) => ISODate): Campaign {
	return {
		id: `camp-${t.key}-${uid().slice(0, 4)}`,
		name: t.name,
		intent: t.intent,
		domainId: t.domain.id,
		status: 'active',
		target: addDays(today, t.weeks * 7),
		chapters: t.chapters.map((ch) => ({
			id: uid(),
			name: ch.name,
			quests: ch.quests.map((q) => (typeof q === 'string' ? { id: uid(), name: q, xp: 100 } : { id: uid(), name: q.name, xp: q.xp ?? 100, boss: q.boss }))
		}))
	};
}

export const templateDomain = (t: CampaignTemplate) => t.domain;
