// Copilote : quelques conseils du jour, tirés de ce qui marche pour tenir des habitudes (docs/recherche-motivation.md).
// Chaque règle encourage ou propose ; aucune ne reproche. Le copilote n'affiche que les deux ou trois plus utiles.
import { REGULARITY, SHIELD } from '../config';
import { addDays, range, startOfWeek, weekday } from '../dates';
import type { AppData, ISODate } from '../types';
import { gaugeValue, obligationsOn, successRate } from './progress';
import { habitStreak } from './regularity';
import { isDueOn, isRestDay } from './schedule';
import { shieldState } from './shields';

export type TipKind = 'boost' | 'care' | 'plan';

export interface Tip {
	id: string; // stable sur la journée, pour pouvoir l'écarter
	kind: TipKind; // boost : on y est presque ; care : prendre soin ; plan : organiser
	title: string;
	text: string;
	action?: { label: string; href: string };
	priority: number; // plus grand = plus utile aujourd'hui
}

const logged = (data: AppData, habitId: string, date: ISODate) => data.habitLogs.some((l) => l.habitId === habitId && l.date === date);

// Réussite d'une habitude sur les jours dus d'une période (jours de repos exclus).
function habitRate(data: AppData, habitId: string, from: ISODate, to: ISODate): { done: number; expected: number } {
	const h = data.habits.find((x) => x.id === habitId);
	let done = 0;
	let expected = 0;
	if (!h) return { done, expected };
	for (const d of range(from, to)) {
		if (!isDueOn(h, d) || isRestDay(data, d)) continue;
		expected++;
		if (logged(data, h.id, d)) done++;
	}
	return { done, expected };
}

