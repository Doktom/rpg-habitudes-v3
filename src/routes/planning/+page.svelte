<script lang="ts">
	import PageHint from '#lib/components/PageHint.svelte';
	import {
		BedDouble,
		CalendarClock,
		CalendarDays,
		CalendarRange,
		Check,
		ChevronLeft,
		ChevronRight,
		Clock,
		GripVertical,
		ListTodo,
		Music,
		Orbit,
		PartyPopper,
		Plus,
		Repeat,
		Sun,
		Telescope,
		X
	} from '@lucide/svelte';
	import { onMount } from 'svelte';
	import ConfirmButton from '#lib/components/ConfirmButton.svelte';
	import LootLine from '#lib/components/LootLine.svelte';
	import Segmented from '#lib/components/Segmented.svelte';
	import { addDays, formatLong, formatShort, parse, range, startOfWeek, today, WEEKDAYS_SHORT, weekday } from '#lib/dates.ts';
	import { danceClassesOn, isDueOn, partiesOn } from '#lib/engine/schedule.ts';
	import { DANCE_LABEL, DIFFICULTY_LABEL } from '#lib/labels.ts';
	import { store, uid } from '#lib/store.svelte.ts';
	import { toasts } from '#lib/toasts.svelte.ts';
	import type { Difficulty, ISODate, Task, TaskList } from '#lib/types.ts';
	import { SECTORS } from '#lib/universe.ts';

	const data = $derived(store.data);
	const HOURS = Array.from({ length: 17 }, (_, i) => i + 7); // 7 h → 23 h
	const ROW = 44; // px par heure

	const LISTS: { id: TaskList; label: string; icon: typeof Sun }[] = [
		{ id: 'today', label: "Aujourd'hui", icon: Sun },
		{ id: 'week', label: 'Cette semaine', icon: CalendarRange },
		{ id: 'month', label: 'Ce mois-ci', icon: CalendarDays },
		{ id: 'someday', label: 'Un jour', icon: Telescope }
	];
	const EFFORTS = (Object.entries(DIFFICULTY_LABEL) as [Difficulty, string][]).map(([value, label]) => ({ value, label }));
	const VIEWS = [
		{ value: 'day' as const, label: 'Jour', icon: Sun },
		{ value: 'week' as const, label: 'Semaine', icon: CalendarRange }
	];

	// Le jour choisi pilote tout : la semaine affichée est celle qui le contient.
	let selDay = $state(today());
	let view = $state<'day' | 'week'>('week');
	const weekStart = $derived(startOfWeek(selDay));
	const days = $derived(range(weekStart, addDays(weekStart, 6)));
	const columns = $derived(view === 'week' ? days : [selDay]);
	const isCurrentWeek = $derived(weekStart === startOfWeek(today()));

	let newTask = $state<Record<TaskList, string>>({ today: '', week: '', month: '', someday: '' });
	let editing = $state<Task | null>(null);
	let isNew = $state(false);
	let dragId = $state<string | null>(null);
	let overSlot = $state<string | null>(null);
	let nowMin = $state(minutesNow());
	let scroller = $state<HTMLDivElement>();
	let editor = $state<HTMLFormElement>();
	let titleInput = $state<HTMLInputElement>();
	const editingId = $derived(editing?.id);

	// À l'ouverture de la fiche : on la ramène à l'écran, et le titre prend la main pour une création.
	$effect(() => {
		if (!editingId || !editor) return;
		editor.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
		if (isNew) titleInput?.focus({ preventScroll: true });
	});

	onMount(() => {
		// Sur mobile, l'agenda d'un seul jour est plus lisible.
		if (window.matchMedia('(max-width: 1023px)').matches) view = 'day';
		// L'agenda s'ouvre une heure avant maintenant (ou à 8 h hors des heures affichées).
		const hour = nowMin >= HOURS[0] * 60 && nowMin < 23 * 60 ? Math.floor(nowMin / 60) - 1 : 8;
		scroller?.scrollTo({ top: Math.max(0, hour - HOURS[0]) * ROW });
		const timer = setInterval(() => (nowMin = minutesNow()), 60_000);
		return () => clearInterval(timer);
	});

	function minutesNow() {
		const d = new Date();
		return d.getHours() * 60 + d.getMinutes();
	}

	const sectorOf = (d: ISODate) => SECTORS[(weekday(d) + 6) % 7];
	const unscheduled = (list: TaskList) => data.tasks.filter((t) => t.list === list && !t.start && !t.done);
	const domain = (id?: string) => data.domains.find((d) => d.id === id);

	const toMin = (t: string) => +t.slice(0, 2) * 60 + +t.slice(3, 5);
	const toTime = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

	type Kind = 'dance' | 'party' | 'habit' | 'task';
	interface Block {
		id: string;
		label: string;
		start: number;
		end: number;
		kind: Kind;
		task?: Task;
	}

	const KIND_STYLE: Record<Kind, string> = {
		dance: 'border-pink-400 bg-pink-200 text-pink-900',
		party: 'border-fuchsia-400 bg-fuchsia-200 text-fuchsia-900',
		habit: 'border-teal-400 bg-teal-100 text-teal-900',
		task: 'border-accent bg-accent-soft text-ink'
	};
	const KIND_ICON = { dance: Music, party: PartyPopper, habit: Repeat, task: ListTodo } as const;

	function blocks(d: ISODate): Block[] {
		const out: Block[] = [];
		for (const c of danceClassesOn(data, d))
			out.push({ id: c.id, label: DANCE_LABEL[c.style], start: toMin(c.time), end: toMin(c.time) + c.durationMin, kind: 'dance' });
		for (const p of partiesOn(data, d))
			out.push({ id: p.id, label: 'Soirée ' + p.styles.map((s) => DANCE_LABEL[s]).join('/'), start: toMin(p.time), end: toMin(p.time) + 180, kind: 'party' });
		for (const h of data.habits)
			if (h.slot && isDueOn(h, d)) out.push({ id: h.id, label: h.name, start: toMin(h.slot), end: toMin(h.slot) + 30, kind: 'habit' });
		for (const t of data.tasks)
			if (t.date === d && t.start)
				out.push({ id: t.id, label: t.title, start: toMin(t.start), end: t.end ? toMin(t.end) : toMin(t.start) + 60, kind: 'task', task: t });
		return out.sort((a, b) => a.start - b.start);
	}

	// Nombre d'éléments par jour, pour le bandeau des secteurs.
	const load = (d: ISODate) => blocks(d).length;

	function step(dir: 1 | -1) {
		selDay = addDays(selDay, dir * (view === 'week' ? 7 : 1));
	}

	function drop(d: ISODate, hour: number) {
		const t = data.tasks.find((x) => x.id === dragId);
		dragId = null;
		overSlot = null;
		if (!t) return;
		const duration = t.start && t.end ? toMin(t.end) - toMin(t.start) : 60;
		t.date = d;
		t.start = toTime(hour * 60);
		t.end = toTime(hour * 60 + duration);
		store.saveTask(t);
	}

	function add(list: TaskList) {
		const title = newTask[list].trim();
		if (!title) return;
		store.saveTask({ id: uid(), title, list, date: list === 'today' ? today() : undefined });
		newTask[list] = '';
	}

	const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

	function edit(t: Task) {
		editing = clone(t);
		isNew = false;
	}

	// Un clic sur un créneau vide prépare une tâche à cette heure-là.
	function createAt(d: ISODate, hour: number) {
		editing = { id: uid(), title: '', list: d === today() ? 'today' : 'week', date: d, start: toTime(hour * 60), end: toTime(hour * 60 + 60) };
		isNew = true;
	}

	function save(e: SubmitEvent) {
		e.preventDefault();
		if (!editing || !editing.title.trim()) return;
		editing.title = editing.title.trim();
		store.saveTask(editing);
		editing = null;
	}

	function unschedule() {
		editing!.start = undefined;
		editing!.end = undefined;
		store.saveTask(editing!);
		editing = null;
	}

	function finish() {
		const t = data.tasks.find((x) => x.id === editing?.id);
		editing = null;
		if (!t) return;
		const finishing = !t.done;
		store.toggleTask(t);
		if (!finishing) return;
		const ev = data.events.find((x) => x.source === `task:${t.id}`);
		toasts.push({ title: 'Tâche terminée', xp: ev?.xp?.reduce((s, x) => s + x.amount, 0), loot: ev?.loot });
	}

	const reward = $derived(editing ? store.taskReward(editing.effort) : null);
	const editingDone = $derived(!!editing && !isNew && !!data.tasks.find((t) => t.id === editing!.id)?.done);
