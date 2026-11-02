// Le conteur de bord et les missions des premiers jours, joués sur le store.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addDays, range, setClock } from '../dates';
import { seed } from '../seed';
import { Store } from '../store.svelte';
import type { Habit } from '../types';
import { missionsState } from './onboarding';
import { monthStory, pendingMoments } from './story';

const START = '2026-10-01';

const habit = (id: string, extra: Partial<Habit> = {}): Habit => ({
	id,
	name: id === 'kine' ? 'Kiné' : id,
	form: 'simple',
	kind: 'obligatory',
	frequency: { type: 'daily' },
	tiers: { min: '2 min', normal: '10 min', excellent: '20 min' },
	moment: 'day',
	difficulty: 'medium',
	domains: [{ domainId: 'mobilite', weight: 100 }],
	createdAt: START,
	...extra
});

let s: Store;
beforeEach(() => {
	setClock(START);
	s = new Store();
	const d = seed(START);
	d.habits = [habit('kine')];
	d.danceClasses = [];
	d.lastProcessedDay = addDays(START, -1);
	s.data = d;
	s.initMoments();
});
afterEach(() => setClock(null));

function play(days: string[]) {
	for (const d of days) {
		setClock(d);
		s.rollover();
		s.logHabit(s.data.habits[0], d, 'normal');
	}
}

describe('moments racontés', () => {
	it('raconte le palier de 7 jours une seule fois', () => {
		play(range(START, addDays(START, 6)));
		const m = pendingMoments(s.data, addDays(START, 6)).find((x) => x.kind === 'streak');
		expect(m?.title).toContain('7 jours');
		expect(m?.text).toContain('Kiné');
		s.seeMoment(m!.key);
		expect(pendingMoments(s.data, addDays(START, 6)).some((x) => x.kind === 'streak')).toBe(false);
	});

	it('fête chaque niveau gagné', () => {
		play(range(START, addDays(START, 9)));
		const levels = pendingMoments(s.data, addDays(START, 9)).filter((x) => x.kind === 'level');
		expect(levels.length).toBeGreaterThan(0);
		for (const l of levels) s.seeMoment(l.key);
		expect(pendingMoments(s.data, addDays(START, 9)).some((x) => x.kind === 'level')).toBe(false);
	});

	it('raconte avec douceur la fin d’une série de 7 jours ou plus', () => {
		play(range(START, addDays(START, 7)));
		const miss = addDays(START, 8);
		setClock(addDays(miss, 1));
		s.rollover();
		s.declineShield(miss);
		const end = pendingMoments(s.data, addDays(miss, 1)).find((x) => x.kind === 'streak-end');
		expect(end?.text).toMatch(/ne pas rater deux fois|nouvelle série/);
	});

	it('n’ouvre pas d’avalanche sur des données importées', () => {
		play(range(START, addDays(START, 6)));
		const fresh = new Store();
		fresh.data = JSON.parse(JSON.stringify(s.data));
		fresh.data.moments = { seen: [], level: -1 };
		fresh.initMoments();
		expect(pendingMoments(fresh.data, addDays(START, 6))).toHaveLength(0);
	});
});

describe('chronique du mois', () => {
	it('raconte le mois en chapitres, avec un titre et un épilogue', () => {
		play(range(START, addDays(START, 20)));
		const story = monthStory(s.data, START, '2026-10-31');
		expect(story.title.length).toBeGreaterThan(5);
		expect(story.chapters.map((c) => c.heading)).toEqual(expect.arrayContaining(['Le départ', 'La route']));
		expect(story.chapters.find((c) => c.heading === 'La route')?.text).toContain('Kiné');
		expect(story.epilogue).toContain('novembre');
		expect(story.xp).toBeGreaterThan(0);
	});
});

describe('missions des premiers jours', () => {
	it('récompense une mission une seule fois, appareil compris', () => {
		play([START]);
		expect(s.data.onboarding.missions['first-habit']).toBe(START);
		const n = s.data.events.filter((e) => e.source === 'onboard:first-habit').length;
		s.logHabit(s.data.habits[0], START, 'excellent');
		expect(s.data.events.filter((e) => e.source === 'onboard:first-habit')).toHaveLength(n);
		s.setDevice({ signedIn: true, subscribed: false, installed: false });
		expect(s.data.onboarding.missions.sync).toBe(START);
	});

	it('débloque les missions jour après jour', () => {
		expect(missionsState(s.data, START).open.every((m) => m.day === 1)).toBe(true);
		expect(missionsState(s.data, addDays(START, 6)).open.some((m) => m.id === 'review')).toBe(true);
	});
});
