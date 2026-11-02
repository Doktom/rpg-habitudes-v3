import { DANCE_XP_DIFFICULTY, GAUGES, LOOT_REWARDS, SHIELD, SKILL_MAX_LEVEL, XP_REWARDS } from './config';
import { addDays, range, setClock, today } from './dates';
import { inspirationBonus, moduleLevel, skillLevel, taskBonus, tierFactor, xpBonus } from './engine/effects';
import { actionXp, bonusXp, splitXp } from './engine/xp';
import { closeDay, daysToClose, discipline } from './engine/progress';
import { addLoot, canAfford, lootFor, materials, negate, orbit, orbitReward, scaleLoot, sectorsLit, skillPoints, upgradeCost } from './engine/ship';
import { regularityRewards } from './engine/regularity';
import { shieldState, streaksAtRisk } from './engine/shields';
import { newTrophies } from './engine/trophies';
import { uid } from './id';
import { seed, withDefaults } from './seed';
import { autoPlay, buildScenario, validateDay } from './testmode';
import { toasts } from './toasts.svelte';
import { campaignFromTemplate, habitFromIdea, type CampaignTemplate, type HabitIdea } from './templates';
import { SHIP_MODULES, SKILLS } from './universe';
import type {
	AppData,
	Campaign,
	DanceClass,
	DanceParty,
	DanceStyle,
	Difficulty,
	Domain,
	Exercise,
	Habit,
	HabitKind,
	ISODate,
	Loot,
	ModuleId,
	ProgressEvent,
	Review,
	SkillId,
	Task,
	Tier,
	Vacation
} from './types';

// V0 : tout est stocké dans le navigateur (localStorage). La couche Supabase remplacera load/persist.
// Le mode test a son propre stockage : les vraies données ne sont jamais touchées.
// La V3 partage le domaine (et donc le stockage) des V0 et V2 : clés à elle, et import en lecture seule
// des données V2 au premier lancement (ou V0 à défaut). Ne jamais écrire dans les clés des autres versions.
const KEY = 'rpg-habitudes-v3:data';
const TEST_KEY = 'rpg-habitudes-v3:test';
const MODE_KEY = 'rpg-habitudes-v3:mode';
const V2_KEY = 'rpg-habitudes-v2:data';
const V0_KEY = 'rpg-habitudes:v1';

export { uid };

const storageKey = (test: boolean) => (test ? TEST_KEY : KEY);
const reload = () => {
	if (typeof location !== 'undefined') location.reload();
};

function readTestMode(): boolean {
	try {
		return localStorage.getItem(MODE_KEY) === 'test';
	} catch {
		return false;
	}
}

function load(test: boolean): AppData {
	try {
		const raw = localStorage.getItem(storageKey(test)) ?? (test ? null : (localStorage.getItem(V2_KEY) ?? localStorage.getItem(V0_KEY)));
		if (raw) {
			const data = withDefaults(JSON.parse(raw) as AppData);
			if (test) setClock(data.testClock ?? null);
			return data;
		}
	} catch {
		// stockage indisponible ou corrompu : on repart du seed
	}
	const t = today();
	return { ...seed(t), lastProcessedDay: addDays(t, -1) };
}

export class Store {
	testMode = readTestMode();
	data = $state<AppData>(load(this.testMode));
	private suspended = 0;

	persist() {
		if (this.suspended) return;
		this.evaluateTrophies();
		this.save();
	}

	private save() {
		try {
			localStorage.setItem(storageKey(this.testMode), JSON.stringify(this.data));
		} catch {
			// navigation privée : les données restent en mémoire pour la session
		}
	}

	// Regroupe plusieurs actions : une seule sauvegarde à la fin.
	batch(fn: () => void) {
		this.suspended++;
		try {
			fn();
		} finally {
			this.suspended--;
		}
		this.persist();
	}

