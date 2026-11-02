<script lang="ts">
	import { ArrowLeft, ArrowRight, BellRing, Cloud, Compass, Feather, Flag, Rocket, Smartphone, Sparkles } from '@lucide/svelte';
	import { fade, fly } from 'svelte/transition';
	import Gauges from '#lib/components/Gauges.svelte';
	import OrbitRing from '#lib/components/OrbitRing.svelte';
	import ShipArt from '#lib/components/ShipArt.svelte';
	import TierButtons from '#lib/components/TierButtons.svelte';
	import { TIER_LABEL } from '#lib/labels.ts';
	import type { Sector, SectorState } from '#lib/engine/ship.ts';
	import { store } from '#lib/store.svelte.ts';
	import type { Tier } from '#lib/types.ts';
	import { INTRO, SECTORS } from '#lib/universe.ts';

	// Tutoriel de prise en main, au premier lancement (et rejouable depuis les Réglages).
	const open = $derived(!store.testMode && !store.data.onboarding.introDone);

	let i = $state(0);
	let dir = $state(1);
	let tier = $state<Tier | undefined>();
	const DEMO_XP: Record<Tier, number> = { min: 6, normal: 12, excellent: 18 };

	const states: SectorState[] = ['lit', 'lit', 'partial', 'lit', 'today', 'future', 'future'];
	const demo: Sector[] = SECTORS.map((s, k) => ({ date: `d${k}`, name: s.name, state: states[k], done: k === 4 ? 1 : 2, expected: 2 }));

	const SLIDES = [
		{ eyebrow: 'Bienvenue à bord', title: 'Le Sillage t’attend' },
		{ eyebrow: 'Une journée à bord', title: 'Valide, même un peu' },
		{ eyebrow: 'Le tableau de bord', title: 'Trois jauges, aucune punition' },
		{ eyebrow: 'Une semaine = une orbite', title: 'Sept secteurs autour de Kronos' },
		{ eyebrow: 'Le voyage au long cours', title: 'Répare le vaisseau, trace ta route' },
		{ eyebrow: 'Partout avec toi', title: 'Téléphone, PC, rappels' }
	];
	const last = SLIDES.length - 1;

	function go(n: number) {
		dir = n > i ? 1 : -1;
		i = Math.max(0, Math.min(last, n));
	}

	function finish(href?: string) {
		store.finishIntro();
		i = 0;
		if (href) location.hash = href;
	}
</script>

