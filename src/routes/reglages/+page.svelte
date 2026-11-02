<script lang="ts">
	import {
		BellOff,
		BellRing,
		Check,
		Cloud,
		CloudOff,
		Compass,
		Download,
		GraduationCap,
		KeyRound,
		LogOut,
		Mail,
		MonitorSmartphone,
		Palette,
		RefreshCw,
		Send,
		Settings2,
		Smartphone,
		TriangleAlert
	} from '@lucide/svelte';
	import ThemeSwitch from '#lib/components/ThemeSwitch.svelte';
	import { today } from '#lib/dates.ts';
	import { missionsState } from '#lib/engine/onboarding.ts';
	import { store } from '#lib/store.svelte.ts';
	import { builtIn, configured, readConfig, saveConfig } from '#lib/sync/config.ts';
	import { push } from '#lib/sync/push.svelte.ts';
	import { sync } from '#lib/sync/sync.svelte.ts';
	import type { ReminderKind } from '#lib/types.ts';

	const data = $derived(store.data);
	const ready = configured();

	// --- Connexion au projet Supabase (si l'app n'a pas été construite avec) ---
	let cfg = $state(readConfig());
	function saveCfg() {
		saveConfig(cfg);
		location.reload();
	}

	// --- Compte ---
	let email = $state('');
	let password = $state('');
	let busy = $state(false);
	let message = $state('');
	let failure = $state('');

	async function run(fn: () => Promise<unknown>, ok?: string) {
		busy = true;
		message = failure = '';
		try {
			await fn();
			if (ok) message = ok;
		} catch (e) {
			failure = translate(e instanceof Error ? e.message : String(e));
		} finally {
			busy = false;
		}
	}

	const translate = (m: string) =>
		/Invalid login/i.test(m)
			? 'E-mail ou mot de passe incorrect.'
			: /Email not confirmed/i.test(m)
				? 'Confirme d’abord ton adresse : un lien t’a été envoyé par e-mail.'
				: /already registered/i.test(m)
					? 'Ce compte existe déjà : connecte-toi.'
					: /Password should be/i.test(m)
						? 'Mot de passe trop court (6 caractères au moins).'
						: m;

	const STATUS = {
		off: { label: 'Synchro désactivée', tone: 'text-muted' },
		'signed-out': { label: 'Non connecté', tone: 'text-muted' },
		syncing: { label: 'Synchronisation…', tone: 'text-accent' },
		synced: { label: 'À jour', tone: 'text-done' },
		offline: { label: 'Hors ligne : envoi à la reconnexion', tone: 'text-orange-700' },
		error: { label: 'Erreur de synchro', tone: 'text-rose-700' },
		choose: { label: 'Un choix t’attend', tone: 'text-orange-700' }
	} as const;

	const ago = (iso: string | null) => {
		if (!iso) return '';
		const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
		return s < 60 ? 'à l’instant' : s < 3600 ? `il y a ${Math.round(s / 60)} min` : `il y a ${Math.round(s / 3600)} h`;
	};

	// --- Rappels ---
	const REMINDERS: Record<ReminderKind, { label: string; hint: string }> = {
		morning: { label: 'Routines du matin', hint: 'S’il en reste à faire' },
		day: { label: 'Point de mi-journée', hint: 'Les routines de la journée restantes' },
		evening: { label: 'Routines du soir', hint: 'S’il en reste à faire' },
		dayCheck: { label: 'Bilan avant la nuit', hint: 'Les obligations restantes et la série en jeu' },
		review: { label: 'Revue du dimanche', hint: 'Si la revue de la semaine n’est pas faite' },
		month: { label: 'Récit du mois', hint: 'Le dernier jour du mois' }
	};

	function setReminder(kind: ReminderKind, patch: { on?: boolean; time?: string }) {
		const s = $state.snapshot(data.settings);
		s.reminders = s.reminders.map((r) => (r.kind === kind ? { ...r, ...patch } : r));
		s.tz = Intl.DateTimeFormat().resolvedOptions().timeZone || s.tz;
		store.saveSettings(s);
	}

	const guide = $derived(missionsState(data, today()));
	const xiaomi = typeof navigator !== 'undefined' && /Redmi|Xiaomi|MIUI|POCO/i.test(navigator.userAgent);
	const ios = typeof navigator !== 'undefined' && /iPhone|iPad/.test(navigator.userAgent);
