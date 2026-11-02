// Fusion à trois voies des données entre deux appareils (téléphone et PC).
// base = dernière version synchronisée commune, local = cet appareil, remote = la version en ligne.
// Ce qui n'a changé que d'un côté est repris tel quel ; quand les deux côtés ont changé :
// - listes d'objets à identifiant (habitudes, tâches, journaux…) : fusion élément par élément,
//   ajouts et suppressions des deux côtés conservés ;
// - listes simples (jours de repos…) : fusion comme des ensembles ;
// - objets : clé par clé ;
// - valeurs simples : l'appareil local l'emporte (c'est la dernière action faite ici).
// Les événements du journal sont identifiés par leur source (« habit:<log> », « reg:… ») : les récompenses
// recalculées changent d'id mais gardent la même source.

type Json = unknown;

const same = (a: Json, b: Json) => a === b || JSON.stringify(a) === JSON.stringify(b);
const isObj = (v: Json): v is Record<string, Json> => !!v && typeof v === 'object' && !Array.isArray(v);

function keyOf(item: Json): string | undefined {
	if (!isObj(item)) return undefined;
	if (typeof item.source === 'string' && typeof item.at === 'string') return 's:' + item.source;
	if (typeof item.id === 'string') return 'i:' + item.id;
	return undefined;
}

const keyed = (arr: Json[]) => arr.length > 0 && arr.every((x) => keyOf(x) !== undefined);
const primitive = (arr: Json[]) => arr.every((x) => x === null || typeof x !== 'object');

function mergeKeyed(base: Json[], local: Json[], remote: Json[]): Json[] {
	const map = (arr: Json[]) => new Map(arr.map((x) => [keyOf(x)!, x]));
	const b = map(base);
	const l = map(local);
	const r = map(remote);
	const out: Json[] = [];
	const seen = new Set<string>();
	// Ordre de la version en ligne, puis les ajouts locaux.
	for (const [k, rv] of r) {
		seen.add(k);
		const bv = b.get(k);
		const lv = l.get(k);
		if (lv === undefined) {
			// Supprimé ici : on le garde seulement s'il a été modifié ailleurs entre-temps.
			if (bv !== undefined && same(bv, rv)) continue;
			out.push(rv);
		} else out.push(bv === undefined ? (same(lv, rv) ? rv : merge3(undefined, lv, rv)) : merge3(bv, lv, rv));
	}
	for (const [k, lv] of l) {
		if (seen.has(k)) continue;
		const bv = b.get(k);
		// Supprimé en ligne : idem, gardé seulement si modifié ici.
		if (bv !== undefined && same(bv, lv)) continue;
		out.push(lv);
	}
	return out;
}

function mergeSet(base: Json[], local: Json[], remote: Json[]): Json[] {
	const b = new Set(base);
	const l = new Set(local);
	const out = remote.filter((x) => l.has(x) || !b.has(x));
	for (const x of local) if (!b.has(x) && !out.includes(x)) out.push(x);
	return out;
}

export function merge3(base: Json, local: Json, remote: Json): Json {
	if (same(local, remote)) return local;
	if (base !== undefined && same(base, local)) return remote;
	if (base !== undefined && same(base, remote)) return local;

	if (Array.isArray(local) && Array.isArray(remote)) {
		const b = Array.isArray(base) ? base : [];
		const all = [...local, ...remote];
		if (keyed(all)) return mergeKeyed(b, local, remote);
		if (primitive(all)) return mergeSet(b, local, remote);
		return local;
	}
	if (isObj(local) && isObj(remote)) {
		const b = isObj(base) ? base : {};
		const out: Record<string, Json> = {};
		for (const k of new Set([...Object.keys(remote), ...Object.keys(local)])) {
			const inL = k in local;
			const inR = k in remote;
			if (inL && inR) out[k] = merge3(b[k], local[k], remote[k]);
			else if (inL) {
				// Absent en ligne : supprimé là-bas (s'il existait dans la base et n'a pas bougé ici) ou ajouté ici.
				if (!(k in b) || !same(b[k], local[k])) out[k] = local[k];
			} else if (!(k in b) || !same(b[k], remote[k])) out[k] = remote[k];
		}
		return out;
	}
	return local;
}
