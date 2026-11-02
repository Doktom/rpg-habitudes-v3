import { describe, expect, it } from 'vitest';
import { addDays } from '../dates';
import { seed } from '../seed';
import type { AppData, Habit } from '../types';
import { copilotTips } from './copilot';

const MON = '2026-10-05'; // un lundi

const habit = (id: string, extra: Partial<Habit> = {}): Habit => ({
	id,
	name: id,
	form: 'simple',
	kind: 'obligatory',
	frequency: { type: 'daily' },
	tiers: { min: '5 min', normal: '10 min', excellent: '30 min' },
	moment: 'day',
	difficulty: 'easy',
	domains: [{ domainId: 'bienetre', weight: 100 }],
	createdAt: addDays(MON, -30),
	...extra
});

function world(habits: Habit[]): AppData {
	const d = seed(addDays(MON, -30));
	d.habits = habits;
	d.danceClasses = [];
	d.campaigns = [];
	return d;
}
const log = (d: AppData, habitId: string, date: string) => d.habitLogs.push({ id: `${habitId}-${date}`, habitId, date, tier: 'normal' });
const ids = (d: AppData, date: string) => copilotTips(d, date).map((t) => t.id.split(':')[0]);

describe('copilote', () => {
	it('rappelle de ne pas rater deux fois, avec le palier minimum', () => {
		const d = world([habit('lire')]);
		const wed = addDays(MON, 2);
		log(d, 'lire', MON);
		const tip = copilotTips(d, wed).find((t) => t.id === 'twice:lire');
		expect(tip?.text).toContain('5 min');
		log(d, 'lire', wed);
		expect(ids(d, wed)).not.toContain('twice');
	});

	it('signale une série à un jour de son palier', () => {
		const d = world([habit('lire')]);
		for (let i = 1; i <= 6; i++) log(d, 'lire', addDays(MON, -i));
		expect(copilotTips(d, MON).find((t) => t.id === 'gradient:lire')?.title).toContain('7 jours');
	});

	it('propose la revue le dimanche si la semaine a vécu', () => {
		const d = world([habit('lire')]);
		const sun = addDays(MON, 6);
		log(d, 'lire', MON);
		expect(ids(d, sun)).toContain('review');
		d.reviews.push({ id: 'r', type: 'weekly', periodStart: MON, createdAt: sun, worked: '', stuck: '', adjust: '', priorities: [], snapshot: { xp: 0, discipline: 0, motivation: 0, inspiration: 0, successRate: 0 } });
		expect(ids(d, sun)).not.toContain('review');
	});

	it("propose de mieux accrocher une habitude qui coince, et allège une charge trop lourde", () => {
		const many = Array.from({ length: 9 }, (_, i) => habit(`h${i}`));
		const d = world(many);
		log(d, 'h0', addDays(MON, -3));
		const tips = copilotTips(d, MON);
		expect(tips.find((t) => t.id.startsWith('stuck:'))?.text).toContain('Après le café');
		expect(tips.some((t) => t.id === 'overload')).toBe(true);
	});

	it("n'affiche plus un conseil écarté pour la journée", () => {
		const d = world([habit('lire')]);
		for (let i = 1; i <= 6; i++) log(d, 'lire', addDays(MON, -i));
		d.dismissedTips.push(`gradient:lire:${MON}`);
		expect(ids(d, MON)).not.toContain('gradient');
		expect(ids(d, addDays(MON, 1))).not.toContain('gradient'); // demain, la série a changé de toute façon
	});
});
