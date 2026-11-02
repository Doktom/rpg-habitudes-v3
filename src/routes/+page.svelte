<script lang="ts">
	import {
		AudioLines,
		BedDouble,
		Check,
		ChevronDown,
		ChevronLeft,
		ChevronRight,
		Compass,
		Feather,
		Flame,
		Gauge,
		HeartHandshake,
		ListTodo,
		MoonStar,
		Orbit,
		Plus,
		Radio,
		ScrollText,
		Shield,
		Sparkles,
		SunMedium,
		Sunrise,
		X
	} from '@lucide/svelte';
	import { slide } from 'svelte/transition';
	import DayRing from '#lib/components/DayRing.svelte';
	import FirstDaysGuide from '#lib/components/FirstDaysGuide.svelte';
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
	const dayIndex = $derived((weekday(date) + 6) % 7);
	const sector = $derived(SECTORS[dayIndex]);

	const habits = $derived(habitsForDay(data, date));
	const classes = $derived(danceClassesOn(data, date));
	const parties = $derived(partiesOn(data, date));
	// Les tâches de la semaine et du mois non planifiées s'affichent aussi dans la journée courante.
	const tasks = $derived(tasksForDay(data, date, today()));
	const tasksLeft = $derived(tasks.filter((t) => !t.done).length);

	const moments: Moment[] = ['morning', 'day', 'evening'];
	const MOMENT_ICON = { morning: Sunrise, day: SunMedium, evening: MoonStar } as const;
	const MOMENT_LORE = { morning: 'Mise en route des systèmes', day: 'Navigation de croisière', evening: 'Retour au calme' } as const;

	// État local des routines et séances avant validation
	let checked = $state<Record<string, string[]>>({});
	let sessionPick = $state<Record<string, string>>({});
	let open = $state<Record<string, boolean>>({});
	let folded = $state<Record<string, boolean>>({});
	let newTask = $state('');
	let showLog = $state(false);

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
			.slice(0, 5)
	);
	const shields = $derived(shieldState(data));
	// Copilote : les deux conseils les plus utiles du jour.
	const tips = $derived(isToday ? copilotTips(data, today()).slice(0, 2) : []);
	const TIP_STYLE = {
		boost: { icon: Flame, tone: 'text-orange-700', dot: 'bg-orange-400' },
		care: { icon: HeartHandshake, tone: 'text-sky-700', dot: 'bg-sky-400' },
		plan: { icon: Compass, tone: 'text-accent', dot: 'bg-accent' }
	} as const;
	// Un raté récent casse une série : on propose le joker, sans jamais le dépenser à la place du joueur.
	const offer = $derived(isToday ? shieldOffer(data, today()) : null);
	// Le bouclier qui a servi la veille, pour le dire en arrivant le matin.
	const savedYesterday = $derived(data.events.find((e) => e.source === `shield:use:${addDays(date, -1)}`));

	const logOf = (h: Habit) => data.habitLogs.find((l) => l.habitId === h.id && l.date === date);

	// Le statut de la journée, en une phrase.
	const status = $derived.by(() => {
		if (restDay) return { title: 'Jour de repos', text: "Le réacteur refroidit : rien n'est compté comme raté aujourd'hui." };
		if (dayPerfect) return { title: 'Journée parfaite', text: `Tout est fait, bonus compris : +${REGULARITY.dayPerfect.xp} XP de base.` };
		if (dayDone)
			return {
				title: 'Secteur allumé',
				text: bonusDue.length ? `Encore ${bonusDue.length - bonusDone} bonus pour la journée parfaite.` : `Journée complète : +${REGULARITY.dayComplete.xp} XP de base.`
			};
		if (duty.expected) {
			const left = duty.expected - duty.done;
			return {
				title: duty.done ? 'Vers la journée complète' : 'Le secteur attend',
				text: `Encore ${left} obligation${left > 1 ? 's' : ''} pour allumer le secteur ${sector.name} (+${REGULARITY.dayComplete.xp} XP).`
			};
		}
		return { title: 'Secteur calme', text: "Pas d'obligation aujourd'hui : fais tes bonus pour le plaisir." };
	});

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

	const SECTOR_DOT: Record<string, string> = {
		lit: 'bg-accent text-on-accent',
		rest: 'bg-sky-200 text-sky-800',
		partial: 'bg-accent-soft text-accent',
		today: 'bg-surface text-ink ring-2 ring-accent',
		missed: 'bg-surface text-muted',
		future: 'bg-surface/60 text-muted'
	};