export function copilotTips(data: AppData, date: ISODate): Tip[] {
	const tips: Tip[] = [];
	const yesterday = addDays(date, -1);
	const active = data.habits.filter((h) => !h.archived && h.createdAt <= date);
	const restToday = isRestDay(data, date);

	// 1. Ne jamais rater deux fois (Lally : un oubli isolé ne coûte rien, c'est l'enchaînement qui casse l'élan).
	if (!restToday) {
		const missed = active.filter(
			(h) =>
				h.kind === 'obligatory' &&
				isDueOn(h, yesterday) &&
				isDueOn(h, date) &&
				!isRestDay(data, yesterday) &&
				!data.shieldedDays.includes(yesterday) &&
				!logged(data, h.id, yesterday) &&
				!logged(data, h.id, date)
		);
		if (missed.length) {
			const h = missed[0];
			tips.push({
				id: `twice:${h.id}`,
				kind: 'care',
				title: `Ne rate pas deux fois : ${h.name}`,
				text: `Un oubli hier, ce n'est rien. Aujourd'hui, même le minimum suffit${h.tiers.min ? ` (${h.tiers.min})` : ''} pour garder l'élan.`,
				priority: 90
			});
		}
	}

	// 2. Effet de gradient : une série est à un ou deux jours d'un palier.
	for (const h of active) {
		if (h.frequency.type === 'weekly' || !isDueOn(h, date) || logged(data, h.id, date)) continue;
		const streak = habitStreak(data, h, date); // aujourd'hui pas encore fait : la série doit tenir jusqu'à hier
		const next = REGULARITY.streakMilestones.find((m) => m.days > streak);
		if (next && streak > 0 && next.days - streak === 1) {
			tips.push({
				id: `gradient:${h.id}`,
				kind: 'boost',
				title: `Série de ${next.days} jours à portée : ${h.name}`,
				text: `Fais-la aujourd'hui et la série de ${next.days} jours tombe : +${next.xp} XP de base.`,
				priority: 80 + Math.min(10, next.days / 10)
			});
		}
	}

	// 3. Journée presque complète.
	const duty = obligationsOn(data, date);
	if (!restToday && duty.expected >= 2 && duty.expected - duty.done === 1) {
		tips.push({
			id: 'almost-day',
			kind: 'boost',
			title: 'Plus qu’une obligation',
			text: `Encore une et la journée est complète : +${REGULARITY.dayComplete.xp} XP de base, et un pas de plus vers le prochain bouclier.`,
			priority: 75
		});
	}

	// 4. Revue de la semaine (réflexion régulière, nouveau départ).
	const dow = weekday(date);
	const thisWeek = startOfWeek(date);
	const reviewWeek = dow >= 1 && dow <= 2 ? addDays(thisWeek, -7) : thisWeek;
	const reviewed = data.reviews.some((r) => r.type === 'weekly' && r.periodStart === reviewWeek);
	if ((dow === 0 || dow === 1 || dow === 2) && !reviewed && data.habitLogs.some((l) => l.date >= reviewWeek)) {
		tips.push({
			id: `review:${reviewWeek}`,
			kind: 'plan',
			title: 'Amarrage au Havre',
			text: 'Dix minutes pour boucler la semaine : ce qui a marché, ce qui coince, ton cap. Le butin d’orbite t’attend.',
			action: { label: 'Faire la revue', href: '#/revue' },
			priority: dow === 0 ? 85 : 70
		});
	}

	// 5. Nouveau départ le lundi après une semaine difficile.
	if (dow === 1) {
		const last = successRate(data, addDays(thisWeek, -7), addDays(thisWeek, -1));
		const hadDuties = range(addDays(thisWeek, -7), addDays(thisWeek, -1)).some((d) => obligationsOn(data, d).expected > 0);
		if (hadDuties && last < 60) {
			tips.push({
				id: 'fresh-start',
				kind: 'care',
				title: 'Nouvelle orbite, nouveau départ',
				text: `La semaine passée a été dure (${last} % tenu). Aujourd'hui, vise seulement le minimum partout : l'important est de relancer.`,
				priority: 72
			});
		}
	}

	// 6. Une habitude qui coince depuis deux semaines : la rendre plus petite ou mieux accrochée.
	for (const h of active) {
		if (h.kind !== 'obligatory') continue;
		const r = habitRate(data, h.id, addDays(date, -14), yesterday);
		if (r.expected >= 5 && r.done / r.expected < 0.4) {
			tips.push({
				id: `stuck:${h.id}`,
				kind: 'care',
				title: `${h.name} coince`,
				text: h.cue
					? `Tenue ${r.done} fois sur ${r.expected}. Essaie le palier minimum quelques jours, ou passe-la en bonus le temps de retrouver le rythme.`
					: `Tenue ${r.done} fois sur ${r.expected}. Accroche-la à un moment précis (« Après le café… ») : c'est ce qui aide le plus à passer à l'acte.`,
				action: { label: 'Ajuster', href: '#/habitudes' },
				priority: 60
			});
			break;
		}
	}

	// 7. Trop d'obligations à la fois.
	const dailyDuties = active.filter((h) => h.kind === 'obligatory' && h.frequency.type !== 'weekly').length;
	if (dailyDuties > 8) {
		tips.push({
			id: 'overload',
			kind: 'plan',
			title: 'Beaucoup d’obligations',
			text: `${dailyDuties} habitudes obligatoires : c'est lourd à tenir ensemble. Passe les moins importantes en bonus, elles rapporteront toujours.`,
			action: { label: 'Voir mes habitudes', href: '#/habitudes' },
			priority: 50
		});
	}

	// 8. Se reposer : deux semaines sans pause et une Motivation qui baisse.
	const recentRest = range(addDays(date, -14), date).some((d) => isRestDay(data, d));
	if (!recentRest && gaugeValue(data, 'motivation', yesterday) < 45 && data.habitLogs.length > 20) {
		tips.push({
			id: 'rest',
			kind: 'care',
			title: 'Une pause te ferait du bien',
			text: 'Deux semaines sans jour de repos et le réacteur fatigue. Pose un jour de repos cette semaine : il ne compte jamais comme raté.',
			priority: 55
		});
	}

	// 9. Une campagne au point mort depuis une semaine.
	for (const c of data.campaigns) {
		if (c.status !== 'active') continue;
		const recent = data.events.some((e) => e.campaignId === c.id && e.date >= addDays(date, -7));
		const hasOpen = c.chapters.some((ch) => ch.quests.some((q) => !q.done));
		if (!recent && hasOpen && c.chapters.length) {
			tips.push({
				id: `idle:${c.id}`,
				kind: 'plan',
				title: `${c.name} attend`,
				text: 'Rien depuis une semaine. Choisis la plus petite quête et fais-en un pas aujourd’hui, ou mets la campagne à quai pour souffler.',
				action: { label: 'Voir la campagne', href: '#/campagnes' },
				priority: 40
			});
			break;
		}
	}

	// 10. Prochain bouclier tout proche.
	const sh = shieldState(data);
	if (sh.stock < sh.max && sh.progress >= SHIELD.earnEvery - 2 && sh.progress > 0) {
		const left = SHIELD.earnEvery - sh.progress;
		tips.push({
			id: 'shield-soon',
			kind: 'boost',
			title: 'Un bouclier en vue',
			text: `Encore ${left} journée${left > 1 ? 's' : ''} complète${left > 1 ? 's' : ''} et tu gagnes un bouclier de série.`,
			priority: 45
		});
	}

	const hidden = new Set(data.dismissedTips.filter((k) => k.endsWith(`:${date}`)).map((k) => k.slice(0, -date.length - 1)));
	return tips.filter((t) => !hidden.has(t.id)).sort((a, b) => b.priority - a.priority);
}
