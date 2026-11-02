// Le conteur de bord : transforme les faits du journal en récit, dans l'univers du Sillage.
// - Moments : un palier de série, un trophée, un niveau, un chapitre… racontés sur le moment.
// - Chronique du mois : le mois écoulé raconté en chapitres, pour la revue mensuelle.
// Ton : chaleureux et jamais culpabilisant (docs/recherche-motivation.md) ; un raté devient une péripétie.
import { addDays, parse, range, startOfWeek } from '../dates';
import type { AppData, ISODate, ProgressEvent } from '../types';
import { obligationsOn, totalXp, xpByDomain } from './progress';
import { habitStreak } from './regularity';
import { isDueOn, isRestDay } from './schedule';
import { shipClass } from './ship';
import { TROPHIES } from './trophies';
import { levelInfo } from './xp';
import { SHIP_CLASSES } from '../universe';

export type MomentKind = 'streak' | 'streak-end' | 'week' | 'habit-weeks' | 'trophy' | 'level' | 'chapter' | 'campaign' | 'boss' | 'ship';

export interface Moment {
	key: string; // unique : sert à ne raconter chaque moment qu'une fois
	kind: MomentKind;
	date: ISODate;
	eyebrow: string;
	title: string;
	text: string;
	xp?: number;
}

// Choix déterministe d'une variante (le même moment se raconte toujours pareil).
function pick<T>(seed: string, options: T[]): T {
	let h = 0;
	for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
	return options[Math.abs(h) % options.length];
}

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const monthName = (d: ISODate) => MONTHS[+d.slice(5, 7) - 1];
const de = (word: string) => (/^[aeiouyéèêàâîôûh]/i.test(word) ? `d’${word}` : `de ${word}`);
const xpOf = (e?: ProgressEvent) => e?.xp?.reduce((s, x) => s + x.amount, 0) ?? 0;
const plural = (n: number, one: string, many = one + 's') => `${n} ${n > 1 ? many : one}`;

function streakText(name: string, days: number, cue: string | undefined, key: string): string {
	const anchor = cue ? ` « ${cue} » est devenu un signal que ton corps reconnaît.` : '';
	if (days >= 365)
		return `Une année entière. ${days} jours sans lâcher ${name}. Les cartes de Kronos portent désormais ton nom à cet endroit de l'orbite : ce n'est plus une habitude, c'est une part de toi.`;
	if (days >= 100)
		return `Cent jours. Dans les ports de Kronos, on raconte l'histoire d'un pilote qui n'a jamais laissé tomber ${name}. Cette histoire, c'est la tienne.${anchor}`;
	if (days >= 60)
		return `Soixante jours que ${name} tient la barre. L'effort des débuts s'est changé en évidence : le Sillage vole presque tout seul sur ce cap.${anchor}`;
	if (days >= 30)
		return pick(key, [
			`Trente jours. Les chercheurs disent qu'une habitude s'ancre quelque part entre trois semaines et deux mois : ${name} vient de passer le cap le plus dur.${anchor}`,
			`Un mois complet de ${name}. Le journal de bord a dû ajouter une page rien que pour toi. Ce qui demandait de l'effort commence à aller de soi.${anchor}`
		]);
	if (days >= 14)
		return pick(key, [
			`Deux semaines d'affilée. ${name} n'est plus une résolution : c'est un rituel de bord. Les moteurs ronronnent un peu plus fort.`,
			`Quatorze jours sur ${name}. Deux orbites complètes de Kronos, et la flamme ne faiblit pas.`
		]);
	return pick(key, [
		`Sept jours, une orbite entière. ${name} a tenu chaque secteur, de l'Aube au Havre. Le premier palier est franchi : le plus dur, c'est de commencer, et c'est fait.`,
		`Une semaine sans faillir sur ${name}. Les instruments de bord le confirment : quelque chose est en train de prendre racine.`
	]);
}