</script>

<!-- ═══ Poste de pilotage : la journée d'un coup d'œil ═══ -->
<section class="cockpit relative mb-4 overflow-hidden rounded-[28px] border border-line">
	<svg class="planet pointer-events-none absolute -top-24 -right-24 h-64 w-64 sm:-top-36 sm:-right-36 sm:h-96 sm:w-96" viewBox="0 0 200 200" aria-hidden="true">
		<defs>
			<radialGradient id="kronos" cx="35%" cy="35%" r="70%">
				<stop offset="0" stop-color="var(--accent)" stop-opacity="0.32" />
				<stop offset="1" stop-color="var(--accent)" stop-opacity="0.04" />
			</radialGradient>
		</defs>
		<circle cx="100" cy="100" r="58" fill="url(#kronos)" />
		<ellipse cx="100" cy="104" rx="96" ry="22" fill="none" stroke="var(--accent)" stroke-opacity="0.35" stroke-width="1.5" transform="rotate(-14 100 100)" />
		<ellipse cx="100" cy="104" rx="80" ry="16" fill="none" stroke="var(--accent)" stroke-opacity="0.18" stroke-width="1" stroke-dasharray="2 5" transform="rotate(-14 100 100)" />
	</svg>

	<div class="relative grid gap-5 p-5 sm:grid-cols-[1fr_auto] sm:p-6">
		<div class="min-w-0">
			<div class="eyebrow mb-1.5 flex items-center gap-1.5 text-accent">
				<Orbit size={13} strokeWidth={2.4} /> Secteur {sector.name} · jour {dayIndex + 1}/7
			</div>
			<div class="-ml-2 flex items-center gap-0.5">
				<button class="btn btn-ghost h-9 w-9 p-0" onclick={() => (date = addDays(date, -1))} aria-label="Jour précédent"><ChevronLeft size={20} /></button>
				<h1 class="text-[26px] leading-tight font-black tracking-tight capitalize sm:text-4xl">{formatLong(date)}</h1>
				<button class="btn btn-ghost h-9 w-9 p-0" onclick={() => (date = addDays(date, 1))} aria-label="Jour suivant"><ChevronRight size={20} /></button>
			</div>
			<p class="mt-0.5 text-sm text-muted italic">{sector.lore}</p>
			{#if !isToday}<button class="btn mt-2 text-xs" onclick={() => (date = today())}>Revenir à aujourd'hui</button>{/if}

			<!-- Statut et réglages du jour -->
			<div class="mt-4 flex items-start gap-3 sm:hidden">
				<DayRing done={duty.done} expected={duty.expected} bonusDone={bonusDone} bonusTotal={bonusDue.length} rest={restDay} size={104} />
				<div class="min-w-0 pt-2">
					<div class="font-extrabold {dayDone ? 'text-done' : ''}">{status.title}</div>
					<p class="text-xs leading-snug text-muted">{status.text}</p>
				</div>
			</div>
			<div class="mt-4 hidden sm:block">
				<div class="text-lg font-extrabold {dayDone ? 'text-done' : ''}">{status.title}</div>
				<p class="text-sm text-muted">{status.text}</p>
			</div>

			<div class="mt-4 flex flex-wrap items-center gap-2">
				<button class="toggle {minimumMode ? 'on' : ''}" aria-pressed={minimumMode} onclick={() => store.toggleMinimumMode(date)}><Feather size={13} /> Mode minimum</button>
				<button class="toggle {restDay ? 'on' : ''}" aria-pressed={restDay} onclick={() => store.toggleRestDay(date)}><BedDouble size={13} /> Jour de repos</button>
				<a
					href="#/vaisseau"
					class="toggle"
					title={shields.stock >= shields.max ? 'Réserve de boucliers pleine' : `Prochain bouclier dans ${SHIELD.earnEvery - shields.progress} journée(s) complète(s)`}
				>
					{#each Array(shields.max) as _, i (i)}
						<Shield size={13} strokeWidth={2.4} class={i < shields.stock ? 'fill-sky-300 text-sky-700' : 'opacity-40'} />
					{/each}
					<span class="sr-only">{shields.stock} bouclier(s) sur {shields.max}</span>
				</a>
			</div>
		</div>

		<!-- Anneau du jour + gain -->
		<div class="hidden flex-col items-center gap-3 sm:flex">
			<DayRing done={duty.done} expected={duty.expected} bonusDone={bonusDone} bonusTotal={bonusDue.length} rest={restDay} />
			<div class="flex items-center gap-2 rounded-2xl border border-line bg-surface/80 px-3 py-1.5 backdrop-blur">
				<LevelRing level={level.level} into={level.into} needed={level.needed} size={38} />
				<div class="leading-tight">
					<div class="text-base font-black text-accent tabular-nums">+{xpDay} XP</div>
					<div class="text-[11px]"><LootLine loot={dayLoot} signed size={11} /></div>
				</div>
			</div>
		</div>
	</div>

	<!-- Les sept secteurs de l'orbite -->
	<div class="relative grid grid-cols-7 gap-1 border-t border-line/70 bg-surface/40 px-3 py-2.5 backdrop-blur-sm sm:px-6">
		{#each sectors as s, i (s.date)}
			<button class="flex flex-col items-center gap-1" onclick={() => (date = s.date)} aria-label="{s.name}{s.date === date ? ' (affiché)' : ''}">
				<span class="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-black transition-colors {SECTOR_DOT[s.state]} {s.date === date && s.state !== 'today' ? 'ring-2 ring-accent/60' : ''}">
					{#if s.state === 'lit'}<Check size={13} strokeWidth={3} />{:else if s.state === 'rest'}<BedDouble size={12} />{:else}{i + 1}{/if}
				</span>
				<span class="text-[9px] font-bold tracking-wide uppercase {s.date === date ? 'text-ink' : 'text-muted'}">{s.name}</span>
			</button>
		{/each}
	</div>
</section>

<!-- Gain du jour sur mobile -->
<div class="mb-4 flex items-center gap-3 sm:hidden">
	<div class="card flex flex-1 items-center gap-2.5 px-3 py-2">
		<LevelRing level={level.level} into={level.into} needed={level.needed} size={38} />
		<div class="min-w-0 leading-tight">
			<div class="text-[11px] font-semibold text-muted">{isToday ? "Gagné aujourd'hui" : 'Gagné ce jour-là'}</div>
			<div class="flex items-center gap-2"><span class="font-black text-accent tabular-nums">+{xpDay} XP</span><span class="text-xs"><LootLine loot={dayLoot} signed size={11} /></span></div>
		</div>
	</div>
</div>

<!-- ═══ Transmissions : copilote, bouclier, alertes ═══ -->
{#if tips.length || offer || savedYesterday || (motivation < GAUGES.minimumModeBelow && !minimumMode && isToday)}
	<section class="mb-4 flex flex-col gap-2" aria-label="Transmissions">
		{#if offer}
			<div class="card flex flex-col gap-3 border-sky-300 p-4">
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
			</div>
		{/if}
		{#if savedYesterday}
			<p class="flex items-center gap-2 rounded-2xl bg-sky-100 px-4 py-2.5 text-xs font-semibold text-sky-800">
				<Shield size={14} strokeWidth={2.4} class="shrink-0" /> Bouclier posé sur hier : {savedYesterday.label.replace('Bouclier de série : ', '')}.
			</p>
		{/if}
		{#if motivation < GAUGES.minimumModeBelow && !minimumMode && isToday}
			<p class="flex items-center gap-2 rounded-2xl bg-orange-100 px-4 py-2.5 text-xs font-semibold text-orange-800">
				<Flame size={14} class="shrink-0" /> Réacteur faible : le mode minimum préserve ta Discipline.
			</p>
		{/if}
		{#if tips.length}
			<div class="transmission card overflow-hidden p-0">
				<div class="flex items-center gap-2 border-b border-line px-4 py-2">
					<Radio size={14} class="text-accent" strokeWidth={2.4} />
					<span class="eyebrow">Transmission du copilote</span>
				</div>
				<div class="grid divide-line {tips.length > 1 ? 'md:grid-cols-2 md:divide-x' : ''} max-md:divide-y">
					{#each tips as t (t.id)}
						{@const st = TIP_STYLE[t.kind]}
						<div class="flex items-start gap-3 px-4 py-3">
							<span class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-raised {st.tone}"><st.icon size={16} strokeWidth={2.4} /></span>
							<div class="min-w-0 flex-1">
								<div class="text-sm font-extrabold">{t.title}</div>
								<p class="text-xs leading-snug text-muted">{t.text}</p>
								{#if t.action}<a href={t.action.href} class="mt-1 inline-block text-xs font-bold text-accent hover:underline">{t.action.label} →</a>{/if}
							</div>
							<button class="btn btn-ghost h-7 w-7 shrink-0 p-0 text-muted" onclick={() => store.dismissTip(t.id)} aria-label="Plus tard" title="Plus tard"><X size={14} /></button>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</section>
{/if}

{#if isToday}
	<div class="mb-4"><FirstDaysGuide /></div>
{/if}

<!-- ═══ Corps : les missions à gauche, la soute et l'état du vaisseau à droite ═══ -->
<div class="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
	<!-- Missions du jour, par moment -->
	<div class="flex min-w-0 flex-col gap-4">
		{#each moments as moment (moment)}
			{@const items = habits.filter((h) => h.moment === moment)}
			{@const danceHere = moment === 'evening'}
			{@const MomentIcon = MOMENT_ICON[moment]}
			{@const total = items.length + (danceHere ? classes.length + parties.length : 0)}
			{@const doneCount =
				items.filter((h) => logOf(h)).length +
				(danceHere ? [...classes, ...parties].filter((x) => data.danceLogs.some((l) => l.refId === x.id && l.date === date)).length : 0)}
			{@const allDone = total > 0 && doneCount === total}
			{@const isFolded = folded[moment] ?? allDone}
			{#if total}
				<section class="moment card overflow-hidden p-0 {allDone ? 'is-done' : ''}" aria-labelledby="m-{moment}">
					<button class="flex w-full items-center gap-3 px-4 py-3 text-left" aria-expanded={!isFolded} onclick={() => (folded[moment] = !isFolded)}>
						<span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl {allDone ? 'bg-done text-on-accent' : 'bg-accent-soft text-accent'}">
							{#if allDone}<Check size={18} strokeWidth={3} />{:else}<MomentIcon size={18} strokeWidth={2.3} />{/if}
						</span>
						<span class="min-w-0 flex-1">
							<span id="m-{moment}" class="block font-extrabold">{MOMENT_LABEL[moment]}</span>
							<span class="block text-[11px] font-semibold text-muted">{allDone ? 'Tout est fait' : MOMENT_LORE[moment]}</span>
						</span>
						<span class="flex items-center gap-2">
							<span class="hidden h-1.5 w-20 overflow-hidden rounded-full bg-zinc-200 sm:block">
								<span class="block h-full rounded-full bg-done transition-[width] duration-500" style="width: {(100 * doneCount) / total}%"></span>
							</span>
							<span class="text-xs font-black tabular-nums {allDone ? 'text-done' : 'text-muted'}">{doneCount}/{total}</span>
							<ChevronDown size={16} class="text-muted transition-transform {isFolded ? '' : 'rotate-180'}" />
						</span>
					</button>

					{#if !isFolded}
						<div class="flex flex-col gap-2 border-t border-line p-2.5" transition:slide={{ duration: 180 }}>
							{#each items as h (h.id)}
								{@const log = logOf(h)}
								{@const gain = log ? earned(`habit:${log.id}`) : null}
								{@const routine = h.form === 'routine' ? routineOn(h, date) : undefined}
								{@const streak = streakOf(h)}
								<div class="mission rounded-2xl border px-3 py-2.5 transition-colors {log ? 'border-done/40 bg-done-soft' : 'border-line bg-raised'}">
									<div class="flex flex-wrap items-center gap-x-3 gap-y-2">
										<div class="min-w-0 flex-1 basis-48">
											<div class="flex flex-wrap items-center gap-1.5 font-bold">
												{#if log}<Check size={15} strokeWidth={3} class="text-done" />{/if}
												<span class={log ? 'text-ink/80' : ''}>{h.name}</span>
												{#if h.kind === 'bonus'}<span class="chip bg-amber-100 text-amber-800">bonus</span>{/if}
												{#if streak >= 2}
													<span class="chip bg-orange-100 text-orange-800" title="Série en cours"><Flame size={11} strokeWidth={2.6} />{streak}{h.frequency.type === 'weekly' ? ' sem.' : ''}</span>
												{/if}
											</div>
											<div class="mt-0.5 truncate text-xs text-muted">
												{#if h.frequency.type === 'weekly'}{logsInWeek(data, h.id, date).length}/{h.frequency.times} cette semaine ·{/if}
												{#if h.cue && !log}<span class="font-semibold text-ink/80">{h.cue}</span> ·{/if}
												{log ? h.tiers[log.tier] : minimumMode ? h.tiers.min : h.tiers.normal}
												{#if log?.session}· {log.session}{/if}
											</div>
											{#if gain}
												<div class="mt-0.5 flex items-center gap-2 text-xs font-bold text-done">+{gain.xp} XP <LootLine loot={gain.loot} signed size={11} /></div>
											{:else if h.frequency.type !== 'weekly'}
												<div class="mt-1"><WeekDots marks={habitWeekDays(data, h, date, today())} current={dayIndex} /></div>
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
												onpick={(t) => store.logHabit(h, date, t, { session: sessionPick[h.id], doneExercises: checked[h.id] })}
												onclear={() => log && store.unlog(log.id)}
											/>
										</div>
									</div>
									{#if routine}
										<button class="mt-1.5 flex items-center gap-1 text-xs font-semibold text-muted hover:text-ink" aria-expanded={!!open[h.id]} onclick={() => (open[h.id] = !open[h.id])}>
											<ChevronDown size={14} class="transition-transform {open[h.id] ? 'rotate-180' : ''}" />
											Exercices ({routine.exercises.length})
										</button>
										{#if open[h.id]}
											{#if routine.exercises.length === 0}
												<p class="mt-2 text-xs text-muted">
													Aucun exercice pour l'instant : ajoute-les dans <a class="font-semibold text-accent hover:underline" href="#/habitudes">Habitudes</a>.
												</p>
											{:else}
												<ul class="mt-2 flex flex-col gap-1.5">
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
									<div class="flex flex-wrap items-center gap-3 rounded-2xl border px-3 py-2.5 {log ? 'border-done/40 bg-done-soft' : 'border-line bg-raised'}">
										<span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg {log ? 'bg-done text-on-accent' : 'bg-pink-100 text-pink-700'}">
											{#if log}<Check size={16} strokeWidth={3} />{:else}<AudioLines size={16} />{/if}
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
									<div class="flex flex-wrap items-center gap-3 rounded-2xl border px-3 py-2.5 {log ? 'border-done/40 bg-done-soft' : 'border-line bg-raised'}">
										<span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg {log ? 'bg-done text-on-accent' : 'bg-fuchsia-100 text-fuchsia-700'}">
											{#if log}<Check size={16} strokeWidth={3} />{:else}<AudioLines size={16} />{/if}
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
					{/if}
				</section>
			{/if}
		{/each}

		{#if !habits.length && !classes.length && !parties.length}
			<div class="card text-center">
				<p class="font-bold">Rien de prévu dans ce secteur</p>
				<p class="text-sm text-muted">Profite du calme, ou crée tes routines dans <a class="font-semibold text-accent hover:underline" href="#/habitudes">Habitudes</a>.</p>
			</div>
		{/if}
	</div>

	<!-- Colonne de bord -->
	<aside class="flex min-w-0 flex-col gap-4 lg:sticky lg:top-6">
		<!-- À faire -->
		<section class="card p-0" aria-labelledby="todo-title">
			<div class="flex items-center gap-2 px-4 pt-3.5 pb-2">
				<ListTodo size={16} class="text-accent" strokeWidth={2.3} />
				<h2 id="todo-title" class="flex-1 font-extrabold">À faire</h2>
				<span class="chip bg-raised text-muted">{tasksLeft} restante{tasksLeft > 1 ? 's' : ''}</span>
			</div>
			<div class="px-2">
				{#each tasks as t (t.id)}
					<label class="flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition-colors hover:bg-raised">
						<input type="checkbox" checked={!!t.done} onchange={() => toggleTask(t)} />
						<span class="min-w-0 flex-1 font-semibold {t.done ? 'text-muted line-through' : ''}">{t.title}</span>
						{#if !t.done && !t.date && t.list === 'week'}<span class="chip bg-sky-100 text-sky-800">semaine</span>{/if}
						{#if !t.done && !t.date && t.list === 'month'}<span class="chip bg-violet-100 text-violet-800">mois</span>{/if}
						{#if !t.done && t.date && t.date < date}<span class="chip bg-orange-100 text-orange-800">reportée</span>{/if}
						{#if !t.done && t.due}<span class="chip {t.due < date ? 'bg-rose-100 text-rose-800' : 'bg-zinc-100 text-muted'}">{formatShort(t.due)}</span>{/if}
						{#if t.subtasks?.length}<span class="text-[11px] font-bold text-muted">{t.subtasks.filter((s) => s.done).length}/{t.subtasks.length}</span>{/if}
						{#if t.start}<span class="text-xs text-muted">{t.start}</span>{/if}
					</label>
				{:else}
					<p class="px-2.5 py-2 text-sm text-muted">Aucune tâche pour ce jour.</p>
				{/each}
			</div>
			<form class="flex gap-2 p-3 pt-2" onsubmit={(e) => (e.preventDefault(), addTask())}>
				<input class="input" placeholder="Ajouter une tâche…" bind:value={newTask} aria-label="Nouvelle tâche" />
				<button class="btn btn-primary shrink-0" aria-label="Ajouter"><Plus size={16} strokeWidth={2.6} /></button>
			</form>
			<a href="#/taches" class="block border-t border-line px-4 py-2 text-right text-xs font-semibold text-accent hover:underline">Organiser mes tâches</a>
		</section>

		<!-- Séries -->
		{#if streaks.length}
			<section class="card" aria-labelledby="streaks-title">
				<div class="mb-2.5 flex items-center gap-2">
					<Flame size={16} class="text-orange-500" strokeWidth={2.4} />
					<h2 id="streaks-title" class="font-extrabold">Séries en cours</h2>
				</div>
				<ul class="flex flex-col gap-2.5">
					{#each streaks as s (s.h.id)}
						{@const next = s.weekly ? undefined : nextMilestone(s.n)}
						{@const prev = s.weekly ? 0 : ([...REGULARITY.streakMilestones].reverse().find((m) => m.days <= s.n)?.days ?? 0)}
						<li>
							<div class="flex items-baseline justify-between gap-2 text-sm">
								<span class="truncate font-bold">{s.h.name}</span>
								<span class="shrink-0 text-xs font-black text-orange-700 tabular-nums">{s.n}{s.weekly ? ' sem.' : ' j'}</span>
							</div>
							{#if next}
								<div class="mt-1 flex items-center gap-2">
									<span class="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200">
										<span class="block h-full rounded-full bg-orange-400" style="width: {(100 * (s.n - prev)) / (next.days - prev)}%"></span>
									</span>
									<span class="text-[10px] font-bold text-muted">palier {next.days} j</span>
								</div>
							{/if}
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<!-- État du vaisseau -->
		<section class="card" aria-labelledby="ship-title">
			<div class="mb-1 flex items-center gap-2">
				<Gauge size={16} class="text-accent" strokeWidth={2.4} />
				<h2 id="ship-title" class="flex-1 font-extrabold">État du vaisseau</h2>
				<a href="#/vaisseau" class="text-xs font-semibold text-accent hover:underline">Chantier</a>
			</div>
			<OrbitRing {sectors} current={date} labels={false} />
			<p class="-mt-1 mb-3 text-center text-xs text-muted">
				<strong class="text-ink">{sectorsLit(sectors)}/7</strong> secteurs · amarrage : <span class="text-ink"><LootLine loot={orbitReward(data, sectors)} signed size={11} /></span>
			</p>
			<Gauges discipline={disc} {motivation} {inspiration} stacked />
		</section>

		<!-- Journal de bord du jour -->
		{#if dayEvents.length}
			<section class="card p-0">
				<button class="flex w-full items-center gap-2 px-4 py-3 text-left" aria-expanded={showLog} onclick={() => (showLog = !showLog)}>
					<ScrollText size={16} class="text-accent" strokeWidth={2.3} />
					<span class="flex-1 font-extrabold">Journal de bord</span>
					<span class="chip bg-raised text-muted">{dayEvents.length}</span>
					<ChevronDown size={16} class="text-muted transition-transform {showLog ? 'rotate-180' : ''}" />
				</button>
				{#if showLog}
					<ul class="flex flex-col divide-y divide-line border-t border-line text-sm" transition:slide={{ duration: 180 }}>
						{#each dayEvents as e (e.id)}
							<li class="flex items-center justify-between gap-3 px-4 py-2">
								<span class="min-w-0 text-xs">{e.label}</span>
								<span class="flex shrink-0 items-center gap-2 text-[11px] font-bold text-muted">
									{#if e.xp?.length}<span class="text-accent">+{e.xp.reduce((s, x) => s + x.amount, 0)}</span>{/if}
									<LootLine loot={e.loot} signed size={10} />
								</span>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		{/if}

		{#if dayPerfect}
			<p class="flex items-center justify-center gap-2 text-xs font-bold text-reward"><Sparkles size={14} /> Le secteur {sector.name} brille de tous ses feux.</p>
		{/if}
	</aside>
</div>

<style>
	.cockpit {
		background:
			radial-gradient(120% 90% at 0% 0%, color-mix(in oklab, var(--accent) 22%, transparent), transparent 55%),
			radial-gradient(80% 70% at 100% 100%, color-mix(in oklab, var(--reward) 14%, transparent), transparent 60%),
			linear-gradient(180deg, var(--surface), var(--raised));
		box-shadow: 0 24px 60px -34px var(--shadow);
	}
	.cockpit::before {
		content: '';
		position: absolute;
		inset: 0;
		background-image:
			radial-gradient(1.5px 1.5px at 18% 30%, var(--star), transparent),
			radial-gradient(1px 1px at 42% 14%, var(--star), transparent),
			radial-gradient(1px 1px at 64% 58%, var(--star), transparent),
			radial-gradient(1.5px 1.5px at 8% 78%, var(--star), transparent),
			radial-gradient(1px 1px at 52% 82%, var(--star), transparent);
		pointer-events: none;
	}
	.planet {
		animation: drift 18s ease-in-out infinite alternate;
	}
	@keyframes drift {
		to {
			transform: translate(-8px, 6px) rotate(4deg);
		}
	}
	.toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		border-radius: 999px;
		border: 1px solid var(--line);
		background: color-mix(in oklab, var(--surface) 80%, transparent);
		padding: 0.35rem 0.8rem;
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--muted);
		backdrop-filter: blur(6px);
		transition: all 0.15s;
	}
	.toggle:hover {
		color: var(--ink);
	}
	.toggle.on {
		border-color: var(--accent);
		background: var(--accent-soft);
		color: var(--ink);
	}
	.moment.is-done {
		border-color: color-mix(in oklab, var(--done) 35%, var(--line));
	}
	.transmission {
		background:
			linear-gradient(90deg, color-mix(in oklab, var(--accent) 7%, transparent), transparent 40%),
			var(--surface);
	}
</style>
