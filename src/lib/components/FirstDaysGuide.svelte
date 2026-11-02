<script lang="ts">
	import { Check, ChevronDown, Compass, Lock, Sparkles } from '@lucide/svelte';
	import LootLine from '#lib/components/LootLine.svelte';
	import { today } from '#lib/dates.ts';
	import { GUIDE_DAYS, MISSIONS, missionsState } from '#lib/engine/onboarding.ts';
	import { store } from '#lib/store.svelte.ts';

	// Guide des premiers jours : les missions de prise en main, sur l'écran Aujourd'hui.
	const data = $derived(store.data);
	const s = $derived(missionsState(data, today()));
	const chapter = $derived([...GUIDE_DAYS].reverse().find((g) => g.day <= s.day) ?? GUIDE_DAYS[0]);
	let showAll = $state(false);
	const pct = $derived(Math.round((100 * s.done) / s.total));
</script>

{#if !s.finished && !data.onboarding.hidden}
	<section class="guide card relative overflow-hidden p-0" aria-label="Guide des premiers jours">
		<div class="flex items-center gap-3 px-4 pt-4 pb-3">
			<span class="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-on-accent">
				<Compass size={22} strokeWidth={2.2} />
				<span class="absolute -right-1 -bottom-1 rounded-full bg-surface px-1.5 text-[10px] font-black text-accent ring-2 ring-surface">J{s.day}</span>
			</span>
			<div class="min-w-0 flex-1">
				<div class="eyebrow text-accent">Premiers jours · {chapter.name}</div>
				<div class="font-extrabold leading-tight">Brevet de pilote</div>
				<div class="mt-1.5 flex items-center gap-2">
					<span class="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200"><span class="block h-full rounded-full bg-accent transition-[width] duration-700" style="width: {pct}%"></span></span>
					<span class="text-[11px] font-bold text-muted tabular-nums">{s.done}/{s.total}</span>
				</div>
			</div>
			<button class="btn btn-ghost h-8 px-2 text-[11px] text-muted" onclick={() => store.setGuideHidden(true)} title="Masquer le guide (il revient dans Réglages)">Masquer</button>
		</div>

		<ul class="flex flex-col gap-1.5 px-3 pb-3">
			{#each s.open.slice(0, showAll ? undefined : 3) as m (m.id)}
				<li>
					<a href={m.href} class="mission flex items-center gap-3 rounded-2xl border border-line bg-raised px-3 py-2.5 transition-colors hover:border-accent">
						<span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-accent/60 text-accent"><Sparkles size={13} /></span>
						<span class="min-w-0 flex-1">
							<span class="block text-sm font-bold">{m.title}</span>
							<span class="block text-xs leading-snug text-muted">{m.text}</span>
						</span>
						<span class="shrink-0 text-right text-[11px] font-black text-accent">+{m.reward.xp} XP<span class="block font-semibold"><LootLine loot={m.reward.loot} signed size={10} /></span></span>
					</a>
				</li>
			{/each}
			{#if s.open.length === 0 && s.next}
				<li class="flex items-center gap-3 rounded-2xl px-3 py-2 text-xs font-semibold text-muted">
					<Lock size={14} class="shrink-0" /> Tout est fait pour aujourd’hui. Prochaine mission au jour {s.next.day} : {s.next.title}.
				</li>
			{/if}
		</ul>

		{#if s.open.length > 3 || s.done}
			<button class="flex w-full items-center justify-center gap-1 border-t border-line py-2 text-xs font-bold text-muted hover:text-ink" aria-expanded={showAll} onclick={() => (showAll = !showAll)}>
				<ChevronDown size={14} class="transition-transform {showAll ? 'rotate-180' : ''}" />
				{showAll ? 'Replier' : s.open.length > 3 ? `Voir les ${s.open.length} missions` : 'Missions réussies'}
			</button>
			{#if showAll && s.done}
				<ul class="flex flex-wrap gap-1.5 px-4 pb-4">
					{#each MISSIONS.filter((m) => data.onboarding.missions[m.id]) as m (m.id)}
						<li class="chip bg-done-soft py-1 text-done"><Check size={11} strokeWidth={3} />{m.title}</li>
					{/each}
				</ul>
			{/if}
		{/if}
	</section>
{/if}

<style>
	.guide {
		background:
			radial-gradient(120% 80% at 100% 0%, color-mix(in oklab, var(--accent) 16%, transparent), transparent 60%),
			var(--surface);
		border-color: color-mix(in oklab, var(--accent) 35%, var(--line));
	}
</style>
