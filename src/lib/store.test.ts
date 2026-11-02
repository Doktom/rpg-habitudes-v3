// Parcours de bout en bout sur le store : chaque action laisse le journal, les jauges et les récompenses cohérents.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addDays, setClock } from './dates';
import { gaugeValue, totalXp } from './engine/progress';
import { habitStreak } from './engine/regularity';
import { materials } from './engine/ship';
import { shieldOffer, shieldState } from './engine/shields';
import { addContent, seed, withDefaults } from './seed';
import { Store } from './store.svelte';
import { CAMPAIGN_TEMPLATES, HABIT_IDEAS } from './templates';
import type { Habit } from './types';

const MON = '2026-10-05';

const habit = (id: string, extra: Partial<Habit> = {}): Habit => ({
	id,
	name: id,
	form: 'simple',
	kind: 'obligatory',
	frequency: { type: 'daily' },
	tiers: { min: 'a', normal: 'b', excellent: 'c' },
	moment: 'day',
	difficulty: 'medium',
	domains: [{ domainId: 'bienetre', weight: 100 }],
	createdAt: addDays(MON, -30),
	...extra
});

let s: Store;
function boot(habits: Habit[] = [habit('lire'), habit('air', { kind: 'bonus' })]) {
	setClock(MON);
	s = new Store();
	const d = seed(addDays(MON, -30));
	d.habits = habits;
	d.danceClasses = [];
	d.lastProcessedDay = addDays(MON, -1);
	s.data = d;
}
const at = (date: string) => setClock(date);
const sources = (prefix: string) => s.data.events.filter((e) => e.source.startsWith(prefix));
const h = (id: string) => s.data.habits.find((x) => x.id === id)!;

beforeEach(() => boot());
afterEach(() => setClock(null));

describe('store : habitudes et journées', () => {
	it("valider rapporte XP et butin, décocher les retire sans rien laisser", () => {
		s.logHabit(h('lire'), MON, 'normal');
		const xp = totalXp(s.data);
		expect(xp).toBeGreaterThan(0);
		expect(materials(s.data).metal).toBeGreaterThan(0);
		const log = s.data.habitLogs[0];
		s.unlog(log.id);
		expect(sources('habit:')).toHaveLength(0);
		expect(sources('reg:')).toHaveLength(0);
		// Seuls restent le trophée « Premier allumage » et la mission de bord : ni l'un ni l'autre ne se perd.
		const kept = [...sources('trophy:'), ...sources('onboard:')];
		expect(totalXp(s.data)).toBe(kept.reduce((t, e) => t + (e.xp?.[0].amount ?? 0), 0));
	});

	it('la journée complète tombe avec la dernière obligation, parfaite avec les bonus', () => {
		s.logHabit(h('lire'), MON, 'min');
		expect(sources('reg:day:')[0]?.label).toBe('Journée complète');
		s.logHabit(h('air'), MON, 'normal');
		expect(sources('reg:day:')).toHaveLength(1);
		expect(sources('reg:day:')[0].label).toBe('Journée parfaite');
	});

	it('débloque le premier trophée une seule fois', () => {
		s.logHabit(h('lire'), MON, 'normal');
		s.logHabit(h('air'), MON, 'normal');
		expect(s.data.trophies['first-light']).toBe(MON);
		expect(sources('trophy:first-light')).toHaveLength(1);
	});

	it('la clôture des jours pèse sur la Motivation, jamais sur l’XP', () => {
		s.logHabit(h('lire'), MON, 'normal');
		const xp = totalXp(s.data);
		const before = gaugeValue(s.data, 'motivation');
		at(addDays(MON, 3));
		s.rollover();
		expect(s.data.lastProcessedDay).toBe(addDays(MON, 2));
		expect(gaugeValue(s.data, 'motivation')).toBeLessThan(before);
		expect(totalXp(s.data)).toBe(xp);
	});
});

describe('store : boucliers', () => {
	it('se proposent après un raté qui casse une série, et se dépensent au choix', () => {
		for (let i = 7; i >= 1; i--) {
			at(addDays(MON, -i));
			s.logHabit(h('lire'), addDays(MON, -i), 'normal');
		}
		at(addDays(MON, 1)); // lundi raté
		s.rollover();
		expect(shieldOffer(s.data, addDays(MON, 1))?.date).toBe(MON);
		expect(s.useShield(MON)).toBe(true); // 7 journées complètes = un bouclier gagné
		expect(shieldState(s.data).stock).toBe(0);
		expect(shieldOffer(s.data, addDays(MON, 1))).toBeNull();
		s.logHabit(h('lire'), addDays(MON, 1), 'normal');
		// Le raté de lundi est pardonné : la série continue (7 jours avant + mardi = 8).
		expect(habitStreak(s.data, h('lire'), addDays(MON, 1))).toBe(8);
	});

	it('refuser garde le bouclier ; en fabriquer coûte 6 Cellules', () => {
		for (let i = 7; i >= 1; i--) {
			at(addDays(MON, -i));
			s.logHabit(h('lire'), addDays(MON, -i), 'normal');
		}
		at(addDays(MON, 1));
		s.rollover();
		s.declineShield(MON);
		expect(shieldOffer(s.data, addDays(MON, 1))).toBeNull();
		expect(shieldState(s.data).stock).toBe(1);
		const cells = materials(s.data).energy;
		const ok = s.buyShield();
		expect(ok).toBe(cells >= 6);
		if (ok) expect(materials(s.data).energy).toBe(cells - 6);
	});
});