</script>

<!-- En-tête et navigation -->
<header class="mb-5 flex flex-wrap items-end justify-between gap-4">
	<div class="min-w-0">
		<div class="eyebrow mb-1 flex items-center gap-1.5 text-accent">
			<Orbit size={13} strokeWidth={2.4} />
			{#if view === 'day'}Secteur {sectorOf(selDay).name}{:else}Orbite du {formatShort(weekStart)} au {formatShort(addDays(weekStart, 6))}{/if}
		</div>
		<div class="-ml-2 flex items-center gap-0.5">
			<button class="btn btn-ghost h-9 w-9 p-0" onclick={() => step(-1)} aria-label={view === 'week' ? 'Semaine précédente' : 'Jour précédent'}><ChevronLeft size={20} /></button>
			<h1 class="text-2xl font-black tracking-tight capitalize sm:text-3xl">
				{view === 'week' ? 'Planning' : formatLong(selDay)}
			</h1>
			<button class="btn btn-ghost h-9 w-9 p-0" onclick={() => step(1)} aria-label={view === 'week' ? 'Semaine suivante' : 'Jour suivant'}><ChevronRight size={20} /></button>
		</div>
		<p class="text-sm text-muted">Glisse une tâche dans un créneau, ou touche un créneau vide pour en créer une.</p>
	</div>
	<div class="flex flex-wrap items-center gap-2">
		{#if selDay !== today()}
			<button class="btn text-xs" onclick={() => (selDay = today())}>{isCurrentWeek && view === 'week' ? "Aujourd'hui" : 'Revenir à aujourd’hui'}</button>
		{/if}
		<Segmented options={VIEWS} bind:value={view} label="Vue de l'agenda" />
	</div>
</header>

<PageHint id="planning" title="La carte des secteurs">Ta semaine vue d'en haut : clique sur un créneau pour y poser une tâche, et vérifie que la charge reste tenable.</PageHint>


<!-- Les sept secteurs de l'orbite -->
<div class="mb-4 grid grid-cols-7 gap-1.5" role="group" aria-label="Jours de la semaine">
	{#each days as d (d)}
		{@const n = load(d)}
		{@const selected = view === 'day' && d === selDay}
		<button
			class="flex flex-col items-center gap-0.5 rounded-2xl border px-1 py-2 transition-colors {selected
				? 'border-accent bg-accent text-on-accent'
				: d === today()
					? 'border-accent bg-accent-soft'
					: 'border-line bg-surface hover:bg-raised'}"
			aria-pressed={selected}
			aria-label="{formatLong(d)}, {n} élément{n > 1 ? 's' : ''}"
			onclick={() => {
				selDay = d;
				view = 'day';
			}}
		>
			<span class="text-[10px] font-bold tracking-wide uppercase {selected ? '' : 'text-muted'}">{WEEKDAYS_SHORT[weekday(d)]}</span>
			<span class="text-lg leading-none font-black tabular-nums">{parse(d).getUTCDate()}</span>
			<span class="hidden text-[10px] font-semibold sm:block {selected ? '' : 'text-muted'}">{sectorOf(d).name}</span>
			<span class="flex h-2 items-center gap-0.5">
				{#if data.restDays.includes(d)}
					<BedDouble size={11} strokeWidth={2.4} class={selected ? '' : 'text-muted'} />
				{:else}
					{#each Array(Math.min(n, 4)) as _, i (i)}<span class="h-1 w-1 rounded-full {selected ? 'bg-on-accent' : 'bg-accent'}"></span>{/each}
				{/if}
			</span>
		</button>
	{/each}
</div>

<!-- Fiche d'une tâche planifiée (ou en création) -->
{#if editing}
	<form bind:this={editor} class="card mb-4 flex scroll-mt-4 flex-col gap-3 border-accent" onsubmit={save}>
		<div class="flex items-center justify-between gap-2">
			<h2 class="flex items-center gap-2 font-extrabold"><CalendarClock size={16} strokeWidth={2.3} class="text-accent" />{isNew ? 'Nouveau créneau' : 'Créneau'}</h2>
			<button type="button" class="btn btn-ghost h-8 w-8 p-0 text-muted" onclick={() => (editing = null)} aria-label="Fermer"><X size={16} /></button>
		</div>
		<div class="grid gap-3 sm:grid-cols-6">
			<div class="sm:col-span-3">
				<label class="label" for="t-title">Tâche</label>
				<input id="t-title" class="input" bind:this={titleInput} bind:value={editing.title} placeholder="Que faut-il caser ici ?" />
			</div>
			<div class="sm:col-span-1">
				<label class="label" for="t-date">Date</label>
				<input id="t-date" class="input" type="date" bind:value={editing.date} />
			</div>
			<div>
				<label class="label" for="t-start">Début</label>
				<input id="t-start" class="input" type="time" bind:value={editing.start} />
			</div>
			<div>
				<label class="label" for="t-end">Fin</label>
				<input id="t-end" class="input" type="time" bind:value={editing.end} />
			</div>
		</div>
		<div class="flex flex-wrap items-center gap-2">
			<Segmented options={EFFORTS} value={editing.effort ?? 'easy'} label="Effort" size="xs" onchange={(v) => (editing!.effort = v)} />
			{#if reward}
				<span class="flex items-center gap-1.5 text-xs font-semibold text-muted">
					Rapporte <span class="font-black text-accent">+{reward.xp} XP</span>
					<LootLine loot={reward.loot} signed size={11} />
				</span>
			{/if}
		</div>
		<div class="flex flex-wrap items-center gap-2">
			<button class="btn btn-primary" disabled={!editing.title.trim()}>{isNew ? 'Ajouter' : 'Enregistrer'}</button>
			{#if !isNew}
				<button type="button" class="btn" onclick={finish}><Check size={15} strokeWidth={2.6} />{editingDone ? 'Rouvrir' : 'Terminer'}</button>
				<button type="button" class="btn btn-ghost" onclick={unschedule}>Retirer de l'agenda</button>
				<ConfirmButton
					class="btn btn-ghost ml-auto text-xs"
					label="Supprimer"
					confirmLabel="Supprimer ?"
					onconfirm={() => {
						store.removeTask(editing!.id);
						editing = null;
					}}
				/>
			{/if}
		</div>
	</form>
{/if}

<div class="flex flex-col gap-4 lg:flex-row">
	<!-- Agenda -->
	<section class="card min-w-0 flex-1 overflow-hidden p-0" aria-label="Agenda">
		<div bind:this={scroller} class="max-h-[72vh] overflow-auto px-2 pb-3 sm:px-3 {view === 'day' ? 'pt-3' : ''}">
		<div class="grid {view === 'week' ? 'min-w-[640px]' : ''}" style="grid-template-columns: 40px repeat({columns.length}, minmax(0, 1fr));">
			{#if view === 'week'}
				<div class="sticky top-0 z-20 bg-surface"></div>
				{#each columns as d (d)}
					<button
						class="sticky top-0 z-20 mb-2 bg-surface pt-2.5 pb-1.5 text-center text-xs font-bold transition-colors hover:text-ink {d === today() ? 'text-accent' : 'text-muted'}"
						onclick={() => {
							selDay = d;
							view = 'day';
						}}
					>
						{WEEKDAYS_SHORT[weekday(d)]} {parse(d).getUTCDate()}
						{#if data.restDays.includes(d)}<span class="block text-[10px] font-semibold">repos</span>{/if}
					</button>
				{/each}
			{/if}

			<!-- Heures -->
			<div class="relative" style="height: {HOURS.length * ROW}px">
				{#each HOURS as h, i (h)}
					<div class="absolute right-1.5 text-[10px] font-semibold text-muted tabular-nums" style="top: {i * ROW - 6}px">{h}h</div>
				{/each}
			</div>

			{#each columns as d (d)}
				{@const isToday = d === today()}
				<div class="relative border-l border-line {isToday && view === 'week' ? 'bg-accent-soft/40' : ''}" style="height: {HOURS.length * ROW}px">
					{#each HOURS as h, i (h)}
						{@const key = `${d}-${h}`}
						<button
							type="button"
							tabindex="-1"
							aria-label="Créer une tâche le {formatShort(d)} à {h} h"
							class="absolute inset-x-0 cursor-cell border-t border-line/60 transition-colors hover:bg-raised {overSlot === key ? 'bg-accent-soft' : ''}"
							style="top: {i * ROW}px; height: {ROW}px"
							ondragover={(e) => {
								e.preventDefault();
								overSlot = key;
							}}
							ondragleave={() => overSlot === key && (overSlot = null)}
							ondrop={() => drop(d, h)}
							onclick={() => createAt(d, h)}
						></button>
					{/each}

					{#each blocks(d) as b (b.id)}
						{@const top = ((b.start - HOURS[0] * 60) / 60) * ROW}
						{@const height = Math.max(20, ((b.end - b.start) / 60) * ROW - 3)}
						{@const Icon = KIND_ICON[b.kind]}
						{@const done = !!b.task?.done}
						{#if top >= 0}
							<button
								type="button"
								class="absolute inset-x-1 flex flex-col overflow-hidden rounded-lg border-l-[3px] px-1.5 py-0.5 text-left text-[11px] leading-tight shadow-sm {done
									? 'border-line bg-raised text-muted line-through'
									: KIND_STYLE[b.kind]} {b.task ? 'cursor-grab' : 'cursor-default'}"
								style="top: {top + 1}px; height: {height}px"
								draggable={!!b.task}
								ondragstart={() => b.task && (dragId = b.task.id)}
								ondragend={() => (overSlot = null)}
								onclick={() => b.task && edit(b.task)}
								title="{b.label} · {toTime(b.start)}–{toTime(b.end)}"
							>
								<span class="flex items-center gap-1 font-bold">
									<Icon size={11} strokeWidth={2.6} class="shrink-0" />
									<span class="truncate">{b.label}</span>
								</span>
								{#if height >= 34}
									<span class="truncate text-[10px] font-semibold opacity-75 tabular-nums">{toTime(b.start)} – {toTime(b.end)}</span>
								{/if}
							</button>
						{/if}
					{/each}

					<!-- Maintenant -->
					{#if isToday && nowMin >= HOURS[0] * 60 && nowMin < (HOURS[HOURS.length - 1] + 1) * 60}
						<div class="pointer-events-none absolute inset-x-0 z-10 flex items-center" style="top: {((nowMin - HOURS[0] * 60) / 60) * ROW}px">
							<span class="-ml-1 h-2 w-2 rounded-full bg-rose-500"></span>
							<span class="h-0.5 flex-1 bg-rose-500"></span>
						</div>
					{/if}
				</div>
			{/each}
		</div>
		</div>
	</section>

	<!-- Listes à caser -->
	<aside class="flex shrink-0 flex-col gap-3 lg:w-64">
		<div class="eyebrow flex items-center gap-1.5 px-1"><GripVertical size={12} strokeWidth={2.4} /> À caser dans l'agenda</div>
		{#each LISTS as l (l.id)}
			{@const items = unscheduled(l.id)}
			<section class="card p-2">
				<h2 class="flex items-center gap-2 px-1.5 pt-0.5 pb-1.5">
					<l.icon size={15} strokeWidth={2.3} class="text-accent" />
					<span class="text-sm font-extrabold">{l.label}</span>
					<span class="chip bg-zinc-100 text-muted">{items.length}</span>
				</h2>
				<ul class="mb-1.5 flex flex-col gap-1">
					{#each items as t (t.id)}
						{@const dom = domain(t.domainId)}
						<li>
							<button
								draggable="true"
								ondragstart={() => (dragId = t.id)}
								ondragend={() => (overSlot = null)}
								onclick={() => edit(t)}
								class="group flex w-full cursor-grab items-center gap-1.5 rounded-xl border border-line bg-raised px-2 py-1.5 text-left text-sm transition-colors hover:border-accent"
							>
								<GripVertical size={13} class="shrink-0 text-muted opacity-50 group-hover:opacity-100" />
								{#if dom}<span class="h-2 w-2 shrink-0 rounded-full" style="background:{dom.color}" title={dom.name}></span>{/if}
								<span class="min-w-0 flex-1 truncate font-semibold">{t.title}</span>
								{#if t.date}<span class="flex shrink-0 items-center gap-0.5 text-[10px] font-semibold text-muted"><Clock size={10} />{formatShort(t.date)}</span>{/if}
							</button>
						</li>
					{/each}
				</ul>
				<form class="flex gap-1" onsubmit={(e) => (e.preventDefault(), add(l.id))}>
					<input class="input py-1 text-xs" placeholder="Ajouter…" bind:value={newTask[l.id]} aria-label="Nouvelle tâche, {l.label}" />
					<button class="btn h-7 w-7 shrink-0 p-0" aria-label="Ajouter à {l.label}"><Plus size={14} /></button>
				</form>
			</section>
		{/each}
	</aside>
</div>
