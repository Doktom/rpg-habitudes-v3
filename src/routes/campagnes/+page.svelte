<script lang="ts">
	import PageHint from '#lib/components/PageHint.svelte';
	import {
		ArrowLeft,
		Check,
		ChevronDown,
		Flag,
		Lock,
		MapPinned,
		Pause,
		Pencil,
		Play,
		Plus,
		Map,
		Rocket,
		Skull,
		Sparkles,
		Trophy
	} from '@lucide/svelte';
	import ConfirmButton from '#lib/components/ConfirmButton.svelte';
	import { CAMPAIGN_TEMPLATES, type CampaignTemplate } from '#lib/templates.ts';
	import LootLine from '#lib/components/LootLine.svelte';
	import TaskCheck from '#lib/components/TaskCheck.svelte';
	import { LOOT_REWARDS, XP_REWARDS } from '#lib/config.ts';
	import { formatShort } from '#lib/dates.ts';
	import { store, uid } from '#lib/store.svelte.ts';
	import { toasts } from '#lib/toasts.svelte.ts';
	import type { Campaign, CampaignStatus, Chapter, Task } from '#lib/types.ts';

	const data = $derived(store.data);
	let selectedId = $state<string | null>(null);
	const selected = $derived(data.campaigns.find((c) => c.id === selectedId) ?? null);

	let newCampaign = $state<Campaign | null>(null);
	let editingInfo = $state(false);
	let newChapter = $state('');
	let questForm = $state<{ chapterId: string; name: string; xp: number; boss: boolean } | null>(null);
	let taskDraft = $state<Record<string, string>>({});
	let showDone = $state(false);
	let showTemplates = $state(false);

	function useTemplate(tpl: CampaignTemplate) {
		const c = store.addCampaignFromTemplate(tpl);
		showTemplates = false;
		toasts.push({ title: `Cap sur : ${c.name}` });
		open(c.id);
	}

	const STATUS: Record<CampaignStatus, { label: string; style: string }> = {
		active: { label: 'En route', style: 'bg-accent-soft text-accent' },
		paused: { label: 'À quai', style: 'bg-amber-100 text-amber-800' },
		done: { label: 'Atteinte', style: 'bg-emerald-100 text-emerald-800' }
	};
	const QUEST_XP = [50, 100, 200, 400];

	const domain = (id?: string) => data.domains.find((d) => d.id === id);
	const active = $derived(data.campaigns.filter((c) => c.status === 'active'));
	const paused = $derived(data.campaigns.filter((c) => c.status === 'paused'));
	const finished = $derived(data.campaigns.filter((c) => c.status === 'done'));
	const questsDone = $derived(data.campaigns.reduce((s, c) => s + c.chapters.flatMap((ch) => ch.quests).filter((q) => q.done).length, 0));
	const campaignXp = $derived(
		data.events.filter((e) => e.campaignId).reduce((s, e) => s + (e.xp?.reduce((a, x) => a + x.amount, 0) ?? 0), 0)
	);

	function progress(c: Campaign) {
		const quests = c.chapters.flatMap((ch) => ch.quests);
		const done = quests.filter((q) => q.done).length;
		return {
			chaptersDone: c.chapters.filter((ch) => ch.done).length,
			questsDone: done,
			quests: quests.length,
			pct: quests.length ? Math.round((100 * done) / quests.length) : 0
		};
	}

	// Un chapitre est verrouillé tant que le précédent n'est pas terminé.
	const locked = (c: Campaign, i: number) => i > 0 && !c.chapters[i - 1].done;
	// L'étape en cours : le premier chapitre pas encore terminé.
	const currentIndex = (c: Campaign) => c.chapters.findIndex((ch) => !ch.done);
	const nextQuest = (c: Campaign) => c.chapters[currentIndex(c)]?.quests.find((q) => !q.done);

	const earned = (source: string) => {
		const e = data.events.find((x) => x.source === source);
		return { xp: e?.xp?.reduce((s, x) => s + x.amount, 0), loot: e?.loot };
	};

	function toggleQuest(c: Campaign, ch: Chapter, questId: string) {
		const quest = ch.quests.find((q) => q.id === questId);
		const finishing = !quest?.done;
		store.toggleQuest(c, ch.id, questId);
		if (!finishing || !quest) return;
		toasts.push({ title: quest.boss ? 'Boss vaincu' : 'Quête accomplie', ...earned(`quest:${questId}`) });
		if (ch.done) toasts.push({ title: `Étape atteinte : ${ch.name}`, ...earned(`chapter:${ch.id}`) });
	}

	function toggleTask(t: Task) {
		const finishing = !t.done;
		store.toggleTask(t);
		if (finishing) toasts.push({ title: 'Tâche terminée', ...earned(`task:${t.id}`) });
	}

	function toggleCampaign(c: Campaign) {
		const finishing = !c.done;
		store.toggleCampaignDone(c);
		if (finishing) toasts.push({ title: `Destination atteinte : ${c.name}`, ...earned(`campaign:${c.id}`) });
	}

	function setStatus(c: Campaign, s: CampaignStatus) {
		c.status = s;
		store.saveCampaign(c);
	}

	function addQuest(c: Campaign) {
		const d = questForm;
		if (!d || !d.name.trim()) return;
		const ch = c.chapters.find((x) => x.id === d.chapterId)!;
		ch.quests.push({ id: uid(), name: d.name.trim(), xp: d.xp, boss: d.boss });
		ch.done = undefined;
		store.saveCampaign(c);
		questForm = null;
	}

	function addChapter(c: Campaign) {
		if (!newChapter.trim()) return;
		c.chapters.push({ id: uid(), name: newChapter.trim(), quests: [] });
		store.saveCampaign(c);
		newChapter = '';
	}

	function addTask(questId: string) {
		const title = taskDraft[questId]?.trim();
		if (!title) return;
		store.saveTask({ id: uid(), title, list: 'week', questId });
		taskDraft[questId] = '';
	}

	function open(id: string) {
		selectedId = id;
		editingInfo = false;
		questForm = null;
		window.scrollTo({ top: 0 });
	}
