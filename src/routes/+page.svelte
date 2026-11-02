<script lang="ts">
	import {
		AudioLines,
		BedDouble,
		Check,
		ChevronDown,
		ChevronLeft,
		ChevronRight,
		Feather,
		Flame,
		ListTodo,
		MoonStar,
		Orbit,
		Plus,
		Shield,
		Compass,
		HeartHandshake,
		Sparkles,
		X,
		Sunrise,
		SunMedium
	} from '@lucide/svelte';
	import Gauges from '#lib/components/Gauges.svelte';
	import LevelRing from '#lib/components/LevelRing.svelte';
	import LootLine from '#lib/components/LootLine.svelte';
	import OrbitRing from '#lib/components/OrbitRing.svelte';
	import TierButtons from '#lib/components/TierButtons.svelte';
	import WeekDots from '#lib/components/WeekDots.svelte';
	import { GAUGES, REGULARITY, SHIELD } from '#lib/config.ts';
	import { addDays, formatLong, formatShort, today, weekday } from '#lib/dates.ts';
	import { discipline, gaugeValue, obligationsOn, totalXp } from '#lib/engine/progress.ts';
	import { habitStreak, habitWeekDays, habitWeekStreak, nextMilestone } from '#lib/engine/regularity.ts';
	import { shieldOffer, shieldState } from '#lib/engine/shields.ts';
	import { copilotTips } from '#lib/engine/copilot.ts';
	import { danceClassesOn, habitsForDay, logsInWeek, partiesOn, routineOn, tasksForDay } from '#lib/engine/schedule.ts';
	import { addLoot, orbit, orbitReward, sectorsLit } from '#lib/engine/ship.ts';
	import { levelInfo } from '#lib/engine/xp.ts';
	import { DANCE_LABEL, MOMENT_LABEL } from '#lib/labels.ts';
	import { store, uid } from '#lib/store.svelte.ts';
	import { toasts } from '#lib/toasts.svelte.ts';
	import type { Habit, Loot, Moment, Task } from '#lib/types.ts';
	import { SECTORS } from '#lib/universe.ts';

	let date = $state(today());
	const data = $derived(store.data);

	const isToday = $derived(date === today());
	const restDay = $derived(data.restDays.includes(date));
	const minimumMode = $derived(data.minimumModeDays.includes(date));
	const disc = $derived(discipline(data, date));
	const motivation = $derived(gaugeValue(data, 'motivation'));
	const inspiration = $derived(gaugeValue(data, 'inspiration'));
	const level = $derived(levelInfo(totalXp(data)));
	const xpDay = $derived(totalXp(data, date, date));
	const dayEvents = $derived(data.events.filter((e) => e.date === date && (e.xp?.length || e.loot)));
	// Butin gagné ce jour (les dépenses du chantier ne comptent pas).
	const dayLoot = $derived(
		dayEvents.reduce<Loot>((acc, e) => (e.loot && Object.values(e.loot).every((v) => (v ?? 0) >= 0) ? addLoot(acc, e.loot) : acc), {})
	);
	const sectors = $derived(orbit(data, date, today()));
	const sector = $derived(SECTORS[(weekday(date) + 6) % 7]);

	const habits = $derived(habitsForDay(data, date));
	const classes = $derived(danceClassesOn(data, date));
	const parties = $derived(partiesOn(data, date));
	// Les tâches de la semaine et du mois non planifiées s'affichent aussi dans la journée courante.
	const tasks = $derived(tasksForDay(data, date, today()));
	const tasksLeft = $derived(tasks.filter((t) => !t.done).length);

	const moments: Moment[] = ['morning', 'day', 'evening'];
	const MOMENT_ICON = { morning: Sunrise, day: SunMedium, evening: MoonStar } as const;

	// État local des routines et séances avant validation
	let checked = $state<Record<string, string[]>>({});
	let sessionPick = $state<Record<string, string>>({});
	let open = $state<Record<string, boolean>>({});
	let newTask = $state('');

	// Régularité : la journée complète à portée de main, et les séries en cours.
	const duty = $derived(obligationsOn(data, date));
	const bonusDue = $derived(habits.filter((h) => h.kind === 'bonus' && h.frequency.type !== 'weekly'));
	const bonusDone = $derived(bonusDue.filter((h) => logOf(h)).length);
	const dayDone = $derived(duty.expected > 0 && duty.done === duty.expected);
	const dayPerfect = $derived(dayDone && bonusDue.length > 0 && bonusDone === bonusDue.length);
	const streakOf = (h: Habit) => (h.frequency.type === 'weekly' ? habitWeekStreak(data, h, date) : habitStreak(data, h, date));
	const streaks = $derived(
		habits
			.map((h) => ({ h, n: streakOf(h), weekly: h.frequency.type === 'weekly' }))
			.filter((s) => s.n >= 2)
			.sort((a, b) => b.n - a.n)
			.slice(0, 6)
	);
	const dayIndex = $derived((weekday(date) + 6) % 7);
	const shields = $derived(shieldState(data));
	// Copilote : les deux conseils les plus utiles du jour.
	const tips = $derived(isToday ? copilotTips(data, today()).slice(0, 2) : []);
	const TIP_STYLE = {
		boost: { icon: Flame, tone: 'bg-orange-100 text-orange-800' },
		care: { icon: HeartHandshake, tone: 'bg-sky-100 text-sky-800' },
		plan: { icon: Compass, tone: 'bg-accent-soft text-accent' }
	} as const;
	// Un raté récent casse une série : on propose le joker, sans jamais le dépenser à la place du joueur.
	const offer = $derived(isToday ? shieldOffer(data, today()) : null);
	// Le bouclier qui a servi la veille, pour le dire en arrivant le matin.
	const savedYesterday = $derived(data.events.find((e) => e.source === `shield:use:${addDays(date, -1)}`));

	const logOf = (h: Habit) => data.habitLogs.find((l) => l.habitId === h.id && l.date === date);

	// Ce qu'une validation a rapporté, pour l'afficher sur la carte.
	function earned(source: string) {
		const e = data.events.find((x) => x.source === source);
		return e ? { xp: e.xp?.reduce((s, x) => s + x.amount, 0) ?? 0, loot: e.loot } : null;
	}

	function toggleExercise(habitId: string, exId: string) {
		const list = checked[habitId] ?? [];
		checked[habitId] = list.includes(exId) ? list.filter((x) => x !== exId) : [...list, exId];
	}

	function toggleTask(t: Task) {
		const finishing = !t.done;
		store.toggleTask(t);
		if (!finishing) return;
		const gain = earned(`task:${t.id}`);
		toasts.push({ title: 'Tâche terminée', xp: gain?.xp, loot: gain?.loot });
	}

	function addTask() {
		if (!newTask.trim()) return;
		store.saveTask({ id: uid(), title: newTask.trim(), list: 'today', date });
		newTask = '';
	}
