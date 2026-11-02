<script lang="ts">
	import {
		Anchor,
		ArrowLeft,
		ArrowRight,
		BedDouble,
		Check,
		ChevronDown,
		Feather,
		Flame,
		MessageCircleHeart,
		NotebookPen,
		Shield,
		Skull,
		Sparkles,
		Swords,
		Target,
		Trash,
		Trophy,
		Wrench
	} from '@lucide/svelte';
	import { onMount } from 'svelte';
	import Gauges from '#lib/components/Gauges.svelte';
	import LootLine from '#lib/components/LootLine.svelte';
	import OrbitRing from '#lib/components/OrbitRing.svelte';
	import { GAUGES, LOOT_REWARDS, XP_REWARDS } from '#lib/config.ts';
	import { addDays, formatLong, formatShort, range, startOfWeek, today, WEEKDAYS_SHORT, weekday } from '#lib/dates.ts';
	import { discipline, gaugeValue, successRate, totalXp } from '#lib/engine/progress.ts';
	import { habitStreak, habitWeekProgress, habitWeekStreak } from '#lib/engine/regularity.ts';
	import { addLoot, orbit, orbitReward, sectorsLit } from '#lib/engine/ship.ts';
	import { TROPHIES } from '#lib/engine/trophies.ts';
	import { store, uid } from '#lib/store.svelte.ts';
	import { toasts } from '#lib/toasts.svelte.ts';
	import type { Habit, Task } from '#lib/types.ts';

	const data = $derived(store.data);
	const reviewed = (monday: string) => data.reviews.some((r) => r.type === 'weekly' && r.periodStart === monday);

	// En début de semaine (lundi, mardi), on boucle d'abord la semaine passée si elle n'a pas eu sa revue.
	const thisWeek = startOfWeek(today());
	const lastWeek = addDays(thisWeek, -7);
	const weekStart = $derived(weekday(today()) >= 1 && weekday(today()) <= 2 && !reviewed(lastWeek) ? lastWeek : thisWeek);
	const weekEnd = $derived(addDays(weekStart, 6));
	const asOf = $derived(weekEnd < today() ? weekEnd : today());
	const done = $derived(reviewed(weekStart));

	// --- Bilan ---
	const sectors = $derived(orbit(data, weekStart, today()));
	const xp = $derived(totalXp(data, weekStart, weekEnd));
	const rate = $derived(successRate(data, weekStart, asOf));
	const inWeek = (d: string) => d >= weekStart && d <= weekEnd;
	const weekEvents = $derived(data.events.filter((e) => inWeek(e.date)));
	const regEvents = $derived(weekEvents.filter((e) => e.source.startsWith('reg:') && !e.source.startsWith('reg:day:')));
	const completeDays = $derived(weekEvents.filter((e) => e.source.startsWith('reg:day:')).length);
	const shieldsUsed = $derived(weekEvents.filter((e) => e.source.startsWith('shield:use:')).length);
	const trophiesWon = $derived(TROPHIES.filter((t) => data.trophies[t.id] && inWeek(data.trophies[t.id])));
	const habits = $derived(
		data.habits
			.filter((h) => !h.archived && h.createdAt <= weekEnd)
			.map((h) => {
				const p = habitWeekProgress(data, h, weekStart, asOf);
				const streak = h.frequency.type === 'weekly' ? habitWeekStreak(data, h, asOf) : habitStreak(data, h, asOf);
				return { h, ...p, streak, pct: p.expected ? Math.min(100, Math.round((100 * p.done) / p.expected)) : 0 };
			})
			.filter((x) => x.expected > 0 || x.done > 0)
			.sort((a, b) => b.pct - a.pct)
	);
	const best = $derived(habits.find((x) => x.expected > 0 && x.done >= x.expected));

	// --- Ajustements ---
	// Habitudes obligatoires ratées 3 fois ou plus : on propose de les alléger (passer en bonus).
	const struggling = $derived(habits.filter((x) => x.h.kind === 'obligatory' && x.expected - x.done >= 3));
	const postponed = $derived(data.tasks.filter((t) => !t.done && t.date && t.date < today()));
	let lightened = $state<string[]>([]);

	function lighten(h: Habit) {
		h.kind = 'bonus';
		store.saveHabit(h);
		lightened = [...lightened, h.id];
	}

	function replan(t: Task, list: 'week' | 'someday') {
		t.list = list;
		t.date = undefined;
		t.start = undefined;
		t.end = undefined;
		store.saveTask(t);
	}

	// --- Plan de la semaine suivante ---
	const nextWeek = $derived(range(addDays(weekStart, 7), addDays(weekStart, 13)));
	const openQuests = $derived(
		data.campaigns
			.filter((c) => c.status === 'active')
			.flatMap((c) => {
				const ch = c.chapters.find((x) => !x.done);
				return ch ? ch.quests.filter((q) => !q.done).map((q) => ({ id: q.id, name: q.name, boss: q.boss, campaign: c.name })) : [];
			})
	);

	// --- Brouillon : les réponses survivent si on quitte l'écran en route ---
	const STEPS = [
		{ label: 'Bilan', icon: Sparkles },
		{ label: 'Questions', icon: MessageCircleHeart },
		{ label: 'Ajuster', icon: Wrench },
		{ label: 'Cap', icon: Target },
		{ label: 'Amarrage', icon: Anchor }
	];
	let step = $state(0);
	let worked = $state('');
	let stuck = $state('');
	let adjust = $state('');
	let priorities = $state(['', '', '']);
	let focusQuest = $state('');
	const draftKey = $derived(`rpg-habitudes-v3:revue:${weekStart}`);

	onMount(() => {
		try {
			const d = JSON.parse(localStorage.getItem(draftKey) ?? 'null');
			if (d) ({ step, worked, stuck, adjust, priorities, focusQuest } = { ...{ step, worked, stuck, adjust, priorities, focusQuest }, ...d });
		} catch {
			// pas de brouillon lisible
		}
	});

	$effect(() => {
		const draft = { step, worked, stuck, adjust, priorities, focusQuest };
		try {
			localStorage.setItem(draftKey, JSON.stringify(draft));
		} catch {
			// stockage indisponible : le brouillon vit le temps de la page
		}
	});

	const reward = $derived(addLoot(LOOT_REWARDS.weeklyReview, orbitReward(data, sectors)));

	function go(i: number) {
		step = Math.max(0, Math.min(STEPS.length - 1, i));
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	function dock() {
		const id = uid();
		const kept = priorities.map((p) => p.trim()).filter(Boolean);
		store.batch(() => {
			store.addReview({
				id,
				type: 'weekly',
				periodStart: weekStart,
				createdAt: today(),
				worked,
				stuck,
				adjust,
				priorities: kept,
				snapshot: { xp, discipline: discipline(data, today()), motivation: gaugeValue(data, 'motivation'), inspiration: gaugeValue(data, 'inspiration'), successRate: rate }
			});
			for (const p of kept) store.saveTask({ id: uid(), title: p, list: 'week' });
			const q = openQuests.find((x) => x.id === focusQuest);
			if (q) store.saveTask({ id: uid(), title: `Avancer : ${q.name}`, list: 'week', questId: q.id, effort: q.boss ? 'hard' : 'medium' });
		});
		const e = data.events.find((x) => x.source === `review:${id}`);
		toasts.push({ title: 'Amarrage au Havre réussi', xp: e?.xp?.reduce((s, x) => s + x.amount, 0), loot: e?.loot });
		try {
			localStorage.removeItem(draftKey);
		} catch {
			// rien à nettoyer
		}
		step = 0;
		worked = stuck = adjust = focusQuest = '';
		priorities = ['', '', ''];
	}

	const QUESTIONS = [
		{ id: 'worked', label: 'Ce qui a marché', hint: 'Une victoire, même petite. Qu’est-ce qui t’a aidé ?', icon: Sparkles },
		{ id: 'stuck', label: 'Ce qui a coincé', hint: 'Sans te juger : où ça a frotté, et pourquoi ?', icon: Swords },
		{ id: 'adjust', label: 'Ce que j’ajuste', hint: 'Un seul petit changement pour la semaine qui vient.', icon: Feather }
	] as const;
	let showArchive = $state(false);
</script>

<!-- En-tête -->
<header class="mb-5 flex flex-wrap items-end justify-between gap-4">
	<div>
		<div class="eyebrow mb-1 flex items-center gap-1.5 text-accent"><Anchor size={13} strokeWidth={2.4} /> Station du Havre</div>
		<h1 class="text-3xl font-black tracking-tight">Revue de la semaine</h1>
		<p class="text-sm text-muted">Orbite du {formatShort(weekStart)} au {formatShort(weekEnd)} · une dizaine de minutes pour boucler la semaine et fixer le cap.</p>
	</div>
	{#if !done}
		<div class="card flex items-center gap-2 px-3 py-2 text-xs font-bold">
			<Anchor size={15} class="text-reward" /> À l'amarrage :
			<span class="text-accent">+{XP_REWARDS.weeklyReview} XP</span>
			<LootLine loot={reward} signed size={11} />
		</div>
	{/if}
</header>

{#if done}
	<section class="card mb-6 flex flex-col items-center gap-2 py-8 text-center">
		<span class="flex h-14 w-14 items-center justify-center rounded-full bg-reward text-on-accent"><Anchor size={26} /></span>
		<h2 class="text-xl font-black">Orbite bouclée</h2>
		<p class="max-w-md text-sm text-muted">
			La revue de cette semaine est faite. Le Sillage repart du Havre avec ton cap ; prochaine escale
			{formatLong(addDays(weekStart, 13))}.
		</p>
		<a href="#/taches" class="btn mt-2 text-xs">Voir mes priorités dans À faire</a>
	</section>
{:else}
	<!-- Étapes -->
	<nav class="mb-4 grid grid-cols-5 gap-1.5" aria-label="Étapes de la revue">
		{#each STEPS as s, i (s.label)}
			<button
				class="flex flex-col items-center gap-1 rounded-2xl border px-1 py-2 text-[11px] font-bold transition-colors {i === step
					? 'border-accent bg-accent text-on-accent'
					: i < step
						? 'border-accent bg-accent-soft text-accent'
						: 'border-line bg-surface text-muted hover:bg-raised'}"
				aria-current={i === step ? 'step' : undefined}
				onclick={() => go(i)}
			>
				{#if i < step}<Check size={16} strokeWidth={3} />{:else}<s.icon size={16} strokeWidth={2.3} />{/if}
				<span class="hidden sm:inline">{s.label}</span>
			</button>
		{/each}
	</nav>

	<!-- 1. Bilan -->
	{#if step === 0}
		<div class="flex flex-col gap-4">
			<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
				{#each [{ n: `+${xp}`, l: 'XP gagnée' }, { n: `${rate} %`, l: 'obligations tenues' }, { n: `${sectorsLit(sectors)}/7`, l: 'secteurs allumés' }, { n: completeDays, l: 'journées complètes' }] as s (s.l)}
					<div class="card px-3 py-3 text-center">
						<div class="text-2xl font-black tabular-nums">{s.n}</div>
						<div class="text-[11px] font-semibold text-muted">{s.l}</div>
					</div>
				{/each}
			</div>

			<div class="grid gap-4 lg:grid-cols-5">
				<section class="card lg:col-span-3">
					<h2 class="mb-1 font-extrabold">L'orbite de la semaine</h2>
					<OrbitRing {sectors} current={asOf} />
					<div class="mt-2 grid grid-cols-7 gap-1 text-center">
						{#each sectors as s (s.date)}
							<div class="rounded-xl px-0.5 py-1.5 {s.expected && s.done >= s.expected ? 'bg-done-soft' : s.date > today() ? 'bg-raised opacity-60' : 'bg-raised'}">
								<div class="text-[10px] font-bold text-muted uppercase">{WEEKDAYS_SHORT[weekday(s.date)]}</div>
								<div class="text-xs font-black tabular-nums">
									{#if data.restDays.includes(s.date)}<BedDouble size={12} class="mx-auto text-muted" />{:else if s.expected}{s.done}/{s.expected}{:else}—{/if}
								</div>
							</div>
						{/each}
					</div>
				</section>
				<section class="card lg:col-span-2">
					<h2 class="mb-2 font-extrabold">Les jauges</h2>
					<Gauges discipline={discipline(data, today())} motivation={gaugeValue(data, 'motivation')} inspiration={gaugeValue(data, 'inspiration')} stacked />
				</section>
			</div>

			<section class="card">
				<h2 class="mb-3 flex items-center gap-2 font-extrabold">
					Habitude par habitude
					{#if best}<span class="chip bg-done-soft text-done"><Trophy size={11} /> {best.h.name} tenue à 100 %</span>{/if}
				</h2>
				<ul class="flex flex-col gap-2.5">
					{#each habits as x (x.h.id)}
						<li class="flex items-center gap-3">
							<span class="w-36 shrink-0 truncate text-sm font-semibold sm:w-48">{x.h.name}</span>
							<span class="h-2 flex-1 overflow-hidden rounded-full bg-zinc-200">
								<span class="block h-full rounded-full {x.pct >= 100 ? 'bg-done' : x.pct >= 50 ? 'bg-accent' : 'bg-orange-400'}" style="width: {x.pct}%"></span>
							</span>
							<span class="w-10 text-right text-xs font-bold text-muted tabular-nums">{x.done}/{x.expected}</span>
							<span class="w-14 text-right">
								{#if x.streak >= 2}<span class="chip bg-orange-100 text-orange-800"><Flame size={10} />{x.streak}</span>{/if}
							</span>
						</li>
					{:else}
						<p class="text-sm text-muted">Aucune habitude suivie cette semaine.</p>
					{/each}
				</ul>
			</section>

			{#if regEvents.length || trophiesWon.length || shieldsUsed}
				<section class="card">
					<h2 class="mb-2 font-extrabold">Les exploits de la semaine</h2>
					<ul class="flex flex-col gap-1.5 text-sm">
						{#each trophiesWon as t (t.id)}
							<li class="flex items-center gap-2"><Trophy size={14} class="shrink-0 text-reward" /><span class="font-semibold">Trophée : {t.name}</span></li>
						{/each}
						{#each regEvents as e (e.id)}
							<li class="flex items-center justify-between gap-2">
								<span class="flex min-w-0 items-center gap-2"><Flame size={14} class="shrink-0 text-orange-500" /><span class="truncate">{e.label}</span></span>
								<span class="shrink-0 text-xs font-bold text-accent">+{e.xp?.reduce((s, x) => s + x.amount, 0) ?? 0} XP</span>
							</li>
						{/each}
						{#if shieldsUsed}
							<li class="flex items-center gap-2 text-muted"><Shield size={14} class="shrink-0 text-sky-700" />{shieldsUsed} bouclier{shieldsUsed > 1 ? 's' : ''} utilisé{shieldsUsed > 1 ? 's' : ''} pour sauver des séries</li>
						{/if}
					</ul>
				</section>
			{/if}
		</div>

		<!-- 2. Questions -->
	{:else if step === 1}
		<div class="flex flex-col gap-3">
			{#each QUESTIONS as q (q.id)}
				<section class="card flex flex-col gap-2">
					<label class="flex items-center gap-2 font-extrabold" for="q-{q.id}"><q.icon size={16} class="text-accent" />{q.label}</label>
					{#if q.id === 'worked'}
						<textarea id="q-{q.id}" class="input min-h-20" placeholder={q.hint} bind:value={worked}></textarea>
					{:else if q.id === 'stuck'}
						<textarea id="q-{q.id}" class="input min-h-20" placeholder={q.hint} bind:value={stuck}></textarea>
					{:else}
						<textarea id="q-{q.id}" class="input min-h-20" placeholder={q.hint} bind:value={adjust}></textarea>
					{/if}
				</section>
			{/each}
		</div>

		<!-- 3. Ajuster -->
	{:else if step === 2}
		<div class="flex flex-col gap-4">
			<section class="card">
				<h2 class="mb-1 font-extrabold">Habitudes qui frottent</h2>
				<p class="mb-3 text-xs text-muted">Ratées 3 fois ou plus cette semaine. Passer en bonus garde l'habitude sans jamais pénaliser, le temps de retrouver le rythme.</p>
				{#each struggling as x (x.h.id)}
					<div class="flex flex-wrap items-center gap-3 rounded-xl px-2 py-2 hover:bg-raised">
						<span class="min-w-0 flex-1 text-sm font-semibold">{x.h.name} <span class="text-xs font-bold text-muted">{x.done}/{x.expected}</span></span>
						{#if lightened.includes(x.h.id)}
							<span class="chip bg-done-soft text-done"><Check size={11} /> passée en bonus</span>
						{:else}
							<button class="btn text-xs" onclick={() => lighten(x.h)}><Feather size={13} /> Passer en bonus</button>
						{/if}
					</div>
				{:else}
					<p class="flex items-center gap-2 text-sm text-muted"><Check size={15} class="text-done" /> Aucune habitude en difficulté. Beau travail.</p>
				{/each}
			</section>

			<section class="card">
				<h2 class="mb-1 font-extrabold">Tâches restées en route</h2>
				<p class="mb-3 text-xs text-muted">Prévues un jour passé et pas faites : on les replanifie ou on les lâche, sans culpabiliser.</p>
				{#each postponed as t (t.id)}
					<div class="flex flex-wrap items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-raised">
						<span class="min-w-0 flex-1 truncate text-sm font-semibold">{t.title} <span class="text-xs font-bold text-muted">· {formatShort(t.date!)}</span></span>
						<button class="btn text-xs" onclick={() => replan(t, 'week')}>Cette semaine</button>
						<button class="btn btn-ghost text-xs" onclick={() => replan(t, 'someday')}>Un jour</button>
						<button class="btn btn-ghost h-8 w-8 p-0 text-muted" onclick={() => store.removeTask(t.id)} aria-label="Abandonner {t.title}"><Trash size={14} /></button>
					</div>
				{:else}
					<p class="flex items-center gap-2 text-sm text-muted"><Check size={15} class="text-done" /> Rien en retard.</p>
				{/each}
			</section>
		</div>

		<!-- 4. Cap -->
	{:else if step === 3}
		<div class="flex flex-col gap-4">
			<section class="card flex flex-col gap-2">
				<h2 class="flex items-center gap-2 font-extrabold"><Target size={16} class="text-accent" /> Trois priorités</h2>
				<p class="text-xs text-muted">Elles iront dans « Cette semaine » à l'amarrage.</p>
				{#each priorities as _, i (i)}
					<div class="flex items-center gap-2">
						<span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-black text-accent">{i + 1}</span>
						<input class="input" placeholder={['La plus importante…', 'Ensuite…', 'Et si possible…'][i]} bind:value={priorities[i]} aria-label="Priorité {i + 1}" />
					</div>
				{/each}
			</section>

			{#if openQuests.length}
				<section class="card flex flex-col gap-2">
					<h2 class="flex items-center gap-2 font-extrabold"><Swords size={16} class="text-rose-700" /> La quête de la semaine</h2>
					<p class="text-xs text-muted">Une quête de campagne à faire avancer ; une tâche liée sera créée.</p>
					<div class="flex flex-wrap gap-1.5">
						{#each openQuests as q (q.id)}
							<button
								class="chip border px-3 py-1.5 {focusQuest === q.id ? 'border-accent bg-accent-soft text-ink' : 'border-line bg-surface text-muted hover:text-ink'}"
								aria-pressed={focusQuest === q.id}
								onclick={() => (focusQuest = focusQuest === q.id ? '' : q.id)}
							>
								{#if q.boss}<Skull size={11} class="text-rose-700" />{/if}{q.name}<span class="font-semibold opacity-60">· {q.campaign}</span>
							</button>
						{/each}
					</div>
				</section>
			{/if}

			<section class="card flex flex-col gap-2">
				<h2 class="flex items-center gap-2 font-extrabold"><BedDouble size={16} class="text-sky-700" /> Jours de repos à venir</h2>
				<p class="text-xs text-muted">Un jour de repos ne compte jamais comme raté. À poser à l'avance, sans en abuser.</p>
				<div class="grid grid-cols-7 gap-1.5">
					{#each nextWeek as d (d)}
						{@const rest = data.restDays.includes(d)}
						<button
							class="flex flex-col items-center rounded-xl border py-2 text-xs font-bold transition-colors {rest ? 'border-sky-300 bg-sky-100 text-sky-800' : 'border-line bg-surface text-muted hover:bg-raised'}"
							aria-pressed={rest}
							onclick={() => store.toggleRestDay(d)}
						>
							<span class="text-[10px] uppercase">{WEEKDAYS_SHORT[weekday(d)]}</span>
							{#if rest}<BedDouble size={14} />{:else}<span class="tabular-nums">{formatShort(d).split(' ')[0]}</span>{/if}
						</button>
					{/each}
				</div>
			</section>
		</div>

		<!-- 5. Amarrage -->
	{:else}
		<section class="card flex flex-col items-center gap-3 py-8 text-center">
			<span class="flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-accent"><Anchor size={30} /></span>
			<h2 class="text-2xl font-black">Prêt à amarrer au Havre</h2>
			<p class="max-w-md text-sm text-muted">
				L'orbite se boucle avec {sectorsLit(sectors)} secteur{sectorsLit(sectors) > 1 ? 's' : ''} allumé{sectorsLit(sectors) > 1 ? 's' : ''}.
				{#if priorities.some((p) => p.trim())}{priorities.filter((p) => p.trim()).length} priorité(s) partiront dans « Cette semaine ».{/if}
			</p>
			<div class="flex flex-wrap items-center justify-center gap-2 text-sm font-bold">
				<span class="chip bg-accent-soft py-1 text-accent">+{XP_REWARDS.weeklyReview} XP</span>
				<span class="chip bg-raised py-1"><LootLine loot={reward} signed size={12} /></span>
				<span class="chip bg-raised py-1 text-muted">+{GAUGES.inspiration.weeklyReview} Inspiration</span>
			</div>
			<button class="btn btn-primary mt-2 px-6 py-2.5 text-base" onclick={dock}><Anchor size={18} /> Amarrer</button>
		</section>
	{/if}

	<!-- Navigation entre étapes -->
	<div class="mt-4 flex items-center justify-between gap-2">
		<button class="btn btn-ghost" disabled={step === 0} onclick={() => go(step - 1)}><ArrowLeft size={16} /> Retour</button>
		{#if step < STEPS.length - 1}
			<button class="btn btn-primary" onclick={() => go(step + 1)}>{STEPS[step + 1].label} <ArrowRight size={16} /></button>
		{/if}
	</div>
{/if}

<!-- Archive : le journal de bord -->
{#if data.reviews.length}
	<section class="mt-8">
		<button class="flex items-center gap-1.5 px-1 text-sm font-bold text-muted hover:text-ink" aria-expanded={showArchive} onclick={() => (showArchive = !showArchive)}>
			<ChevronDown size={15} class="transition-transform {showArchive ? 'rotate-180' : ''}" />
			<NotebookPen size={14} /> Journal des revues ({data.reviews.length})
		</button>
		{#if showArchive}
			<div class="mt-2 flex flex-col gap-2">
				{#each [...data.reviews].reverse() as r (r.id)}
					<details class="card p-3">
						<summary class="flex cursor-pointer flex-wrap items-center gap-2 text-sm font-bold">
							Semaine du {formatShort(r.periodStart)}
							<span class="chip bg-accent-soft text-accent">+{r.snapshot.xp} XP</span>
							<span class="chip bg-raised text-muted">{r.snapshot.successRate} % tenu</span>
						</summary>
						<dl class="mt-2 grid gap-2 text-sm sm:grid-cols-2">
							<div><dt class="label">Ce qui a marché</dt><dd class="whitespace-pre-line">{r.worked || '—'}</dd></div>
							<div><dt class="label">Ce qui a coincé</dt><dd class="whitespace-pre-line">{r.stuck || '—'}</dd></div>
							<div><dt class="label">Ce que j'ajuste</dt><dd class="whitespace-pre-line">{r.adjust || '—'}</dd></div>
							<div><dt class="label">Priorités</dt><dd>{r.priorities.join(' · ') || '—'}</dd></div>
						</dl>
					</details>
				{/each}
			</div>
		{/if}
	</section>
{/if}
