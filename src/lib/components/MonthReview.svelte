<script lang="ts">
	import { ArrowLeft, ArrowRight, BookOpen, CloudLightning, Compass, Feather, Gem, Lock, Rocket, Route, ScrollText, Sparkles, Sunrise, UserRound } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import LootLine from '#lib/components/LootLine.svelte';
	import { GAUGES, LOOT_REWARDS, XP_REWARDS } from '#lib/config.ts';
	import { addDays, formatLong, today } from '#lib/dates.ts';
	import { discipline, gaugeValue } from '#lib/engine/progress.ts';
	import { monthEndOf, monthStartOf, monthStory, type StoryChapter } from '#lib/engine/story.ts';
	import { store, uid } from '#lib/store.svelte.ts';
	import { toasts } from '#lib/toasts.svelte.ts';

	// Revue mensuelle : le mois raconté comme un chapitre du voyage, puis le regard du pilote et le cap du mois suivant.
	const data = $derived(store.data);
	const reviewed = (start: string) => data.reviews.some((r) => r.type === 'monthly' && r.periodStart === start);

	// Les dix premiers jours du mois, on clôt d'abord le mois précédent s'il n'a pas eu sa revue.
	const thisMonth = monthStartOf(today());
	const lastMonth = monthStartOf(addDays(thisMonth, -1));
	const start = $derived(+today().slice(8) <= 10 && !reviewed(lastMonth) && data.habitLogs.some((l) => l.date >= lastMonth && l.date < thisMonth) ? lastMonth : thisMonth);
	const end = $derived(monthEndOf(start));
	const opensOn = $derived(addDays(end, -2)); // on peut clore le chapitre à partir des trois derniers jours
	const canClose = $derived(today() >= opensOn);
	const done = $derived(reviewed(start));
	const story = $derived(monthStory(data, start, today()));

	const ICON: Record<StoryChapter['icon'], typeof Route> = { start: Sunrise, road: Route, storm: CloudLightning, treasure: Gem, pilot: UserRound, ship: Rocket };
	const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

	const STEPS = ['Le récit', 'Ton regard', 'Clore le chapitre'];
	let step = $state(0);
	let pride = $state('');
	let letGo = $state('');
	let arc = $state('');
	let intents = $state(['', '', '']);
	const draftKey = $derived(`rpg-habitudes-v3:revue-mois:${start}`);

	onMount(() => {
		try {
			const d = JSON.parse(localStorage.getItem(draftKey) ?? 'null');
			if (d) ({ step, pride, letGo, arc, intents } = { step, pride, letGo, arc, intents, ...d });
		} catch {
			// pas de brouillon
		}
	});
	$effect(() => {
		const d = { step, pride, letGo, arc, intents };
		try {
			localStorage.setItem(draftKey, JSON.stringify(d));
		} catch {
			// brouillon non gardé
		}
	});

	function go(n: number) {
		step = Math.max(0, Math.min(STEPS.length - 1, n));
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	function close() {
		const id = uid();
		const kept = intents.map((p) => p.trim()).filter(Boolean);
		store.batch(() => {
			store.addReview({
				id,
				type: 'monthly',
				periodStart: start,
				createdAt: today(),
				worked: pride,
				stuck: letGo,
				adjust: arc,
				priorities: kept,
				snapshot: { xp: story.xp, discipline: discipline(data, today()), motivation: gaugeValue(data, 'motivation'), inspiration: gaugeValue(data, 'inspiration'), successRate: story.successRate }
			});
			for (const p of kept) store.saveTask({ id: uid(), title: p, list: 'month' });
		});
		const e = data.events.find((x) => x.source === `review:${id}`);
		toasts.push({ title: 'Chapitre refermé', xp: e?.xp?.reduce((s, x) => s + x.amount, 0), loot: e?.loot });
		try {
			localStorage.removeItem(draftKey);
		} catch {
			// rien
		}
		step = 0;
	}
</script>

{#if done}
	<section class="card mb-6 flex flex-col items-center gap-2 py-8 text-center">
		<span class="flex h-14 w-14 items-center justify-center rounded-full bg-reward text-on-accent"><BookOpen size={26} /></span>
		<h2 class="text-xl font-black">Chapitre refermé</h2>
		<p class="max-w-md text-sm text-muted">« {story.title} » rejoint le journal de bord. Le prochain récit s’écrira à la fin du mois.</p>
	</section>
{:else}
	<nav class="mb-4 grid grid-cols-3 gap-1.5" aria-label="Étapes de la revue du mois">
		{#each STEPS as s, i (s)}
			<button
				class="rounded-2xl border px-2 py-2 text-xs font-bold transition-colors {i === step ? 'border-accent bg-accent text-on-accent' : i < step ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface text-muted hover:bg-raised'}"
				aria-current={i === step ? 'step' : undefined}
				onclick={() => go(i)}>{s}</button
			>
		{/each}
	</nav>

	{#if step === 0}
		<article class="chronicle relative overflow-hidden rounded-[28px] border border-line px-5 py-8 sm:px-10">
			<div class="chronicle-stars" aria-hidden="true"></div>
			<header class="relative mb-8 text-center">
				<div class="eyebrow mb-2 flex items-center justify-center gap-1.5 text-accent"><ScrollText size={13} /> {story.subtitle}</div>
				<h2 class="text-3xl font-black tracking-tight text-balance sm:text-4xl">{story.title}</h2>
				{#if start === thisMonth && today() < end}
					<p class="mt-2 text-xs font-semibold text-muted">Le récit s’écrit encore : le mois se termine {formatLong(end)}.</p>
				{/if}
			</header>

			<ol class="relative flex flex-col gap-7">
				{#each story.chapters as c, i (c.heading)}
					{@const Icon = ICON[c.icon]}
					<li class="chapter grid grid-cols-[2.75rem_1fr] gap-4" style="--d: {i * 140}ms">
						<div class="flex flex-col items-center">
							<span class="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-accent"><Icon size={20} strokeWidth={2.1} /></span>
							{#if i < story.chapters.length - 1}<span class="mt-2 w-px flex-1 bg-line"></span>{/if}
						</div>
						<div class="pb-1">
							<div class="eyebrow text-muted">Chapitre {ROMAN[i]}</div>
							<h3 class="mb-1.5 text-lg font-extrabold">{c.heading}</h3>
							<p class="text-[15px] leading-relaxed text-pretty text-ink/85">{c.text}</p>
							{#if c.figures}
								<div class="mt-3 flex flex-wrap gap-2">
									{#each c.figures as f (f.label)}
										<span class="rounded-2xl border border-line bg-surface px-3 py-1.5 text-center leading-tight">
											<span class="block text-base font-black tabular-nums">{f.value}</span>
											<span class="block text-[10px] font-bold text-muted">{f.label}</span>
										</span>
									{/each}
								</div>
							{/if}
						</div>
					</li>
				{/each}
			</ol>

			<footer class="chapter relative mt-8 rounded-2xl border border-dashed border-accent/40 bg-accent-soft/40 px-4 py-4 text-center" style="--d: {story.chapters.length * 140}ms">
				<Feather size={18} class="mx-auto mb-1 text-accent" />
				<p class="text-[15px] leading-relaxed font-semibold text-pretty italic">{story.epilogue}</p>
			</footer>
		</article>
	{:else if step === 1}
		<div class="flex flex-col gap-3">
			<section class="card flex flex-col gap-2">
				<label class="flex items-center gap-2 font-extrabold" for="m-pride"><Sparkles size={16} class="text-reward" /> Ce dont je suis fier ce mois-ci</label>
				<textarea id="m-pride" class="input min-h-20" placeholder="Un moment, un déclic, une petite victoire…" bind:value={pride}></textarea>
			</section>
			<section class="card flex flex-col gap-2">
				<label class="flex items-center gap-2 font-extrabold" for="m-letgo"><Feather size={16} class="text-accent" /> Ce que je laisse derrière moi</label>
				<textarea id="m-letgo" class="input min-h-20" placeholder="Une habitude qui ne me sert plus, une attente trop haute…" bind:value={letGo}></textarea>
			</section>
			<section class="card flex flex-col gap-2">
				<label class="flex items-center gap-2 font-extrabold" for="m-arc"><Compass size={16} class="text-accent" /> L’arc du mois prochain</label>
				<p class="text-xs text-muted">Un thème en quelques mots, qui donnera son titre au prochain chapitre (ex. « Le mois du sommeil », « Reprise en douceur »).</p>
				<input id="m-arc" class="input" placeholder="Le mois de…" bind:value={arc} />
				<div class="mt-2 flex flex-col gap-2">
					{#each intents as _, i (i)}
						<div class="flex items-center gap-2">
							<span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-black text-accent">{i + 1}</span>
							<input class="input" placeholder={['Une intention pour le mois…', 'Une autre…', 'Et si possible…'][i]} bind:value={intents[i]} aria-label="Intention {i + 1}" />
						</div>
					{/each}
					<p class="text-xs text-muted">Elles iront dans « Ce mois » de tes tâches.</p>
				</div>
			</section>
		</div>
	{:else}
		<section class="card flex flex-col items-center gap-3 py-8 text-center">
			<span class="flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-accent"><BookOpen size={30} /></span>
			<h2 class="text-2xl font-black">Refermer « {story.title} »</h2>
			<p class="max-w-md text-sm text-muted">Le chapitre rejoint le journal de bord{arc ? `, et le prochain s’ouvre sous le signe de « ${arc} »` : ''}.</p>
			<div class="flex flex-wrap items-center justify-center gap-2 text-sm font-bold">
				<span class="chip bg-accent-soft py-1 text-accent">+{XP_REWARDS.monthlyReview} XP</span>
				<span class="chip bg-raised py-1"><LootLine loot={LOOT_REWARDS.monthlyReview} signed size={12} /></span>
				<span class="chip bg-raised py-1 text-muted">+{GAUGES.inspiration.weeklyReview} Inspiration</span>
			</div>
			{#if canClose}
				<button class="btn btn-primary mt-2 px-6 py-2.5 text-base" onclick={close}><BookOpen size={18} /> Clore le chapitre</button>
			{:else}
				<p class="mt-2 flex items-center gap-1.5 text-xs font-semibold text-muted"><Lock size={13} /> Disponible à partir du {formatLong(opensOn)}. Ton regard est gardé en brouillon.</p>
			{/if}
		</section>
	{/if}

	<div class="mt-4 flex items-center justify-between gap-2">
		<button class="btn btn-ghost" disabled={step === 0} onclick={() => go(step - 1)}><ArrowLeft size={16} /> Retour</button>
		{#if step < STEPS.length - 1}
			<button class="btn btn-primary" onclick={() => go(step + 1)}>{STEPS[step + 1]} <ArrowRight size={16} /></button>
		{/if}
	</div>
{/if}

<style>
	.chronicle {
		background:
			radial-gradient(90% 60% at 50% 0%, color-mix(in oklab, var(--accent) 16%, transparent), transparent 70%),
			radial-gradient(60% 40% at 100% 100%, color-mix(in oklab, var(--reward) 12%, transparent), transparent 70%),
			var(--raised);
		box-shadow: 0 20px 60px -30px var(--shadow);
	}
	.chronicle-stars {
		position: absolute;
		inset: 0;
		background-image:
			radial-gradient(1.5px 1.5px at 12% 18%, var(--star), transparent),
			radial-gradient(1px 1px at 82% 12%, var(--star), transparent),
			radial-gradient(1.5px 1.5px at 68% 34%, var(--star), transparent),
			radial-gradient(1px 1px at 28% 62%, var(--star), transparent),
			radial-gradient(1px 1px at 90% 72%, var(--star), transparent);
		opacity: 0.8;
		pointer-events: none;
	}
	.chapter {
		animation: rise 0.6s cubic-bezier(0.2, 0.7, 0.2, 1) both;
		animation-delay: var(--d);
	}
	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(14px);
		}
	}
</style>
