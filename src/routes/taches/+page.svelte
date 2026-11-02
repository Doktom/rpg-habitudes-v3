<script lang="ts">
	import PageHint from '#lib/components/PageHint.svelte';
	import { CalendarDays, CalendarRange, ChevronDown, ClockAlert, ListChecks, Plus, Sun, Telescope, Trash, X } from '@lucide/svelte';
	import ConfirmButton from '#lib/components/ConfirmButton.svelte';
	import LootLine from '#lib/components/LootLine.svelte';
	import Segmented from '#lib/components/Segmented.svelte';
	import TaskCheck from '#lib/components/TaskCheck.svelte';
	import { formatShort, startOfWeek, today } from '#lib/dates.ts';
	import { DIFFICULTY_LABEL } from '#lib/labels.ts';
	import { store, uid } from '#lib/store.svelte.ts';
	import { toasts } from '#lib/toasts.svelte.ts';
	import type { Difficulty, Task, TaskList } from '#lib/types.ts';

	const data = $derived(store.data);

	const LISTS: { id: TaskList; label: string; short: string; icon: typeof Sun; empty: string }[] = [
		{ id: 'today', label: "Aujourd'hui", short: 'Jour', icon: Sun, empty: 'Rien pour aujourd’hui : la soute est en ordre.' },
		{ id: 'week', label: 'Cette semaine', short: 'Semaine', icon: CalendarRange, empty: 'Rien de prévu sur cette orbite.' },
		{ id: 'month', label: 'Ce mois-ci', short: 'Mois', icon: CalendarDays, empty: 'Aucune corvée pour ce mois.' },
		{ id: 'someday', label: 'Un jour', short: 'Un jour', icon: Telescope, empty: 'Les idées lointaines atterrissent ici.' }
	];
	const EFFORTS = (Object.entries(DIFFICULTY_LABEL) as [Difficulty, string][]).map(([value, label]) => ({ value, label }));
	const LIST_OPTIONS = LISTS.map((l) => ({ value: l.id, label: l.short, icon: l.icon }));

	let title = $state('');
	let list = $state<TaskList>('today');
	let domainId = $state('');
	let effort = $state<Difficulty>('easy');
	let filter = $state('');
	let showDone = $state(false);
	let openId = $state<string | null>(null);
	let newSub = $state<Record<string, string>>({});

	const week = $derived(startOfWeek(today()));
	const domain = (id?: string) => data.domains.find((d) => d.id === id);
	const visible = $derived(data.tasks.filter((t) => !filter || t.domainId === filter));
	const open = (l: TaskList) =>
		visible.filter((t) => t.list === l && !t.done).sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999'));
	const done = $derived(visible.filter((t) => t.done).sort((a, b) => (b.done ?? '').localeCompare(a.done ?? '')));
	const openCount = $derived(data.tasks.filter((t) => !t.done).length);
	const doneThisWeek = $derived(data.tasks.filter((t) => t.done && t.done >= week).length);
	const xpThisWeek = $derived(
		data.events
			.filter((e) => e.source.startsWith('task:') && e.date >= week)
			.reduce((s, e) => s + (e.xp?.reduce((a, x) => a + x.amount, 0) ?? 0), 0)
	);
	const usedDomains = $derived(data.domains.filter((d) => data.tasks.some((t) => t.domainId === d.id)));
	const preview = $derived(store.taskReward(effort));
	const subDone = (t: Task) => t.subtasks?.filter((s) => s.done).length ?? 0;

	function add(e: SubmitEvent) {
		e.preventDefault();
		if (!title.trim()) return;
		store.saveTask({ id: uid(), title: title.trim(), list, date: list === 'today' ? today() : undefined, domainId: domainId || undefined, effort });
		title = '';
	}

	// Termine (ou rouvre) une tâche ; une notification montre ce qu'elle a rapporté.
	function toggle(t: Task) {
		const finishing = !t.done;
		store.toggleTask(t);
		if (!finishing) return;
		const e = data.events.find((x) => x.source === `task:${t.id}`);
		toasts.push({ title: 'Tâche terminée', xp: e?.xp?.reduce((s, x) => s + x.amount, 0), loot: e?.loot });
		if (openId === t.id) openId = null;
	}

	function move(t: Task, to: TaskList) {
		t.list = to;
		t.date = to === 'today' ? today() : undefined;
		t.start = undefined;
		t.end = undefined;
		store.persist();
	}

	function setEffort(t: Task, v: Difficulty) {
		t.effort = v;
		store.persist();
	}

	function addSub(t: Task) {
		const text = (newSub[t.id] ?? '').trim();
		if (!text) return;
		(t.subtasks ??= []).push({ id: uid(), title: text });
		newSub[t.id] = '';
		store.persist();
	}

	function removeSub(t: Task, id: string) {
		t.subtasks = t.subtasks?.filter((s) => s.id !== id);
		store.persist();
	}
