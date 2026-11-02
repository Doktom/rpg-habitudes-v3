<script lang="ts">
	import { Anchor, Award, Feather, Flag, Flame, Rocket, Skull, Sparkles, Star, Trophy } from '@lucide/svelte';
	import { fade, scale } from 'svelte/transition';
	import { today } from '#lib/dates.ts';
	import { pendingMoments, type MomentKind } from '#lib/engine/story.ts';
	import { store } from '#lib/store.svelte.ts';

	// Un moment fort raconté en plein écran (palier de série, trophée, niveau, chapitre…), un à la fois.
	const queue = $derived(store.testMode || !store.data.onboarding.introDone ? [] : pendingMoments(store.data, today()));
	const m = $derived(queue[0]);

	const STYLE: Record<MomentKind, { icon: typeof Flame; color: string }> = {
		streak: { icon: Flame, color: 'var(--g-motivation)' },
		'streak-end': { icon: Feather, color: 'var(--g-inspiration)' },
		week: { icon: Anchor, color: 'var(--done)' },
		'habit-weeks': { icon: Star, color: 'var(--g-motivation)' },
		trophy: { icon: Trophy, color: 'var(--reward)' },
		level: { icon: Award, color: 'var(--accent)' },
		chapter: { icon: Flag, color: 'var(--g-inspiration)' },
		campaign: { icon: Sparkles, color: 'var(--reward)' },
		boss: { icon: Skull, color: 'var(--reward)' },
		ship: { icon: Rocket, color: 'var(--accent)' }
	};
	const st = $derived(m ? STYLE[m.kind] : STYLE.streak);

	function next() {
		if (m) store.seeMoment(m.key);
	}
</script>

<svelte:window onkeydown={(e) => m && (e.key === 'Escape' || e.key === 'Enter') && next()} />

{#if m}
	<div class="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="moment-title" transition:fade={{ duration: 220 }}>
		<div class="moment-sky absolute inset-0" style="--glow: {st.color}"></div>
		{#key m.key}
			<div class="moment-card relative w-full max-w-md overflow-hidden rounded-[28px] border border-line bg-surface px-6 pt-10 pb-6 text-center" style="--glow: {st.color}" in:scale={{ start: 0.92, duration: 380 }}>
				<div class="moment-rays" style="--glow: {st.color}" aria-hidden="true"></div>
				<div class="relative mx-auto mb-5 flex h-24 w-24 items-center justify-center">
					<span class="moment-ring absolute inset-0 rounded-full" style="--glow: {st.color}"></span>
					<span class="absolute inset-3 rounded-full" style="background: color-mix(in oklab, {st.color} 22%, var(--surface))"></span>
					<st.icon size={40} strokeWidth={2} class="relative" style="color: {st.color}" />
					{#each [0, 1, 2, 3, 4, 5] as i (i)}
						<span class="moment-spark" style="--i: {i}; --glow: {st.color}"></span>
					{/each}
				</div>
				<div class="eyebrow relative mb-1" style="color: {st.color}">{m.eyebrow}</div>
				<h2 id="moment-title" class="relative text-2xl leading-tight font-black tracking-tight text-balance">{m.title}</h2>
				<p class="relative mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-pretty text-ink/85">{m.text}</p>
				{#if m.xp}
					<div class="relative mt-4 inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-sm font-black text-accent"><Sparkles size={14} /> +{m.xp} XP</div>
				{/if}
				<div class="relative mt-6 flex items-center justify-center gap-3">
					<button class="btn btn-primary px-6 py-2.5 text-base" onclick={next}>
						{queue.length > 1 ? 'Suite du journal' : 'Continuer le voyage'}
					</button>
				</div>
				{#if queue.length > 1}<div class="relative mt-3 text-xs font-bold text-muted">Encore {queue.length - 1} moment{queue.length > 2 ? 's' : ''} à raconter</div>{/if}
			</div>
		{/key}
	</div>
{/if}

<style>
	.moment-sky {
		background:
			radial-gradient(circle at 50% 40%, color-mix(in oklab, var(--glow) 28%, transparent), transparent 55%),
			color-mix(in oklab, var(--page) 82%, transparent);
		backdrop-filter: blur(6px);
	}
	.moment-card {
		box-shadow:
			0 30px 80px -30px var(--shadow),
			0 0 0 1px color-mix(in oklab, var(--glow, var(--accent)) 10%, transparent);
	}
	.moment-rays {
		position: absolute;
		left: 50%;
		top: 88px;
		width: 520px;
		height: 520px;
		margin: -260px 0 0 -260px;
		background: repeating-conic-gradient(from 0deg, color-mix(in oklab, var(--glow) 12%, transparent) 0deg 8deg, transparent 8deg 22deg);
		mask: radial-gradient(circle, black 15%, transparent 60%);
		animation: spin 30s linear infinite;
		pointer-events: none;
	}
	.moment-ring {
		border: 2px dashed color-mix(in oklab, var(--glow) 70%, transparent);
		animation: spin 14s linear infinite;
	}
	.moment-spark {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 6px;
		height: 6px;
		margin: -3px;
		border-radius: 999px;
		background: var(--glow);
		transform: rotate(calc(var(--i) * 60deg)) translateY(-58px);
		animation: twinkle 2.4s ease-in-out infinite;
		animation-delay: calc(var(--i) * 0.4s);
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	@keyframes twinkle {
		0%,
		100% {
			opacity: 0.2;
			scale: 0.6;
		}
		50% {
			opacity: 1;
			scale: 1.2;
		}
	}
</style>
