<script lang="ts">
	import PageHint from '#lib/components/PageHint.svelte';
	import {
		ArrowRightLeft,
		BookOpen,
		ChevronDown,
		Clapperboard,
		Gift,
		Heart,
		Lightbulb,
		List,
		ListPlus,
		MapPin,
		Music,
		NotebookTabs,
		Pencil,
		Pin,
		PinOff,
		Plane,
		Plus,
		Search,
		ShoppingCart,
		Sofa,
		Sparkles,
		StickyNote,
		UtensilsCrossed,
		X
	} from '@lucide/svelte';
	import { onMount } from 'svelte';
	import ConfirmButton from '#lib/components/ConfirmButton.svelte';
	import { formatShort, today } from '#lib/dates.ts';
	import { store, uid } from '#lib/store.svelte.ts';
	import { toasts } from '#lib/toasts.svelte.ts';
	import type { NoteItem, NoteList } from '#lib/types.ts';

	const ICONS = {
		cart: ShoppingCart,
		sofa: Sofa,
		sparkles: Sparkles,
		pin: MapPin,
		book: BookOpen,
		bulb: Lightbulb,
		gift: Gift,
		film: Clapperboard,
		music: Music,
		food: UtensilsCrossed,
		plane: Plane,
		heart: Heart,
		list: List,
		note: StickyNote
	} as const;
	type IconKey = keyof typeof ICONS;
	const COLORS = ['#16a34a', '#b45309', '#9333ea', '#0284c7', '#4f46e5', '#e11d48', '#ea580c', '#0d9488'];
	const LAST_KEY = 'rpg-habitudes-v3:carnet';

	const data = $derived(store.data);
	const lists = $derived([...data.notebook].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned)));

	let selectedId = $state<string | null>(null);
	const selected = $derived(data.notebook.find((l) => l.id === selectedId) ?? lists[0] ?? null);
	let draft = $state('');
	let query = $state('');
	let showDone = $state(false);
	let editingName = $state(false);
	let editingItem = $state<string | null>(null);
	let creating = $state<{ name: string; kind: 'list' | 'note'; icon: IconKey; color: string } | null>(null);

	onMount(() => {
		try {
			const last = localStorage.getItem(LAST_KEY);
			if (last && data.notebook.some((l) => l.id === last)) selectedId = last;
		} catch {
			// stockage indisponible : on ouvre la première liste
		}
	});

	function select(id: string) {
		selectedId = id;
		editingName = false;
		editingItem = null;
		showDone = false;
		query = '';
		try {
			localStorage.setItem(LAST_KEY, id);
		} catch {
			// rien à faire
		}
	}

	// Teinte douce d'une couleur de liste, lisible dans les deux thèmes.
	const soft = (c: string) => `background: color-mix(in oklab, ${c} 18%, transparent); color: color-mix(in oklab, ${c} 65%, var(--ink));`;
	const left = (l: NoteList) => (l.kind === 'note' ? 0 : l.items.filter((i) => !i.done).length);
	const touch = (l: NoteList) => ((l.updatedAt = today()), store.persist());

	// Ajout à la chaîne : Entrée ajoute et garde la main ; plusieurs lignes collées donnent plusieurs éléments.
	function addItems(l: NoteList) {
		const lines = draft.split(/\r?\n/).map((s) => s.replace(/^[-*•\s]+/, '').trim()).filter(Boolean);
		if (!lines.length) return;
		l.items.unshift(...lines.map((text) => ({ id: uid(), text, createdAt: today() })));
		draft = '';
		touch(l);
	}

	function onPaste(e: ClipboardEvent, l: NoteList) {
		const text = e.clipboardData?.getData('text') ?? '';
		if (!text.includes('\n')) return;
		e.preventDefault();
		draft = text;
		addItems(l);
	}

	function toggle(l: NoteList, item: NoteItem) {
		item.done = !item.done;
		touch(l);
	}

	function removeItem(l: NoteList, id: string) {
		l.items = l.items.filter((i) => i.id !== id);
		touch(l);
	}

	function clearDone(l: NoteList) {
		l.items = l.items.filter((i) => !i.done);
		touch(l);
	}

	// Passe un élément dans « À faire » (cette semaine) : il rapportera de l'XP une fois fait.
	function toTask(l: NoteList, item: NoteItem) {
		store.saveTask({ id: uid(), title: item.text, list: 'week', note: `Depuis le carnet : ${l.name}` });
		removeItem(l, item.id);
		toasts.push({ title: 'Ajoutée à « Cette semaine »' });
	}

	function create(e: SubmitEvent) {
		e.preventDefault();
		if (!creating || !creating.name.trim()) return;
		const l: NoteList = { id: uid(), name: creating.name.trim(), kind: creating.kind, icon: creating.icon, color: creating.color, items: [], body: '', createdAt: today() };
		data.notebook.push(l);
		store.persist();
		creating = null;
		select(l.id);
	}

	function remove(l: NoteList) {
		data.notebook = data.notebook.filter((x) => x.id !== l.id);
		store.persist();
		selectedId = null;
	}

	const q = $derived(query.trim().toLowerCase());
	const matches = $derived(
		q
			? data.notebook
					.map((l) => ({
						l,
						items: l.items.filter((i) => i.text.toLowerCase().includes(q)),
						inBody: l.kind === 'note' && !!l.body?.toLowerCase().includes(q),
						inName: l.name.toLowerCase().includes(q)
					}))
					.filter((m) => m.items.length || m.inBody || m.inName)
			: []
	);
