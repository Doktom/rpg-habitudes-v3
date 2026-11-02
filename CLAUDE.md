# CLAUDE.md

Webapp perso de suivi d'habitudes, planification hebdo/mensuelle et projets au long cours, avec une couche RPG (stats, XP, jauges Discipline / Motivation / Inspiration, campagnes) dans un univers spatial (le Sillage, `docs/univers.md`). Langue du projet : français.

## Ce dépôt : la V3

Ce dépôt (`Doktom/rpg-habitudes-v3`) est la **V3** : la V2 graphique, rendue complète et cohérente, appuyée sur ce qui marche vraiment pour tenir des habitudes (`docs/recherche-motivation.md`) : copilote de recommandations, déclencheurs d'habitudes, modèles de campagnes, tests de bout en bout.

- **Base** : dépôt `Doktom/rpg-habitudes-v2`, tag `v0.2-base` (historique conservé ici, V0 comprise). La V2 reste en ligne et n'est plus modifiée, sauf correctif.
- **Stockage** : V0, V2 et V3 sont sur le même domaine (doktom.github.io) et partagent le localStorage. La V3 a ses propres clés (`rpg-habitudes-v3:*`) et importe en lecture seule, au premier lancement, les données V2 (`rpg-habitudes-v2:data`), ou V0 à défaut. Ne jamais écrire dans les clés des autres versions.
- **Copilote** : `src/lib/engine/copilot.ts` (règles pures et testées, chacune reliée à un principe de la synthèse ; priorité, conseils écartables pour la journée via `dismissedTips`). Ajouter une règle = un test dans `copilot.test.ts`.
- **Contenus prêts à l'emploi** : `src/lib/templates.ts` (`HABIT_IDEAS`, `CAMPAIGN_TEMPLATES`) ; les versements aux données existantes passent par `addContent` (`CONTENT_VERSION` = 3).
- **Principes de conception** : toute nouvelle mécanique s'appuie sur un principe de `docs/recherche-motivation.md` et n'en contredit aucun (pas de punition, choix laissé à l'utilisateur, progrès visibles, commencer petit).

## Démarrer une session

0. `git pull` : le travail a pu avancer sur un autre PC (voir « Travailler sur plusieurs PC »).
1. Lire la carte mentale (voir « Carte mentale : outil de pilotage »), puis l'entrée la plus récente de `docs/journal-sessions.md` et `docs/cahier-des-charges.md`.
2. `npm install` puis `npm test` (47 tests attendus au vert, dont les parcours de bout en bout de `src/lib/store.test.ts`) et `npm run dev`.
3. Si le doc partagé Claude Docs n'est pas accessible, `docs/cahier-des-charges.md` fait foi.

**État au 02/11/2026 (V3, version 0.3.0)** : tous les écrans sont au système de design (Habitudes refait, Danse aligné) ; régularité récompensée, boucliers de série au choix, Carnet ; copilote de recommandations sur Aujourd'hui ; déclencheurs d'habitudes ; catalogue d'habitudes à essayer ; 7 modèles de campagnes ; « si… alors… » dans la revue. Aujourd'hui met l'action d'abord (copilote, joker, journée, habitudes, tâches), l'orbite et les jauges ensuite.

**Prochaines étapes, par ordre de priorité**

1. Usage réel de la V3 quelques semaines, puis calibrage (`REGULARITY`, `SHIELD`, règles du copilote) et retours à reporter ici.
2. Supabase : auth + tables du modèle de données, en remplacement de `load`/`persist` dans `store.svelte.ts` ; synchro entre téléphone et PC.
3. PWA installable + rappels au moment du déclencheur choisi, revue du dimanche.
4. Revue mensuelle (point campagnes, évolution des stats, arc du mois), vue mois du planning.
5. Pistes de `docs/recherche-motivation.md` : titres du pilote gagnés par les séries, petites trouvailles surprises, Élan, mode guidé des routines avec minuteur, intégration de l'app salle.

Questions encore ouvertes : nom de l'app et des stats, habitudes de trading détaillées, chapitres réels des campagnes Trading et Maison, stack de l'app salle.

## Travailler sur plusieurs PC

L'utilisateur travaille sur plusieurs PC. GitHub est la seule source de vérité : la mémoire et l'historique des conversations de Claude restent sur chaque PC, donc tout ce qu'il faut pour reprendre doit être dans le dépôt (ce fichier, le journal, le cahier des charges, la carte mentale).

- **Début de session** : `git pull`, puis `npm install` si `package-lock.json` a changé.
- **Fin de session** : journal à jour (section « Prochaine étape » précise, avec ce qui est en cours), « État » et « Prochaines étapes » ci-dessus à jour, commit et `git push`. Ne jamais laisser de travail non poussé : l'autre PC ne le verrait pas.
- Un travail inachevé se pousse quand même, sur une branche, en le signalant dans le journal.
- Premier lancement sur un nouveau PC : `git clone https://github.com/Doktom/rpg-habitudes-v2.git`, puis Node.js 22+ et `npm install`. Éviter de cloner dans un dossier synchronisé (OneDrive) : la synchro de `.git` et `node_modules` peut créer des conflits.

## Documents de référence

- `docs/cahier-des-charges.md` : cahier des charges, source de vérité du produit.
- Doc partagé (Claude Docs) : https://claude.ai/artifact/C8zL86y6JnbN2dSHobDbAi — même contenu, version éditable et commentable.
- `docs/journal-sessions.md` : journal des sessions de travail avec Claude.
- **Carte mentale** des modules et mécaniques : https://claude.ai/artifact/Bq2ySz5W8oPtYHMQpmxQz9 (source : `tools/carte-mentale.html`). Les nœuds vivent dans la base de l'artifact, collection `nodes` (champs `label`, `parent`, `kind` module|mecanique|idee|question, `status` en-place|prevu|a-explorer|abandonne, `note`, `order`). Claude les lit et les écrit avec l'outil ArtifactData. `docs/carte-mentale.md` en est une copie lisible.

## Carte mentale : outil de pilotage (à chaque session)

La carte mentale est l'outil de pilotage du projet et l'interface d'échange avec l'utilisateur, en plus du chat. Les priorités et les idées s'y décident.

- **Début de session** : lire toute la collection `nodes`. Traiter en priorité les nœuds sous « Pour Claude » (`x-pour-claude`) ; statut `prevu` = à faire en premier. Repérer aussi les nœuds nouveaux ou modifiés ailleurs (comparer avec `docs/carte-mentale.md`).
- **Pendant** : quand une mécanique est développée ou décidée, passer son nœud en `en-place` ou `prevu` (ou le créer). Une demande traitée passe en `en-place` (ou `abandonne` avec la raison en note).
- **Fin de session** : ajouter un nœud de compte rendu daté sous « Réponses de Claude » (`x-reponses`, le plus récent avec le plus petit `order`), qui répond aux demandes traitées.
- Quand une mécanique est développée ou décidée, passer son nœud en `en-place` ou `prevu` (ou le créer).
- En fin de session, régénérer la copie : ArtifactData `list` sur `nodes` avec `out_dir`, puis `node tools/carte-export.mjs <out_dir>/nodes`, et committer `docs/carte-mentale.md`.
- Pour modifier la page elle-même : republier `tools/carte-mentale.html` sur la même URL (garder `capabilities: {db: {}}`).

## Règles systématiques (à chaque session)

1. **Cahier des charges à jour** : toute décision produit ou technique prise pendant la session est reportée dans le doc partagé ET dans `docs/cahier-des-charges.md` (exporter le doc en markdown pour garder les deux identiques).
2. **Journal de session** : ajouter en haut de `docs/journal-sessions.md` une entrée datée (objectif, décisions, travail réalisé, questions ouvertes, prochaine étape).
3. **Commit + push** sur GitHub en fin de session, avec un message qui résume la session.

## Principes produit à respecter

- On ne perd jamais d'XP ni de niveau ; les conséquences portent sur les jauges.
- Motivation plutôt que punition. Les matériaux du vaisseau ne se perdent jamais : ils se dépensent seulement sur une amélioration choisie. Lore et mécaniques spatiales : `docs/univers.md`.
- Mode test (écran Personnage) : stockage séparé, date simulée via `setClock` dans `src/lib/dates.ts`. Toujours l'utiliser pour essayer la progression avant de calibrer.
- Trading : on récompense le processus, jamais le P&L.
- V2 : beau et doux, dans l'univers spatial, sans perdre la lisibilité.

## Système de design

- **Thèmes** : Nuit douce (sombre, par défaut) et Aube orbitale (clair), plus « automatique ». Jetons dans `src/app.css` (`--page`, `--surface`, `--raised`, `--line`, `--ink`, `--muted`, `--accent`, `--reward`, `--done`, `--g-*` pour les jauges) et classes Tailwind associées (`bg-surface`, `text-muted`, `bg-accent-soft`…). Choix du thème : `src/lib/theme.svelte.ts`, appliqué avant l'affichage par le script de `src/app.html`.
- **Écrire les écrans avec les jetons** (`bg-surface`, `text-ink`, `text-muted`, `border-line`, `bg-accent`…) plutôt qu'avec des couleurs Tailwind. La palette `zinc` est rebranchée sur la rampe neutre du thème, et les teintes d'accent ont une version sombre générée par `node scripts/gen-dark-hues.mjs` (`src/theme-hues-dark.css`) : ajouter une teinte là si un écran en utilise une nouvelle. Pas de `bg-white`/`text-white`.
- **Classes de composants** : `.card`, `.btn`, `.btn-primary`, `.btn-ghost`, `.input`, `.label`, `.h2`, `.eyebrow`, `.chip`.
- **Composants** : `ShipArt` (le Sillage en SVG, dont chaque partie reflète le niveau d'un module), `OrbitRing` (orbite elliptique autour de Kronos), `LevelRing`, `Gauges`, `TierButtons` (palier en pilule), `LootLine` (butin avec icônes), `ThemeSwitch`, `Segmented` (sélecteur à pilules), `TaskCheck` (case ronde colorée par l'effort), `StatRadar` (radar des disciplines), `Toasts` + `toasts.svelte.ts` (notification de gain : `toasts.push({ title, xp, loot })`), `WeekDots` (la semaine d'une habitude en sept pastilles). Icônes : `@lucide/svelte`. Police : Nunito (`@fontsource-variable/nunito`, embarquée).
- **Navigation** : barre latérale groupée (Bord, Voyage, Pilote) sur PC ; sur mobile, une barre flottante à 4 écrans + « Plus ».

## Stack

- En place (V0) : SvelteKit 3 (Svelte 5, runes), TypeScript, Tailwind 4, Vitest, adapter-static en SPA. Données en localStorage via `src/lib/store.svelte.ts`.
- Prévu : Supabase (Postgres, Auth, RLS, Edge Functions), PWA avec Web Push.
- SvelteKit 3 : pas de `svelte.config.js`, la config passe par `sveltekit({...})` dans `vite.config.ts`. Imports internes avec `#lib/...` et l'extension explicite (`#lib/dates.ts`, `#lib/store.svelte.ts`).
- Régularité : `src/lib/engine/regularity.ts` calcule les récompenses d'une date (journée complète, séries, semaines pleines) ; le store les recalcule de la date modifiée à aujourd'hui (`syncRegularity`, sources `reg:*`) à chaque coche ou décoche, et annonce les nouveaux gains par une notification.
- Boucliers de série : `src/lib/engine/shields.ts` (réserve rejouée depuis le journal : gains `reg:day:*`, achats `shield:buy:*`, usages `shieldedDays`). C'est un choix du joueur : `shieldOffer` repère un raté récent (hier, avant-hier) qui casse une série, l'écran Aujourd'hui propose `store.useShield(date)` ou `store.declineShield(date)` ; jamais de dépense automatique. Un jour protégé est sauté par les séries et les semaines pleines, pas par les obligations.
- Contenus ajoutés après coup : `addContent` dans `src/lib/seed.ts`, versé une fois grâce à `contentVersion` (une habitude supprimée ne revient pas). Pour ajouter un contenu, incrémenter `CONTENT_VERSION`.
- Les règles de jeu vivent dans `src/lib/engine/` (fonctions pures, testées) et les constantes dans `src/lib/config.ts`. XP et jauges sont recalculées depuis le journal `events` : toute action ajoute ou retire des événements, jamais de compteur modifié directement.

- Routage par hash (`router: { type: 'hash' }`) et `appDir: 'app'` : liens internes en `#/...`. Pas de `confirm()`/`alert()` (bloqués dans la page de test), utiliser `ConfirmButton`.

## Commandes

`npm run dev` · `npm test` · `npm run check` · `npm run build` · `npm run build:artifact`

Sous Windows avec Git Bash, tester le build GitHub Pages avec `MSYS_NO_PATHCONV=1 BASE_PATH=/rpg-habitudes-v3 npm run build` (sinon le chemin est converti en chemin Windows).

## En ligne

- Site public V3 : https://doktom.github.io/rpg-habitudes-v3/ — déployé automatiquement par GitHub Actions à chaque push sur `main` (le build reçoit `BASE_PATH=/rpg-habitudes-v3`, tiré du nom du dépôt).
- V2 (figée, tag `v0.2-base`) : https://doktom.github.io/rpg-habitudes-v2/. Le dépôt est public : ne jamais y mettre de secrets ni de données personnelles.
- V0 (base, figée) : https://doktom.github.io/rpg-habitudes/.
