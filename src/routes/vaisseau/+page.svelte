<script lang="ts">
	import PageHint from '#lib/components/PageHint.svelte';
	import { ArrowUp, Atom, CircleCheck, Flame, Gem, Hexagon, Lock, Mountain, Package, RadioTower, Shield, Trophy, Wind, Wrench, Zap } from '@lucide/svelte';
	import LootLine from '#lib/components/LootLine.svelte';
	import OrbitRing from '#lib/components/OrbitRing.svelte';
	import ShipArt from '#lib/components/ShipArt.svelte';
	import { MODULE_MAX_LEVEL, SHIELD, SKILL_MAX_LEVEL } from '#lib/config.ts';
	import { formatShort, today } from '#lib/dates.ts';
	import { moduleLevel, skillLevel } from '#lib/engine/effects.ts';
	import {
		canAfford,
		MATERIAL_IDS,
		materials,
		moduleTotal,
		orbit,
		orbitReward,
		sectorPoints,
		sectorsLit,
		shipClass,
		skillPoints,
		upgradeCost
	} from '#lib/engine/ship.ts';
	import { shieldState } from '#lib/engine/shields.ts';
	import { TROPHIES } from '#lib/engine/trophies.ts';
	import { store } from '#lib/store.svelte.ts';
	import type { Loot, ModuleId, SkillId } from '#lib/types.ts';
	import { INTRO, MATERIALS, PLANET_NAME, SHIP_CLASSES, SHIP_MODULES, SHIP_NAME, SKILLS } from '#lib/universe.ts';

	const data = $derived(store.data);
	const stock = $derived(materials(data));
	const points = $derived(Math.max(0, skillPoints(data)));
	const sectors = $derived(orbit(data, today(), today()));
	const total = $derived(moduleTotal(data));
	const maxTotal = SHIP_MODULES.length * MODULE_MAX_LEVEL;
	const nextClass = $derived(SHIP_CLASSES.find((c) => c.from > total));
	const levels = $derived(
		Object.fromEntries(SHIP_MODULES.map((m) => [m.id, moduleLevel(data, m.id)])) as Record<ModuleId, number>
	);
	// Trophées gagnés d'abord (les plus récents en tête), puis ceux à décrocher.
	const trophies = $derived(
		[...TROPHIES].sort((x, y) => (data.trophies[y.id] ?? '').localeCompare(data.trophies[x.id] ?? ''))
	);
	const unlocked = $derived(TROPHIES.filter((t) => data.trophies[t.id]).length);

	const MODULE_ICON = { reactor: Atom, hull: Shield, thrusters: Flame, antenna: RadioTower } as const;
	const SKILL_ICON = { recovery: Wind, logistics: Package, endurance: Mountain, engineering: Wrench } as const;
	const MAT_ICON = { metal: Hexagon, energy: Zap, crystal: Gem } as const;
	const MAT_COLOR = { metal: 'text-zinc-500', energy: 'text-amber-500', crystal: 'text-accent' } as const;

	const shields = $derived(shieldState(data));
	const canBuyShield = $derived(shields.stock < shields.max && canAfford(stock, SHIELD.cost));

	let flashed = $state<ModuleId | null>(null);

	// Matériaux qui manquent pour un coût donné.
	function missing(cost: Loot): Loot {
		const out: Loot = {};
		for (const m of MATERIAL_IDS) if ((cost[m] ?? 0) > stock[m]) out[m] = (cost[m] ?? 0) - stock[m];
		return out;
	}

	function upgrade(id: ModuleId) {
		if (!store.upgradeModule(id)) return;
		flashed = id;
		setTimeout(() => (flashed = null), 1200);
	}

	function learn(id: SkillId) {
		store.buySkill(id);
	}
</script>

<PageHint id="vaisseau" title="Le chantier naval">Les matériaux gagnés en agissant réparent les modules : chaque niveau donne un bonus durable. Les boucliers de série se fabriquent ici aussi.</PageHint>


