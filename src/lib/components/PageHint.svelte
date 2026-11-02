<script lang="ts">
	import { Lightbulb, X } from '@lucide/svelte';
	import { slide } from 'svelte/transition';
	import { store } from '#lib/store.svelte.ts';

	// Astuce de première visite d'un écran : s'affiche une fois, jusqu'à ce qu'on la ferme.
	let { id, title, children }: { id: string; title: string; children: import('svelte').Snippet } = $props();
	const show = $derived(!store.testMode && !!store.data.onboarding.introDone && !store.data.onboarding.hints.includes(id));
</script>

{#if show}
	<aside class="hint mb-5 flex items-start gap-3 rounded-2xl border px-4 py-3" transition:slide={{ duration: 200 }}>
		<span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-reward-soft text-reward"><Lightbulb size={16} strokeWidth={2.4} /></span>
		<div class="min-w-0 flex-1 text-sm">
			<div class="font-extrabold">{title}</div>
			<div class="leading-snug text-muted">{@render children()}</div>
		</div>
		<button class="btn btn-ghost h-7 shrink-0 px-2 text-xs font-bold text-muted" onclick={() => store.seeHint(id)} aria-label="J'ai compris"><X size={14} /> Compris</button>
	</aside>
{/if}

<style>
	.hint {
		border-color: color-mix(in oklab, var(--reward) 35%, var(--line));
		background: color-mix(in oklab, var(--reward-soft) 55%, var(--surface));
	}
</style>