</script>

{#snippet listIcon(l: { icon: string; color: string }, size: number)}
	{@const Icon = ICONS[l.icon as IconKey] ?? List}
	<span class="flex shrink-0 items-center justify-center rounded-xl" style="{soft(l.color)} width: {size + 16}px; height: {size + 16}px">
		<Icon {size} strokeWidth={2.3} />
	</span>
{/snippet}

<!-- En-tête -->
<header class="mb-5 flex flex-wrap items-end justify-between gap-4">
	<div>
		<div class="eyebrow mb-1 flex items-center gap-1.5 text-accent"><NotebookTabs size={13} strokeWidth={2.4} /> Carnet de bord</div>
		<h1 class="text-3xl font-black tracking-tight">Carnet</h1>
		<p class="text-sm text-muted">Courses, envies, idées, endroits à voir : tout ce qui n'est pas une tâche, mais qu'on ne veut pas oublier.</p>
	</div>
	<label class="relative w-full sm:w-64">
		<Search size={15} class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
		<input class="input py-2 pl-9" placeholder="Chercher dans le carnet…" bind:value={query} aria-label="Chercher dans le carnet" />
	</label>
</header>

<PageHint id="carnet" title="Le carnet de bord">Des listes et des notes libres (courses, idées, à essayer) qui ne rapportent rien : juste pour ne rien oublier.</PageHint>


<!-- Les listes, en tuiles défilantes -->
<div class="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0" role="tablist" aria-label="Listes du carnet">
	{#each lists as l (l.id)}
		{@const active = selected?.id === l.id && !q}
		<button
			role="tab"
			aria-selected={active}
			class="flex shrink-0 items-center gap-2 rounded-2xl border py-1.5 pr-3 pl-1.5 text-left transition-colors {active ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:bg-raised'}"
			onclick={() => select(l.id)}
			{@attach (el) => {
				if (active) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
			}}
		>
			{@render listIcon(l, 15)}
			<span class="text-sm font-bold whitespace-nowrap">{l.name}</span>
			{#if l.pinned}<Pin size={11} class="text-muted" />{/if}
			{#if left(l)}<span class="chip bg-zinc-100 text-muted">{left(l)}</span>{/if}
		</button>
	{/each}
	<button
		class="flex shrink-0 items-center gap-1.5 rounded-2xl border border-dashed border-line px-3 py-1.5 text-sm font-bold text-muted transition-colors hover:border-accent hover:text-accent"
		onclick={() => (creating = { name: '', kind: 'list', icon: 'list', color: COLORS[Math.floor(Math.random() * COLORS.length)] })}
	>
		<ListPlus size={16} /> Nouvelle
	</button>
</div>

<!-- Création d'une liste ou d'une note -->
{#if creating}
	<form class="card mb-4 flex flex-col gap-3 border-accent" onsubmit={create}>
		<div class="flex items-center gap-3">
			{@render listIcon(creating, 18)}
			<input class="input py-2 text-base font-bold" placeholder="Nom (ex. Restos à tester)" bind:value={creating.name} aria-label="Nom" {@attach (el) => el.focus()} />
		</div>
		<div class="flex flex-wrap items-center gap-2">
			<div class="inline-flex rounded-2xl border border-line bg-raised p-0.5" role="radiogroup" aria-label="Type">
				{#each [{ v: 'list', l: 'Liste à cocher', i: List }, { v: 'note', l: 'Note libre', i: StickyNote }] as t (t.v)}
					<button
						type="button"
						role="radio"
						aria-checked={creating.kind === t.v}
						class="flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-bold {creating.kind === t.v ? 'bg-accent text-on-accent' : 'text-muted hover:text-ink'}"
						onclick={() => (creating!.kind = t.v as 'list' | 'note')}><t.i size={13} />{t.l}</button
					>
				{/each}
			</div>
		</div>
		<div class="flex flex-wrap gap-1" role="radiogroup" aria-label="Icône">
			{#each Object.entries(ICONS) as [key, Icon] (key)}
				<button
					type="button"
					role="radio"
					aria-checked={creating.icon === key}
					aria-label={key}
					class="flex h-8 w-8 items-center justify-center rounded-xl border transition-colors {creating.icon === key ? 'border-accent bg-accent-soft text-accent' : 'border-transparent text-muted hover:bg-raised'}"
					onclick={() => (creating!.icon = key as IconKey)}><Icon size={16} /></button
				>
			{/each}
		</div>
		<div class="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Couleur">
			{#each COLORS as c (c)}
				<button
					type="button"
					role="radio"
					aria-checked={creating.color === c}
					aria-label="Couleur {c}"
					class="h-7 w-7 rounded-full transition-transform {creating.color === c ? 'scale-110 ring-2 ring-accent ring-offset-2 ring-offset-surface' : 'hover:scale-110'}"
					style="background: {c}"
					onclick={() => (creating!.color = c)}
				></button>
			{/each}
			<div class="ml-auto flex gap-2">
				<button type="button" class="btn btn-ghost text-xs" onclick={() => (creating = null)}>Annuler</button>
				<button class="btn btn-primary text-xs" disabled={!creating.name.trim()}>Créer</button>
			</div>
		</div>
	</form>
{/if}

{#if q}
	<!-- Résultats de recherche -->
	<section class="flex flex-col gap-3">
		{#each matches as m (m.l.id)}
			<button class="card flex flex-col gap-1.5 text-left transition-colors hover:border-accent" onclick={() => select(m.l.id)}>
				<span class="flex items-center gap-2 font-extrabold">{@render listIcon(m.l, 13)}{m.l.name}</span>
				{#each m.items as i (i.id)}<span class="pl-1 text-sm {i.done ? 'text-muted line-through' : ''}">· {i.text}</span>{/each}
				{#if m.inBody}<span class="line-clamp-2 pl-1 text-sm text-muted">{m.l.body}</span>{/if}
			</button>
		{:else}
			<p class="card text-sm text-muted">Rien ne correspond à « {query} ».</p>
		{/each}
	</section>
{:else if selected}
	{@const l = selected}
	{@const open = l.items.filter((i) => !i.done)}
	{@const done = l.items.filter((i) => i.done)}
	<section class="card flex flex-col gap-3">
		<!-- En-tête de la liste -->
		<div class="flex items-center gap-3">
			{@render listIcon(l, 18)}
			<div class="min-w-0 flex-1">
				{#if editingName}
					<input
						class="input py-1.5 text-lg font-extrabold"
						bind:value={l.name}
						aria-label="Nom de la liste"
						onblur={() => ((editingName = false), touch(l))}
						onkeydown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
						{@attach (el) => el.focus()}
					/>
				{:else}
					<h2 class="truncate text-xl font-extrabold">{l.name}</h2>
				{/if}
				<div class="text-[11px] font-semibold text-muted">
					{#if l.kind === 'list'}{open.length} à prendre{#if done.length} · {done.length} fait{done.length > 1 ? 's' : ''}{/if}{:else}Note libre{/if}
					{#if l.updatedAt} · modifiée le {formatShort(l.updatedAt)}{/if}
				</div>
			</div>
			<button class="btn btn-ghost h-8 w-8 p-0 text-muted" onclick={() => (editingName = true)} aria-label="Renommer"><Pencil size={15} /></button>
			<button class="btn btn-ghost h-8 w-8 p-0 text-muted" onclick={() => ((l.pinned = !l.pinned), store.persist())} aria-label={l.pinned ? 'Désépingler' : 'Épingler en tête'}>
				{#if l.pinned}<PinOff size={15} />{:else}<Pin size={15} />{/if}
			</button>
		</div>

		{#if l.kind === 'note'}
			<textarea
				class="input min-h-64 resize-y py-3 text-[15px] leading-relaxed"
				placeholder="Écris ce qui te passe par la tête… (enregistré au fil de l'eau)"
				bind:value={l.body}
				oninput={() => touch(l)}
				aria-label="Note"
			></textarea>
		{:else}
			<!-- Ajout rapide -->
			<form class="flex gap-2" onsubmit={(e) => (e.preventDefault(), addItems(l))}>
				<input
					class="input py-2.5 text-base"
					placeholder="Ajouter… (Entrée pour enchaîner, colle une liste entière)"
					bind:value={draft}
					onpaste={(e) => onPaste(e, l)}
					aria-label="Nouvel élément"
				/>
				<button class="btn btn-primary shrink-0 px-4" aria-label="Ajouter"><Plus size={18} strokeWidth={2.6} /></button>
			</form>

			<ul class="flex flex-col">
				{#each open as item (item.id)}
					<li class="group flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-raised">
						<button
							type="button"
							role="checkbox"
							aria-checked="false"
							aria-label="Cocher {item.text}"
							class="h-6 w-6 shrink-0 rounded-full border-2 transition-transform hover:scale-110"
							style="border-color: {l.color}"
							onclick={() => toggle(l, item)}
						></button>
						{#if editingItem === item.id}
							<input
								class="input py-1"
								bind:value={item.text}
								aria-label="Modifier l'élément"
								onblur={() => ((editingItem = null), touch(l))}
								onkeydown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
								{@attach (el) => el.focus()}
							/>
						{:else}
							<button class="min-w-0 flex-1 truncate text-left text-[15px] font-semibold" onclick={() => (editingItem = item.id)} title="Modifier">{item.text}</button>
						{/if}
						<span class="flex shrink-0 items-center gap-0.5 opacity-60 transition-opacity group-hover:opacity-100 sm:opacity-0 sm:group-focus-within:opacity-100">
							<button class="btn btn-ghost h-7 w-7 p-0 text-muted" onclick={() => toTask(l, item)} aria-label="Transformer « {item.text} » en tâche" title="En faire une tâche"><ArrowRightLeft size={14} /></button>
							<button class="btn btn-ghost h-7 w-7 p-0 text-muted" onclick={() => removeItem(l, item.id)} aria-label="Retirer {item.text}"><X size={15} /></button>
						</span>
					</li>
				{:else}
					<li class="flex flex-col items-center gap-1 py-6 text-center text-sm text-muted">
						{@render listIcon(l, 20)}
						<span class="mt-1 font-semibold">{done.length ? 'Tout est coché, bravo !' : 'Liste vide pour l’instant.'}</span>
					</li>
				{/each}
			</ul>

			{#if done.length}
				<div class="border-t border-line pt-2">
					<div class="flex items-center justify-between">
						<button class="flex items-center gap-1.5 px-1 text-sm font-bold text-muted hover:text-ink" aria-expanded={showDone} onclick={() => (showDone = !showDone)}>
							<ChevronDown size={15} class="transition-transform {showDone ? 'rotate-180' : ''}" /> Cochés ({done.length})
						</button>
						<button class="btn btn-ghost text-xs text-muted" onclick={() => clearDone(l)}>Tout effacer</button>
					</div>
					{#if showDone}
						<ul class="mt-1 flex flex-col">
							{#each done as item (item.id)}
								<li class="flex items-center gap-3 rounded-xl px-2 py-1 hover:bg-raised">
									<button
										type="button"
										role="checkbox"
										aria-checked="true"
										aria-label="Décocher {item.text}"
										class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-on-accent"
										style="background: {l.color}"
										onclick={() => toggle(l, item)}><span class="text-xs font-black">✓</span></button
									>
									<span class="min-w-0 flex-1 truncate text-sm text-muted line-through">{item.text}</span>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			{/if}
		{/if}

		<div class="flex justify-end border-t border-line pt-2">
			<ConfirmButton class="btn btn-ghost text-xs text-muted" label="Supprimer {l.kind === 'note' ? 'la note' : 'la liste'}" confirmLabel="Supprimer définitivement ?" onconfirm={() => remove(l)} />
		</div>
	</section>
{:else}
	<div class="card flex flex-col items-center gap-2 py-10 text-center">
		<NotebookTabs size={28} class="text-accent" />
		<p class="font-bold">Ton carnet est vide.</p>
		<p class="text-sm text-muted">Crée une liste de courses, d'envies ou une note libre.</p>
	</div>
{/if}