</script>

{#snippet route(c: Campaign, size: 'sm' | 'lg')}
	<!-- Carte de route : une balise par chapitre, la destination au bout. -->
	{@const cur = currentIndex(c)}
	<ol class="flex items-center" aria-label="Route de la campagne">
		<li class="flex items-center">
			<span class="flex items-center justify-center rounded-full bg-accent text-on-accent {size === 'lg' ? 'h-8 w-8' : 'h-5 w-5'}" title="Départ">
				<Rocket size={size === 'lg' ? 15 : 10} strokeWidth={2.4} />
			</span>
		</li>
		{#each c.chapters as ch, i (ch.id)}
			<li class="flex min-w-0 flex-1 items-center">
				<span class="h-0.5 flex-1 {ch.done || i <= cur ? 'bg-accent' : 'border-t-2 border-dashed border-line'} {ch.done ? '' : i === cur ? 'opacity-50' : ''}"></span>
				{#if size === 'lg'}
					<a
						href="#/campagnes"
						onclick={(e) => {
							e.preventDefault();
							document.getElementById(`ch-${ch.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
						}}
						class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-black transition-transform hover:scale-110 {ch.done
							? 'border-accent bg-accent text-on-accent'
							: i === cur
								? 'border-accent bg-accent-soft text-accent ring-4 ring-accent-soft'
								: 'border-line bg-raised text-muted'}"
						title="Chapitre {i + 1} : {ch.name}"
					>
						{#if ch.done}<Check size={14} strokeWidth={3} />{:else if locked(c, i)}<Lock size={12} strokeWidth={2.6} />{:else}{i + 1}{/if}
					</a>
				{:else}
					<span
						class="h-3 w-3 shrink-0 rounded-full border-2 {ch.done ? 'border-accent bg-accent' : i === cur ? 'border-accent bg-accent-soft' : 'border-line bg-raised'}"
						title="Chapitre {i + 1} : {ch.name}"
					></span>
				{/if}
			</li>
		{/each}
		<li class="flex min-w-0 flex-1 items-center">
			<span class="h-0.5 flex-1 {c.done ? 'bg-accent' : 'border-t-2 border-dashed border-line'}"></span>
			<span
				class="flex shrink-0 items-center justify-center rounded-full {c.done ? 'bg-reward text-on-accent' : 'border-2 border-dashed border-reward text-reward'} {size === 'lg' ? 'h-9 w-9' : 'h-5 w-5'}"
				title="Destination"
			>
				<Flag size={size === 'lg' ? 15 : 10} strokeWidth={2.6} />
			</span>
		</li>
	</ol>
{/snippet}

{#snippet campaignCard(c: Campaign)}
	{@const p = progress(c)}
	{@const dom = domain(c.domainId)}
	{@const next = nextQuest(c)}
	<button class="card flex flex-col gap-3 text-left transition-colors hover:border-accent" onclick={() => open(c.id)}>
		<div class="flex items-start justify-between gap-2">
			<div class="min-w-0">
				{#if dom}<div class="eyebrow mb-0.5 flex items-center gap-1.5"><span class="h-2 w-2 rounded-full" style="background:{dom.color}"></span>{dom.name}</div>{/if}
				<div class="truncate text-lg font-extrabold">{c.name}</div>
			</div>
			<span class="chip shrink-0 {STATUS[c.status].style}">{STATUS[c.status].label}</span>
		</div>
		{#if c.intent}<p class="line-clamp-2 text-sm text-muted">{c.intent}</p>{/if}
		{@render route(c, 'sm')}
		<div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs font-semibold text-muted">
			<span>{p.chaptersDone}/{c.chapters.length} étapes · {p.questsDone}/{p.quests} quêtes</span>
			{#if c.target}<span class="flex items-center gap-1"><Flag size={11} />{formatShort(c.target)}</span>{/if}
		</div>
		{#if next && c.status !== 'done'}
			<div class="flex items-center gap-1.5 rounded-xl bg-raised px-2.5 py-1.5 text-xs">
				{#if next.boss}<Skull size={13} class="shrink-0 text-rose-700" />{:else}<MapPinned size={13} class="shrink-0 text-accent" />{/if}
				<span class="text-muted">Prochaine quête :</span>
				<span class="truncate font-bold">{next.name}</span>
			</div>
		{/if}
	</button>
{/snippet}

{#if !selected}
	<!-- Liste des destinations -->
	<header class="mb-5 flex flex-wrap items-end justify-between gap-4">
		<div>
			<div class="eyebrow mb-1 flex items-center gap-1.5 text-accent"><MapPinned size={13} strokeWidth={2.4} /> Destinations</div>
			<h1 class="text-3xl font-black tracking-tight">Campagnes</h1>
			<p class="text-sm text-muted">Des systèmes lointains à rejoindre, étape par étape. Chaque quête rapproche le Sillage du but.</p>
		</div>
		<div class="grid grid-cols-3 gap-2">
			{#each [{ n: active.length, l: 'en route' }, { n: questsDone, l: 'quêtes accomplies' }, { n: `+${campaignXp}`, l: 'XP de campagne' }] as s (s.l)}
				<div class="card min-w-24 px-3 py-2 text-center">
					<div class="text-xl font-black tabular-nums">{s.n}</div>
					<div class="text-[11px] leading-tight font-semibold text-muted">{s.l}</div>
				</div>
			{/each}
		</div>
	</header>

<PageHint id="campagnes" title="Tes projets au long cours">Une campagne = une destination, découpée en chapitres et en quêtes. Pars d'un modèle si tu ne sais pas par où commencer ; les boss sont les grosses étapes.</PageHint>


	{#if newCampaign}
		<form
			class="card mb-5 grid gap-3 border-accent sm:grid-cols-2"
			onsubmit={(e) => {
				e.preventDefault();
				if (!newCampaign!.name.trim()) return;
				store.saveCampaign(newCampaign!);
				open(newCampaign!.id);
				newCampaign = null;
			}}
		>
			<h2 class="flex items-center gap-2 font-extrabold sm:col-span-2"><Rocket size={16} class="text-accent" /> Nouvelle destination</h2>
			<div>
				<label class="label" for="c-name">Nom</label>
				<input id="c-name" class="input" bind:value={newCampaign.name} placeholder="Ex. la Ceinture des Marchés" required />
			</div>
			<div>
				<label class="label" for="c-dom">Stat qui reçoit l'XP</label>
				<select id="c-dom" class="input" bind:value={newCampaign.domainId}>
					{#each data.domains as d (d.id)}<option value={d.id}>{d.name}</option>{/each}
				</select>
			</div>
			<div>
				<label class="label" for="c-intent">Intention (le fil rouge)</label>
				<input id="c-intent" class="input" bind:value={newCampaign.intent} placeholder="Pourquoi ce voyage ?" />
			</div>
			<div>
				<label class="label" for="c-target">Arrivée visée (facultatif)</label>
				<input id="c-target" class="input" type="date" bind:value={newCampaign.target} />
			</div>
			<div class="flex gap-2 sm:col-span-2">
				<button class="btn btn-primary">Mettre le cap</button>
				<button type="button" class="btn btn-ghost" onclick={() => (newCampaign = null)}>Annuler</button>
			</div>
		</form>
	{:else}
		<div class="mb-5 flex flex-wrap gap-2">
			<button
				class="btn btn-primary"
				onclick={() => (newCampaign = { id: uid(), name: '', intent: '', domainId: data.domains[0]?.id ?? 'projets', status: 'active', chapters: [] })}
			>
				<Plus size={16} strokeWidth={2.6} /> Nouvelle campagne
			</button>
			<button class="btn" aria-expanded={showTemplates} onclick={() => (showTemplates = !showTemplates)}><Map size={15} /> Partir d'un modèle</button>
		</div>
	{/if}

	{#if showTemplates && !newCampaign}
		<section class="mb-6">
			<p class="mb-2 px-1 text-xs text-muted">Des routes toutes tracées, avec leurs étapes, leurs quêtes et un boss final. Tout reste modifiable ensuite.</p>
			<div class="grid gap-3 md:grid-cols-2">
				{#each CAMPAIGN_TEMPLATES as tpl (tpl.key)}
					{@const quests = tpl.chapters.reduce((s, ch) => s + ch.quests.length, 0)}
					<div class="card flex flex-col gap-2">
						<div class="eyebrow flex items-center gap-1.5"><span class="h-2 w-2 rounded-full" style="background:{tpl.domain.color}"></span>{tpl.domain.name}</div>
						<div class="text-lg font-extrabold">{tpl.name}</div>
						<p class="text-sm text-muted">{tpl.intent}</p>
						<p class="text-xs font-semibold text-muted">{tpl.chapters.length} étapes · {quests} quêtes · environ {tpl.weeks} semaines</p>
						<button class="btn mt-auto self-start text-xs" onclick={() => useTemplate(tpl)}><Rocket size={13} /> Mettre le cap</button>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	{#if active.length}
		<section class="mb-6">
			<h2 class="eyebrow mb-2 px-1">En route</h2>
			<div class="grid gap-4 md:grid-cols-2">{#each active as c (c.id)}{@render campaignCard(c)}{/each}</div>
		</section>
	{/if}
	{#if paused.length}
		<section class="mb-6">
			<h2 class="eyebrow mb-2 flex items-center gap-1.5 px-1"><Pause size={11} strokeWidth={2.6} /> À quai</h2>
			<div class="grid gap-4 opacity-80 md:grid-cols-2">{#each paused as c (c.id)}{@render campaignCard(c)}{/each}</div>
		</section>
	{/if}
	{#if !data.campaigns.length && !newCampaign}
		<div class="card flex flex-col items-center gap-2 py-10 text-center">
			<MapPinned size={28} class="text-accent" />
			<p class="font-bold">Aucune destination pour l'instant.</p>
			<p class="text-sm text-muted">Une campagne, c'est un projet au long cours découpé en étapes et en quêtes.</p>
		</div>
	{/if}
	{#if finished.length}
		<section>
			<button class="flex items-center gap-1.5 px-1 text-sm font-bold text-muted hover:text-ink" aria-expanded={showDone} onclick={() => (showDone = !showDone)}>
				<ChevronDown size={15} class="transition-transform {showDone ? 'rotate-180' : ''}" />
				<Trophy size={14} /> Destinations atteintes ({finished.length})
			</button>
			{#if showDone}
				<div class="mt-2 grid gap-4 md:grid-cols-2">{#each finished as c (c.id)}{@render campaignCard(c)}{/each}</div>
			{/if}
		</section>
	{/if}
{:else}
	<!-- Détail d'une campagne -->
	{@const c = selected}
	{@const p = progress(c)}
	{@const dom = domain(c.domainId)}
	<button class="btn btn-ghost mb-3 -ml-2 text-sm text-muted" onclick={() => (selectedId = null)}><ArrowLeft size={16} /> Toutes les campagnes</button>

	<header class="card mb-4 flex flex-col gap-4">
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div class="min-w-0">
				<div class="eyebrow mb-1 flex items-center gap-1.5">
					{#if dom}<span class="h-2 w-2 rounded-full" style="background:{dom.color}"></span>{dom.name} ·{/if}
					<span class="chip {STATUS[c.status].style}">{STATUS[c.status].label}</span>
				</div>
				<h1 class="text-2xl font-black tracking-tight sm:text-3xl">{c.name}</h1>
				{#if c.intent}<p class="text-sm text-muted">{c.intent}</p>{/if}
			</div>
			<div class="flex flex-wrap gap-2">
				<button class="btn btn-ghost text-xs" onclick={() => (editingInfo = !editingInfo)} aria-expanded={editingInfo}><Pencil size={13} /> Modifier</button>
				{#if c.status === 'active'}
					<button class="btn text-xs" onclick={() => setStatus(c, 'paused')}><Pause size={13} /> Mettre à quai</button>
				{:else if c.status === 'paused'}
					<button class="btn text-xs" onclick={() => setStatus(c, 'active')}><Play size={13} /> Reprendre la route</button>
				{/if}
			</div>
		</div>

		{#if editingInfo}
			<div class="grid gap-3 border-t border-line pt-3 sm:grid-cols-2">
				<div>
					<label class="label" for="e-name">Nom</label>
					<input id="e-name" class="input" bind:value={c.name} onchange={() => store.saveCampaign(c)} />
				</div>
				<div>
					<label class="label" for="e-dom">Stat</label>
					<select id="e-dom" class="input" bind:value={c.domainId} onchange={() => store.saveCampaign(c)}>
						{#each data.domains as d (d.id)}<option value={d.id}>{d.name}</option>{/each}
					</select>
				</div>
				<div>
					<label class="label" for="e-intent">Intention</label>
					<input id="e-intent" class="input" bind:value={c.intent} onchange={() => store.saveCampaign(c)} />
				</div>
				<div>
					<label class="label" for="e-target">Arrivée visée</label>
					<input id="e-target" class="input" type="date" bind:value={c.target} onchange={() => store.saveCampaign(c)} />
				</div>
				<div class="flex justify-end sm:col-span-2">
					<ConfirmButton
						class="btn btn-ghost text-xs"
						label="Supprimer la campagne"
						confirmLabel="Supprimer définitivement ?"
						onconfirm={() => {
							store.removeCampaign(c.id);
							selectedId = null;
						}}
					/>
				</div>
			</div>
		{/if}

		<div class="px-1">{@render route(c, 'lg')}</div>

		<div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-muted">
			<span>{p.chaptersDone}/{c.chapters.length} étapes</span>
			<span>{p.questsDone}/{p.quests} quêtes · {p.pct} %</span>
			{#if c.target}<span class="flex items-center gap-1"><Flag size={11} /> Arrivée visée le {formatShort(c.target)}</span>{/if}
			{#if c.done}<span class="font-bold text-emerald-700">Atteinte le {formatShort(c.done)}</span>{/if}
		</div>
	</header>

	<!-- Étapes -->
	<ol class="flex flex-col gap-4">
		{#each c.chapters as ch, i (ch.id)}
			{@const isLocked = locked(c, i)}
			{@const isCurrent = i === currentIndex(c)}
			{@const qDone = ch.quests.filter((q) => q.done).length}
			<li id="ch-{ch.id}" class="card scroll-mt-4 p-2 {isCurrent ? 'border-accent' : ''} {isLocked ? 'opacity-60' : ''}">
				<div class="flex items-center gap-3 px-2 pt-1.5 pb-2">
					<span
						class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black {ch.done
							? 'bg-accent text-on-accent'
							: isCurrent
								? 'bg-accent-soft text-accent'
								: 'bg-raised text-muted'}"
					>
						{#if ch.done}<Check size={15} strokeWidth={3} />{:else if isLocked}<Lock size={13} strokeWidth={2.6} />{:else}{i + 1}{/if}
					</span>
					<div class="min-w-0 flex-1">
						<h2 class="truncate font-extrabold">{ch.name}</h2>
						<div class="text-[11px] font-semibold text-muted">
							{#if ch.done}Étape atteinte le {formatShort(ch.done)}
							{:else if isLocked}Verrouillée : termine l'étape précédente
							{:else}{qDone}/{ch.quests.length} quêtes · l'étape rapporte +{XP_REWARDS.chapter} XP <LootLine loot={LOOT_REWARDS.chapter} signed size={10} />{/if}
						</div>
					</div>
					<ConfirmButton
						class="btn btn-ghost h-7 shrink-0 px-2 text-[11px] text-muted"
						label="Retirer"
						confirmLabel="Retirer l'étape ?"
						onconfirm={() => {
							c.chapters.splice(i, 1);
							store.saveCampaign(c);
						}}
					/>
				</div>

				{#if ch.quests.length}
					<div class="mx-2 mb-2 h-1.5 overflow-hidden rounded-full bg-zinc-200">
						<div class="h-full rounded-full bg-accent transition-[width]" style="width: {ch.quests.length ? (100 * qDone) / ch.quests.length : 0}%"></div>
					</div>
				{/if}

				<ul class="flex flex-col gap-1">
					{#each ch.quests as q (q.id)}
						{@const tasks = data.tasks.filter((t) => t.questId === q.id)}
						<li class="rounded-xl {q.boss && !q.done ? 'bg-rose-50' : 'hover:bg-raised'}">
							<div class="flex items-center gap-3 px-2.5 py-2">
								{#if isLocked}
									<span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-line text-muted"><Lock size={11} /></span>
								{:else}
									<TaskCheck done={!!q.done} effort={q.boss ? 'hard' : 'medium'} label="{q.done ? 'Rouvrir' : 'Accomplir'} {q.name}" ontoggle={() => toggleQuest(c, ch, q.id)} />
								{/if}
								<span class="min-w-0 flex-1">
									<span class="flex items-center gap-1.5 text-sm font-semibold {q.done ? 'text-muted line-through' : ''}">
										{#if q.boss}<Skull size={14} class="shrink-0 text-rose-700" />{/if}
										<span class="truncate">{q.name}</span>
									</span>
									{#if tasks.length}<span class="text-[11px] font-semibold text-muted">{tasks.filter((t) => t.done).length}/{tasks.length} tâches</span>{/if}
								</span>
								<span class="flex shrink-0 items-center gap-1.5 text-[11px] font-bold text-muted">
									+{q.xp} XP <span class="hidden sm:inline"><LootLine loot={q.boss ? LOOT_REWARDS.boss : LOOT_REWARDS.quest} signed size={10} /></span>
								</span>
							</div>
							{#if tasks.length || (!q.done && !isLocked)}
								<ul class="flex flex-col gap-1 pr-2.5 pb-2 pl-11">
									{#each tasks as t (t.id)}
										<li class="flex items-center gap-2 text-xs">
											<TaskCheck done={!!t.done} effort={t.effort} label="{t.done ? 'Rouvrir' : 'Terminer'} {t.title}" ontoggle={() => toggleTask(t)} />
											<span class="font-semibold {t.done ? 'text-muted line-through' : ''}">{t.title}</span>
										</li>
									{/each}
									{#if !q.done && !isLocked}
										<li>
											<form class="flex gap-1" onsubmit={(e) => (e.preventDefault(), addTask(q.id))}>
												<input class="input py-1 text-xs" placeholder="Ajouter une tâche…" title="La tâche va dans « Cette semaine »" bind:value={taskDraft[q.id]} aria-label="Nouvelle tâche pour {q.name}" />
												<button class="btn h-7 w-7 shrink-0 p-0" aria-label="Ajouter la tâche"><Plus size={13} /></button>
											</form>
										</li>
									{/if}
								</ul>
							{/if}
						</li>
					{:else}
						<p class="px-2.5 pb-2 text-sm text-muted">Pas encore de quête sur cette étape.</p>
					{/each}
				</ul>

				{#if questForm?.chapterId === ch.id}
					<form class="mx-2 mt-1 mb-1 flex flex-col gap-2 rounded-xl border border-line bg-raised p-2.5" onsubmit={(e) => (e.preventDefault(), addQuest(c))}>
						<input class="input" placeholder="Nouvelle quête" bind:value={questForm.name} aria-label="Nom de la quête" {@attach (el) => el.focus()} />
						<div class="flex flex-wrap items-center gap-2">
							<div class="inline-flex rounded-2xl border border-line bg-surface p-0.5" role="radiogroup" aria-label="XP de la quête">
								{#each QUEST_XP as xp (xp)}
									<button
										type="button"
										role="radio"
										aria-checked={questForm.xp === xp}
										class="rounded-xl px-2 py-1 text-[11px] font-bold {questForm.xp === xp ? 'bg-accent text-on-accent' : 'text-muted hover:text-ink'}"
										onclick={() => (questForm!.xp = xp)}>{xp} XP</button
									>
								{/each}
							</div>
							<button
								type="button"
								aria-pressed={questForm.boss}
								class="chip border px-2.5 py-1 {questForm.boss ? 'border-rose-300 bg-rose-100 text-rose-800' : 'border-line bg-surface text-muted'}"
								onclick={() => (questForm!.boss = !questForm!.boss)}><Skull size={12} /> Boss</button
							>
							<div class="ml-auto flex gap-2">
								<button type="button" class="btn btn-ghost text-xs" onclick={() => (questForm = null)}>Annuler</button>
								<button class="btn btn-primary text-xs" disabled={!questForm.name.trim()}>Ajouter</button>
							</div>
						</div>
					</form>
				{:else if !ch.done}
					<button class="btn btn-ghost mx-1 mb-1 text-xs text-accent" onclick={() => (questForm = { chapterId: ch.id, name: '', xp: 100, boss: false })}>
						<Plus size={14} /> Quête
					</button>
				{/if}
			</li>
		{/each}
	</ol>

	<form class="card mt-4 flex gap-2 p-2" onsubmit={(e) => (e.preventDefault(), addChapter(c))}>
		<input class="input" placeholder="Nouvelle étape de la route…" bind:value={newChapter} aria-label="Nouvelle étape" />
		<button class="btn shrink-0" disabled={!newChapter.trim()}><Plus size={15} /> Étape</button>
	</form>

	<!-- Arrivée -->
	<section class="card mt-4 flex flex-wrap items-center justify-between gap-3 {c.done ? 'border-emerald-300' : ''}">
		<div class="flex items-center gap-3">
			<span class="flex h-10 w-10 items-center justify-center rounded-full {c.done ? 'bg-reward text-on-accent' : 'bg-raised text-reward'}"><Sparkles size={18} /></span>
			<div>
				<div class="font-extrabold">{c.done ? 'Destination atteinte' : 'Arrivée à destination'}</div>
				<div class="flex items-center gap-1.5 text-xs font-semibold text-muted">
					+{XP_REWARDS.campaign} XP <LootLine loot={LOOT_REWARDS.campaign} signed size={11} /> · regain d'Inspiration
				</div>
			</div>
		</div>
		{#if c.done}
			<button class="btn btn-ghost text-xs" onclick={() => toggleCampaign(c)}>Rouvrir la campagne</button>
		{:else}
			<ConfirmButton class="btn btn-primary text-xs" label="Terminer la campagne" confirmLabel="Confirmer l'arrivée ?" onconfirm={() => toggleCampaign(c)} />
		{/if}
	</section>
{/if}