</script>

<header class="mb-6">
	<div class="eyebrow mb-1 flex items-center gap-1.5 text-accent"><Settings2 size={13} strokeWidth={2.4} /> Poste de commande</div>
	<h1 class="text-3xl font-black tracking-tight">Réglages</h1>
	<p class="text-sm text-muted">Ton compte de bord, l’app sur le téléphone, les rappels et la prise en main.</p>
</header>

{#if store.testMode}
	<p class="card mb-4 flex items-center gap-2 text-sm font-semibold text-muted"><TriangleAlert size={16} class="text-orange-600" /> Mode test : la synchro et les rappels sont coupés.</p>
{/if}

<div class="grid gap-4 lg:grid-cols-2">
	<!-- Compte de bord -->
	<section class="card flex flex-col gap-3 lg:col-span-2">
		<div class="flex flex-wrap items-center gap-3">
			<span class="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-soft text-accent">
				{#if sync.user}<Cloud size={20} />{:else}<CloudOff size={20} />{/if}
			</span>
			<div class="min-w-0 flex-1">
				<h2 class="font-extrabold">Compte de bord · synchro</h2>
				<p class="text-xs text-muted">Tes données sont sauvegardées en ligne et fusionnées entre le téléphone et le PC, même après une utilisation hors ligne.</p>
			</div>
			{#if ready}
				<span class="chip bg-raised py-1 {STATUS[sync.status].tone}">
					{#if sync.status === 'syncing'}<RefreshCw size={11} class="animate-spin" />{:else if sync.status === 'synced'}<Check size={11} strokeWidth={3} />{/if}
					{STATUS[sync.status].label}{sync.status === 'synced' && sync.lastSync ? ` · ${ago(sync.lastSync)}` : ''}
				</span>
			{/if}
		</div>

		{#if !ready}
			<div class="rounded-2xl border border-dashed border-line bg-raised p-3 text-sm">
				<p class="mb-2 font-semibold">Relie l’app à ton projet Supabase (une seule fois par appareil, ou une fois pour toutes dans le build : voir <code>docs/supabase.md</code>).</p>
				<div class="grid gap-2 sm:grid-cols-3">
					<label><span class="label">URL du projet</span><input class="input" placeholder="https://xxxx.supabase.co" bind:value={cfg.url} /></label>
					<label><span class="label">Clé publique (anon)</span><input class="input" placeholder="eyJ… ou sb_publishable_…" bind:value={cfg.key} /></label>
					<label><span class="label">Clé VAPID publique</span><input class="input" placeholder="B… (rappels)" bind:value={cfg.vapid} /></label>
				</div>
				<button class="btn btn-primary mt-3" disabled={!cfg.url || !cfg.key} onclick={saveCfg}><KeyRound size={15} /> Enregistrer et relancer</button>
			</div>
		{:else if sync.status === 'choose'}
			<div class="rounded-2xl border border-orange-300 bg-orange-100 p-3 text-sm text-orange-900">
				<p class="mb-2 font-bold">Ce compte a déjà des données en ligne, et cet appareil aussi. Que faire ?</p>
				<div class="flex flex-wrap gap-2">
					<button class="btn btn-primary" onclick={() => sync.resolve('merge')}>Fusionner les deux (conseillé)</button>
					<button class="btn" onclick={() => sync.resolve('remote')}>Garder celles en ligne</button>
					<button class="btn" onclick={() => sync.resolve('local')}>Garder celles de cet appareil</button>
				</div>
			</div>
		{:else if sync.user}
			<div class="flex flex-wrap items-center gap-2 text-sm">
				<span class="font-semibold">Connecté : <span class="text-accent">{sync.user.email}</span></span>
				<span class="flex-1"></span>
				<button class="btn text-xs" onclick={() => sync.now()} disabled={sync.status === 'syncing'}><RefreshCw size={13} /> Synchroniser</button>
				<button class="btn btn-ghost text-xs" onclick={() => run(() => sync.signOut())}><LogOut size={13} /> Se déconnecter</button>
			</div>
			{#if sync.status === 'error'}<p class="text-xs font-semibold text-rose-700">{sync.error}</p>{/if}
		{:else if !store.testMode}
			<form class="grid gap-2 sm:grid-cols-[1fr_1fr_auto]" onsubmit={(e) => (e.preventDefault(), run(() => sync.signIn(email, password), 'Connecté. Synchronisation en cours…'))}>
				<label><span class="label">E-mail</span><input class="input" type="email" autocomplete="email" required bind:value={email} /></label>
				<label><span class="label">Mot de passe</span><input class="input" type="password" autocomplete="current-password" minlength="6" bind:value={password} /></label>
				<div class="flex items-end gap-2">
					<button class="btn btn-primary" disabled={busy || !email || !password}>Se connecter</button>
				</div>
			</form>
			<div class="flex flex-wrap gap-2 text-xs">
				<button
					class="btn text-xs"
					disabled={busy || !email || password.length < 6}
					onclick={() => run(async () => ((await sync.signUp(email, password)) ? (message = 'Compte créé : ouvre le lien reçu par e-mail pour le confirmer, puis reviens ici.') : (message = 'Compte créé, tu es connecté.')))}
				>
					Créer mon compte
				</button>
				<button class="btn btn-ghost text-xs" disabled={busy || !email} onclick={() => run(() => sync.magicLink(email), 'Lien envoyé : ouvre-le sur cet appareil pour te connecter.')}>
					<Mail size={13} /> Recevoir un lien de connexion
				</button>
			</div>
		{/if}
		{#if message}<p class="text-xs font-semibold text-done">{message}</p>{/if}
		{#if failure}<p class="text-xs font-semibold text-rose-700">{failure}</p>{/if}
		{#if ready && !builtIn()}
			<details class="text-xs text-muted">
				<summary class="cursor-pointer font-semibold">Projet Supabase de cet appareil</summary>
				<div class="mt-2 grid gap-2 sm:grid-cols-3">
					<input class="input" bind:value={cfg.url} aria-label="URL" />
					<input class="input" bind:value={cfg.key} aria-label="Clé publique" />
					<input class="input" bind:value={cfg.vapid} aria-label="Clé VAPID" />
				</div>
				<button class="btn mt-2 text-xs" onclick={saveCfg}>Enregistrer et relancer</button>
			</details>
		{/if}
	</section>

	<!-- Installer -->
	<section class="card flex flex-col gap-3">
		<div class="flex items-center gap-3">
			<span class="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-soft text-accent"><Smartphone size={20} /></span>
			<div class="min-w-0 flex-1">
				<h2 class="font-extrabold">L’app sur l’écran d’accueil</h2>
				<p class="text-xs text-muted">Elle s’ouvre en plein écran, démarre vite et fonctionne hors ligne.</p>
			</div>
		</div>
		{#if push.installed}
			<p class="flex items-center gap-2 text-sm font-semibold text-done"><Check size={16} strokeWidth={3} /> Installée sur cet appareil.</p>
		{:else if push.installable}
			<button class="btn btn-primary self-start" onclick={() => push.install()}><Download size={15} /> Installer le Sillage</button>
		{:else if ios}
			<p class="text-sm text-muted">Dans Safari : bouton <strong class="text-ink">Partager</strong> puis <strong class="text-ink">Sur l’écran d’accueil</strong>.</p>
		{:else}
			<ol class="list-decimal pl-5 text-sm text-muted">
				<li>Ouvre ce site dans <strong class="text-ink">Chrome</strong> sur le téléphone.</li>
				<li>Menu <strong class="text-ink">⋮</strong> puis <strong class="text-ink">Installer l’application</strong> (ou « Ajouter à l’écran d’accueil »).</li>
			</ol>
			<p class="flex items-center gap-1.5 text-xs text-muted"><MonitorSmartphone size={13} /> Sur PC, l’icône d’installation est dans la barre d’adresse de Chrome ou Edge.</p>
		{/if}
	</section>

	<!-- Rappels -->
	<section class="card flex flex-col gap-3">
		<div class="flex items-center gap-3">
			<span class="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-soft text-accent"><BellRing size={20} /></span>
			<div class="min-w-0 flex-1">
				<h2 class="font-extrabold">Transmissions du copilote</h2>
				<p class="text-xs text-muted">Envoyées seulement s’il reste quelque chose à faire. Elles arrivent même app fermée.</p>
			</div>
		</div>

		{#if !push.supported}
			<p class="text-sm text-muted">Ce navigateur ne gère pas les notifications push. Sur Android, utilise Chrome.</p>
		{:else if push.subscribed}
			<div class="flex flex-wrap items-center gap-2">
				<span class="chip bg-done-soft py-1 text-done"><Check size={11} strokeWidth={3} /> Actives sur cet appareil</span>
				<span class="flex-1"></span>
				<button class="btn text-xs" disabled={busy} onclick={() => run(async () => (message = `Notification envoyée à ${await push.test()} appareil(s).`))}><Send size={13} /> Tester</button>
				<button class="btn btn-ghost text-xs" onclick={() => run(() => push.disable(), 'Rappels coupés sur cet appareil.')}><BellOff size={13} /> Couper</button>
			</div>
		{:else}
			<button class="btn btn-primary self-start" disabled={busy || !sync.user} onclick={() => run(() => push.enable(), 'Rappels activés sur cet appareil.')}><BellRing size={15} /> Activer les rappels ici</button>
			{#if !sync.user}<p class="text-xs text-muted">Connecte d’abord ton compte de bord : c’est lui qui envoie les rappels.</p>{/if}
			{#if push.permission === 'denied'}<p class="text-xs font-semibold text-rose-700">Notifications bloquées pour ce site : autorise-les dans les réglages du navigateur.</p>{/if}
		{/if}

		<ul class="flex flex-col divide-y divide-line rounded-2xl border border-line bg-raised">
			{#each data.settings.reminders as r (r.kind)}
				<li class="flex items-center gap-3 px-3 py-2">
					<input type="checkbox" checked={r.on} onchange={(e) => setReminder(r.kind, { on: e.currentTarget.checked })} aria-label={REMINDERS[r.kind].label} />
					<div class="min-w-0 flex-1 leading-tight">
						<div class="text-sm font-bold {r.on ? '' : 'text-muted'}">{REMINDERS[r.kind].label}</div>
						<div class="text-[11px] text-muted">{REMINDERS[r.kind].hint}</div>
					</div>
					<input type="time" class="input w-[6.5rem] py-1 text-xs" value={r.time} disabled={!r.on} onchange={(e) => setReminder(r.kind, { time: e.currentTarget.value })} aria-label="Heure : {REMINDERS[r.kind].label}" />
				</li>
			{/each}
		</ul>
		{#if xiaomi}
			<p class="rounded-xl bg-orange-100 px-3 py-2 text-xs font-semibold text-orange-800">
				Xiaomi / Redmi : dans Paramètres → Applis → Chrome, autorise les notifications et mets l’économiseur de batterie sur « Aucune restriction », sinon les rappels arrivent en retard.
			</p>
		{/if}
	</section>

	<!-- Prise en main -->
	<section class="card flex flex-col gap-3">
		<div class="flex items-center gap-3">
			<span class="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-soft text-accent"><GraduationCap size={20} /></span>
			<div class="min-w-0 flex-1">
				<h2 class="font-extrabold">Prise en main</h2>
				<p class="text-xs text-muted">Brevet de pilote : {guide.done}/{guide.total} missions · jour {guide.day} du voyage.</p>
			</div>
		</div>
		<div class="flex flex-wrap gap-2">
			<button class="btn text-xs" onclick={() => store.replayIntro()}><Compass size={13} /> Revoir le tutoriel</button>
			{#if data.onboarding.hidden && !guide.finished}
				<button class="btn text-xs" onclick={() => store.setGuideHidden(false)}>Réafficher le guide des premiers jours</button>
			{/if}
			{#if data.onboarding.hints.length}
				<button class="btn btn-ghost text-xs" onclick={() => ((data.onboarding.hints = []), store.persist())}>Remontrer les astuces des écrans</button>
			{/if}
		</div>
	</section>

	<!-- Apparence -->
	<section class="card flex items-center gap-3">
		<span class="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-soft text-accent"><Palette size={20} /></span>
		<div class="min-w-0 flex-1">
			<h2 class="font-extrabold">Apparence</h2>
			<p class="text-xs text-muted">Nuit douce, Aube orbitale ou automatique. Données, export et mode test : écran <a class="font-semibold text-accent hover:underline" href="#/personnage">Pilote</a>.</p>
		</div>
		<ThemeSwitch />
	</section>
</div>