	// Ajoute un événement au journal. Les bonus du vaisseau (XP, Inspiration) s'appliquent ici.
	private event(e: Omit<ProgressEvent, 'id' | 'at'>) {
		const mult = e.source.startsWith('trophy:') ? 1 : xpBonus(this.data);
		const xp = e.xp?.map((x) => ({ ...x, amount: Math.round(x.amount * mult) }));
		let gauge = e.gauge;
		if (gauge?.inspiration && gauge.inspiration > 0)
			gauge = { ...gauge, inspiration: Math.round(gauge.inspiration * inspirationBonus(this.data)) };
		// L'heure sert seulement à ordonner les événements d'une même journée.
		this.data.events.push({ id: uid(), at: `${e.date}T${new Date().toISOString().slice(11)}`, ...e, xp, gauge });
	}

	private dropEvents(source: string) {
		this.data.events = this.data.events.filter((e) => e.source !== source);
	}

	// Recalcule les récompenses de régularité du jour donné jusqu'à aujourd'hui (une coche peut boucler
	// une série ou une semaine, une décoche peut la défaire). Les nouveaux gains s'annoncent par une notification.
	private syncRegularity(from: ISODate) {
		const end = today();
		if (from > end) return;
		const start = from < addDays(end, -400) ? addDays(end, -400) : from;
		const before = new Set(this.data.events.filter((e) => e.source.startsWith('reg:')).map((e) => e.source));
		this.data.events = this.data.events.filter((e) => !(e.source.startsWith('reg:') && e.date >= start));
		const gained: ProgressEvent[] = [];
		for (const d of range(start, end)) {
			const disc = discipline(this.data, d);
			for (const r of regularityRewards(this.data, d)) {
				this.event({ date: d, source: r.source, label: r.label, xp: splitXp(bonusXp(r.xp, disc), r.shares), loot: r.loot });
				if (!before.has(r.source)) gained.push(this.data.events[this.data.events.length - 1]);
			}
		}
		if (this.suspended) return;
		for (const e of gained) toasts.push({ title: e.label, xp: e.xp?.reduce((s, x) => s + x.amount, 0), loot: e.loot });
	}

	disciplineNow() {
		return discipline(this.data, today());
	}

	// --- Journée ---

	rollover() {
		const days = daysToClose(this.data, today());
		for (const d of days) {
			this.dropEvents(`day:${d}`);
			const e = closeDay(this.data, d);
			if (e) this.data.events.push(e);
			this.data.lastProcessedDay = d;
		}
		if (days.length) {
			this.syncRegularity(days[0]);
			this.persist();
		}
	}

	// Le joueur choisit d'utiliser un bouclier sur un jour raté : les séries de ce jour sont sauves.
	useShield(date: ISODate): boolean {
		const risk = streaksAtRisk(this.data, date);
		if (!risk.length || shieldState(this.data).stock < 1) return false;
		this.data.shieldedDays.push(date);
		const names = risk.map((r) => `${r.habit.name} (${r.streak} j)`).join(', ');
		this.event({ date: today(), source: `shield:use:${date}`, label: `Bouclier de série : ${names} sauvée${risk.length > 1 ? 's' : ''}` });
		this.syncRegularity(date);
		this.persist();
		toasts.push({ title: `Bouclier utilisé : ${risk.map((r) => r.habit.name).join(', ')} sauvée${risk.length > 1 ? 's' : ''}` });
		return true;
	}

	// … ou laisse filer : la proposition ne revient pas pour ce jour.
	declineShield(date: ISODate) {
		if (!this.data.shieldDeclined.includes(date)) this.data.shieldDeclined.push(date);
		this.persist();
	}

	// Achat d'un bouclier au chantier, dans la limite de la réserve.
	buyShield(): boolean {
		const s = shieldState(this.data);
		if (s.stock >= s.max || !canAfford(materials(this.data), SHIELD.cost)) return false;
		this.event({ date: today(), source: `shield:buy:${uid()}`, label: 'Bouclier de série acheté', loot: negate(SHIELD.cost) });
		this.persist();
		return true;
	}

