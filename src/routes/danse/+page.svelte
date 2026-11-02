<script lang="ts">
	import PageHint from '#lib/components/PageHint.svelte';
	import { AudioLines } from '@lucide/svelte';
	import ConfirmButton from '#lib/components/ConfirmButton.svelte';
	import { addDays, formatLong, formatShort, range, today, WEEKDAYS } from '#lib/dates.ts';
	import { onVacation, upcomingParties } from '#lib/engine/schedule.ts';
	import { DANCE_LABEL, DANCE_STYLES } from '#lib/labels.ts';
	import { store, uid } from '#lib/store.svelte.ts';
	import type { DanceClass, DanceParty, Vacation } from '#lib/types.ts';

	const data = $derived(store.data);
	const t = today();

	const emptyClass = (): DanceClass => ({
		id: uid(),
		style: 'salsa',
		weekday: 2,
		time: '20:00',
		durationMin: 60,
		place: '',
		kind: 'obligatory',
		cancelled: []
	});
	const emptyParty = (): DanceParty => ({ id: uid(), date: t, time: '21:00', place: '', styles: ['salsa'], note: '' });
	const emptyVacation = (): Vacation => ({ id: uid(), label: '', start: t, end: addDays(t, 7) });

	let classForm = $state<DanceClass | null>(null);
	let partyForm = $state<DanceParty | null>(null);
	let vacationForm = $state<Vacation | null>(null);

	const parties = $derived(upcomingParties(data, t));
	const classes = $derived([...data.danceClasses].sort((a, b) => ((a.weekday + 6) % 7) - ((b.weekday + 6) % 7) || a.time.localeCompare(b.time)));

	// Prochaines séances sur 4 semaines, pour annuler une date précise
	const next = $derived(
		range(t, addDays(t, 27)).flatMap((d) =>
			data.danceClasses
				.filter((c) => c.weekday === new Date(d + 'T00:00:00Z').getUTCDay())
				.map((c) => ({ c, d, vacation: onVacation(data, d), cancelled: c.cancelled.includes(d) }))
		)
	);

	const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

	function toggleStyle(p: DanceParty, s: (typeof DANCE_STYLES)[number]) {
		p.styles = p.styles.includes(s) ? p.styles.filter((x) => x !== s) : [...p.styles, s];
	}
</script>

<header class="mb-5">
	<div class="eyebrow mb-1 flex items-center gap-1.5 text-accent"><AudioLines size={13} strokeWidth={2.4} /> Rythme galactique</div>
	<h1 class="text-3xl font-black tracking-tight">Danse</h1>
	<p class="text-sm text-muted">Cours fixes chaque semaine (hors vacances) et soirées ponctuelles. Ils apparaissent dans Aujourd'hui et le Planning.</p>
</header>

<PageHint id="danse" title="La piste">Tes cours réguliers et tes soirées : ils apparaissent le soir dans Aujourd'hui et comptent comme des habitudes.</PageHint>