{#if open}
	<div class="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="tuto-title" transition:fade={{ duration: 200 }}>
		<div class="tuto-sky absolute inset-0"></div>
		<div class="relative flex max-h-[100dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] border border-line bg-surface sm:rounded-[28px]" style="box-shadow: 0 30px 80px -30px var(--shadow)">
			<!-- Progression -->
			<div class="flex items-center gap-1.5 px-6 pt-5">
				{#each SLIDES as _, k (k)}
					<button class="h-1.5 flex-1 rounded-full transition-colors {k <= i ? 'bg-accent' : 'bg-zinc-200'}" aria-label="Étape {k + 1}" onclick={() => go(k)}></button>
				{/each}
				<button class="ml-2 text-xs font-bold text-muted hover:text-ink" onclick={() => finish()}>Passer</button>
			</div>

			<div class="relative min-h-0 flex-1 overflow-y-auto px-6 pt-4 pb-2">
				{#key i}
					<div in:fly={{ x: 40 * dir, duration: 260, delay: 60 }} out:fade={{ duration: 60 }}>
						<div class="eyebrow mb-1 text-accent">{SLIDES[i].eyebrow}</div>
						<h2 id="tuto-title" class="mb-3 text-2xl font-black tracking-tight">{SLIDES[i].title}</h2>

						{#if i === 0}
							<div class="tuto-visual mb-4 rounded-3xl px-4 py-3"><ShipArt levels={{ reactor: 0, hull: 0, thrusters: 0, antenna: 0 }} /></div>
							<p class="text-[15px] leading-relaxed text-ink/85">{INTRO}</p>
							<p class="mt-3 text-sm text-muted">Ici, tes habitudes, tes tâches et tes projets font avancer le vaisseau. Six écrans pour tout comprendre, une minute.</p>
						{:else if i === 1}
							<p class="text-[15px] leading-relaxed text-ink/85">
								Chaque jour, l’écran <strong>Aujourd’hui</strong> range tes routines par moment : matin, journée, soir. Quand c’est fait, choisis le palier qui
								correspond à ce que tu as vraiment fait.
							</p>
							<div class="tuto-visual my-4 flex flex-col items-center gap-3 rounded-3xl px-4 py-5">
								<div class="text-sm font-bold">Kiné matin</div>
								<TierButtons current={tier} titles={{ min: 'Étirements seuls', normal: 'Étirements + renfos', excellent: 'Tout + 1 série' }} onpick={(t) => (tier = t)} onclear={() => (tier = undefined)} />
								<div class="h-5 text-sm font-black text-done">
									{#if tier}+{DEMO_XP[tier]} XP · palier {TIER_LABEL[tier]}{:else}<span class="font-semibold text-muted">Essaie : touche un palier</span>{/if}
								</div>
							</div>
							<p class="flex gap-2 text-sm text-muted"><Feather size={16} class="mt-0.5 shrink-0 text-accent" /> Le palier Min compte toujours : un petit pas garde la série en vie. Les jours sans énergie, active le mode minimum.</p>
						{:else if i === 2}
							<div class="tuto-visual mb-4 rounded-3xl p-4"><Gauges discipline={72} motivation={64} inspiration={58} stacked /></div>
							<p class="text-sm leading-relaxed text-ink/85">
								<strong>Discipline</strong> : ta régularité sur 4 semaines, elle multiplie l’XP. <strong>Motivation</strong> : l’énergie du réacteur, elle baisse un peu quand une obligation est
								ratée et remonte toute seule. <strong>Inspiration</strong> : nourrie par tes campagnes et tes revues.
							</p>
						{:else if i === 3}
							<div class="tuto-visual mb-3 rounded-3xl px-2 py-2"><OrbitRing sectors={demo} current="d4" /></div>
							<p class="text-sm leading-relaxed text-ink/85">
								Toutes les obligations d’une journée faites : le secteur s’allume. Les séries, les journées complètes et les semaines pleines rapportent des bonus, et des
								<strong>boucliers</strong> peuvent sauver une série après un raté.
							</p>
							<p class="mt-2 flex gap-2 text-sm text-muted"><Compass size={16} class="mt-0.5 shrink-0 text-accent" /><span>Le dimanche, tu amarres au <strong>Havre</strong> : la revue de la semaine, et à la fin du mois, le récit de ton voyage.</span></p>
						{:else if i === 4}
							<div class="tuto-visual mb-4 rounded-3xl px-4 py-3"><ShipArt levels={{ reactor: 3, hull: 2, thrusters: 3, antenna: 2 }} /></div>
							<div class="grid gap-2 text-sm">
								<p class="flex gap-2"><Rocket size={16} class="mt-0.5 shrink-0 text-accent" /><span>Chaque action rapporte des <strong>matériaux</strong> : au Vaisseau, ils réparent les modules, qui donnent des bonus.</span></p>
								<p class="flex gap-2"><Flag size={16} class="mt-0.5 shrink-0 text-accent" /><span>Les <strong>Campagnes</strong> sont tes projets au long cours, découpés en chapitres et en quêtes, avec des boss.</span></p>
								<p class="flex gap-2"><Sparkles size={16} class="mt-0.5 shrink-0 text-accent" /><span>Les moments forts (paliers, trophées, niveaux) sont racontés dans le journal de bord.</span></p>
							</div>
						{:else}
							<div class="grid gap-2.5">
								{#each [{ icon: Cloud, t: 'Synchro', d: 'Un compte de bord : tout est sauvegardé en ligne et se retrouve sur le téléphone comme sur le PC.' }, { icon: Smartphone, t: 'App installée', d: 'Ajoute le Sillage à l’écran d’accueil : il s’ouvre comme une app, même hors ligne.' }, { icon: BellRing, t: 'Rappels', d: 'Le matin, le soir, avant la fin de journée, le dimanche : seulement s’il reste quelque chose à faire.' }] as row (row.t)}
									<div class="flex gap-3 rounded-2xl border border-line bg-raised p-3">
										<span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"><row.icon size={17} /></span>
										<div class="text-sm"><div class="font-extrabold">{row.t}</div><div class="text-muted">{row.d}</div></div>
									</div>
								{/each}
							</div>
							<p class="mt-3 text-sm text-muted">Le <strong class="text-ink">guide des premiers jours</strong> t’attend sur Aujourd’hui : une poignée de missions, chacune récompensée.</p>
						{/if}
					</div>
				{/key}
			</div>

			<div class="flex items-center justify-between gap-2 border-t border-line px-6 py-4" style="padding-bottom: max(1rem, env(safe-area-inset-bottom))">
				<button class="btn btn-ghost" disabled={i === 0} onclick={() => go(i - 1)}><ArrowLeft size={16} /> Retour</button>
				{#if i < last}
					<button class="btn btn-primary px-5" onclick={() => go(i + 1)}>Suivant <ArrowRight size={16} /></button>
				{:else}
					<div class="flex gap-2">
						<button class="btn" onclick={() => finish()}>Plus tard</button>
						<button class="btn btn-primary" onclick={() => finish('#/reglages')}>Configurer</button>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.tuto-sky {
		background:
			radial-gradient(circle at 30% 20%, color-mix(in oklab, var(--accent) 25%, transparent), transparent 50%),
			radial-gradient(circle at 80% 80%, color-mix(in oklab, var(--reward) 18%, transparent), transparent 45%),
			color-mix(in oklab, var(--page) 85%, transparent);
		backdrop-filter: blur(6px);
	}
	.tuto-visual {
		background:
			radial-gradient(circle at 50% 0%, color-mix(in oklab, var(--accent) 14%, transparent), transparent 70%),
			var(--raised);
		border: 1px solid var(--line);
	}
</style>