	toggleRestDay(date: ISODate) {
		const i = this.data.restDays.indexOf(date);
		if (i >= 0) this.data.restDays.splice(i, 1);
		else this.data.restDays.push(date);
		this.syncRegularity(date);
		this.persist();
	}

	toggleMinimumMode(date: ISODate) {
		const i = this.data.minimumModeDays.indexOf(date);
		if (i >= 0) this.data.minimumModeDays.splice(i, 1);
		else this.data.minimumModeDays.push(date);
		this.persist();
	}

	// --- Habitudes ---

	logHabit(habit: Habit, date: ISODate, tier: Tier, extra: { session?: string; doneExercises?: string[] } = {}) {
		const existing = this.data.habitLogs.find((l) => l.habitId === habit.id && l.date === date);
		if (existing) this.unlog(existing.id);
		const id = uid();
		this.data.habitLogs.push({ id, habitId: habit.id, date, tier, ...extra });
		const factor = tierFactor(this.data, tier);
		const xp = actionXp(habit.difficulty, tier, discipline(this.data, date), factor);
		const m = GAUGES.motivation;
		this.event({
			date,
			source: `habit:${id}`,
			label: `${habit.name}${extra.session ? ' — ' + extra.session : ''}`,
			xp: splitXp(xp, habit.domains),
			loot: lootFor(habit.difficulty, factor),
			gauge: { motivation: habit.kind === 'obligatory' ? m.obligatoryDone : m.bonusDone },
			campaignId: habit.campaignId
		});
		this.syncRegularity(date);
		this.persist();
	}

	unlog(logId: string) {
		const log = this.data.habitLogs.find((l) => l.id === logId);
		this.data.habitLogs = this.data.habitLogs.filter((l) => l.id !== logId);
		this.dropEvents(`habit:${logId}`);
		if (log) this.syncRegularity(log.date);
		this.persist();
	}

	saveHabit(habit: Habit) {
		const i = this.data.habits.findIndex((h) => h.id === habit.id);
		if (i >= 0) this.data.habits[i] = habit;
		else this.data.habits.push(habit);
		this.persist();
	}

	// Nouvelle version datée si la liste change un autre jour que celui de la dernière version.
	saveRoutine(habit: Habit, exercises: Exercise[]) {
		const t = today();
		const versions = habit.routine ?? [];
		const last = versions.at(-1);
		if (last && last.from === t) last.exercises = exercises;
		else versions.push({ from: t, exercises });
		habit.routine = versions;
		this.saveHabit(habit);
	}

	archiveHabit(id: string, archived = true) {
		const h = this.data.habits.find((x) => x.id === id);
		if (h) h.archived = archived;
		this.persist();
	}

	// Ajoute une habitude du catalogue (en bonus, avec son déclencheur) et sa catégorie si besoin.
	addHabitIdea(idea: HabitIdea): Habit {
		const { habit, domain } = habitFromIdea(idea, this.data.domains, today());
		if (domain) this.data.domains.push(domain);
		this.data.habits.push(habit);
		this.persist();
		return habit;
	}

	// --- Copilote ---

	dismissTip(id: string, date: ISODate = today()) {
		const key = `${id}:${date}`;
		// On ne garde que les conseils écartés de la semaine écoulée.
		const since = addDays(date, -7);
		this.data.dismissedTips = this.data.dismissedTips.filter((k) => k.slice(-10) >= since);
		if (!this.data.dismissedTips.includes(key)) this.data.dismissedTips.push(key);
		this.persist();
	}

	// --- Catégories (stats) ---

	saveDomain(d: Domain) {
		const i = this.data.domains.findIndex((x) => x.id === d.id);
		if (i >= 0) this.data.domains[i] = d;
		else this.data.domains.push(d);
		this.persist();
	}

	// --- Danse ---

	saveDanceClass(c: DanceClass) {
		const i = this.data.danceClasses.findIndex((x) => x.id === c.id);
		if (i >= 0) this.data.danceClasses[i] = c;
		else this.data.danceClasses.push(c);
		this.persist();
	}

