<script lang="ts">
	import PageHint from '#lib/components/PageHint.svelte';
	import {
		AudioLines,
		Copy,
		Database,
		Download,
		Flag,
		Flame,
		FlaskConical,
		ListTodo,
		NotebookPen,
		Orbit,
		Repeat,
		Rocket,
		RotateCcw,
		Settings,
		Sparkles,
		Trophy,
		Upload,
		UserRound
	} from '@lucide/svelte';
	import ConfirmButton from '#lib/components/ConfirmButton.svelte';
	import Gauges from '#lib/components/Gauges.svelte';
	import LevelRing from '#lib/components/LevelRing.svelte';
	import LootLine from '#lib/components/LootLine.svelte';
	import StatRadar from '#lib/components/StatRadar.svelte';
	import ThemeSwitch from '#lib/components/ThemeSwitch.svelte';
	import { formatLong, today } from '#lib/dates.ts';
	import { discipline, gaugeValue, perfectStreak, sortedEvents, totalXp, xpByDomain } from '#lib/engine/progress.ts';
	import { shipClass, skillPoints } from '#lib/engine/ship.ts';
	import { TROPHIES } from '#lib/engine/trophies.ts';
	import { levelInfo } from '#lib/engine/xp.ts';
	import { store } from '#lib/store.svelte.ts';
	import { theme } from '#lib/theme.svelte.ts';
	import type { ProgressEvent } from '#lib/types.ts';
	import { SHIP_NAME } from '#lib/universe.ts';

	const data = $derived(store.data);
	const xp = $derived(totalXp(data));
	const level = $derived(levelInfo(xp));
	const byDomain = $derived(xpByDomain(data));
	const roots = $derived(data.domains.filter((d) => !d.parentId));
	const radar = $derived(roots.map((d) => ({ label: d.stat, level: levelInfo(byDomain[d.id] ?? 0).level, color: d.color })));
	const streak = $derived(perfectStreak(data, today()));
	const points = $derived(Math.max(0, skillPoints(data)));
	const unlocked = $derived(TROPHIES.filter((t) => data.trophies[t.id]).length);

	// Journal de bord : les événements les plus récents, regroupés par jour.
	let shown = $state(25);
	const recent = $derived(sortedEvents(data.events).reverse().slice(0, shown));
	const days = $derived(
		recent.reduce<{ date: string; events: ProgressEvent[] }[]>((acc, e) => {
			const last = acc.at(-1);
			if (last?.date === e.date) last.events.push(e);
			else acc.push({ date: e.date, events: [e] });
			return acc;
		}, [])
	);
	const SOURCE_ICON = {
		habit: Repeat,
		dance: AudioLines,
		task: ListTodo,
		quest: Flag,
		chapter: Flag,
		campaign: Flag,
		review: NotebookPen,
		trophy: Trophy,
		ship: Rocket,
		day: Orbit
	} as const;
	const iconOf = (e: ProgressEvent) => SOURCE_ICON[e.source.split(':')[0] as keyof typeof SOURCE_ICON] ?? Sparkles;
	const sumXp = (e: ProgressEvent) => e.xp?.reduce((s, x) => s + x.amount, 0) ?? 0;
	const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

	let fileInput = $state<HTMLInputElement>();
	let message = $state('');
	let jsonShown = $state(false);

	async function copy() {
		try {
			await navigator.clipboard.writeText(store.exportJson());
			message = 'Données copiées dans le presse-papiers.';
		} catch {
			jsonShown = true;
			message = 'Copie impossible ici : sélectionne le texte ci-dessous et copie-le.';
		}
	}

	function download() {
		const blob = new Blob([store.exportJson()], { type: 'application/json' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = `rpg-habitudes-${today()}.json`;
		a.click();
		URL.revokeObjectURL(a.href);
	}

	async function upload(e: Event) {
		const file = (e.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		try {
			store.importJson(await file.text());
			message = 'Import réussi.';
		} catch (err) {
			message = 'Import impossible : ' + (err as Error).message;
		}
	}
</script>

<PageHint id="personnage" title="Ton insigne de pilote">Tes stats grandissent avec l'XP de chaque catégorie. Chaque niveau donne un point de compétence à dépenser ici.</PageHint>


<!-- Fiche du pilote -->
<section class="card mb-5 flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
	<div class="flex items-center gap-4">
		<LevelRing level={level.level} into={level.into} needed={level.needed} size={96} />
		<div>
			<div class="eyebrow flex items-center gap-1.5 text-accent"><UserRound size={13} strokeWidth={2.4} /> Pilote du {SHIP_NAME}</div>
			<h1 class="text-3xl font-black tracking-tight">Niveau {level.level}</h1>
			<p class="text-sm text-muted tabular-nums">{level.into} / {level.needed} XP vers le niveau {level.level + 1} · {xp} XP au total</p>
		</div>
	</div>
	<div class="grid flex-1 grid-cols-3 gap-2 sm:ml-auto sm:max-w-sm">
		<div class="rounded-2xl bg-zinc-100 px-2 py-2.5 text-center">
			<Flame size={18} class="mx-auto text-g-motivation" strokeWidth={2.3} />
			<div class="text-lg font-black tabular-nums">{streak}</div>
			<div class="text-[11px] font-semibold leading-tight text-muted">jour{streak > 1 ? 's' : ''} sans faille</div>
		</div>
		<a href="#/vaisseau" class="rounded-2xl bg-zinc-100 px-2 py-2.5 text-center transition-colors hover:bg-accent-soft">
			<Trophy size={18} class="mx-auto text-reward" strokeWidth={2.3} />
			<div class="text-lg font-black tabular-nums">{unlocked}/{TROPHIES.length}</div>
			<div class="text-[11px] font-semibold leading-tight text-muted">trophées</div>
		</a>
		<a href="#/vaisseau" class="rounded-2xl px-2 py-2.5 text-center transition-colors {points ? 'bg-reward-soft' : 'bg-zinc-100'} hover:bg-accent-soft">
			<Sparkles size={18} class="mx-auto text-accent" strokeWidth={2.3} />
			<div class="text-lg font-black tabular-nums">{points}</div>
			<div class="text-[11px] font-semibold leading-tight text-muted">point{points > 1 ? 's' : ''} à dépenser</div>
		</a>
	</div>
</section>

<section class="card mb-5">
	<Gauges discipline={discipline(data, today())} motivation={gaugeValue(data, 'motivation')} inspiration={gaugeValue(data, 'inspiration')} />
</section>

<!-- Disciplines -->
<section class="mb-6">
	<div class="mb-2 flex items-baseline justify-between px-1">
		<h2 class="eyebrow">Disciplines</h2>
		<span class="text-xs font-semibold text-muted">Vaisseau de classe {shipClass(data)}</span>
	</div>
	<div class="grid gap-4 lg:grid-cols-5">
		<div class="card flex items-center justify-center lg:col-span-2">
			{#if radar.length >= 3}
				<div class="w-full max-w-sm"><StatRadar items={radar} /></div>
			{:else}
				<p class="text-sm text-muted">Le radar apparaît à partir de trois disciplines.</p>
			{/if}
		</div>
		<div class="grid content-start gap-2.5 sm:grid-cols-2 lg:col-span-3">
			{#each roots as d (d.id)}
				{@const info = levelInfo(byDomain[d.id] ?? 0)}
				{@const children = data.domains.filter((c) => c.parentId === d.id)}
				<div class="card p-3.5 {children.length ? 'sm:col-span-2' : ''}">
					<div class="flex items-center gap-3">
						<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-black" style="background: color-mix(in oklab, {d.color} 22%, transparent); color: {d.color}">
							{info.level}
						</span>
						<div class="min-w-0 flex-1">
							<div class="flex items-baseline justify-between gap-2">
								<span class="truncate font-extrabold">{d.stat}</span>
								<span class="shrink-0 text-[11px] font-semibold text-muted tabular-nums">{info.into}/{info.needed}</span>
							</div>
							<div class="truncate text-xs text-muted">{d.name}</div>
						</div>
					</div>
					<div class="mt-2.5 h-1.5 overflow-hidden rounded-full bg-zinc-200">
						<div class="h-full rounded-full transition-[width] duration-700" style="width: {(100 * info.into) / info.needed}%; background: {d.color}"></div>
					</div>
					{#if children.length}
						<div class="mt-3 grid grid-cols-3 gap-2">
							{#each children as c (c.id)}
								{@const ci = levelInfo(byDomain[c.id] ?? 0)}
								<div class="rounded-xl bg-zinc-100 p-2">
									<div class="flex items-baseline justify-between text-xs font-bold"><span class="truncate">{c.name}</span><span class="text-muted">{ci.level}</span></div>
									<div class="mt-1.5 h-1 overflow-hidden rounded-full bg-zinc-200">
										<div class="h-full rounded-full" style="width: {(100 * ci.into) / ci.needed}%; background: {c.color}"></div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</div>
</section>

<!-- Journal de bord -->
<section class="mb-6">
	<h2 class="eyebrow mb-2 px-1">Journal de bord</h2>
	<div class="card p-0">
		{#each days as day (day.date)}
			<div class="border-b border-line px-4 pt-3 pb-2 last:border-b-0">
				<div class="mb-1.5 text-[11px] font-bold tracking-wide text-muted capitalize">{formatLong(day.date)}</div>
				<ul class="flex flex-col gap-1">
					{#each day.events as e (e.id)}
						{@const Icon = iconOf(e)}
						<li class="flex items-center gap-3 py-1 text-sm">
							<span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-muted"><Icon size={14} strokeWidth={2.3} /></span>
							<span class="min-w-0 flex-1 truncate">{e.label}</span>
							<span class="flex shrink-0 flex-wrap items-center justify-end gap-x-2 text-[11px] font-bold">
								{#if sumXp(e)}<span class="text-accent">+{sumXp(e)} XP</span>{/if}
								<LootLine loot={e.loot} signed size={11} />
								{#if e.gauge?.motivation}<span class="text-g-motivation">Motiv. {signed(e.gauge.motivation)}</span>{/if}
								{#if e.gauge?.inspiration}<span class="text-g-inspiration">Insp. {signed(e.gauge.inspiration)}</span>{/if}
							</span>
						</li>
					{/each}
				</ul>
			</div>
		{:else}
			<p class="p-4 text-sm text-muted">Rien encore : valide une routine dans Aujourd'hui pour lancer le journal.</p>
		{/each}
		{#if data.events.length > shown}
			<div class="border-t border-line p-2 text-center">
				<button class="btn btn-ghost text-xs" onclick={() => (shown += 25)}>Voir plus</button>
			</div>
		{/if}
	</div>
</section>

<!-- Réglages -->
<section class="mb-4">
	<h2 class="eyebrow mb-2 flex items-center gap-1.5 px-1"><Settings size={13} strokeWidth={2.4} /> Réglages</h2>
	<div class="grid gap-3 lg:grid-cols-3">
		<div class="card flex flex-col gap-3">
			<div class="font-extrabold">Apparence</div>
			<p class="text-xs text-muted">Nuit douce, Aube orbitale, ou selon le réglage de ton appareil.</p>
			<div class="mt-auto flex items-center justify-between gap-2">
				<span class="text-sm font-semibold">{theme.pref === 'dark' ? 'Nuit douce' : theme.pref === 'light' ? 'Aube orbitale' : 'Automatique'}</span>
				<ThemeSwitch />
			</div>
		</div>

		<div class="card flex flex-col gap-3">
			<div class="flex items-center gap-2 font-extrabold"><FlaskConical size={16} class="text-accent" /> Mode test</div>
			<p class="text-xs text-muted">
				Un scénario de quatre semaines dans un espace séparé (tes vraies données ne sont pas touchées), puis tu avances les jours pour voir XP, matériaux, orbite et trophées évoluer.
			</p>
			<div class="mt-auto flex flex-wrap gap-2">
				{#if store.testMode}
					<ConfirmButton class="btn text-xs" label="Régénérer" confirmLabel="Repartir de zéro ?" onconfirm={() => store.startTestMode(4)} />
					<button class="btn text-xs" onclick={() => store.exitTestMode()}>Quitter le mode test</button>
				{:else}
					<ConfirmButton class="btn btn-primary text-xs" label="Lancer un test" confirmLabel="Remplacer le test précédent ?" onconfirm={() => store.startTestMode(4)} />
					{#if store.hasTestData()}<button class="btn text-xs" onclick={() => store.resumeTestMode()}>Reprendre</button>{/if}
				{/if}
			</div>
		</div>

		<div class="card flex flex-col gap-3">
			<div class="flex items-center gap-2 font-extrabold"><Database size={16} class="text-accent" /> Données</div>
			<p class="text-xs text-muted">Elles vivent dans ce navigateur. Exporte-les régulièrement en attendant la synchronisation.</p>
			<div class="mt-auto flex flex-wrap gap-2">
				<button class="btn text-xs" onclick={download}><Download size={14} /> Exporter</button>
				<button class="btn text-xs" onclick={copy}><Copy size={14} /> Copier</button>
				<button class="btn text-xs" onclick={() => fileInput?.click()}><Upload size={14} /> Importer</button>
				<input bind:this={fileInput} type="file" accept="application/json" class="hidden" onchange={upload} />
			</div>
			<div class="flex items-center gap-2 border-t border-line pt-3">
				<RotateCcw size={14} class="text-muted" />
				<ConfirmButton class="btn btn-ghost text-xs" label="Réinitialiser" confirmLabel="Tout effacer ?" onconfirm={() => store.reset()} />
			</div>
			{#if message}<p class="text-sm font-semibold">{message}</p>{/if}
			{#if jsonShown}<textarea class="input h-40 w-full font-mono text-xs" readonly value={store.exportJson()}></textarea>{/if}
		</div>
	</div>
</section>