</script>

<!-- En-tête : la date, le secteur de l'orbite et le gain du jour -->
<header class="mb-5 flex flex-wrap items-end justify-between gap-4">
	<div class="min-w-0">
		<div class="eyebrow mb-1 flex items-center gap-1.5 text-accent">
			<Orbit size={13} strokeWidth={2.4} /> Secteur {sector.name} · jour {(weekday(date) + 6) % 7 + 1} sur 7
		</div>
		<div class="-ml-2 flex items-center gap-0.5">
			<button class="btn btn-ghost h-9 w-9 p-0" onclick={() => (date = addDays(date, -1))} aria-label="Jour précédent"><ChevronLeft size={20} /></button>
			<h1 class="text-2xl font-black tracking-tight capitalize sm:text-3xl">{formatLong(date)}</h1>
			<button class="btn btn-ghost h-9 w-9 p-0" onclick={() => (date = addDays(date, 1))} aria-label="Jour suivant"><ChevronRight size={20} /></button>
		</div>
		<p class="text-sm text-muted">{sector.lore}</p>
		{#if !isToday}<button class="btn mt-2 text-xs" onclick={() => (date = today())}>Revenir à aujourd'hui</button>{/if}
	</div>
	<div class="card flex items-center gap-3 px-3.5 py-2.5">
		<LevelRing level={level.level} into={level.into} needed={level.needed} size={56} />
		<div class="leading-tight">
			<div class="text-[11px] font-semibold text-muted">{isToday ? "Aujourd'hui" : 'Ce jour-là'}</div>
			<div class="text-xl font-black text-accent tabular-nums">+{xpDay} XP</div>
			<div class="text-xs"><LootLine loot={dayLoot} signed size={12} /></div>
		</div>
	</div>
</header>

<!-- Réglages du jour -->
<div class="mb-6 flex flex-wrap items-center gap-2">
	<button class="btn text-xs {minimumMode ? 'border-accent bg-accent-soft' : ''}" aria-pressed={minimumMode} onclick={() => store.toggleMinimumMode(date)}>
		<Feather size={14} /> Mode minimum
	</button>
	<button class="btn text-xs {restDay ? 'border-accent bg-accent-soft' : ''}" aria-pressed={restDay} onclick={() => store.toggleRestDay(date)}>
		<BedDouble size={14} /> Jour de repos
	</button>
	{#if motivation < GAUGES.minimumModeBelow && !minimumMode && isToday}
		<p class="flex items-center gap-1.5 rounded-xl bg-orange-100 px-3 py-1.5 text-xs font-semibold text-orange-800">
			<Flame size={14} /> Réacteur faible : le mode minimum préserve ta Discipline.
		</p>
	{/if}
	{#if restDay}
		<p class="rounded-xl bg-sky-100 px-3 py-1.5 text-xs font-semibold text-sky-800">Jour de repos : rien n'est compté comme raté.</p>
	{/if}
</div>

<!-- Copilote -->
{#if tips.length}
	<section class="mb-4 grid gap-2 {tips.length > 1 ? 'md:grid-cols-2' : ''}" aria-label="Conseils du copilote">
		{#each tips as t (t.id)}
			{@const st = TIP_STYLE[t.kind]}
			<div class="card flex items-start gap-3 p-3.5">
				<span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full {st.tone}"><st.icon size={17} strokeWidth={2.4} /></span>
				<div class="min-w-0 flex-1">
					<div class="text-sm font-extrabold">{t.title}</div>
					<p class="text-xs leading-snug text-muted">{t.text}</p>
					{#if t.action}<a href={t.action.href} class="mt-1 inline-block text-xs font-bold text-accent hover:underline">{t.action.label} →</a>{/if}
				</div>
				<button class="btn btn-ghost h-7 w-7 shrink-0 p-0 text-muted" onclick={() => store.dismissTip(t.id)} aria-label="Plus tard" title="Plus tard"><X size={14} /></button>
			</div>
		{/each}
	</section>
{/if}

<!-- Joker : sauver une série après un raté -->
{#if offer}
	<section class="card mb-4 flex flex-col gap-3 border-sky-300">
		<div class="flex items-start gap-3">
			<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-800"><Shield size={19} strokeWidth={2.4} /></span>
			<div class="min-w-0 flex-1">
				<div class="font-extrabold">
					{offer.date === addDays(today(), -1) ? 'Hier' : formatLong(offer.date)}, {offer.risk.length > 1 ? 'des séries se sont cassées' : 'une série s’est cassée'}
				</div>
				<p class="text-xs font-semibold text-muted">
					{#each offer.risk as r, i (r.habit.id)}{i ? ', ' : ''}<span class="text-ink">{r.habit.name}</span> ({r.streak} jours){/each}.
					{#if shields.stock}
						Un bouclier peut {offer.risk.length > 1 ? 'les' : 'la'} sauver ; il t'en reste {shields.stock}. Garde-les pour les séries qui comptent.
					{:else}
						Pas de bouclier en réserve : la prochaine fois peut-être.
					{/if}
				</p>
			</div>
		</div>
		<div class="flex flex-wrap justify-end gap-2">
			<button class="btn btn-ghost text-xs" onclick={() => store.declineShield(offer.date)}>Laisser filer</button>
			{#if shields.stock}
				<button class="btn btn-primary text-xs" onclick={() => store.useShield(offer.date)}><Shield size={14} /> Utiliser un bouclier</button>
			{:else}
				<a class="btn text-xs" href="#/vaisseau">En fabriquer un</a>
			{/if}
		</div>
	</section>
{/if}

<!-- Régularité : la journée en cours et les séries -->
{#if !restDay && (duty.expected > 0 || bonusDue.length)}
	<section class="card mb-6 flex flex-col gap-3 {dayPerfect ? 'border-reward' : dayDone ? 'border-done/50' : ''}">
		<div class="flex flex-wrap items-center gap-3">
			<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full {dayDone ? 'bg-reward text-on-accent' : 'bg-accent-soft text-accent'}">
				{#if dayPerfect}<Sparkles size={19} />{:else if dayDone}<Check size={19} strokeWidth={3} />{:else}<Flame size={19} />{/if}
			</span>
			<div class="min-w-0 flex-1">
				<div class="font-extrabold">
					{#if dayPerfect}Journée parfaite !{:else if dayDone}Journée complète{:else}Vers la journée complète{/if}
				</div>
				<div class="flex flex-wrap items-center gap-1 text-xs font-semibold text-muted">
					{#if dayPerfect}
						Tout est fait, bonus compris : +{REGULARITY.dayPerfect.xp} XP de base.
					{:else if dayDone}
						{bonusDue.length
							? `Encore ${bonusDue.length - bonusDone} bonus pour la journée parfaite (+${REGULARITY.dayPerfect.xp} XP au lieu de +${REGULARITY.dayComplete.xp}).`
							: `+${REGULARITY.dayComplete.xp} XP de base.`}
					{:else if duty.expected}
						Encore {duty.expected - duty.done} obligation{duty.expected - duty.done > 1 ? 's' : ''} : +{REGULARITY.dayComplete.xp} XP
						<LootLine loot={REGULARITY.dayComplete.loot} signed size={10} />
					{:else}
						Pas d'obligation aujourd'hui : fais tes bonus pour le plaisir.
					{/if}
				</div>
			</div>
			<div class="flex flex-col items-end gap-1">
				<span class="text-xs font-bold text-muted tabular-nums">{duty.done + bonusDone}/{duty.expected + bonusDue.length}</span>
				<a
					href="#/vaisseau"
					class="flex items-center gap-0.5"
					title={shields.stock >= shields.max
						? 'Réserve de boucliers pleine'
						: `Prochain bouclier dans ${SHIELD.earnEvery - shields.progress} journée(s) complète(s)`}
					aria-label="{shields.stock} bouclier{shields.stock > 1 ? 's' : ''} de série sur {shields.max}"
				>
					{#each Array(shields.max) as _, i (i)}
						<Shield size={13} strokeWidth={2.4} class={i < shields.stock ? 'fill-sky-300 text-sky-700' : 'text-muted opacity-40'} />
					{/each}
				</a>
			</div>
		</div>
		<div class="flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
			{#each Array(duty.expected) as _, i (i)}<span class="flex-1 transition-colors {i < duty.done ? 'bg-done' : 'bg-zinc-200'}"></span>{/each}
			{#each Array(bonusDue.length) as _, i (i)}<span class="flex-1 transition-colors {i < bonusDone ? 'bg-reward' : 'bg-zinc-100'}"></span>{/each}
		</div>
		{#if savedYesterday}
			<p class="flex items-center gap-2 rounded-xl bg-sky-100 px-3 py-2 text-xs font-semibold text-sky-800">
				<Shield size={14} strokeWidth={2.4} class="shrink-0" />
				Bouclier posé sur hier : {savedYesterday.label.replace('Bouclier de série : ', '')}.
			</p>
		{/if}
		{#if streaks.length}
			<div class="flex flex-wrap gap-1.5">
				{#each streaks as s (s.h.id)}
					{@const next = s.weekly ? undefined : nextMilestone(s.n)}
					<span
						class="chip bg-orange-100 py-1 text-orange-800"
						title={next ? `Encore ${next.days - s.n} jour(s) pour la série de ${next.days} (+${next.xp} XP)` : undefined}
					>
						<Flame size={12} strokeWidth={2.6} />{s.h.name} · {s.n}{s.weekly ? ' sem.' : ' j'}
						{#if next}<span class="font-semibold opacity-70">→ {next.days}</span>{/if}
					</span>
				{/each}
			</div>
		{/if}
	</section>
{/if}

<!-- Routines du jour, par moment -->
{#each moments as moment (moment)}
	{@const items = habits.filter((h) => h.moment === moment)}
	{@const danceHere = moment === 'evening'}
	{@const MomentIcon = MOMENT_ICON[moment]}
	{#if items.length || (danceHere && (classes.length || parties.length))}
		<section class="mb-6">
			<h2 class="mb-2 flex items-center gap-2 px-1">
				<MomentIcon size={16} class="text-accent" strokeWidth={2.3} />
				<span class="eyebrow">{MOMENT_LABEL[moment]}</span>
				<span class="text-[11px] font-bold text-muted">{items.filter((h) => logOf(h)).length}/{items.length}</span>
			</h2>
			<div class="flex flex-col gap-2.5">
				{#each items as h (h.id)}
					{@const log = logOf(h)}
					{@const gain = log ? earned(`habit:${log.id}`) : null}
					{@const routine = h.form === 'routine' ? routineOn(h, date) : undefined}
					{@const streak = streakOf(h)}
					<div class="card p-3.5 transition-colors {log ? 'border-done/40 bg-done-soft' : ''}">
						<div class="flex flex-wrap items-center gap-3">
							<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors {log ? 'bg-done text-on-accent' : 'bg-accent-soft text-accent'}">
								{#if log}<Check size={20} strokeWidth={3} />{:else}<MomentIcon size={19} strokeWidth={2.2} />{/if}
							</span>
							<div class="min-w-0 flex-1">
								<div class="flex flex-wrap items-center gap-1.5 font-bold">
									{h.name}
									{#if h.kind === 'bonus'}<span class="chip bg-amber-100 text-amber-800">bonus</span>{/if}
									{#if streak >= 2}
										<span class="chip bg-orange-100 text-orange-800" title="Série en cours"><Flame size={11} strokeWidth={2.6} />{streak}{h.frequency.type === 'weekly' ? ' sem.' : ''}</span>
									{/if}
								</div>
								{#if h.frequency.type !== 'weekly'}
									<div class="my-0.5"><WeekDots marks={habitWeekDays(data, h, date, today())} current={dayIndex} /></div>
								{/if}
								<div class="truncate text-xs text-muted">
									{#if h.frequency.type === 'weekly'}
										{logsInWeek(data, h.id, date).length}/{h.frequency.times} cette semaine ·
									{/if}
									{#if h.cue && !log}<span class="font-semibold text-ink">{h.cue}</span> ·{/if}
									{log ? h.tiers[log.tier] : minimumMode ? h.tiers.min : h.tiers.normal}
									{#if log?.session}· {log.session}{/if}
								</div>
								{#if gain}
									<div class="mt-0.5 flex items-center gap-2 text-xs font-bold text-done">+{gain.xp} XP <LootLine loot={gain.loot} signed size={11} /></div>
								{/if}
							</div>
							<div class="flex items-center gap-2">
								{#if h.form === 'program' && !log}
									<select class="input w-auto py-1 text-xs" bind:value={sessionPick[h.id]} aria-label="Séance">
										<option value={undefined}>Séance…</option>
										{#each h.sessions ?? [] as s (s)}<option value={s}>{s}</option>{/each}
									</select>
								{/if}
								<TierButtons
									current={log?.tier}
									minimumOnly={minimumMode && !log}
									titles={h.tiers}
									onpick={(t) =>
										store.logHabit(h, date, t, {
											session: sessionPick[h.id],
											doneExercises: checked[h.id]
										})}
									onclear={() => log && store.unlog(log.id)}
								/>
							</div>
						</div>
						{#if routine}
							<button class="mt-2 ml-13 flex items-center gap-1 text-xs font-semibold text-muted hover:text-ink" aria-expanded={!!open[h.id]} onclick={() => (open[h.id] = !open[h.id])}>
								<ChevronDown size={14} class="transition-transform {open[h.id] ? 'rotate-180' : ''}" />
								Exercices ({routine.exercises.length})
							</button>
							{#if open[h.id]}
								{#if routine.exercises.length === 0}
									<p class="mt-2 ml-13 text-xs text-muted">
										Aucun exercice pour l'instant : ajoute-les dans <a class="font-semibold text-accent hover:underline" href="#/habitudes">Habitudes</a>.
									</p>
								{:else}
									<ul class="mt-2 ml-13 flex flex-col gap-1.5">
										{#each routine.exercises as ex (ex.id)}
											<li>
												<label class="flex items-center gap-2 text-sm">
													<input
														type="checkbox"
														checked={(log?.doneExercises ?? checked[h.id] ?? []).includes(ex.id)}
														disabled={!!log}
														onchange={() => toggleExercise(h.id, ex.id)}
													/>
													{ex.name}
													{#if ex.detail}<span class="text-xs text-muted">{ex.detail}</span>{/if}
												</label>
											</li>
										{/each}
									</ul>
								{/if}
							{/if}
						{/if}
					</div>
				{/each}

				{#if danceHere}
					{#each classes as c (c.id)}
						{@const log = data.danceLogs.find((l) => l.refId === c.id && l.date === date)}
						{@const gain = log ? earned(`dance:${log.id}`) : null}
						<div class="card flex flex-wrap items-center gap-3 p-3.5 transition-colors {log ? 'border-done/40 bg-done-soft' : ''}">
							<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl {log ? 'bg-done text-on-accent' : 'bg-pink-100 text-pink-700'}">
								{#if log}<Check size={20} strokeWidth={3} />{:else}<AudioLines size={19} />{/if}
							</span>
							<div class="min-w-0 flex-1">
								<div class="flex flex-wrap items-center gap-1.5 font-bold">
									Cours de {DANCE_LABEL[c.style]}
									{#if c.kind === 'bonus'}<span class="chip bg-amber-100 text-amber-800">bonus</span>{/if}
								</div>
								<div class="text-xs text-muted">{c.time} · {c.durationMin} min{c.place ? ' · ' + c.place : ''}</div>
								{#if gain}<div class="mt-0.5 flex items-center gap-2 text-xs font-bold text-done">+{gain.xp} XP <LootLine loot={gain.loot} signed size={11} /></div>{/if}
							</div>
							<TierButtons
								current={log?.tier}
								onpick={(t) => store.logDance(c.id, `Cours de ${DANCE_LABEL[c.style]}`, [c.style], c.kind, date, t)}
								onclear={() => log && store.unlogDance(log.id)}
							/>
						</div>
					{/each}
					{#each parties as p (p.id)}
						{@const log = data.danceLogs.find((l) => l.refId === p.id && l.date === date)}
						{@const gain = log ? earned(`dance:${log.id}`) : null}
						<div class="card flex flex-wrap items-center gap-3 p-3.5 transition-colors {log ? 'border-done/40 bg-done-soft' : ''}">
							<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl {log ? 'bg-done text-on-accent' : 'bg-fuchsia-100 text-fuchsia-700'}">
								{#if log}<Check size={20} strokeWidth={3} />{:else}<AudioLines size={19} />{/if}
							</span>
							<div class="min-w-0 flex-1">
								<div class="flex flex-wrap items-center gap-1.5 font-bold">
									Soirée {p.styles.map((s) => DANCE_LABEL[s]).join(' / ')}
									<span class="chip bg-amber-100 text-amber-800">bonus</span>
								</div>
								<div class="text-xs text-muted">{p.time}{p.place ? ' · ' + p.place : ''}{p.note ? ' · ' + p.note : ''}</div>
								{#if gain}<div class="mt-0.5 flex items-center gap-2 text-xs font-bold text-done">+{gain.xp} XP <LootLine loot={gain.loot} signed size={11} /></div>{/if}
							</div>
							<TierButtons
								current={log?.tier}
								onpick={(t) => store.logDance(p.id, 'Soirée de danse', p.styles, 'bonus', date, t)}
								onclear={() => log && store.unlogDance(log.id)}
							/>
						</div>
					{/each}
				{/if}
			</div>
		</section>
	{/if}
{/each}

{#if !habits.length && !classes.length && !parties.length}
	<div class="card mb-6 text-center">
		<p class="font-bold">Rien de prévu dans ce secteur</p>
		<p class="text-sm text-muted">Profite du calme, ou crée tes routines dans <a class="font-semibold text-accent hover:underline" href="#/habitudes">Habitudes</a>.</p>
	</div>
{/if}

<!-- Todo du jour -->
<section class="mb-6">
	<h2 class="mb-2 flex items-center gap-2 px-1">
		<ListTodo size={16} class="text-accent" strokeWidth={2.3} />
		<span class="eyebrow">À faire</span>
		<span class="text-[11px] font-bold text-muted">{tasksLeft} restante{tasksLeft > 1 ? 's' : ''}</span>
	</h2>
	<div class="card p-2">
		{#each tasks as t (t.id)}
			<label class="flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition-colors hover:bg-raised">
				<input type="checkbox" checked={!!t.done} onchange={() => toggleTask(t)} />
				<span class="min-w-0 flex-1 font-semibold {t.done ? 'text-muted line-through' : ''}">{t.title}</span>
				{#if !t.done && !t.date && t.list === 'week'}<span class="chip bg-sky-100 text-sky-800">semaine</span>{/if}
				{#if !t.done && !t.date && t.list === 'month'}<span class="chip bg-violet-100 text-violet-800">mois</span>{/if}
				{#if !t.done && t.date && t.date < date}<span class="chip bg-orange-100 text-orange-800">reportée</span>{/if}
				{#if !t.done && t.due}<span class="chip {t.due < date ? 'bg-rose-100 text-rose-800' : 'bg-zinc-100 text-muted'}">échéance {formatShort(t.due)}</span>{/if}
				{#if t.subtasks?.length}<span class="text-[11px] font-bold text-muted">{t.subtasks.filter((s) => s.done).length}/{t.subtasks.length}</span>{/if}
				{#if t.start}<span class="text-xs text-muted">{t.start}</span>{/if}
			</label>
		{:else}
			<p class="px-2.5 py-2 text-sm text-muted">Aucune tâche pour ce jour.</p>
		{/each}
		<form class="mt-1 flex gap-2 p-1" onsubmit={(e) => (e.preventDefault(), addTask())}>
			<input class="input" placeholder="Ajouter une tâche…" bind:value={newTask} aria-label="Nouvelle tâche" />
			<button class="btn btn-primary shrink-0" aria-label="Ajouter"><Plus size={16} strokeWidth={2.6} /></button>
		</form>
		<div class="px-2.5 pt-1 pb-1.5 text-right">
			<a href="#/taches" class="text-xs font-semibold text-accent hover:underline">Détailler et organiser mes tâches</a>
		</div>
	</div>
</section>

<!-- Orbite et jauges -->
<div class="mb-6 grid gap-4 lg:grid-cols-5">
	<section class="card lg:col-span-3">
		<div class="mb-1 flex items-baseline justify-between gap-2">
			<h2 class="font-extrabold">Orbite de la semaine</h2>
			<a href="#/vaisseau" class="text-xs font-semibold text-accent hover:underline">Vaisseau</a>
		</div>
		<OrbitRing {sectors} current={date} />
		<p class="text-xs text-muted">
			<strong class="text-ink">{sectorsLit(sectors)}/7</strong> secteurs allumés · à l'amarrage du dimanche :
			<span class="text-ink"><LootLine loot={orbitReward(data, sectors)} signed size={11} /></span>
		</p>
	</section>
	<section class="card lg:col-span-2">
		<Gauges discipline={disc} {motivation} {inspiration} stacked />
	</section>
</div>

<!-- Journal de bord du jour -->
{#if dayEvents.length}
	<section>
		<h2 class="eyebrow mb-2 px-1">Journal de bord</h2>
		<ul class="card flex flex-col divide-y divide-line p-0 text-sm">
			{#each dayEvents as e (e.id)}
				<li class="flex items-center justify-between gap-3 px-4 py-2.5">
					<span class="min-w-0">{e.label}</span>
					<span class="flex shrink-0 items-center gap-2 text-xs font-bold text-muted">
						{#if e.xp?.length}<span class="text-accent">+{e.xp.reduce((s, x) => s + x.amount, 0)} XP</span>{/if}
						<LootLine loot={e.loot} signed size={11} />
					</span>
				</li>
			{/each}
		</ul>
	</section>
{/if}
