<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { AudioLines, CalendarDays, Ellipsis, Flag, ListTodo, NotebookPen, NotebookTabs, Orbit, Repeat, Rocket, Sun, UserRound, X } from '@lucide/svelte';
	import LevelRing from '#lib/components/LevelRing.svelte';
	import LootLine from '#lib/components/LootLine.svelte';
	import TestBanner from '#lib/components/TestBanner.svelte';
	import ThemeSwitch from '#lib/components/ThemeSwitch.svelte';
	import Toasts from '#lib/components/Toasts.svelte';
	import { totalXp } from '#lib/engine/progress.ts';
	import { materials } from '#lib/engine/ship.ts';
	import { levelInfo } from '#lib/engine/xp.ts';
	import { store } from '#lib/store.svelte.ts';
	import { theme } from '#lib/theme.svelte.ts';
	import { SHIP_NAME } from '#lib/universe.ts';

	let { children } = $props();

	const ITEMS = {
		today: { href: '#/', label: "Aujourd'hui", icon: Sun },
		tasks: { href: '#/taches', label: 'À faire', icon: ListTodo },
		planning: { href: '#/planning', label: 'Planning', icon: CalendarDays },
		notebook: { href: '#/carnet', label: 'Carnet', icon: NotebookTabs },
		ship: { href: '#/vaisseau', label: 'Vaisseau', icon: Rocket },
		campaigns: { href: '#/campagnes', label: 'Campagnes', icon: Flag },
		review: { href: '#/revue', label: 'Revue', icon: NotebookPen },
		pilot: { href: '#/personnage', label: 'Pilote', icon: UserRound },
		habits: { href: '#/habitudes', label: 'Habitudes', icon: Repeat },
		dance: { href: '#/danse', label: 'Danse', icon: AudioLines }
	};

	const groups = [
		{ label: 'Bord', items: [ITEMS.today, ITEMS.tasks, ITEMS.planning, ITEMS.notebook] },
		{ label: 'Voyage', items: [ITEMS.ship, ITEMS.campaigns, ITEMS.review] },
		{ label: 'Pilote', items: [ITEMS.pilot, ITEMS.habits, ITEMS.dance] }
	];
	// Sur mobile : quatre écrans principaux dans la barre, le reste dans « Plus ».
	const primary = [ITEMS.today, ITEMS.tasks, ITEMS.ship, ITEMS.pilot];
	const secondary = [ITEMS.planning, ITEMS.notebook, ITEMS.campaigns, ITEMS.review, ITEMS.habits, ITEMS.dance];

	// Routage par hash (#/planning…) pour fonctionner sur n'importe quel hébergement statique.
	const active = (href: string) => page.route.id === href.slice(1);
	const inSecondary = $derived(secondary.some((i) => active(i.href)));

	const data = $derived(store.data);
	const level = $derived(levelInfo(totalXp(data)));
	const stock = $derived(materials(data));

	let moreOpen = $state(false);

	onMount(() => {
		store.rollover();
		theme.apply();
		// L'app est prête : on retire l'écran de chargement posé par app.html.
		const splash = document.getElementById('splash');
		if (splash) {
			splash.style.opacity = '0';
			setTimeout(() => splash.remove(), 400);
		}
		const media = matchMedia('(prefers-color-scheme: light)');
		const onChange = () => theme.pref === 'auto' && theme.apply();
		media.addEventListener('change', onChange);
		return () => media.removeEventListener('change', onChange);
	});
</script>

<TestBanner />
<Toasts />

