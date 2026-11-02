// Synchro en ligne (Supabase) : un document par utilisateur (table app_state), versionné par un numéro de révision.
// À chaque sauvegarde locale, on envoie ; à l'ouverture, au retour sur l'app et toutes les 30 s, on regarde si
// un autre appareil a écrit. Si les deux ont changé, on fusionne (merge.ts) à partir de la dernière version commune.
// L'app reste utilisable hors ligne : tout repart à la prochaine connexion.
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { store } from '../store.svelte';
import type { AppData } from '../types';
import { configured, readConfig } from './config';
import { merge3 } from './merge';

const BASE_KEY = 'rpg-habitudes-v3:sync-base'; // dernière version synchronisée (point commun pour la fusion)
const REV_KEY = 'rpg-habitudes-v3:sync-rev';
const DIRTY_KEY = 'rpg-habitudes-v3:sync-dirty';

export type SyncStatus = 'off' | 'signed-out' | 'syncing' | 'synced' | 'offline' | 'error' | 'choose';

const read = (k: string) => {
	try {
		return localStorage.getItem(k);
	} catch {
		return null;
	}
};
const write = (k: string, v: string | null) => {
	try {
		if (v === null) localStorage.removeItem(k);
		else localStorage.setItem(k, v);
	} catch {
		// stockage indisponible
	}
};

// Un appareil « vierge » n'a encore rien enregistré : on adopte directement les données en ligne.
const pristine = (d: AppData) => d.habitLogs.length === 0 && d.danceLogs.length === 0 && d.reviews.length === 0 && !d.tasks.some((t) => t.done);

class Sync {
	status = $state<SyncStatus>('off');
	user = $state<User | null>(null);
	lastSync = $state<string | null>(null);
	error = $state('');
	// Premier lien d'un appareil qui a déjà ses propres données : l'utilisateur choisit.
	pending: { data: AppData; rev: number } | null = null;

	client: SupabaseClient | null = null;
	private timer: ReturnType<typeof setTimeout> | null = null;
	private running = false;
	private again = false;

	get enabled() {
		return !store.testMode && configured();
	}