<section class="mb-6">
	<div class="mb-2 flex items-center justify-between">
		<h2 class="h2">Cours fixes</h2>
		<button class="btn" onclick={() => (classForm = emptyClass())}>+ Cours</button>
	</div>
	<div class="flex flex-col gap-2">
		{#each classes as c (c.id)}
			<div class="card flex flex-wrap items-center justify-between gap-2">
				<div>
					<div class="font-medium">{DANCE_LABEL[c.style]} · {WEEKDAYS[c.weekday]} {c.time}</div>
					<div class="text-xs text-muted">
						{c.durationMin} min{c.place ? ' · ' + c.place : ''} · {c.kind === 'obligatory' ? 'obligatoire' : 'bonus'}
					</div>
				</div>
				<div class="flex gap-2">
					<button class="btn text-xs" onclick={() => (classForm = clone(c))}>Modifier</button>
					<ConfirmButton label="Supprimer" onconfirm={() => store.removeDanceClass(c.id)} />
				</div>
			</div>
		{:else}
			<p class="text-sm text-muted">Aucun cours fixe. Ajoute tes cours de salsa, bachata et kizomba.</p>
		{/each}
	</div>

	{#if classForm}
		<form
			class="card mt-3 grid gap-3 sm:grid-cols-3"
			onsubmit={(e) => {
				e.preventDefault();
				store.saveDanceClass(classForm!);
				classForm = null;
			}}
		>
			<div>
				<label class="label" for="c-style">Danse</label>
				<select id="c-style" class="input" bind:value={classForm.style}>
					{#each DANCE_STYLES as s (s)}<option value={s}>{DANCE_LABEL[s]}</option>{/each}
				</select>
			</div>
			<div>
				<label class="label" for="c-day">Jour</label>
				<select id="c-day" class="input" bind:value={classForm.weekday}>
					{#each [1, 2, 3, 4, 5, 6, 0] as d (d)}<option value={d}>{WEEKDAYS[d]}</option>{/each}
				</select>
			</div>
			<div>
				<label class="label" for="c-time">Heure</label>
				<input id="c-time" class="input" type="time" bind:value={classForm.time} required />
			</div>
			<div>
				<label class="label" for="c-dur">Durée (min)</label>
				<input id="c-dur" class="input" type="number" min="15" step="15" bind:value={classForm.durationMin} />
			</div>
			<div>
				<label class="label" for="c-place">Lieu</label>
				<input id="c-place" class="input" bind:value={classForm.place} />
			</div>
			<div>
				<label class="label" for="c-kind">Type</label>
				<select id="c-kind" class="input" bind:value={classForm.kind}>
					<option value="obligatory">Obligatoire</option>
					<option value="bonus">Bonus</option>
				</select>
			</div>
			<div class="flex gap-2 sm:col-span-3">
				<button class="btn btn-primary">Enregistrer</button>
				<button type="button" class="btn" onclick={() => (classForm = null)}>Annuler</button>
			</div>
		</form>
	{/if}

	{#if next.length}
		<details class="mt-3">
			<summary class="cursor-pointer text-sm text-zinc-600">Prochaines séances (4 semaines) — annuler une date</summary>
			<ul class="card mt-2 flex flex-col gap-1 text-sm">
				{#each next as n (n.c.id + n.d)}
					<li class="flex items-center justify-between gap-2">
						<span class={n.vacation || n.cancelled ? 'text-zinc-400 line-through' : ''}>
							{formatShort(n.d)} · {DANCE_LABEL[n.c.style]} {n.c.time}
						</span>
						{#if n.vacation}
							<span class="text-xs text-muted">vacances</span>
						{:else}
							<button class="btn px-2 py-0.5 text-xs" onclick={() => store.toggleCancelled(n.c.id, n.d)}>
								{n.cancelled ? 'Rétablir' : 'Annuler'}
							</button>
						{/if}
					</li>
				{/each}
			</ul>
		</details>
	{/if}
</section>

<section class="mb-6">
	<div class="mb-2 flex items-center justify-between">
		<h2 class="h2">Vacances</h2>
		<button class="btn" onclick={() => (vacationForm = emptyVacation())}>+ Période</button>
	</div>
	<div class="flex flex-col gap-2">
		{#each [...data.vacations].sort((a, b) => a.start.localeCompare(b.start)) as v (v.id)}
			<div class="card flex flex-wrap items-center justify-between gap-2">
				<div>
					<div class="font-medium">{v.label || 'Vacances'}</div>
					<div class="text-xs text-muted">du {formatShort(v.start)} au {formatShort(v.end)}</div>
				</div>
				<div class="flex gap-2">
					<button class="btn text-xs" onclick={() => (vacationForm = clone(v))}>Modifier</button>
					<button class="btn text-xs" onclick={() => store.removeVacation(v.id)}>Supprimer</button>
				</div>
			</div>
		{:else}
			<p class="text-sm text-muted">Aucune période. Les cours fixes sont suspendus pendant les vacances, sans effet sur les jauges.</p>
		{/each}
	</div>
	{#if vacationForm}
		<form
			class="card mt-3 grid gap-3 sm:grid-cols-3"
			onsubmit={(e) => {
				e.preventDefault();
				store.saveVacation(vacationForm!);
				vacationForm = null;
			}}
		>
			<div>
				<label class="label" for="v-label">Nom</label>
				<input id="v-label" class="input" placeholder="Vacances de Noël" bind:value={vacationForm.label} />
			</div>
			<div>
				<label class="label" for="v-start">Début</label>
				<input id="v-start" class="input" type="date" bind:value={vacationForm.start} required />
			</div>
			<div>
				<label class="label" for="v-end">Fin</label>
				<input id="v-end" class="input" type="date" bind:value={vacationForm.end} min={vacationForm.start} required />
			</div>
			<div class="flex gap-2 sm:col-span-3">
				<button class="btn btn-primary">Enregistrer</button>
				<button type="button" class="btn" onclick={() => (vacationForm = null)}>Annuler</button>
			</div>
		</form>
	{/if}
</section>

<section>
	<div class="mb-2 flex items-center justify-between">
		<h2 class="h2">Soirées à venir</h2>
		<button class="btn" onclick={() => (partyForm = emptyParty())}>+ Soirée</button>
	</div>
	<div class="flex flex-col gap-2">
		{#each parties as p (p.id)}
			<div class="card flex flex-wrap items-center justify-between gap-2">
				<div>
					<div class="font-medium capitalize">{formatLong(p.date)} · {p.time}</div>
					<div class="text-xs text-muted">
						{p.styles.map((s) => DANCE_LABEL[s]).join(' / ')}{p.place ? ' · ' + p.place : ''}{p.note ? ' · ' + p.note : ''}
					</div>
				</div>
				<div class="flex gap-2">
					<button class="btn text-xs" onclick={() => (partyForm = clone(p))}>Modifier</button>
					<button class="btn text-xs" onclick={() => store.removeParty(p.id)}>Supprimer</button>
				</div>
			</div>
		{:else}
			<p class="text-sm text-muted">Aucune soirée prévue.</p>
		{/each}
	</div>
	{#if partyForm}
		<form
			class="card mt-3 grid gap-3 sm:grid-cols-3"
			onsubmit={(e) => {
				e.preventDefault();
				if (partyForm!.styles.length) {
					store.saveParty(partyForm!);
					partyForm = null;
				}
			}}
		>
			<div>
				<label class="label" for="p-date">Date</label>
				<input id="p-date" class="input" type="date" bind:value={partyForm.date} required />
			</div>
			<div>
				<label class="label" for="p-time">Heure</label>
				<input id="p-time" class="input" type="time" bind:value={partyForm.time} required />
			</div>
			<div>
				<label class="label" for="p-place">Lieu</label>
				<input id="p-place" class="input" bind:value={partyForm.place} />
			</div>
			<div class="sm:col-span-2">
				<span class="label">Danses</span>
				<div class="flex gap-2">
					{#each DANCE_STYLES as s (s)}
						<button
							type="button"
							class="btn text-xs {partyForm.styles.includes(s) ? 'btn-primary' : ''}"
							onclick={() => toggleStyle(partyForm!, s)}>{DANCE_LABEL[s]}</button
						>
					{/each}
				</div>
			</div>
			<div>
				<label class="label" for="p-note">Note</label>
				<input id="p-note" class="input" bind:value={partyForm.note} />
			</div>
			<div class="flex gap-2 sm:col-span-3">
				<button class="btn btn-primary">Enregistrer</button>
				<button type="button" class="btn" onclick={() => (partyForm = null)}>Annuler</button>
			</div>
		</form>
	{/if}
</section>