<div class="min-h-screen md:flex">
	<aside class="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-5 border-r border-line bg-surface/70 p-4 backdrop-blur md:flex">
		<a href="#/" class="flex items-center gap-2.5 px-1">
			<span class="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent"><Orbit size={20} strokeWidth={2.2} /></span>
			<span class="leading-tight">
				<span class="block font-black tracking-tight">{SHIP_NAME}</span>
				<span class="block text-[11px] font-semibold text-muted">Orbite de Kronos</span>
			</span>
		</a>

		<a href="#/personnage" class="flex items-center gap-3 rounded-2xl border border-line bg-raised p-2.5 transition-colors hover:border-accent">
			<LevelRing level={level.level} into={level.into} needed={level.needed} size={46} />
			<div class="min-w-0 text-xs">
				<div class="font-bold">Pilote</div>
				<div class="text-muted tabular-nums">{level.into} / {level.needed} XP</div>
				<div class="mt-0.5 text-[11px]"><LootLine loot={stock} size={11} /></div>
			</div>
		</a>

		<nav class="flex flex-1 flex-col gap-4 overflow-y-auto">
			{#each groups as g (g.label)}
				<div>
					<div class="eyebrow mb-1 px-3">{g.label}</div>
					{#each g.items as item (item.href)}
						<a
							href={item.href}
							aria-current={active(item.href) ? 'page' : undefined}
							class="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors {active(item.href)
								? 'bg-accent-soft text-ink'
								: 'text-muted hover:bg-raised hover:text-ink'}"
						>
							<item.icon size={17} strokeWidth={2.2} class={active(item.href) ? 'text-accent' : ''} />{item.label}
						</a>
					{/each}
				</div>
			{/each}
		</nav>

		<div class="flex items-center justify-between gap-2 px-1">
			<ThemeSwitch />
			<span class="text-[10px] font-semibold text-muted">V3</span>
		</div>
	</aside>

	<main class="mx-auto w-full min-w-0 max-w-5xl px-4 pt-5 pb-32 md:px-8 md:pt-8 md:pb-12">
		{@render children()}
	</main>
</div>

<!-- Barre de navigation mobile -->
<nav
	class="fixed inset-x-3 z-30 flex rounded-2xl border border-line bg-surface/90 px-1 py-1 backdrop-blur md:hidden"
	style="bottom: max(0.75rem, env(safe-area-inset-bottom)); box-shadow: 0 12px 30px -12px var(--shadow)"
	aria-label="Navigation principale"
>
	{#each primary as item (item.href)}
		<a
			href={item.href}
			aria-current={active(item.href) ? 'page' : undefined}
			class="flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-bold transition-colors {active(item.href)
				? 'bg-accent-soft text-ink'
				: 'text-muted'}"
		>
			<item.icon size={20} strokeWidth={2.2} class={active(item.href) ? 'text-accent' : ''} />{item.label}
		</a>
	{/each}
	<button
		class="flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-bold {inSecondary || moreOpen ? 'bg-accent-soft text-ink' : 'text-muted'}"
		aria-expanded={moreOpen}
		onclick={() => (moreOpen = !moreOpen)}
	>
		<Ellipsis size={20} strokeWidth={2.2} class={inSecondary ? 'text-accent' : ''} />Plus
	</button>
</nav>

{#if moreOpen}
	<div class="fixed inset-0 z-40 bg-zinc-50/60 backdrop-blur-sm md:hidden" role="presentation" onclick={() => (moreOpen = false)}></div>
	<div
		class="fixed inset-x-3 z-50 rounded-3xl border border-line bg-surface p-4 md:hidden"
		style="bottom: calc(max(0.75rem, env(safe-area-inset-bottom)) + 4.5rem); box-shadow: 0 20px 50px -20px var(--shadow)"
		role="dialog"
		aria-label="Autres écrans"
	>
		<div class="mb-3 flex items-center justify-between">
			<span class="eyebrow">Autres écrans</span>
			<button class="btn btn-ghost h-8 w-8 p-0" aria-label="Fermer" onclick={() => (moreOpen = false)}><X size={18} /></button>
		</div>
		<div class="grid grid-cols-3 gap-2">
			{#each secondary as item (item.href)}
				<a
					href={item.href}
					onclick={() => (moreOpen = false)}
					class="flex flex-col items-center gap-1.5 rounded-2xl border border-line py-3 text-xs font-bold {active(item.href)
						? 'bg-accent-soft text-ink'
						: 'bg-raised text-muted'}"
				>
					<item.icon size={22} strokeWidth={2.1} class="text-accent" />{item.label}
				</a>
			{/each}
		</div>
		<div class="mt-4 flex items-center justify-between">
			<span class="text-xs font-semibold text-muted">Thème</span>
			<ThemeSwitch />
		</div>
	</div>
{/if}