describe('store : tâches, campagnes, revue', () => {
	it('une tâche rapporte à sa catégorie, et rien une fois rouverte', () => {
		s.saveTask({ id: 't1', title: 'Appeler', list: 'today', effort: 'hard', domainId: 'maison' });
		s.toggleTask(s.data.tasks[0]);
		expect(sources('task:t1')[0].xp?.[0].domainId).toBe('maison');
		s.toggleTask(s.data.tasks[0]);
		expect(sources('task:t1')).toHaveLength(0);
	});

	it('un modèle de campagne se joue jusqu’au bout : quêtes, étapes, destination', () => {
		const c = s.addCampaignFromTemplate(CAMPAIGN_TEMPLATES.find((t) => t.key === 'routine-matin')!);
		expect(c.target).toBe(addDays(MON, 42));
		for (const ch of c.chapters) for (const q of ch.quests) s.toggleQuest(c, ch.id, q.id);
		expect(c.chapters.every((ch) => ch.done)).toBe(true);
		expect(sources('chapter:')).toHaveLength(c.chapters.length);
		expect(sources('quest:').some((e) => e.label.startsWith('Boss vaincu'))).toBe(true);
		s.toggleCampaignDone(c);
		expect(c.status).toBe('done');
		expect(sources(`campaign:${c.id}`)[0].xp?.[0].amount).toBeGreaterThanOrEqual(1000);
		expect(s.data.trophies['campaign']).toBe(MON);
	});

	it('la revue hebdo verse son butin d’orbite et relance l’Inspiration', () => {
		const insp = gaugeValue(s.data, 'inspiration');
		s.addReview({ id: 'r1', type: 'weekly', periodStart: MON, createdAt: MON, worked: '', stuck: '', adjust: '', plan: 'Si…', priorities: [], snapshot: { xp: 0, discipline: 0, motivation: 0, inspiration: 0, successRate: 0 } });
		expect(sources('review:r1')[0].loot?.energy).toBeGreaterThanOrEqual(3);
		expect(gaugeValue(s.data, 'inspiration')).toBeGreaterThan(insp);
	});
});

describe('store : contenus', () => {
	it('une idée du catalogue devient une habitude bonus avec déclencheur, et crée sa catégorie', () => {
		s.data.domains = s.data.domains.filter((d) => d.id !== 'culture');
		const added = s.addHabitIdea(HABIT_IDEAS.find((i) => i.key === 'lecture')!);
		expect(added.kind).toBe('bonus');
		expect(added.cue).toBeTruthy();
		expect(s.data.domains.some((d) => d.id === 'culture')).toBe(true);
	});

	it('les contenus se versent une fois : une habitude supprimée ne revient pas', () => {
		const d = seed(MON);
		expect(d.habits.find((x) => x.id === 'lecture')?.cue).toBeTruthy();
		expect(d.campaigns.find((c) => c.id === 'camp-trading')!.chapters.every((ch) => ch.quests.length > 0)).toBe(true);
		d.habits = d.habits.filter((x) => x.id !== 'lecture');
		addContent(d, MON);
		expect(d.habits.some((x) => x.id === 'lecture')).toBe(false);
	});

	it('des données V2 reçoivent les déclencheurs sans perdre les quêtes déjà écrites', () => {
		const v2 = seed(MON);
		v2.contentVersion = 2;
		for (const x of v2.habits) delete x.cue;
		v2.campaigns[0].chapters[0].quests = [{ id: 'q', name: 'Ma quête', xp: 50 }];
		const up = withDefaults(JSON.parse(JSON.stringify(v2)));
		expect(up.habits.find((x) => x.id === 'reveil')?.cue).toBe('Au saut du lit');
		expect(up.campaigns[0].chapters[0].quests.map((q) => q.name)).toEqual(['Ma quête']);
		expect(up.contentVersion).toBe(3);
	});

	it('un conseil écarté ne revient pas de la journée', () => {
		s.dismissTip('overload', MON);
		expect(s.data.dismissedTips).toContain(`overload:${MON}`);
	});
});