<!-- Le vaisseau -->
<section class="card mb-5 grid gap-5 overflow-hidden p-0 md:grid-cols-5">
	<div class="relative flex items-center justify-center bg-zinc-100 px-4 py-6 md:col-span-3">
		<div class="pointer-events-none absolute inset-0 opacity-70" style="background-image: radial-gradient(1px 1px at 30px 20px, var(--star), transparent), radial-gradient(1.5px 1.5px at 140px 90px, var(--star), transparent), radial-gradient(1px 1px at 220px 40px, var(--star), transparent); background-size: 260px 140px"></div>
		<div class="relative w-full max-w-md"><ShipArt {levels} highlight={flashed} /></div>
	</div>
	<div class="flex flex-col gap-3 p-5 md:col-span-2 md:pl-0">
		<div>
			<div class="eyebrow text-accent">En orbite autour de {PLANET_NAME}</div>
			<h1 class="text-3xl font-black tracking-tight">{SHIP_NAME}</h1>
			<div class="mt-1 flex flex-wrap items-center gap-2">
				<span class="chip bg-accent-soft text-accent">Classe {shipClass(data)}</span>
				<span class="text-xs font-semibold text-muted">modules {total}/{maxTotal}</span>
			</div>
		</div>
		<div>
			<div class="h-2 overflow-hidden rounded-full bg-zinc-200">
				<div class="h-full rounded-full bg-accent transition-[width] duration-700" style="width: {(100 * total) / maxTotal}%"></div>
			</div>
			<div class="mt-1 text-[11px] font-semibold text-muted">
				{#if nextClass}Classe {nextClass.name} dans {nextClass.from - total} niveau{nextClass.from - total > 1 ? 'x' : ''} de module{:else}Classe maximale atteinte{/if}
			</div>
		</div>
		<p class="text-sm leading-relaxed text-muted">{INTRO}</p>
	</div>
</section>

<!-- Soute -->
<section class="mb-5">
	<h2 class="eyebrow mb-2 px-1">Soute</h2>
	<div class="grid grid-cols-3 gap-3">
		{#each MATERIAL_IDS as m (m)}
			{@const Icon = MAT_ICON[m]}
			<div class="card flex flex-col items-center gap-1 px-2 py-4 text-center" title={MATERIALS[m].lore}>
				<span class="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-100 {MAT_COLOR[m]}"><Icon size={22} strokeWidth={2.2} /></span>
				<span class="text-2xl font-black tabular-nums">{stock[m]}</span>
				<span class="text-xs font-bold text-muted">{MATERIALS[m].name}</span>
				<span class="hidden text-[11px] leading-snug text-muted sm:block">{MATERIALS[m].lore}</span>
			</div>
		{/each}
	</div>
	<div class="card mt-3 flex flex-wrap items-center gap-3">
		<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-800"><Shield size={20} strokeWidth={2.3} /></span>
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-2 font-extrabold">
				Boucliers de série
				<span class="flex gap-0.5" aria-label="{shields.stock} sur {shields.max}">
					{#each Array(shields.max) as _, i (i)}
						<Shield size={14} strokeWidth={2.4} class={i < shields.stock ? 'fill-sky-300 text-sky-700' : 'text-muted opacity-40'} />
					{/each}
				</span>
			</div>
			<p class="text-xs text-muted">
				Des jokers : le lendemain d'un raté qui casse une série d'au moins {SHIELD.minStreak} jours, tu choisis d'en utiliser un pour la sauver.
				Un bouclier toutes les {SHIELD.earnEvery} journées complètes ; la Coque renforcée agrandit la réserve.
			</p>
		</div>
		<button class="btn text-xs" disabled={!canBuyShield} onclick={() => store.buyShield()}>
			Fabriquer <LootLine loot={SHIELD.cost} size={11} />
		</button>
	</div>
</section>

<!-- Orbite -->
<section class="card mb-5 grid items-center gap-4 md:grid-cols-5">
	<div class="md:col-span-3"><OrbitRing {sectors} current={today()} /></div>
	<div class="md:col-span-2">
		<h2 class="font-extrabold">Orbite de la semaine</h2>
		<p class="mt-1 text-sm text-muted">
			Un secteur s'allume quand toutes les obligations du jour sont faites (un jour de repos compte aussi) ; à moitié fait, il compte pour un demi-secteur.
		</p>
		<div class="mt-3 rounded-2xl bg-zinc-100 p-3">
			<div class="text-xs font-semibold text-muted">
				{sectorsLit(sectors)}/7 allumés · {sectorPoints(sectors)} points d'orbite
			</div>
			<div class="mt-1 flex items-center gap-2 text-sm font-bold">
				Amarrage au Havre (revue hebdo) : <LootLine loot={orbitReward(data, sectors)} signed size={13} />
			</div>
			<div class="mt-0.5 text-[11px] text-muted">Bonus de cristaux si les sept secteurs sont allumés.</div>
		</div>
	</div>
</section>

<!-- Modules -->
<section class="mb-6">
	<h2 class="eyebrow mb-2 px-1">Modules du vaisseau</h2>
	<div class="grid gap-3 sm:grid-cols-2">
		{#each SHIP_MODULES as m (m.id)}
			{@const level = moduleLevel(data, m.id)}
			{@const cost = upgradeCost(data, m.id)}
			{@const Icon = MODULE_ICON[m.id]}
			<div class="card flex flex-col gap-3 transition-shadow {flashed === m.id ? 'ring-2 ring-accent' : ''}">
				<div class="flex items-start gap-3">
					<span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl {level ? 'bg-accent text-on-accent' : 'bg-zinc-100 text-muted'}">
						<Icon size={22} strokeWidth={2.2} />
					</span>
					<div class="min-w-0 flex-1">
						<div class="flex items-baseline justify-between gap-2">
							<div class="font-extrabold">{m.name}</div>
							<span class="text-xs font-bold text-muted tabular-nums">niv. {level}/{MODULE_MAX_LEVEL}</span>
						</div>
						<p class="text-xs text-muted">{m.lore}</p>
					</div>
				</div>
				<div class="flex gap-1" aria-hidden="true">
					{#each Array(MODULE_MAX_LEVEL) as _, i (i)}
						<span class="h-1.5 flex-1 rounded-full transition-colors {i < level ? 'bg-accent' : 'bg-zinc-200'}"></span>
					{/each}
				</div>
				<div class="text-sm font-semibold">{level ? m.effect(level) : 'Hors service'}</div>
				{#if cost}
					{@const lack = missing(cost)}
					{@const ok = canAfford(stock, cost)}
					<div class="mt-auto flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-zinc-100 p-2.5">
						<div class="min-w-0 text-xs">
							<div class="font-semibold text-muted">Niveau {level + 1} : <span class="text-ink">{m.effect(level + 1)}</span></div>
							<div class="mt-0.5 flex items-center gap-1.5">Coût <LootLine loot={cost} size={12} /></div>
							{#if !ok}<div class="mt-0.5 flex items-center gap-1.5 font-semibold text-rose-700">Il manque <LootLine loot={lack} size={11} /></div>{/if}
						</div>
						<button class="btn {ok ? 'btn-primary' : ''} text-xs" disabled={!ok} onclick={() => upgrade(m.id)}>
							<ArrowUp size={14} strokeWidth={2.6} /> Améliorer
						</button>
					</div>
				{:else}
					<div class="mt-auto flex items-center gap-1.5 rounded-2xl bg-accent-soft p-2.5 text-xs font-bold text-accent">
						<CircleCheck size={14} /> Niveau maximum
					</div>
				{/if}
			</div>
		{/each}
	</div>
</section>

<!-- Compétences du pilote -->
<section class="mb-6">
	<div class="mb-2 flex items-center justify-between gap-2 px-1">
		<h2 class="eyebrow">Compétences du pilote</h2>
		<span class="chip {points ? 'bg-reward-soft text-reward' : 'bg-zinc-100 text-muted'}">{points} point{points > 1 ? 's' : ''} à dépenser</span>
	</div>
	<p class="mb-3 px-1 text-xs text-muted">Chaque niveau de pilote gagné donne un point ; cinq niveaux par compétence.</p>
	<div class="grid gap-3 sm:grid-cols-2">
		{#each SKILLS as s (s.id)}
			{@const level = skillLevel(data, s.id)}
			{@const Icon = SKILL_ICON[s.id]}
			<div class="card flex flex-col gap-3">
				<div class="flex items-start gap-3">
					<span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl {level ? 'bg-reward-soft text-reward' : 'bg-zinc-100 text-muted'}">
						<Icon size={22} strokeWidth={2.2} />
					</span>
					<div class="min-w-0 flex-1">
						<div class="flex items-baseline justify-between gap-2">
							<div class="font-extrabold">{s.name}</div>
							<span class="text-xs font-bold text-muted tabular-nums">{level}/{SKILL_MAX_LEVEL}</span>
						</div>
						<p class="text-xs text-muted">{s.lore}</p>
					</div>
				</div>
				<div class="flex gap-1" aria-hidden="true">
					{#each Array(SKILL_MAX_LEVEL) as _, i (i)}
						<span class="h-1.5 flex-1 rounded-full {i < level ? 'bg-reward' : 'bg-zinc-200'}"></span>
					{/each}
				</div>
				<div class="text-sm font-semibold">{level ? s.effect(level) : 'Pas encore apprise'}</div>
				{#if level < SKILL_MAX_LEVEL}
					<div class="mt-auto flex items-center justify-between gap-2 rounded-2xl bg-zinc-100 p-2.5">
						<div class="min-w-0 text-xs font-semibold text-muted">Niveau {level + 1} : <span class="text-ink">{s.effect(level + 1)}</span></div>
						<button class="btn {points ? 'btn-primary' : ''} shrink-0 text-xs" disabled={points < 1} onclick={() => learn(s.id)}>Apprendre</button>
					</div>
				{:else}
					<div class="mt-auto flex items-center gap-1.5 rounded-2xl bg-reward-soft p-2.5 text-xs font-bold text-reward"><CircleCheck size={14} /> Maîtrisée</div>
				{/if}
			</div>
		{/each}
	</div>
</section>

<!-- Trophées -->
<section class="mb-4">
	<div class="mb-2 flex items-center justify-between gap-2 px-1">
		<h2 class="eyebrow">Trophées</h2>
		<span class="text-xs font-bold text-muted tabular-nums">{unlocked}/{TROPHIES.length}</span>
	</div>
	<div class="mb-3 h-1.5 overflow-hidden rounded-full bg-zinc-200">
		<div class="h-full rounded-full bg-reward" style="width: {(100 * unlocked) / TROPHIES.length}%"></div>
	</div>
	<div class="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
		{#each trophies as t (t.id)}
			{@const date = data.trophies[t.id]}
			<div class="card flex items-start gap-3 p-3.5 {date ? '' : 'bg-raised shadow-none'}">
				<span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full {date ? 'bg-reward-soft text-reward' : 'bg-zinc-100 text-zinc-400'}">
					{#if date}<Trophy size={20} strokeWidth={2.2} />{:else}<Lock size={17} strokeWidth={2.2} />{/if}
				</span>
				<div class="min-w-0 flex-1">
					<div class="flex items-baseline justify-between gap-2">
						<div class="font-bold {date ? '' : 'text-muted'}">{t.name}</div>
						{#if date}<span class="shrink-0 text-[11px] font-semibold text-muted">{formatShort(date)}</span>{/if}
					</div>
					<div class="text-xs text-muted">{date ? t.lore : t.hint}</div>
					<div class="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-bold {date ? 'text-reward' : 'text-muted'}">
						{#if t.reward.xp}<span>+{t.reward.xp} XP</span>{/if}
						<LootLine loot={t.reward.loot} signed size={11} />
					</div>
				</div>
			</div>
		{/each}
	</div>
</section>