	async init() {
		if (!this.enabled) {
			this.status = 'off';
			return;
		}
		const { createClient } = await import('@supabase/supabase-js');
		const cfg = readConfig();
		this.client = createClient(cfg.url, cfg.key, {
			auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce', storageKey: 'rpg-habitudes-v3:auth' }
		});
		// Retour d'un lien de confirmation (?code=…) : la session est créée, on nettoie l'adresse.
		if (location.search.includes('code=')) {
			const code = new URLSearchParams(location.search).get('code');
			if (code) await this.client.auth.exchangeCodeForSession(code).catch(() => undefined);
			history.replaceState(null, '', location.pathname + location.hash);
		}
		const { data } = await this.client.auth.getSession();
		this.user = data.session?.user ?? null;
		this.client.auth.onAuthStateChange((_e, session) => {
			const was = this.user?.id;
			this.user = session?.user ?? null;
			if (!this.user) this.status = 'signed-out';
			else if (was !== this.user.id) this.now();
		});
		store.onSaved = () => this.local();
		addEventListener('online', () => this.now());
		document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && this.now());
		setInterval(() => document.visibilityState === 'visible' && this.now(), 30_000);
		if (this.user) await this.now();
		else this.status = 'signed-out';
	}

	// --- Compte ---

	async signUp(email: string, password: string) {
		const { data, error } = await this.client!.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } });
		if (error) throw error;
		return !data.session; // vrai : un e-mail de confirmation a été envoyé
	}

	async signIn(email: string, password: string) {
		const { error } = await this.client!.auth.signInWithPassword({ email, password });
		if (error) throw error;
	}

	async magicLink(email: string) {
		const { error } = await this.client!.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
		if (error) throw error;
	}

	async signOut() {
		await this.client?.auth.signOut();
		write(BASE_KEY, null);
		write(REV_KEY, null);
		write(DIRTY_KEY, null);
		this.status = 'signed-out';
	}

	// --- Synchro ---

	// Une modification locale : on la marque et on l'envoie un peu plus tard (plusieurs coches = un envoi).
	private local() {
		write(DIRTY_KEY, '1');
		if (this.timer) clearTimeout(this.timer);
		this.timer = setTimeout(() => this.now(), 1500);
	}

	async now() {
		if (!this.client || !this.user || this.status === 'choose') return;
		if (this.running) {
			this.again = true;
			return;
		}
		this.running = true;
		try {
			do {
				this.again = false;
				await this.cycle();
			} while (this.again);
		} finally {
			this.running = false;
		}
	}

	private async cycle() {
		if (!navigator.onLine) {
			this.status = 'offline';
			return;
		}
		this.status = 'syncing';
		try {
			for (let attempt = 0; attempt < 4; attempt++) {
				const { data: row, error } = await this.client!.from('app_state').select('data, rev').maybeSingle();
				if (error) throw error;
				const baseRev = Number(read(REV_KEY) ?? 0);
				const dirty = read(DIRTY_KEY) === '1';
				const local = $state.snapshot(store.data) as AppData;

				if (!row) {
					// Premier envoi de ce compte.
					if (await this.push(local, 0)) return this.done();
					continue;
				}
				const remote = row.data as AppData;
				const remoteRev = Number(row.rev);

				if (!baseRev) {
					// Premier lien de cet appareil avec un compte qui a déjà des données.
					if (pristine(local)) {
						this.adopt(remote, remoteRev);
						return this.done();
					}
					this.pending = { data: remote, rev: remoteRev };
					this.status = 'choose';
					return;
				}
				if (remoteRev === baseRev) {
					if (!dirty) return this.done();
					if (await this.push(local, remoteRev)) return this.done();
					continue;
				}
				// Un autre appareil a écrit.
				if (!dirty) {
					this.adopt(remote, remoteRev);
					return this.done();
				}
				const base = JSON.parse(read(BASE_KEY) ?? 'null');
				const merged = merge3(base ?? undefined, local, remote) as AppData;
				store.replaceData(merged);
				if (await this.push($state.snapshot(store.data) as AppData, remoteRev)) return this.done();
			}
			throw new Error('Trop de conflits, nouvel essai plus tard');
		} catch (e) {
			this.error = e instanceof Error ? e.message : String(e);
			this.status = navigator.onLine ? 'error' : 'offline';
		}
	}

	// Choix au premier lien : garder les données en ligne, celles de cet appareil, ou fusionner les deux.
	async resolve(choice: 'remote' | 'local' | 'merge') {
		const p = this.pending;
		if (!p) return;
		this.pending = null;
		this.status = 'syncing';
		if (choice === 'remote') this.adopt(p.data, p.rev);
		else {
			const next = choice === 'local' ? ($state.snapshot(store.data) as AppData) : (merge3(undefined, $state.snapshot(store.data), p.data) as AppData);
			if (choice === 'merge') store.replaceData(next);
			write(REV_KEY, String(p.rev));
			write(BASE_KEY, JSON.stringify(p.data));
			write(DIRTY_KEY, '1');
		}
		this.status = 'synced';
		await this.now();
	}

	private adopt(remote: AppData, rev: number) {
		store.replaceData(remote);
		this.remember(remote, rev);
	}

	private remember(data: AppData, rev: number) {
		const json = JSON.stringify(data);
		write(BASE_KEY, json);
		write(REV_KEY, String(rev));
		// Si quelque chose a bougé ici pendant l'envoi (ou à la reprise des données), il reste à envoyer.
		write(DIRTY_KEY, JSON.stringify($state.snapshot(store.data)) === json ? null : '1');
	}

	// Envoi avec contrôle de révision : refusé (null) si un autre appareil a écrit entre-temps.
	private async push(data: AppData, expected: number): Promise<boolean> {
		const { data: rev, error } = await this.client!.rpc('push_state', { p_data: data, p_expected: expected });
		if (error) throw error;
		if (rev === null || rev === undefined) return false;
		this.remember(data, Number(rev));
		return true;
	}

	private done() {
		this.status = 'synced';
		this.error = '';
		this.lastSync = new Date().toISOString();
	}
}

export const sync = new Sync();