// Tous les moments qu'on peut raconter à partir des données (déjà vus ou non).
export function moments(data: AppData, asOf: ISODate): Moment[] {
	const out: Moment[] = [];
	const habitName = (id: string) => data.habits.find((h) => h.id === id)?.name ?? 'une habitude';

	for (const e of data.events) {
		const s = e.source;
		if (s.startsWith('reg:streak:')) {
			const [, , habitId, days] = s.split(':');
			const h = data.habits.find((x) => x.id === habitId);
			out.push({
				key: s,
				kind: 'streak',
				date: e.date,
				eyebrow: `Palier de série · ${days} jours`,
				title: `${h?.name ?? 'Série'} : ${days} jours d'affilée`,
				text: streakText(h?.name ?? 'cette habitude', +days, h?.cue, s),
				xp: xpOf(e)
			});
		} else if (s.startsWith('reg:week:')) {
			out.push({
				key: s,
				kind: 'week',
				date: e.date,
				eyebrow: 'Semaine sans faille',
				title: 'Sept secteurs, zéro faux pas',
				text: pick(s, [
					'Toutes les obligations de la semaine, tenues. Au Havre, les mécaniciens lèvent les yeux de leurs établis quand le Sillage passe : on n’avait pas vu une orbite aussi propre depuis longtemps.',
					'Une semaine entière où rien n’a été laissé de côté. Le genre de semaine qu’on raconte plus tard en disant « c’est là que tout a commencé ».'
				]),
				xp: xpOf(e)
			});
		} else if (s.startsWith('reg:hweek:') && /\((\d+) semaines/.test(e.label)) {
			const n = +e.label.match(/\((\d+) semaines/)![1];
			if (![4, 8, 12, 26, 52].includes(n)) continue;
			const name = habitName(s.split(':')[2]);
			out.push({
				key: s,
				kind: 'habit-weeks',
				date: e.date,
				eyebrow: `${n} semaines d'affilée`,
				title: `${name}, semaine après semaine`,
				text: `${n} semaines pleines sans en rater une. Le rythme de ${name} fait désormais partie de la mécanique du vaisseau : un cristal de navigation rejoint la soute.`,
				xp: xpOf(e)
			});
		} else if (s.startsWith('trophy:')) {
			const t = TROPHIES.find((x) => x.id === s.slice(7));
			if (!t) continue;
			out.push({ key: s, kind: 'trophy', date: e.date, eyebrow: 'Trophée débloqué', title: t.name, text: `${t.lore} Objectif atteint : ${t.hint.charAt(0).toLowerCase() + t.hint.slice(1)}.`, xp: xpOf(e) });
		} else if (s.startsWith('chapter:')) {
			const name = e.label.replace('Chapitre terminé : ', '');
			const c = data.campaigns.find((x) => x.id === e.campaignId);
			const next = c?.chapters.find((ch) => !ch.done);
			out.push({
				key: s,
				kind: 'chapter',
				date: e.date,
				eyebrow: c ? `Campagne · ${c.name}` : 'Chapitre terminé',
				title: `Cap franchi : ${name}`,
				text: `Un fragment de plus de la carte se redessine. ${next ? `Au loin se dessine déjà la suite : « ${next.name} ».` : 'Il ne reste plus qu’à atteindre la destination.'}`,
				xp: xpOf(e)
			});
		} else if (s.startsWith('campaign:')) {
			const c = data.campaigns.find((x) => x.id === e.campaignId);
			out.push({
				key: s,
				kind: 'campaign',
				date: e.date,
				eyebrow: 'Destination atteinte',
				title: c?.name ?? e.label.replace('Campagne terminée : ', ''),
				text: `${c?.intent ? `« ${c.intent} » ` : ''}C’était une intention ; c’est maintenant un système entier sur ta carte. Prends le temps de regarder le chemin parcouru avant de choisir la prochaine destination.`,
				xp: xpOf(e)
			});
		} else if (s.startsWith('quest:') && e.label.startsWith('Boss vaincu')) {
			out.push({
				key: s,
				kind: 'boss',
				date: e.date,
				eyebrow: 'Boss vaincu',
				title: e.label.replace('Boss vaincu : ', ''),
				text: 'Ce qui te faisait reculer gît maintenant dans le sas. Les grosses étapes paraissent toujours plus grandes avant qu’après.',
				xp: xpOf(e)
			});
		}
	}

	// Niveaux du pilote : un moment par niveau gagné depuis le dernier fêté.
	const level = levelInfo(totalXp(data)).level;
	if (data.moments.level > 0)
		for (let l = data.moments.level + 1; l <= level; l++)
			out.push({
				key: `level:${l}`,
				kind: 'level',
				date: asOf,
				eyebrow: 'Montée en grade',
				title: `Pilote de niveau ${l}`,
				text: pick(`level:${l}`, [
					`Le cockpit s’ajuste à tes réflexes. Un point de compétence t’attend sur l’écran Pilote : à toi de choisir comment tu veux voler.`,
					`Ton insigne change de couleur. Les systèmes de bord te reconnaissent un peu mieux à chaque niveau : un nouveau point de compétence est disponible.`
				])
			});

	// Classe du vaisseau.
	const cls = shipClass(data);
	if (cls !== SHIP_CLASSES[0].name)
		out.push({
			key: `class:${cls}`,
			kind: 'ship',
			date: asOf,
			eyebrow: 'Le Sillage change de classe',
			title: `Classe ${cls}`,
			text: `Réacteur, coque, propulseurs, antenne : à force de réparations, l’épave des débuts n’est plus qu’un souvenir. Au registre de Kronos, le Sillage est désormais classé ${cls}.`
		});

	// Séries qui s'achèvent : racontées avec douceur, une fois passée la fenêtre du bouclier.
	for (const d of range(addDays(asOf, -7), addDays(asOf, -1))) {
		if (isRestDay(data, d) || data.shieldedDays.includes(d)) continue;
		const decided = data.shieldDeclined.includes(d) || d <= addDays(asOf, -3);
		if (!decided) continue;
		for (const h of data.habits) {
			if (h.frequency.type === 'weekly' || !isDueOn(h, d)) continue;
			if (data.habitLogs.some((l) => l.habitId === h.id && l.date === d)) continue;
			const n = habitStreak(data, h, addDays(d, -1));
			if (n < 7) continue;
			out.push({
				key: `streak-end:${h.id}:${d}`,
				kind: 'streak-end',
				date: d,
				eyebrow: 'Fin d’une série',
				title: `${h.name} : ${n} jours, une belle traversée`,
				text: pick(`${h.id}:${d}`, [
					`La série s’arrête à ${n} jours. Ce n’est pas un retour en arrière : ces ${n} jours restent dans le journal, et ton corps s’en souvient. La seule règle qui compte maintenant : ne pas rater deux fois.`,
					`${n} jours d’affilée, puis une pause. Les plus grands pilotes connaissent ces trous d’air. Reprends dès aujourd’hui, même au minimum (${h.tiers.min}) : une nouvelle série commence à 1.`
				])
			});
		}
	}
	return out;
}

// Moments pas encore racontés, du plus ancien au plus récent (on ne remonte pas au-delà de 4 jours).
export function pendingMoments(data: AppData, asOf: ISODate): Moment[] {
	if (data.moments.level < 0) return [];
	const seen = new Set(data.moments.seen);
	const since = addDays(asOf, -4);
	return moments(data, asOf)
		.filter((m) => !seen.has(m.key) && m.date >= since)
		.sort((a, b) => a.date.localeCompare(b.date));
}

// --- Chronique du mois ---

export interface StoryChapter {
	icon: 'start' | 'road' | 'storm' | 'treasure' | 'pilot' | 'ship';
	heading: string;
	text: string;
	figures?: { value: string; label: string }[];
}

export interface MonthStory {
	monthStart: ISODate;
	monthEnd: ISODate;
	title: string; // le nom de l'arc du mois
	subtitle: string;
	chapters: StoryChapter[];
	epilogue: string;
	xp: number;
	successRate: number;
}

export const monthStartOf = (d: ISODate) => d.slice(0, 8) + '01';
export function monthEndOf(d: ISODate): ISODate {
	const x = parse(monthStartOf(d));
	x.setUTCMonth(x.getUTCMonth() + 1);
	return addDays(x.toISOString().slice(0, 10), -1);
}

export function monthStory(data: AppData, monthStart: ISODate, asOf: ISODate): MonthStory {
	const end = monthEndOf(monthStart);
	const last = end < asOf ? end : asOf;
	const days = range(monthStart, last);
	const mois = monthName(monthStart);
	const inMonth = (e: { date: ISODate }) => e.date >= monthStart && e.date <= end;
	const events = data.events.filter(inMonth);

	const xp = totalXp(data, monthStart, end);
	const prevStart = monthStartOf(addDays(monthStart, -1));
	const prevXp = totalXp(data, prevStart, addDays(monthStart, -1));
	const levelBefore = levelInfo(totalXp(data, undefined, addDays(monthStart, -1))).level;
	const levelAfter = levelInfo(totalXp(data, undefined, end)).level;

	let expected = 0;
	let done = 0;
	for (const d of days) {
		const o = obligationsOn(data, d);
		expected += o.expected;
		done += o.done;
	}
	const rate = expected ? Math.round((100 * done) / expected) : 0;
	const completeDays = events.filter((e) => e.source.startsWith('reg:day:')).length;
	const perfectDays = events.filter((e) => e.source.startsWith('reg:day:') && e.label === 'Journée parfaite').length;
	const restDays = days.filter((d) => isRestDay(data, d)).length;
	const shields = events.filter((e) => e.source.startsWith('shield:use:')).length;
	const fullWeeks = events.filter((e) => e.source.startsWith('reg:week:')).length;
	const milestones = events.filter((e) => e.source.startsWith('reg:streak:'));
	const trophies = TROPHIES.filter((t) => data.trophies[t.id] && data.trophies[t.id] >= monthStart && data.trophies[t.id] <= end);
	const quests = events.filter((e) => e.source.startsWith('quest:'));
	const bosses = quests.filter((e) => e.label.startsWith('Boss'));
	const chapters = events.filter((e) => e.source.startsWith('chapter:'));
	const campaigns = events.filter((e) => e.source.startsWith('campaign:'));
	const upgrades = events.filter((e) => e.source.startsWith('ship:'));
	const tasks = data.tasks.filter((t) => t.done && t.done >= monthStart && t.done <= end).length;

	// Habitudes : la plus tenue, la plus difficile.
	const rates = data.habits
		.filter((h) => !h.archived && h.frequency.type !== 'weekly')
		.map((h) => {
			let exp = 0;
			let ok = 0;
			for (const d of days) {
				if (!isDueOn(h, d) || isRestDay(data, d)) continue;
				exp++;
				if (data.habitLogs.some((l) => l.habitId === h.id && l.date === d)) ok++;
			}
			return { h, exp, ok, pct: exp ? ok / exp : 0, streak: habitStreak(data, h, last) };
		})
		.filter((x) => x.exp >= 4);
	const best = [...rates].sort((a, b) => b.pct - a.pct || b.ok - a.ok)[0];
	const hardest = [...rates].filter((x) => x.h.kind === 'obligatory').sort((a, b) => a.pct - b.pct)[0];
	const longest = [...rates].sort((a, b) => b.streak - a.streak)[0];

	// La semaine la plus difficile (taux le plus bas), pour la raconter comme une tempête traversée.
	const weeks = [...new Set(days.map((d) => startOfWeek(d)))].map((m) => {
		let e = 0;
		let k = 0;
		for (const d of range(m < monthStart ? monthStart : m, addDays(m, 6) > last ? last : addDays(m, 6))) {
			const o = obligationsOn(data, d);
			e += o.expected;
			k += o.done;
		}
		return { monday: m, rate: e ? k / e : 1, expected: e };
	});
	const storm = weeks.filter((w) => w.expected >= 5).sort((a, b) => a.rate - b.rate)[0];

	// La stat qui a le plus grandi ce mois-ci.
	const monthData = { ...data, events };
	const byDomain = xpByDomain(monthData);
	const topDomain = data.domains.filter((d) => !d.parentId).sort((a, b) => (byDomain[b.id] ?? 0) - (byDomain[a.id] ?? 0))[0];
	const topXp = topDomain ? (byDomain[topDomain.id] ?? 0) : 0;

	// Le nom de l'arc : le trait dominant du mois.
	let title = `L’orbite ${de(mois)}`;
	if (campaigns.length) title = `Le mois de la destination`;
	else if (rate >= 90 && completeDays >= 15) title = `Le mois de la Forge`;
	else if (trophies.length >= 3) title = `Le mois des trouvailles`;
	else if (upgrades.length >= 3) title = `Le mois du chantier`;
	else if (chapters.length || bosses.length) title = `Le mois des caps franchis`;
	else if (expected && rate < 50) title = `Le mois des vents contraires`;
	else if (milestones.length >= 2) title = `Le mois des séries`;
	else if (topDomain && topXp > 0) title = `Le mois ${de(topDomain.stat)}`;

	const out: StoryChapter[] = [];

	// I. Le départ
	out.push({
		icon: 'start',
		heading: 'Le départ',
		text:
			`Le 1er ${mois}, le Sillage quittait le Havre avec un pilote de niveau ${levelBefore}. ` +
			(prevXp
				? xp > prevXp * 1.15
					? `Le mois précédent avait rapporté ${prevXp} XP : celui-ci allait faire mieux.`
					: xp < prevXp * 0.85
						? `Après un mois précédent plus chargé, celui-ci s’annonçait plus calme.`
						: `Même cap, même élan que le mois d’avant.`
				: `Un premier mois complet de voyage commençait.`),
		figures: [
			{ value: `+${xp}`, label: 'XP gagnée' },
			{ value: levelAfter > levelBefore ? `${levelBefore} → ${levelAfter}` : `${levelAfter}`, label: 'niveau' }
		]
	});

	// II. La route
	if (expected) {
		let road =
			rate >= 85
				? `Sur la route, le Sillage a tenu ${rate} % de ses obligations : une navigation d’une rare régularité.`
				: rate >= 60
					? `Sur la route, ${rate} % des obligations tenues : une vraie constance, avec ses jours avec et ses jours sans.`
					: `La route a été sinueuse : ${rate} % des obligations tenues. Mais chaque secteur allumé a compté.`;
		if (best && best.pct > 0) road += ` ${best.h.name} a été le moteur le plus fiable (${best.ok} jours sur ${best.exp}).`;
		if (longest && longest.streak >= 5) road += ` La série en cours la plus longue : ${longest.h.name}, ${longest.streak} jours, toujours vivante.`;
		out.push({
			icon: 'road',
			heading: 'La route',
			text: road,
			figures: [
				{ value: `${completeDays}`, label: `journée${completeDays > 1 ? 's' : ''} complète${completeDays > 1 ? 's' : ''}` },
				{ value: `${perfectDays}`, label: `parfaite${perfectDays > 1 ? 's' : ''}` },
				{ value: `${fullWeeks}`, label: `semaine${fullWeeks > 1 ? 's' : ''} sans faille` }
			]
		});
	}

	// III. Les épreuves (toujours bienveillant)
	const trials: string[] = [];
	if (storm && storm.rate < 0.7)
		trials.push(
			`La semaine du ${+storm.monday.slice(8)} a ressemblé à une traversée de champ d’astéroïdes (${Math.round(storm.rate * 100)} % tenu). Le vaisseau en est ressorti, et c’est ce qui compte.`
		);
	if (hardest && hardest.pct < 0.6 && hardest.h !== best?.h)
		trials.push(`${hardest.h.name} a résisté (${hardest.ok} sur ${hardest.exp}) : peut-être une habitude à rendre plus petite, ou à accrocher à un autre moment.`);
	if (shields) trials.push(`${plural(shields, 'bouclier')} ${shields > 1 ? 'ont' : 'a'} sauvé des séries au bon moment.`);
	if (restDays) trials.push(`${plural(restDays, 'jour')} de repos ${restDays > 1 ? 'ont' : 'a'} laissé le réacteur refroidir : c’est aussi ça, durer.`);
	if (trials.length) out.push({ icon: 'storm', heading: 'Les épreuves', text: trials.join(' ') });

	// IV. Les trouvailles
	const finds: string[] = [];
	if (milestones.length)
		finds.push(
			`${plural(milestones.length, 'palier')} de série franchi${milestones.length > 1 ? 's' : ''} : ${milestones
				.slice(0, 3)
				.map((e) => e.label.replace('Série de ', '').replace(' jours : ', ' j · '))
				.join(', ')}.`
		);
	if (trophies.length) finds.push(`${trophies.length > 1 ? 'Des trophées ont' : 'Un trophée a'} rejoint la vitrine : ${trophies.map((t) => t.name).join(', ')}.`);
	if (campaigns.length) finds.push(`Une destination atteinte : ${campaigns.map((e) => e.label.replace('Campagne terminée : ', '')).join(', ')}.`);
	else if (chapters.length) finds.push(`${plural(chapters.length, 'chapitre')} de campagne bouclé${chapters.length > 1 ? 's' : ''}.`);
	if (bosses.length) finds.push(`${plural(bosses.length, 'boss')} vaincu${bosses.length > 1 ? 's' : ''}.`);
	else if (quests.length) finds.push(`${plural(quests.length, 'quête')} accomplie${quests.length > 1 ? 's' : ''}.`);
	if (tasks) finds.push(`${plural(tasks, 'colis', 'colis')} livré${tasks > 1 ? 's' : ''} (tâches terminées).`);
	if (finds.length) out.push({ icon: 'treasure', heading: 'Les trouvailles', text: finds.join(' ') });

	// V. Le chantier
	if (upgrades.length)
		out.push({
			icon: 'ship',
			heading: 'Le chantier',
			text: `${plural(upgrades.length, 'amélioration')} au chantier naval : ${upgrades
				.map((e) => e.label.replace('Amélioration : ', ''))
				.join(', ')}. Le Sillage termine le mois en classe ${shipClass(data)}.`
		});

	// VI. Le pilote
	if (topDomain && topXp > 0)
		out.push({
			icon: 'pilot',
			heading: 'Le pilote',
			text: `C’est en ${topDomain.name} que tu as le plus grandi (+${topXp} XP de ${topDomain.stat}). ${levelAfter > levelBefore ? `Et ${levelAfter - levelBefore > 1 ? `${levelAfter - levelBefore} niveaux gagnés` : 'un niveau gagné'} : l’insigne de pilote brille un peu plus.` : 'Le prochain niveau se rapproche.'}`
		});

	const nextMonth = monthName(addDays(end, 1));
	const epilogue =
		rate >= 80
			? `Le chapitre ${de(mois)} se referme sur une belle orbite. En ${nextMonth}, garde ce qui marche et ose un cap un peu plus loin.`
			: rate >= 50
				? `Le chapitre ${de(mois)} se referme. En ${nextMonth}, choisis une seule chose à alléger et une seule à renforcer.`
				: `Le chapitre ${de(mois)} se referme. Les mois difficiles font les meilleurs pilotes : en ${nextMonth}, commence petit, vise le minimum, et laisse l’élan revenir.`;

	return {
		monthStart,
		monthEnd: end,
		title,
		subtitle: `Chronique ${de(mois)} ${monthStart.slice(0, 4)} · ${plural(days.length, 'jour')} de voyage`,
		chapters: out,
		epilogue,
		xp,
		successRate: rate
	};
}
