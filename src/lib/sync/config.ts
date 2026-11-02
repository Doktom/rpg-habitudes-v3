// Connexion au projet Supabase (synchro et notifications). Voir docs/supabase.md.
// L'URL et la clé publique (« anon » / « publishable ») ne sont pas secrètes : la sécurité repose sur les règles
// d'accès (RLS) de la base. Elles viennent du build (variables du dépôt GitHub) ou, à défaut, des Réglages de l'app.
const KEY = 'rpg-habitudes-v3:supabase';

export interface SyncConfig {
	url: string;
	key: string;
	vapid: string; // clé publique VAPID des notifications push
}

const BUILT: SyncConfig = {
	url: import.meta.env.VITE_SUPABASE_URL || '',
	key: import.meta.env.VITE_SUPABASE_KEY || '',
	// Clé publique VAPID (pas secrète) ; la clé privée correspondante est un secret de la fonction send-reminders.
	vapid: import.meta.env.VITE_VAPID_PUBLIC_KEY || 'BLi3UOLK99Z0FIy5b8cHkQ35dX70PV8t0Bds96CxnibPFGdJ1zE0ZCh1M_bxfrYwZKB6HgGlI9Xt3X4jo4vtmVc'
};

export function readConfig(): SyncConfig {
	try {
		const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<SyncConfig> | null;
		if (saved) return { url: saved.url || BUILT.url, key: saved.key || BUILT.key, vapid: saved.vapid || BUILT.vapid };
	} catch {
		// réglage illisible : on garde celui du build
	}
	return BUILT;
}

export function saveConfig(c: SyncConfig) {
	try {
		localStorage.setItem(KEY, JSON.stringify({ url: c.url.trim().replace(/\/$/, ''), key: c.key.trim(), vapid: c.vapid.trim() }));
	} catch {
		// stockage indisponible
	}
}

export const builtIn = () => !!(BUILT.url && BUILT.key);
export const configured = (c = readConfig()) => !!(c.url && c.key);
