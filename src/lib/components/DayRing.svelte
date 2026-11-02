<script lang="ts">
	// Anneau de la journée : obligations (anneau extérieur) et bonus (anneau intérieur), avec le décompte au centre.
	let {
		done,
		expected,
		bonusDone,
		bonusTotal,
		size = 132,
		rest = false
	}: { done: number; expected: number; bonusDone: number; bonusTotal: number; size?: number; rest?: boolean } = $props();

	const R1 = 54;
	const R2 = 43;
	const c1 = 2 * Math.PI * R1;
	const c2 = 2 * Math.PI * R2;
	const r1 = $derived(expected ? done / expected : rest ? 1 : 0);
	const r2 = $derived(bonusTotal ? bonusDone / bonusTotal : 0);
	const complete = $derived(expected > 0 && done >= expected);
</script>

<div class="relative shrink-0" style="width:{size}px;height:{size}px">
	<svg viewBox="0 0 128 128" width={size} height={size} class="-rotate-90" aria-hidden="true">
		<circle cx="64" cy="64" r={R1} fill="none" stroke="var(--line)" stroke-width="9" />
		<circle
			cx="64"
			cy="64"
			r={R1}
			fill="none"
			stroke={rest ? 'var(--g-inspiration)' : 'var(--done)'}
			stroke-width="9"
			stroke-linecap="round"
			stroke-dasharray={c1}
			stroke-dashoffset={c1 * (1 - r1)}
			class="transition-[stroke-dashoffset] duration-700 {complete ? 'ring-glow' : ''}"
		/>
		{#if bonusTotal}
			<circle cx="64" cy="64" r={R2} fill="none" stroke="var(--line)" stroke-width="5" stroke-opacity="0.7" />
			<circle
				cx="64"
				cy="64"
				r={R2}
				fill="none"
				stroke="var(--reward)"
				stroke-width="5"
				stroke-linecap="round"
				stroke-dasharray={c2}
				stroke-dashoffset={c2 * (1 - r2)}
				class="transition-[stroke-dashoffset] duration-700"
			/>
		{/if}
	</svg>
	<div class="absolute inset-0 flex flex-col items-center justify-center leading-none">
		{#if rest}
			<span class="text-[11px] font-bold tracking-wider text-muted uppercase">repos</span>
		{:else if expected}
			<span class="text-3xl font-black tabular-nums">{done}<span class="text-lg text-muted">/{expected}</span></span>
			<span class="mt-1 text-[10px] font-bold tracking-wider text-muted uppercase">obligations</span>
			{#if bonusTotal}<span class="mt-1 text-[10px] font-bold text-reward tabular-nums">+{bonusDone}/{bonusTotal} bonus</span>{/if}
		{:else}
			<span class="text-2xl font-black tabular-nums text-reward">{bonusDone}<span class="text-base text-muted">/{bonusTotal}</span></span>
			<span class="mt-1 text-[10px] font-bold tracking-wider text-muted uppercase">bonus</span>
		{/if}
	</div>
</div>

<style>
	.ring-glow {
		filter: drop-shadow(0 0 6px color-mix(in oklab, var(--done) 70%, transparent));
	}
</style>
