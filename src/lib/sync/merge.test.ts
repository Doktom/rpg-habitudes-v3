import { describe, expect, it } from 'vitest';
import { merge3 } from './merge';

const ev = (id: string, source: string, date = '2026-11-02') => ({ id, at: `${date}T10:00:00.000Z`, date, source, label: source });

describe('fusion entre appareils', () => {
	it('reprend ce qui n’a changé que d’un côté', () => {
		const base = { a: 1, list: [{ id: 'x', v: 1 }] };
		expect(merge3(base, base, { a: 2, list: base.list })).toEqual({ a: 2, list: base.list });
		expect(merge3(base, { a: 3, list: base.list }, base)).toEqual({ a: 3, list: base.list });
	});

	it('garde les ajouts faits des deux côtés (téléphone hors ligne + PC)', () => {
		const base = { habitLogs: [{ id: 'l1', date: '2026-11-01' }] };
		const phone = { habitLogs: [...base.habitLogs, { id: 'l2', date: '2026-11-02' }] };
		const pc = { habitLogs: [...base.habitLogs, { id: 'l3', date: '2026-11-02' }] };
		const out = merge3(base, phone, pc) as typeof base;
		expect(out.habitLogs.map((l) => l.id).sort()).toEqual(['l1', 'l2', 'l3']);
	});

	it('applique une suppression faite d’un seul côté', () => {
		const base = { tasks: [{ id: 't1' }, { id: 't2' }] };
		const local = { tasks: [{ id: 't1' }] };
		const remote = { tasks: [{ id: 't1' }, { id: 't2' }, { id: 't3' }] };
		expect((merge3(base, local, remote) as typeof base).tasks.map((t) => t.id)).toEqual(['t1', 't3']);
	});

	it('identifie les événements par leur source : une récompense recalculée n’est pas doublée', () => {
		const base = { events: [ev('e1', 'habit:a')] };
		const local = { events: [ev('e1', 'habit:a'), ev('r-local', 'reg:day:2026-11-02')] };
		const remote = { events: [ev('e1', 'habit:a'), ev('r-remote', 'reg:day:2026-11-02'), ev('e2', 'habit:b')] };
		const out = merge3(base, local, remote) as typeof base;
		expect(out.events.filter((e) => e.source === 'reg:day:2026-11-02')).toHaveLength(1);
		expect(out.events.map((e) => e.source).sort()).toEqual(['habit:a', 'habit:b', 'reg:day:2026-11-02']);
	});

	it('fusionne les listes de dates comme des ensembles et les objets clé par clé', () => {
		const base = { restDays: ['2026-11-01'], trophies: { a: '2026-10-01' } };
		const local = { restDays: ['2026-11-01', '2026-11-05'], trophies: { a: '2026-10-01', b: '2026-11-02' } };
		const remote = { restDays: [] as string[], trophies: { a: '2026-10-01', c: '2026-11-02' } };
		expect(merge3(base, local, remote)).toEqual({ restDays: ['2026-11-05'], trophies: { a: '2026-10-01', c: '2026-11-02', b: '2026-11-02' } });
	});

	it('fusionne à l’intérieur d’un même élément modifié des deux côtés', () => {
		const base = { campaigns: [{ id: 'c', name: 'Trading', chapters: [{ id: 'ch', quests: [{ id: 'q1' }, { id: 'q2' }] }] }] };
		const local = { campaigns: [{ id: 'c', name: 'Trading', chapters: [{ id: 'ch', quests: [{ id: 'q1', done: '2026-11-02' }, { id: 'q2' }] }] }] };
		const remote = { campaigns: [{ id: 'c', name: 'Trading pro', chapters: [{ id: 'ch', quests: [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }] }] }] };
		expect(merge3(base, local, remote)).toEqual({
			campaigns: [{ id: 'c', name: 'Trading pro', chapters: [{ id: 'ch', quests: [{ id: 'q1', done: '2026-11-02' }, { id: 'q2' }, { id: 'q3' }] }] }]
		});
	});
});
