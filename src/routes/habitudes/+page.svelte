<script lang="ts">
	import {
		Archive,
		ArrowDown,
		ArrowUp,
		ChevronDown,
		Flame,
		Lightbulb,
		ListChecks,
		MoonStar,
		Pencil,
		Plus,
		Repeat,
		RotateCcw,
		Sunrise,
		SunMedium,
		X
	} from '@lucide/svelte';
	import Segmented from '#lib/components/Segmented.svelte';
	import WeekDots from '#lib/components/WeekDots.svelte';
	import { addDays, formatShort, range, today, WEEKDAYS_SHORT, weekday } from '#lib/dates.ts';
	import { habitStreak, habitWeekDays, habitWeekStreak } from '#lib/engine/regularity.ts';
	import { isDueOn, isRestDay } from '#lib/engine/schedule.ts';
	import { DIFFICULTY_LABEL, MOMENT_LABEL } from '#lib/labels.ts';
	import { store, uid } from '#lib/store.svelte.ts';
	import { HABIT_IDEAS } from '#lib/templates.ts';
	import { toasts } from '#lib/toasts.svelte.ts';
	import type { Difficulty, Exercise, Habit, Moment } from '#lib/types.ts';

	const data = $derived(store.data);
	const active = $derived(data.habits.filter((h) => !h.archived));
	const archived = $derived(data.habits.filter((h) => h.archived));
	const domains = $derived(data.domains);
	const t = today();

	let form = $state<Habit | null>(null);
	let isNew = $state(false);
	let advanced = $state(false);
	let routineFor = $state<Habit | null>(null);
	let exercises = $state<Exercise[]>([]);
	let sessionsText = $state('');
	let newCat = $state<{ name: string; stat: string; color: string } | null>(null);
	let showIdeas = $state(false);
	let showArchived = $state(false);

	const CAT_COLORS = ['#db2777', '#ea580c', '#0d9488', '#2563eb', '#ca8a04', '#16a34a', '#7c3aed', '#64748b'];
	const CUES = ['Au saut du lit', 'Après le café', 'Après le dîner', 'En rentrant du travail', 'Pendant la pause du midi', 'Avant de me coucher'];
	const MOMENTS: Moment[] = ['morning', 'day', 'evening'];
	const MOMENT_ICON = { morning: Sunrise, day: SunMedium, evening: MoonStar } as const;
	const KINDS = [
		{ value: 'bonus' as const, label: 'Bonus' },
		{ value: 'obligatory' as const, label: 'Obligatoire' }
	];
	const FREQS = [
		{ value: 'daily' as const, label: 'Tous les jours' },
		{ value: 'weekly' as const, label: 'X fois / sem.' },
		{ value: 'days' as const, label: 'Jours fixes' }
	];
	const DIFFS = (Object.entries(DIFFICULTY_LABEL) as [Difficulty, string][]).map(([value, label]) => ({ value, label }));
	const MOMENT_OPTIONS = MOMENTS.map((m) => ({ value: m, label: MOMENT_LABEL[m], icon: MOMENT_ICON[m] }));

	const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
	const domainOf = (id: string) => domains.find((d) => d.id === id);
	// Idées pas encore suivies (par nom), pour ne pas proposer un doublon.
	const ideas = $derived(HABIT_IDEAS.filter((i) => !active.some((h) => h.name.toLowerCase() === i.name.toLowerCase())));

	// Réussite sur les 28 derniers jours (jours dus, repos exclus) ; pour « X fois par semaine », séances / objectif.
	function rate(h: Habit): number | null {
		const from = addDays(t, -28) < h.createdAt ? h.createdAt : addDays(t, -28);
		const days = range(from, addDays(t, -1));
		if (h.frequency.type === 'weekly') {
			const count = data.habitLogs.filter((l) => l.habitId === h.id && l.date >= from && l.date < t).length;
			const expected = Math.max(1, Math.round((days.length / 7) * h.frequency.times));
			return days.length >= 7 ? Math.min(100, Math.round((100 * count) / expected)) : null;
		}
		let expected = 0;
		let done = 0;
		for (const d of days) {
			if (!isDueOn(h, d) || isRestDay(data, d)) continue;
			expected++;
			if (data.habitLogs.some((l) => l.habitId === h.id && l.date === d)) done++;
		}
		return expected >= 3 ? Math.round((100 * done) / expected) : null;
	}

	function freqLabel(h: Habit) {
		const f = h.frequency;
		if (f.type === 'daily') return 'Tous les jours';
		if (f.type === 'weekly') return `${f.times} fois par semaine`;
		return f.days.map((d) => WEEKDAYS_SHORT[d]).join(', ');
	}

	function newHabit(): Habit {
		return {
			id: uid(),
			name: '',
			form: 'simple',
			kind: 'bonus', // commencer en bonus : on construit l'habitude avant d'en faire une obligation
			frequency: { type: 'daily' },
			tiers: { min: '', normal: '', excellent: '' },
			moment: 'day',
			difficulty: 'easy',
			domains: [{ domainId: domains[0]?.id ?? 'bienetre', weight: 100 }],
			createdAt: t
		};
	}

	function edit(h?: Habit) {
		form = h ? clone(h) : newHabit();
		isNew = !h;
		advanced = false;
		newCat = null;
		sessionsText = (form.sessions ?? []).join(', ');
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	function setFreqType(type: 'daily' | 'weekly' | 'days') {
		if (!form) return;
		form.frequency = type === 'daily' ? { type } : type === 'weekly' ? { type, times: 3 } : { type, days: [1, 3, 5] };
	}

	function toggleDay(d: number) {
		if (form?.frequency.type !== 'days') return;
		const days = form.frequency.days;
		form.frequency.days = days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort();
	}

	function setSecondary(id: string) {
		if (!form) return;
		const first = form.domains[0];
		if (!id) form.domains = [{ domainId: first.domainId, weight: 100 }];
		else form.domains = [{ domainId: first.domainId, weight: Math.min(first.weight, 70) }, { domainId: id, weight: 100 - Math.min(first.weight, 70) }];
	}

	function setPrimaryWeight(w: number) {
		if (!form || form.domains.length < 2) return;
		form.domains[0].weight = w;
		form.domains[1].weight = 100 - w;
	}

	function addCategory() {
		if (!form || !newCat || !newCat.name.trim()) return;
		const name = newCat.name.trim();
		const slug = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-');
		const id = `${slug}-${uid().slice(0, 4)}`;
		store.saveDomain({ id, name, stat: newCat.stat.trim() || name, color: newCat.color });
		form.domains[0].domainId = id;
		newCat = null;
	}

	function save(e: SubmitEvent) {
		e.preventDefault();
		if (!form || !form.name.trim()) return;
		form.name = form.name.trim();
		form.cue = form.cue?.trim() || undefined;
		// Un palier vide reprend le précédent : l'habitude reste utilisable sans tout remplir.
		form.tiers.normal ||= form.tiers.min;
		form.tiers.excellent ||= form.tiers.normal;
		if (form.form === 'program') form.sessions = sessionsText.split(',').map((s) => s.trim()).filter(Boolean);
		if (form.form === 'routine' && !form.routine) form.routine = [{ from: t, exercises: [] }];
		store.saveHabit(form);
		toasts.push({ title: isNew ? `Nouvelle habitude : ${form.name}` : `${form.name} enregistrée` });
		form = null;
	}

	function adopt(i: (typeof HABIT_IDEAS)[number]) {
		const h = store.addHabitIdea(i);
		toasts.push({ title: `${h.name} ajoutée en bonus` });
	}

	function openRoutine(h: Habit) {
		routineFor = h;
		exercises = clone(h.routine?.at(-1)?.exercises ?? []);
	}

	function move(i: number, dir: -1 | 1) {
		const j = i + dir;
		if (j < 0 || j >= exercises.length) return;
		[exercises[i], exercises[j]] = [exercises[j], exercises[i]];
	}

	const obligatoryCount = $derived(active.filter((h) => h.kind === 'obligatory').length);
	const bestStreak = $derived(Math.max(0, ...active.map((h) => (h.frequency.type === 'weekly' ? 0 : habitStreak(data, h, t)))));
	const dayIndex = (weekday(t) + 6) % 7;
</script>

<!-- En-tête -->
<header class="mb-5 flex flex-wrap items-end justify-between gap-4">
	<div>
		<div class="eyebrow mb-1 flex items-center gap-1.5 text-accent"><Repeat size={13} strokeWidth={2.4} /> Routines de bord</div>
		<h1 class="text-3xl font-black tracking-tight">Habitudes</h1>
		<p class="text-sm text-muted">Petit et accroché à un moment précis : c'est ce qui tient. Les nouvelles habitudes démarrent en bonus.</p>
	</div>
	<div class="grid grid-cols-3 gap-2">
		{#each [{ n: active.length, l: 'suivies' }, { n: obligatoryCount, l: 'obligatoires' }, { n: bestStreak, l: 'meilleure série' }] as s (s.l)}
			<div class="card min-w-24 px-3 py-2 text-center">
				<div class="text-xl font-black tabular-nums">{s.n}</div>
				<div class="text-[11px] leading-tight font-semibold text-muted">{s.l}</div>
			</div>
		{/each}
	</div>
</header>

<div class="mb-5 flex flex-wrap gap-2">
	<button class="btn btn-primary" onclick={() => edit()}><Plus size={16} strokeWidth={2.6} /> Nouvelle habitude</button>
	<button class="btn" aria-expanded={showIdeas} onclick={() => (showIdeas = !showIdeas)}><Lightbulb size={15} /> Idées à essayer ({ideas.length})</button>
</div>

<!-- Catalogue -->
{#if showIdeas}
	<section class="mb-5">
		<div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
			{#each ideas as i (i.key)}
				<div class="card flex flex-col gap-1.5 p-3.5">
					<div class="flex items-center gap-2">
						<span class="h-2.5 w-2.5 shrink-0 rounded-full" style="background:{i.domain.color}"></span>
						<span class="font-extrabold">{i.name}</span>
						<span class="ml-auto text-[11px] font-semibold text-muted">{MOMENT_LABEL[i.moment]}</span>
					</div>
					<p class="text-xs text-muted">{i.why}</p>
					<p class="text-xs"><span class="font-bold">{i.cue}</span> · <span class="text-muted">dès {i.tiers[0]}</span></p>
					<button class="btn mt-auto self-start text-xs" onclick={() => adopt(i)}><Plus size={13} /> Essayer</button>
				</div>
			{:else}
				<p class="card text-sm text-muted">Tu suis déjà toutes les idées du catalogue.</p>
			{/each}
		</div>
	</section>
{/if}

<!-- Formulaire -->
{#if form}
	<form class="card mb-5 flex flex-col gap-4 border-accent" onsubmit={save}>
		<div class="flex items-center justify-between">
			<h2 class="font-extrabold">{isNew ? 'Nouvelle habitude' : `Modifier : ${form.name}`}</h2>
			<button type="button" class="btn btn-ghost h-8 w-8 p-0 text-muted" onclick={() => (form = null)} aria-label="Fermer"><X size={16} /></button>
		</div>

		<div class="grid gap-3 sm:grid-cols-2">
			<div>
				<label class="label" for="h-name">Nom</label>
				<input id="h-name" class="input" bind:value={form.name} placeholder="ex. Lecture" required {@attach (el) => {
					if (isNew) el.focus();
				}} />
			</div>
			<div>
				<label class="label" for="h-cue">Déclencheur : quand ou après quoi ?</label>
				<input id="h-cue" class="input" bind:value={form.cue} placeholder="ex. Après le café du matin" list="cue-ideas" />
				<datalist id="cue-ideas">{#each CUES as c (c)}<option value={c}></option>{/each}</datalist>
			</div>
		</div>
		<p class="-mt-2 flex items-start gap-1.5 text-[11px] text-muted">
			<Lightbulb size={12} class="mt-0.5 shrink-0 text-accent" /> Accrocher l'habitude à un geste que tu fais déjà (« Après le café, je lis ») aide nettement à passer à l'acte.
		</p>

		<div class="flex flex-col gap-3">
			<div class="flex flex-wrap items-center gap-3">
				<span class="label mb-0 w-20">Type</span>
				<Segmented options={KINDS} bind:value={form.kind} label="Type" size="xs" />
				<span class="text-[11px] text-muted">{form.kind === 'bonus' ? 'Rapporte, ne coûte jamais rien.' : 'Compte pour la Discipline et la journée complète.'}</span>
			</div>
			<div class="flex flex-wrap items-center gap-3">
				<span class="label mb-0 w-20">Fréquence</span>
				<Segmented options={FREQS} value={form.frequency.type} label="Fréquence" size="xs" onchange={(v) => setFreqType(v)} />
				{#if form.frequency.type === 'weekly'}
					<input class="input w-16 py-1 text-xs" type="number" min="1" max="7" bind:value={form.frequency.times} aria-label="Fois par semaine" />
				{:else if form.frequency.type === 'days'}
					<div class="flex flex-wrap gap-1">
						{#each [1, 2, 3, 4, 5, 6, 0] as d (d)}
							<button
								type="button"
								aria-pressed={form.frequency.days.includes(d)}
								class="h-7 w-9 rounded-lg border text-[11px] font-bold {form.frequency.days.includes(d) ? 'border-accent bg-accent text-on-accent' : 'border-line bg-raised text-muted'}"
								onclick={() => toggleDay(d)}>{WEEKDAYS_SHORT[d]}</button
							>
						{/each}
					</div>
				{/if}
			</div>
			<div class="flex flex-wrap items-center gap-3">
				<span class="label mb-0 w-20">Moment</span>
				<Segmented options={MOMENT_OPTIONS} bind:value={form.moment} label="Moment" size="xs" />
			</div>
			<div class="flex flex-wrap items-center gap-3">
				<span class="label mb-0 w-20">Effort</span>
				<Segmented options={DIFFS} bind:value={form.difficulty} label="Difficulté" size="xs" />
			</div>
		</div>

		<div>
			<span class="label">Paliers : le minimum doit tenir les mauvais jours</span>
			<div class="grid gap-2 sm:grid-cols-3">
				<input class="input" bind:value={form.tiers.min} placeholder="Minimum, ex. 5 min" aria-label="Palier minimum" />
				<input class="input" bind:value={form.tiers.normal} placeholder="Normal, ex. 10 min" aria-label="Palier normal" />
				<input class="input" bind:value={form.tiers.excellent} placeholder="Excellent, ex. 30 min" aria-label="Palier excellent" />
			</div>
		</div>

		<div>
			<label class="label" for="h-dom">Stat qui reçoit l'XP</label>
			<div class="flex flex-wrap gap-2">
				<select id="h-dom" class="input w-auto" bind:value={form.domains[0].domainId}>
					{#each domains as d (d.id)}<option value={d.id}>{d.name} ({d.stat})</option>{/each}
				</select>
				{#if !newCat}
					<button type="button" class="btn btn-ghost text-xs" onclick={() => (newCat = { name: '', stat: '', color: CAT_COLORS[0] })}><Plus size={13} /> Nouvelle catégorie</button>
				{/if}
			</div>
			{#if newCat}
				<div class="mt-2 grid gap-2 rounded-xl border border-dashed border-line p-3 sm:grid-cols-4">
					<input class="input" bind:value={newCat.name} placeholder="Catégorie, ex. Cuisine" aria-label="Nom de la catégorie" />
					<input class="input" bind:value={newCat.stat} placeholder="Stat, ex. Gourmandise" aria-label="Nom de la stat" />
					<div class="flex flex-wrap items-center gap-1">
						{#each CAT_COLORS as c (c)}
							<button
								type="button"
								aria-label="Couleur {c}"
								class="h-6 w-6 rounded-full {newCat.color === c ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface' : ''}"
								style="background:{c}"
								onclick={() => newCat && (newCat.color = c)}
							></button>
						{/each}
					</div>
					<div class="flex gap-2">
						<button type="button" class="btn btn-primary text-xs" onclick={addCategory}>Créer</button>
						<button type="button" class="btn btn-ghost text-xs" onclick={() => (newCat = null)}>Annuler</button>
					</div>
				</div>
			{/if}
		</div>

		<button type="button" class="flex items-center gap-1.5 self-start text-xs font-bold text-muted hover:text-ink" aria-expanded={advanced} onclick={() => (advanced = !advanced)}>
			<ChevronDown size={14} class="transition-transform {advanced ? 'rotate-180' : ''}" /> Plus d'options (forme, créneau, stat secondaire, campagne)
		</button>
		{#if advanced}
			<div class="grid gap-3 sm:grid-cols-2">
				<div>
					<label class="label" for="h-form">Forme</label>
					<select id="h-form" class="input" bind:value={form.form}>
						<option value="simple">Habitude simple</option>
						<option value="routine">Routine (liste d'exercices)</option>
						<option value="program">Programme (séances types)</option>
					</select>
				</div>
				<div>
					<label class="label" for="h-slot">Créneau dans l'agenda</label>
					<input id="h-slot" class="input" type="time" bind:value={form.slot} />
				</div>
				<div>
					<label class="label" for="h-dom2">Stat secondaire</label>
					<select id="h-dom2" class="input" value={form.domains[1]?.domainId ?? ''} onchange={(e) => setSecondary(e.currentTarget.value)}>
						<option value="">Aucune</option>
						{#each domains as d (d.id)}<option value={d.id}>{d.name}</option>{/each}
					</select>
					{#if form.domains.length > 1}
						<label class="label mt-2" for="h-w">Répartition : {form.domains[0].weight} % / {form.domains[1].weight} %</label>
						<input id="h-w" class="w-full" type="range" min="10" max="90" step="10" value={form.domains[0].weight} oninput={(e) => setPrimaryWeight(+e.currentTarget.value)} />
					{/if}
				</div>
				<div>
					<label class="label" for="h-camp">Campagne liée</label>
					<select id="h-camp" class="input" bind:value={form.campaignId}>
						<option value={undefined}>Aucune</option>
						{#each data.campaigns as c (c.id)}<option value={c.id}>{c.name}</option>{/each}
					</select>
				</div>
				{#if form.form === 'program'}
					<div class="sm:col-span-2">
						<label class="label" for="h-sessions">Séances types (séparées par des virgules)</label>
						<input id="h-sessions" class="input" bind:value={sessionsText} placeholder="Push, Pull, Legs" />
					</div>
				{/if}
			</div>
		{/if}

		<div class="flex gap-2">
			<button class="btn btn-primary" disabled={!form.name.trim()}>{isNew ? 'Créer' : 'Enregistrer'}</button>
			<button type="button" class="btn btn-ghost" onclick={() => (form = null)}>Annuler</button>
		</div>
	</form>
{/if}

<!-- Éditeur de routine -->
{#if routineFor}
	<section class="card mb-5 flex flex-col gap-3 border-accent">
		<div>
			<h2 class="flex items-center gap-2 font-extrabold"><ListChecks size={16} class="text-accent" /> Exercices : {routineFor.name}</h2>
			<p class="text-xs text-muted">
				Modifier la liste crée une nouvelle version datée ; l'historique garde les anciennes ({routineFor.routine?.length ?? 0} version(s), dernière du
				{formatShort(routineFor.routine?.at(-1)?.from ?? t)}).
			</p>
		</div>
		<ul class="flex flex-col gap-2">
			{#each exercises as ex, i (ex.id)}
				<li class="flex gap-2">
					<input class="input" placeholder="Exercice" bind:value={ex.name} aria-label="Exercice {i + 1}" />
					<input class="input w-32 sm:w-40" placeholder="30 s, 3x10…" bind:value={ex.detail} aria-label="Détail" />
					<button class="btn btn-ghost h-9 w-8 p-0" onclick={() => move(i, -1)} aria-label="Monter"><ArrowUp size={14} /></button>
					<button class="btn btn-ghost h-9 w-8 p-0" onclick={() => move(i, 1)} aria-label="Descendre"><ArrowDown size={14} /></button>
					<button class="btn btn-ghost h-9 w-8 p-0 text-muted" onclick={() => exercises.splice(i, 1)} aria-label="Retirer"><X size={14} /></button>
				</li>
			{/each}
		</ul>
		<div class="flex flex-wrap gap-2">
			<button class="btn text-xs" onclick={() => exercises.push({ id: uid(), name: '', detail: '' })}><Plus size={13} /> Exercice</button>
			<button
				class="btn btn-primary text-xs"
				onclick={() => {
					store.saveRoutine(routineFor!, exercises.filter((e) => e.name.trim()));
					routineFor = null;
				}}>Enregistrer</button
			>
			<button class="btn btn-ghost text-xs" onclick={() => (routineFor = null)}>Fermer</button>
		</div>
	</section>
{/if}

<!-- Habitudes par moment -->
{#each MOMENTS as m (m)}
	{@const list = active.filter((h) => h.moment === m)}
	{@const MIcon = MOMENT_ICON[m]}
	{#if list.length}
		<section class="mb-5">
			<h2 class="mb-2 flex items-center gap-2 px-1"><MIcon size={15} class="text-accent" /><span class="eyebrow">{MOMENT_LABEL[m]}</span></h2>
			<div class="flex flex-col gap-2">
				{#each list as h (h.id)}
					{@const dom = domainOf(h.domains[0]?.domainId)}
					{@const streak = h.frequency.type === 'weekly' ? habitWeekStreak(data, h, t) : habitStreak(data, h, t)}
					{@const r = rate(h)}
					<div class="card flex flex-wrap items-center gap-3 p-3.5">
						<div class="min-w-0 flex-1">
							<div class="flex flex-wrap items-center gap-1.5 font-bold">
								{#if dom}<span class="h-2 w-2 rounded-full" style="background:{dom.color}" title={dom.name}></span>{/if}
								{h.name}
								{#if h.kind === 'bonus'}<span class="chip bg-amber-100 text-amber-800">bonus</span>{/if}
								{#if streak >= 2}<span class="chip bg-orange-100 text-orange-800"><Flame size={10} />{streak}{h.frequency.type === 'weekly' ? ' sem.' : ''}</span>{/if}
							</div>
							<div class="text-xs text-muted">
								{#if h.cue}<span class="font-semibold text-ink">{h.cue}</span>{' · '}{/if}{freqLabel(h)} · {DIFFICULTY_LABEL[h.difficulty]}
								{#if h.form === 'routine'}· {h.routine?.at(-1)?.exercises.length ?? 0} exercice(s){/if}
								{#if h.form === 'program'}· {(h.sessions ?? []).join(', ')}{/if}
							</div>
							{#if !h.cue}<div class="text-[11px] font-semibold text-accent">Astuce : ajoute un déclencheur pour l'ancrer.</div>{/if}
						</div>
						<div class="flex items-center gap-3">
							{#if h.frequency.type !== 'weekly'}<WeekDots marks={habitWeekDays(data, h, t, t)} current={dayIndex} />{/if}
							{#if r !== null}
								<span class="w-12 text-right text-xs font-black tabular-nums {r >= 80 ? 'text-done' : r >= 50 ? 'text-ink' : 'text-orange-700'}" title="Réussite sur 4 semaines">{r} %</span>
							{/if}
						</div>
						<div class="flex gap-1">
							{#if h.form === 'routine'}<button class="btn btn-ghost h-8 px-2 text-xs" onclick={() => openRoutine(h)}><ListChecks size={14} /> Exercices</button>{/if}
							<button class="btn btn-ghost h-8 w-8 p-0" onclick={() => edit(h)} aria-label="Modifier {h.name}"><Pencil size={14} /></button>
							<button class="btn btn-ghost h-8 w-8 p-0 text-muted" onclick={() => store.archiveHabit(h.id)} aria-label="Archiver {h.name}" title="Archiver (l'historique est gardé)"><Archive size={14} /></button>
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}
{/each}

{#if !active.length}
	<div class="card flex flex-col items-center gap-2 py-10 text-center">
		<Repeat size={28} class="text-accent" />
		<p class="font-bold">Aucune habitude pour l'instant.</p>
		<p class="text-sm text-muted">Commence par une seule, toute petite : ouvre les idées à essayer.</p>
	</div>
{/if}

{#if archived.length}
	<section class="mt-6">
		<button class="flex items-center gap-1.5 px-1 text-sm font-bold text-muted hover:text-ink" aria-expanded={showArchived} onclick={() => (showArchived = !showArchived)}>
			<ChevronDown size={15} class="transition-transform {showArchived ? 'rotate-180' : ''}" /> Archivées ({archived.length})
		</button>
		{#if showArchived}
			<div class="mt-2 flex flex-col gap-2">
				{#each archived as h (h.id)}
					<div class="card flex items-center justify-between gap-2 p-3 opacity-70">
						<span class="font-semibold">{h.name}</span>
						<button class="btn btn-ghost text-xs" onclick={() => store.archiveHabit(h.id, false)}><RotateCcw size={13} /> Réactiver</button>
					</div>
				{/each}
			</div>
		{/if}
	</section>
{/if}
