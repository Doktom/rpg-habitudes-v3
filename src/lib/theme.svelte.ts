// Thème de l'interface : Nuit douce (sombre, par défaut), Aube orbitale (clair) ou automatique (suit le système).
// Le script de app.html applique le thème avant l'affichage pour éviter un flash ; ce module le change ensuite.
export type ThemePref = 'dark' | 'light' | 'auto';

const KEY = 'rpg-habitudes-v3:theme';

function read(): ThemePref {
	try {
		const v = localStorage.getItem(KEY);
		return v === 'light' || v === 'auto' ? v : 'dark';
	} catch {
		return 'dark';
	}
}

function resolve(pref: ThemePref): 'dark' | 'light' {
	if (pref !== 'auto') return pref;
	return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

class Theme {
	pref = $state<ThemePref>(typeof localStorage === 'undefined' ? 'dark' : read());

	set(pref: ThemePref) {
		this.pref = pref;
		try {
			localStorage.setItem(KEY, pref);
		} catch {
			// préférence non mémorisée, le thème s'applique quand même pour la session
		}
		this.apply();
	}

	apply() {
		const mode = resolve(this.pref);
		document.documentElement.dataset.theme = mode;
		document.querySelector('meta[name="theme-color"]')?.setAttribute('content', mode === 'dark' ? '#121428' : '#f5f1ea');
	}
}

export const theme = new Theme();