</script>

<!-- En-tête et chiffres de la semaine -->
<header class="mb-5 flex flex-wrap items-end justify-between gap-4">
	<div>
		<div class="eyebrow mb-1 flex items-center gap-1.5 text-accent"><ListChecks size={13} strokeWidth={2.4} /> Manifeste de bord</div>
		<h1 class="text-3xl font-black tracking-tight">À faire</h1>
		<p class="text-sm text-muted">Chaque corvée terminée rapporte de l'XP et des matériaux selon son effort.</p>
	</div>
	<div class="grid grid-cols-3 gap-2">
		{#each [{ n: openCount, l: 'à faire' }, { n: doneThisWeek, l: 'faites cette semaine' }, { n: `+${xpThisWeek}`, l: 'XP cette semaine' }] as s (s.l)}
			<div class="card min-w-24 px-3 py-2 text-center">
				<div class="text-xl font-black tabular-nums">{s.n}</div>
				<div class="text-[11px] font-semibold leading-tight text-muted">{s.l}</div>
			</div>
		{/each}
	</div>
</header>

<PageHint id="taches" title="La soute à colis">Les tâches ponctuelles, rangées par horizon (aujourd'hui, semaine, mois, un jour). Elles rapportent selon leur effort, et celles de la semaine remontent dans Aujourd'hui.</PageHint>


<!-- Ajout rapide -->
<form class="card mb-4 flex flex-col gap-3" onsubmit={add}>
	<div class="flex gap-2">
		<input class="input py-2.5 text-base" placeholder="Nouvelle tâche…" bind:value={title} aria-label="Nouvelle tâche" />
		<button class="btn btn-primary shrink-0 px-4" aria-label="Ajouter la tâche"><Plus size={18} strokeWidth={2.6} /><span class="hidden sm:inline">Ajouter</span></button>
	</div>
	<div class="flex flex-wrap items-center gap-2">
		<Segmented options={LIST_OPTIONS} bind:value={list} label="Liste" size="xs" />
		<Segmented options={EFFORTS} bind:value={effort} label="Effort" size="xs" />
		<select class="input w-auto py-1 text-xs" bind:value={domainId} aria-label="Catégorie">
			<option value="">Sans catégorie</option>
			{#each data.domains as d (d.id)}<option value={d.id}>{d.name}</option>{/each}
		</select>
		<span class="ml-auto flex items-center gap-1.5 text-xs font-semibold text-muted">
			Rapportera <span class="font-black text-accent">+{preview.xp} XP</span>
			<LootLine loot={preview.loot} signed size={11} />
		</span>
	</div>
</form>

<!-- Filtres par catégorie -->
{#if usedDomains.length}
	<div class="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Filtrer par catégorie">
		<button class="chip border px-3 py-1 {filter === '' ? 'border-accent bg-accent-soft text-ink' : 'border-line bg-surface text-muted'}" onclick={() => (filter = '')}>Toutes</button>
		{#each usedDomains as d (d.id)}
			<button
				class="chip border px-3 py-1 {filter === d.id ? 'border-accent bg-accent-soft text-ink' : 'border-line bg-surface text-muted'}"
				aria-pressed={filter === d.id}
				onclick={() => (filter = filter === d.id ? '' : d.id)}
			>
				<span class="h-2 w-2 rounded-full" style="background:{d.color}"></span>{d.name}
			</button>
		{/each}
	</div>
{/if}

<!-- Les quatre listes -->
<div class="grid gap-4 md:grid-cols-2">
	{#each LISTS as l (l.id)}
		{@const items = open(l.id)}
		<section class="card flex flex-col p-2">
			<h2 class="flex items-center gap-2 px-2.5 pt-1.5 pb-2">
				<l.icon size={16} strokeWidth={2.3} class="text-accent" />
				<span class="font-extrabold">{l.label}</span>
				<span class="chip bg-zinc-100 text-muted">{items.length}</span>
			</h2>
			{#each items as t (t.id)}
				{@const reward = store.taskReward(t.effort)}
				{@const dom = domain(t.domainId)}
				<div class="rounded-xl transition-colors {openId === t.id ? 'bg-raised' : 'hover:bg-raised'}">
					<div class="flex items-center gap-3 px-2.5 py-2">
						<TaskCheck done={false} effort={t.effort} label="Terminer {t.title}" ontoggle={() => toggle(t)} />
						<button class="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={openId === t.id} onclick={() => (openId = openId === t.id ? null : t.id)}>
							<span class="min-w-0 flex-1">
								<span class="block truncate text-sm font-semibold">{t.title}</span>
								<span class="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] font-semibold text-muted">
									{#if dom}<span class="flex items-center gap-1"><span class="h-1.5 w-1.5 rounded-full" style="background:{dom.color}"></span>{dom.name}</span>{/if}
									{#if t.due}
										<span class="flex items-center gap-1 {t.due < today() ? 'text-rose-700' : ''}"><ClockAlert size={11} strokeWidth={2.4} />{formatShort(t.due)}</span>
									{/if}
									{#if t.subtasks?.length}<span>{subDone(t)}/{t.subtasks.length} étapes</span>{/if}
									{#if t.note}<span class="truncate">{t.note}</span>{/if}
								</span>
							</span>
							<span class="hidden shrink-0 text-[11px] font-bold text-muted sm:inline">+{reward.xp} XP</span>
							<ChevronDown size={15} class="shrink-0 text-muted transition-transform {openId === t.id ? 'rotate-180' : ''}" />
						</button>
					</div>

					{#if openId === t.id}
						<div class="grid gap-3 border-t border-line px-3 pt-3 pb-3 sm:grid-cols-2">
							<div class="sm:col-span-2">
								<label class="label" for="t-title-{t.id}">Titre</label>
								<input id="t-title-{t.id}" class="input" bind:value={t.title} onchange={() => store.persist()} />
							</div>
							<div class="sm:col-span-2">
								<label class="label" for="t-note-{t.id}">Détails</label>
								<textarea id="t-note-{t.id}" class="input h-20" bind:value={t.note} onchange={() => store.persist()} placeholder="Contexte, étapes, liens…"></textarea>
							</div>
							<div class="sm:col-span-2">
								<span class="label">Effort</span>
								<Segmented options={EFFORTS} value={t.effort ?? 'easy'} label="Effort" size="xs" onchange={(v) => setEffort(t, v)} />
								<div class="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-muted">
									Rapporte <span class="font-black text-accent">+{reward.xp} XP</span> <LootLine loot={reward.loot} signed size={11} />
								</div>
							</div>
							<div class="sm:col-span-2">
								<span class="label">Liste</span>
								<Segmented options={LIST_OPTIONS} value={t.list} label="Liste" size="xs" onchange={(v) => move(t, v)} />
							</div>
							<div>
								<label class="label" for="t-due-{t.id}">Échéance</label>
								<input id="t-due-{t.id}" class="input" type="date" bind:value={t.due} onchange={() => store.persist()} />
							</div>
							<div>
								<label class="label" for="t-dom-{t.id}">Catégorie</label>
								<select id="t-dom-{t.id}" class="input" bind:value={t.domainId} onchange={() => store.persist()}>
									<option value={undefined}>Sans catégorie</option>
									{#each data.domains as d (d.id)}<option value={d.id}>{d.name}</option>{/each}
								</select>
							</div>
							<div class="sm:col-span-2">
								<div class="mb-1 flex items-center justify-between">
									<span class="label mb-0">Étapes</span>
									{#if t.subtasks?.length}<span class="text-[11px] font-bold text-muted">{subDone(t)}/{t.subtasks.length}</span>{/if}
								</div>
								{#if t.subtasks?.length}
									<div class="mb-2 h-1.5 overflow-hidden rounded-full bg-zinc-200">
										<div class="h-full rounded-full bg-accent transition-[width]" style="width: {(100 * subDone(t)) / t.subtasks.length}%"></div>
									</div>
								{/if}
								<ul class="mb-2 flex flex-col gap-1">
									{#each t.subtasks ?? [] as s (s.id)}
										<li class="flex items-center gap-2 rounded-lg px-1 text-sm">
											<input type="checkbox" bind:checked={s.done} onchange={() => store.persist()} aria-label="Étape {s.title}" />
											<span class="flex-1 {s.done ? 'text-muted line-through' : ''}">{s.title}</span>
											<button class="btn btn-ghost h-7 w-7 p-0 text-muted" onclick={() => removeSub(t, s.id)} aria-label="Retirer {s.title}"><X size={14} /></button>
										</li>
									{/each}
								</ul>
								<form class="flex gap-2" onsubmit={(e) => (e.preventDefault(), addSub(t))}>
									<input class="input" placeholder="Ajouter une étape…" bind:value={newSub[t.id]} aria-label="Nouvelle étape" />
									<button class="btn shrink-0" aria-label="Ajouter l'étape"><Plus size={15} /></button>
								</form>
							</div>
							<div class="flex items-center justify-between gap-2 sm:col-span-2">
								<button class="btn btn-ghost text-xs" onclick={() => (openId = null)}>Fermer</button>
								<ConfirmButton class="btn btn-ghost text-xs" label="Supprimer" confirmLabel="Supprimer ?" onconfirm={() => store.removeTask(t.id)} />
							</div>
						</div>
					{/if}
				</div>
			{:else}
				<p class="px-2.5 pb-2 text-sm text-muted">{l.empty}</p>
			{/each}
		</section>
	{/each}
</div>

<!-- Terminées -->
<section class="mt-5">
	<button class="flex items-center gap-1.5 px-1 text-sm font-bold text-muted hover:text-ink" aria-expanded={showDone} onclick={() => (showDone = !showDone)}>
		<ChevronDown size={15} class="transition-transform {showDone ? 'rotate-180' : ''}" />
		Terminées ({done.length})
	</button>
	{#if showDone}
		<div class="card mt-2 flex flex-col p-2">
			{#each done as t (t.id)}
				<div class="flex items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-raised">
					<TaskCheck done effort={t.effort} label="Rouvrir {t.title}" ontoggle={() => toggle(t)} />
					<span class="min-w-0 flex-1 truncate text-sm text-muted line-through">{t.title}</span>
					{#if t.done}<span class="text-[11px] font-semibold text-muted">{formatShort(t.done)}</span>{/if}
					<button class="btn btn-ghost h-7 w-7 p-0 text-muted" onclick={() => store.removeTask(t.id)} aria-label="Supprimer {t.title}"><Trash size={14} /></button>
				</div>
			{:else}
				<p class="px-2.5 py-2 text-sm text-muted">Aucune tâche terminée.</p>
			{/each}
		</div>
	{/if}
</section>