	removeDanceClass(id: string) {
		this.data.danceClasses = this.data.danceClasses.filter((c) => c.id !== id);
		this.persist();
	}

	toggleCancelled(classId: string, date: ISODate) {
		const c = this.data.danceClasses.find((x) => x.id === classId);
		if (!c) return;
		const i = c.cancelled.indexOf(date);
		if (i >= 0) c.cancelled.splice(i, 1);
		else c.cancelled.push(date);
		this.persist();
	}

	saveParty(p: DanceParty) {
		const i = this.data.danceParties.findIndex((x) => x.id === p.id);
		if (i >= 0) this.data.danceParties[i] = p;
		else this.data.danceParties.push(p);
		this.persist();
	}

	removeParty(id: string) {
		this.data.danceParties = this.data.danceParties.filter((p) => p.id !== id);
		this.persist();
	}

	saveVacation(v: Vacation) {
		const i = this.data.vacations.findIndex((x) => x.id === v.id);
		if (i >= 0) this.data.vacations[i] = v;
		else this.data.vacations.push(v);
		this.persist();
	}

	removeVacation(id: string) {
		this.data.vacations = this.data.vacations.filter((v) => v.id !== id);
		this.persist();
	}

	logDance(refId: string, label: string, styles: DanceStyle[], kind: HabitKind, date: ISODate, tier: Tier) {
		const existing = this.data.danceLogs.find((l) => l.refId === refId && l.date === date);
		if (existing) this.unlogDance(existing.id);
		const id = uid();
		this.data.danceLogs.push({ id, refId, date, tier });
		const factor = tierFactor(this.data, tier);
		const xp = actionXp(DANCE_XP_DIFFICULTY, tier, discipline(this.data, date), factor);
		const m = GAUGES.motivation;
		this.event({
			date,
			source: `dance:${id}`,
			label,
			xp: splitXp(xp, styles.map((s) => ({ domainId: s, weight: 1 }))),
			loot: lootFor(DANCE_XP_DIFFICULTY, factor),
			gauge: { motivation: kind === 'obligatory' ? m.obligatoryDone : m.bonusDone }
		});
		this.syncRegularity(date);
		this.persist();
	}

	unlogDance(logId: string) {
		const log = this.data.danceLogs.find((l) => l.id === logId);
		this.data.danceLogs = this.data.danceLogs.filter((l) => l.id !== logId);
		this.dropEvents(`dance:${logId}`);
		if (log) this.syncRegularity(log.date);
		this.persist();
	}

	// --- Campagnes ---

	saveCampaign(c: Campaign) {
		const i = this.data.campaigns.findIndex((x) => x.id === c.id);
		if (i >= 0) this.data.campaigns[i] = c;
		else this.data.campaigns.push(c);
		this.persist();
	}

	// Nouvelle campagne à partir d'un modèle (étapes et quêtes prêtes), avec sa catégorie si besoin.
	addCampaignFromTemplate(t: CampaignTemplate): Campaign {
		const c = campaignFromTemplate(t, today(), addDays);
		if (!this.data.domains.some((d) => d.id === t.domain.id)) this.data.domains.push(t.domain);
		this.data.campaigns.push(c);
		this.persist();
		return c;
	}

	removeCampaign(id: string) {
		this.data.campaigns = this.data.campaigns.filter((c) => c.id !== id);
		this.persist();
	}

	toggleQuest(campaign: Campaign, chapterId: string, questId: string) {
		const chapter = campaign.chapters.find((c) => c.id === chapterId);
		const quest = chapter?.quests.find((q) => q.id === questId);
		if (!chapter || !quest) return;
		const date = today();
		const d = discipline(this.data, date);
		if (quest.done) {
			quest.done = undefined;
			this.dropEvents(`quest:${quest.id}`);
			if (chapter.done) {
				chapter.done = undefined;
				this.dropEvents(`chapter:${chapter.id}`);
			}
		} else {
			quest.done = date;
			this.event({
				date,
				source: `quest:${quest.id}`,
				label: `${quest.boss ? 'Boss vaincu' : 'Quête'} : ${quest.name}`,
				xp: [{ domainId: campaign.domainId, amount: bonusXp(quest.xp, d) }],
				loot: quest.boss ? LOOT_REWARDS.boss : LOOT_REWARDS.quest,
				gauge: { motivation: GAUGES.motivation.questDone },
				campaignId: campaign.id
			});
			if (chapter.quests.every((q) => q.done)) {
				chapter.done = date;
				this.event({
					date,
					source: `chapter:${chapter.id}`,
					label: `Chapitre terminé : ${chapter.name}`,
					xp: [{ domainId: campaign.domainId, amount: bonusXp(XP_REWARDS.chapter, d) }],
					loot: LOOT_REWARDS.chapter,
					gauge: { inspiration: GAUGES.inspiration.chapterDone },
					campaignId: campaign.id
				});
			}
		}
		this.persist();
	}

	toggleCampaignDone(campaign: Campaign) {
		if (campaign.done) {
			campaign.done = undefined;
			campaign.status = 'active';
			this.dropEvents(`campaign:${campaign.id}`);
		} else {
			const date = today();
			campaign.done = date;
			campaign.status = 'done';
			this.event({
				date,
				source: `campaign:${campaign.id}`,
				label: `Campagne terminée : ${campaign.name}`,
				xp: [{ domainId: campaign.domainId, amount: bonusXp(XP_REWARDS.campaign, discipline(this.data, date)) }],
				loot: LOOT_REWARDS.campaign,
				gauge: { inspiration: GAUGES.inspiration.campaignDone },
				campaignId: campaign.id
			});
		}
		this.persist();
	}

	// --- Tâches ---

	saveTask(t: Task) {
		const i = this.data.tasks.findIndex((x) => x.id === t.id);
		if (i >= 0) this.data.tasks[i] = t;
		else this.data.tasks.push(t);
		this.persist();
	}

	removeTask(id: string) {
		this.data.tasks = this.data.tasks.filter((t) => t.id !== id);
		this.dropEvents(`task:${id}`);
		this.persist();
	}

	// XP de base d'une tâche (avant le bonus du Réacteur, appliqué à l'ajout au journal).
	private taskXp(effort: Difficulty, date: ISODate) {
		const base = actionXp(effort, 'normal', discipline(this.data, date), tierFactor(this.data, 'normal'));
		return Math.round(base * taskBonus(this.data));
	}

	// Ce que rapporte une tâche selon son effort : sert à l'aperçu comme au calcul réel.
	taskReward(effort: Difficulty = 'easy', date = today()): { xp: number; loot: Loot } {
		return {
			xp: Math.round(this.taskXp(effort, date) * xpBonus(this.data)),
			loot: scaleLoot(lootFor(effort), taskBonus(this.data))
		};
	}

	toggleTask(task: Task) {
		if (task.done) {
			task.done = undefined;
			this.dropEvents(`task:${task.id}`);
		} else {
			const date = today();
			task.done = date;
			const effort = task.effort ?? 'easy';
			const campaign = this.data.campaigns.find((c) =>
				c.chapters.some((ch) => ch.quests.some((q) => q.id === task.questId))
			);
			this.event({
				date,
				source: `task:${task.id}`,
				label: `Tâche : ${task.title}`,
				xp: [{ domainId: campaign?.domainId ?? task.domainId ?? '', amount: this.taskXp(effort, date) }],
				loot: scaleLoot(lootFor(effort), taskBonus(this.data)),
				campaignId: campaign?.id
			});
		}
		this.persist();
	}

	// --- Revue ---

	addReview(r: Review) {
		this.data.reviews.push(r);
		let loot = r.type === 'weekly' ? LOOT_REWARDS.weeklyReview : LOOT_REWARDS.monthlyReview;
		let label = r.type === 'weekly' ? 'Revue hebdo' : 'Revue mensuelle';
		if (r.type === 'weekly') {
			// Amarrage au Havre : l'orbite de la semaine est bouclée et rapporte du butin.
			const sectors = orbit(this.data, r.periodStart, today());
			loot = addLoot(loot, orbitReward(this.data, sectors));
			label = `Revue hebdo — orbite bouclée (${sectorsLit(sectors)}/7)`;
		}
		this.event({
			date: r.createdAt,
			source: `review:${r.id}`,
			label,
			xp: [{ domainId: '', amount: r.type === 'weekly' ? XP_REWARDS.weeklyReview : XP_REWARDS.monthlyReview }],
			loot,
			gauge: { inspiration: GAUGES.inspiration.weeklyReview }
		});
		this.persist();
	}

	// --- Vaisseau, compétences, trophées ---

	upgradeModule(id: ModuleId): boolean {
		const cost = upgradeCost(this.data, id);
		if (!cost || !canAfford(materials(this.data), cost)) return false;
		const level = moduleLevel(this.data, id) + 1;
		this.data.ship.modules[id] = level;
		const def = SHIP_MODULES.find((m) => m.id === id)!;
		this.event({ date: today(), source: `ship:${id}:${level}`, label: `Amélioration : ${def.name}, niveau ${level}`, loot: negate(cost) });
		this.persist();
		return true;
	}

	buySkill(id: SkillId): boolean {
		const level = skillLevel(this.data, id);
		if (skillPoints(this.data) < 1 || level >= SKILL_MAX_LEVEL) return false;
		this.data.skills[id] = level + 1;
		this.persist();
		return true;
	}

	skillName(id: SkillId) {
		return SKILLS.find((s) => s.id === id)?.name ?? id;
	}

	// Débloque les trophées dont la condition est remplie et verse leur récompense.
	evaluateTrophies() {
		const date = today();
		for (const t of newTrophies(this.data, date)) {
			this.data.trophies[t.id] = date;
			this.event({
				date,
				source: `trophy:${t.id}`,
				label: `Trophée : ${t.name}`,
				xp: t.reward.xp ? [{ domainId: '', amount: t.reward.xp }] : undefined,
				loot: t.reward.loot
			});
		}
	}

	// --- Mode test ---

	hasTestData(): boolean {
		try {
			return !!localStorage.getItem(TEST_KEY);
		} catch {
			return false;
		}
	}

	// Génère un scénario sur plusieurs semaines puis bascule l'app dessus.
	startTestMode(weeks = 4) {
		try {
			localStorage.setItem(MODE_KEY, 'test');
		} catch {
			return;
		}
		this.testMode = true;
		buildScenario(this, weeks);
		reload();
	}

	resumeTestMode() {
		try {
			localStorage.setItem(MODE_KEY, 'test');
		} catch {
			return;
		}
		reload();
	}

	exitTestMode() {
		try {
			localStorage.removeItem(MODE_KEY);
		} catch {
			// rien à faire
		}
		setClock(null);
		reload();
	}

	// Avance la date simulée ; les jours passés sont clôturés comme en vrai (obligations non faites = ratées).
	advanceDays(n: number) {
		const next = addDays(today(), n);
		this.batch(() => {
			setClock(next);
			this.data.testClock = next;
			this.rollover();
		});
		reload();
	}

	autoPlayDays(n: number) {
		autoPlay(this, n);
		reload();
	}

	validateToday() {
		this.batch(() => validateDay(this));
	}

	// --- Données ---

	exportJson(): string {
		return JSON.stringify(this.data, null, 2);
	}

	importJson(json: string) {
		const parsed = JSON.parse(json) as AppData;
		if (parsed.version !== 1 || !Array.isArray(parsed.habits)) throw new Error('Fichier non reconnu');
		this.data = withDefaults(parsed);
		this.persist();
	}

	reset() {
		const t = today();
		this.data = { ...seed(t), lastProcessedDay: addDays(t, -1) };
		this.persist();
	}
}

export const store = new Store();
