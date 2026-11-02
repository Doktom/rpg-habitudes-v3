# Le Sillage · RPG Habitudes — Brief technique complet (V3, version 0.4.0)

Document de référence pour **reconstruire l'application à l'identique sur le fond** (mécaniques, données, règles, contenus, textes), en particulier pour une **nouvelle version en 3D**. Il décrit tout **sauf le graphisme** : aucune couleur, mise en page, typographie ou style visuel n'est imposé ici. Là où l'app actuelle montre quelque chose (une jauge, une orbite, un vaisseau), le brief dit *quelle information* doit être visible et *quelle action* doit être possible, jamais *à quoi cela ressemble*.

Source : dépôt `Doktom/rpg-habitudes-v3`, tag `v3-base` (02-03/11/2026). Langue de l'app : français. Les valeurs chiffrées sont celles de `src/lib/config.ts` ; elles sont à recalibrer à l'usage mais doivent être reprises telles quelles au départ.

---

## Sommaire

1. Vision et principes non négociables
2. Architecture technique
3. Modèle de données
4. Le journal d'événements
5. XP, niveaux, butin
6. Les trois jauges et la clôture des journées
7. Régularité : journées, séries, semaines pleines
8. Boucliers de série
9. L'orbite hebdomadaire
10. Le vaisseau, les compétences, les trophées
11. Planification : ce qui est dû un jour donné
12. Habitudes, routines, programmes, danse
13. Tâches et carnet
14. Campagnes
15. Revues (semaine, mois)
16. Le conteur : moments et chronique du mois
17. Le copilote
18. Prise en main : tutoriel, missions, astuces
19. Notifications push
20. Synchronisation entre appareils
21. Écrans et parcours
22. Contenus de départ et textes de l'univers
23. Mode test
24. Constantes de jeu (config complète)
25. Comportements à couvrir par des tests
26. Pas encore fait / pistes

---

## 1. Vision et principes non négociables

Webapp personnelle (mobile + PC) qui réunit **suivi d'habitudes**, **planification** (jour, semaine, mois) et **projets au long cours**, habillée d'une couche **RPG spatiale** : un pilote, son vaisseau (le *Sillage*) en orbite autour de la planète-horloge *Kronos*, dont la révolution de 7 jours *est* la semaine.

Principes (chaque mécanique nouvelle doit en respecter tous) :

1. **On ne perd jamais d'XP, de niveau, de trophée ni de module.** Les ratés pèsent seulement sur des jauges qui remontent. Les matériaux ne se perdent pas : ils se dépensent uniquement quand l'utilisateur choisit une amélioration.
2. **Motivation plutôt que punition.** Pas de points de vie, pas de mort, pas de reproche. Ton bienveillant dans tous les textes.
3. **Anti tout-ou-rien.** Trois paliers par habitude (minimum / normal / excellent), le minimum compte comme réussi. Mode minimum, jours de repos, fréquences souples.
4. **Récompenser le processus, pas le résultat** (trading : on récompense l'analyse et le respect du plan, jamais le gain).
5. **L'utilisateur choisit** : ses habitudes, ses paliers, ses jokers (jamais dépensés à sa place), ses améliorations.
6. **Progrès visibles** : chaque gain s'annonce au moment où il arrive ; les moments forts sont racontés.
7. Fondements (synthèse `docs/recherche-motivation.md`, 13 principes) : une habitude prend du temps (médiane 66 jours, Lally 2010) ; rater une fois ne casse rien, rater deux fois si ; commencer petit (Fogg) ; intentions de mise en œuvre « quand X, je fais Y » (Gollwitzer) ; suivi des progrès et effet de gradient ; récompenses informatives (autodétermination) ; pas de punition ; séries + joker ; nouveaux départs (lundi, début de mois) ; prévoir les obstacles (« si… alors… », WOOP) ; pas trop à la fois ; le repos fait partie du plan ; réfléchir régulièrement (revues).

Pièges à éviter : trop de gamification (l'XP ne doit pas devenir le but), notifications culpabilisantes, complexité (chaque écran a une action principale évidente).

---

## 2. Architecture technique

### 2.1 Vue d'ensemble

- **Client web local-first** (aujourd'hui SvelteKit 3 + Svelte 5 + TypeScript, Tailwind 4, Vitest, routage par hash `#/…` pour un hébergement statique, hébergé sur GitHub Pages par un workflow GitHub Actions qui lance tests puis build). Toutes les données vivent **dans le navigateur** (localStorage) et l'app marche **hors ligne**.
- **Moteur pur et testé** (`src/lib/engine/*`) : fonctions sans effet de bord, qui calculent tout (XP, jauges, régularité, orbite, trophées, récits, copilote) **à partir des données**. Les constantes sont dans un seul fichier de config.
- **Store** (`src/lib/store.svelte.ts`) : l'état de l'app (un objet `AppData`) et toutes les actions (valider, décocher, créer…). Chaque action écrit dans le **journal d'événements** puis sauvegarde.
- **Synchro** (`src/lib/sync/*`) : copie de l'`AppData` dans Supabase (un document JSON par utilisateur, versionné), fusion à trois voies entre appareils.
- **Serveur** (Supabase) : Postgres + Auth + RLS, une fonction Edge `send-reminders` appelée toutes les 10 minutes par `pg_cron` pour les notifications push (Web Push / VAPID).
- **PWA** : manifeste, icônes, service worker (cache de la version, page hors ligne, réception des push, clic sur notification qui ouvre l'app à la bonne page).

### 2.2 Règles d'architecture à conserver

1. **Le journal d'événements est la source de vérité de la progression** : XP, matériaux, jauges se recalculent toujours en rejouant les événements. On ne stocke jamais un total.
2. **Tout calcul de jeu est une fonction pure** des données et d'une date (`asOf`), testable sans interface.
3. **Les dates sont des chaînes `YYYY-MM-DD`** calculées en UTC (pas de décalage d'heure d'été). Les semaines commencent le **lundi**. Une horloge simulée (`setClock`) permet le mode test.
4. **Décocher annule exactement** ce que la validation avait rapporté (événements supprimés par leur source, récompenses de régularité recalculées).
5. **Versionnement du stockage** : chaque version de l'app a ses propres clés locales et importe **en lecture seule** les données de la version précédente au premier lancement. Ne jamais écrire dans les clés d'une autre version. Clés V3 : `rpg-habitudes-v3:data`, `:test`, `:mode`, `:theme`, `:supabase`, `:auth`, `:sync-base`, `:sync-rev`, `:sync-dirty`, brouillons `:revue:<lundi>`, `:revue-mois:<1er du mois>`. Import : `rpg-habitudes-v2:data`, sinon `rpg-habitudes:v1` (V0).
6. **Contenus ajoutés après coup** : un compteur `contentVersion` (actuellement 3) dans les données ; chaque palier de contenu n'est versé qu'une fois (une habitude supprimée ensuite ne revient pas).

### 2.3 Pour la version 3D

- Garder le **même modèle de données** (`AppData`, version 1) et le même moteur : idéalement, porter `src/lib/engine/*`, `config.ts`, `universe.ts`, `templates.ts`, `seed.ts`, `dates.ts` et `sync/merge.ts` tels quels (TypeScript pur, sans dépendance d'interface). La 3D est une nouvelle *présentation* du même jeu.
- Clés locales propres (ex. `rpg-habitudes-3d:*`) et import en lecture seule des données V3 au premier lancement.
- Le backend Supabase existant (projet `ihqmeozeyzsihzjvjsgk`) peut servir tel quel si la 3D garde le même format de données : la 3D et la V3 deviennent deux clients du même compte. Si le format évolue, prévoir une table distincte (ex. `app_state_3d`) pour ne pas casser la V3.

---

## 3. Modèle de données

Un seul objet `AppData` (sérialisé en JSON) contient tout.

```ts
type ISODate = string;           // 'YYYY-MM-DD'
type Time = string;              // 'HH:MM'
type Difficulty = 'easy' | 'medium' | 'hard';
type Tier = 'min' | 'normal' | 'excellent';
type Moment = 'morning' | 'day' | 'evening';
type HabitKind = 'obligatory' | 'bonus';
type HabitForm = 'simple' | 'routine' | 'program';
type DanceStyle = 'salsa' | 'bachata' | 'kizomba';
type Material = 'metal' | 'energy' | 'crystal';      // Alliage, Cellule, Cristal
type Loot = Partial<Record<Material, number>>;        // positif = gain, négatif = dépense
type ModuleId = 'reactor' | 'hull' | 'thrusters' | 'antenna';
type SkillId = 'recovery' | 'logistics' | 'endurance' | 'engineering';

type Frequency =
  | { type: 'daily' }
  | { type: 'weekly'; times: number }     // X fois par semaine, jours libres
  | { type: 'days'; days: number[] };     // jours fixes, 0 = dimanche … 6 = samedi

interface Domain { id; name; stat; color; parentId? }  // catégorie = stat ; parentId = sous-compétence
interface DomainShare { domainId; weight }              // répartition en %, total 100

interface Exercise { id; name; detail? }                // « 30 s », « 3 x 10 »
interface RoutineVersion { from: ISODate; exercises: Exercise[] }

interface Habit {
  id; name; form: HabitForm; kind: HabitKind; frequency: Frequency;
  tiers: Record<Tier, string>;   // description d'une ligne par palier
  moment: Moment; slot?: Time;   // créneau par défaut dans l'agenda
  cue?: string;                  // déclencheur « quand / après… »
  difficulty: Difficulty; domains: DomainShare[]; campaignId?;
  routine?: RoutineVersion[];    // forme routine : versions datées
  sessions?: string[];           // forme programme : séances types (A, B, C…)
  createdAt: ISODate; archived?: boolean;
}
interface HabitLog { id; habitId; date; tier; doneExercises?: string[]; session?; note? }

interface DanceClass { id; style; weekday; time; durationMin; place?; kind: HabitKind; cancelled: ISODate[] }
interface DanceParty { id; date; time; place?; styles: DanceStyle[]; note? }
interface Vacation { id; label; start; end }            // suspend les cours fixes
interface DanceLog { id; refId /* cours ou soirée */; date; tier }

interface Quest { id; name; xp; boss?; due?; done?: ISODate }
interface Chapter { id; name; quests: Quest[]; done?: ISODate }
interface Campaign { id; name; intent; domainId; status: 'active'|'paused'|'done'; target?: ISODate; chapters: Chapter[]; done?: ISODate }

type TaskList = 'today' | 'week' | 'month' | 'someday';
interface Subtask { id; title; done? }
interface Task { id; title; list: TaskList; note?; effort?: Difficulty /* facile par défaut */; due?; subtasks?;
                 date?; start?: Time; end?: Time; questId?; domainId?; done?: ISODate }

interface Review { id; type: 'weekly'|'monthly'; periodStart; createdAt; worked; stuck; adjust; plan?; priorities: string[];
                   snapshot: { xp; discipline; motivation; inspiration; successRate } }

interface ProgressEvent { id; at /* ISO, pour l'ordre */; date; source; label;
                          xp?: { domainId; amount }[]; gauge?: { motivation?; inspiration? }; loot?: Loot; campaignId? }

interface NoteItem { id; text; done?; createdAt }
interface NoteList { id; name; kind: 'list'|'note'; icon; color; items: NoteItem[]; body?; pinned?; createdAt; updatedAt? }

type ReminderKind = 'morning' | 'day' | 'evening' | 'dayCheck' | 'review' | 'month';
interface Reminder { kind; time: Time; on: boolean }
interface Settings { reminders: Reminder[]; tz: string }
interface Onboarding { startedAt; introDone?; missions: Record<string, ISODate>; hidden?; hints: string[] }

interface AppData {
  version: 1;
  domains; habits; habitLogs; danceClasses; danceParties; vacations; danceLogs;
  campaigns; tasks; reviews; events;
  restDays: ISODate[]; minimumModeDays: ISODate[];
  shieldedDays: ISODate[];      // jours ratés protégés par un bouclier
  shieldDeclined: ISODate[];    // jours où l'utilisateur a refusé le bouclier
  dismissedTips: string[];      // conseils écartés « <id>:<date> » (on garde 7 jours)
  lastProcessedDay?: ISODate;   // dernière journée clôturée
  ship: { modules: Partial<Record<ModuleId, number>> };
  skills: Partial<Record<SkillId, number>>;
  trophies: Record<string, ISODate>;
  testClock?: ISODate;
  notebook: NoteList[];
  contentVersion?: number;
  settings: Settings;
  onboarding: Onboarding;
  moments: { seen: string[]; level: number };   // moments déjà racontés, dernier niveau fêté (−1 = à initialiser)
}
```

`withDefaults` complète toute donnée plus ancienne (champs manquants) puis appelle `addContent`.

---

## 4. Le journal d'événements

Chaque changement de progression est un `ProgressEvent` identifié par sa **source** (unique). Décocher supprime l'événement de même source.

| Source | Créé par | Contenu |
| --- | --- | --- |
| `habit:<logId>` | validation d'une habitude | XP réparti sur les domaines, butin, Motivation |
| `dance:<logId>` | validation d'un cours / d'une soirée | XP sur la danse concernée, butin, Motivation |
| `task:<taskId>` | tâche terminée | XP, butin, campagne liée éventuelle |
| `quest:<questId>` | quête cochée (libellé « Quête : » ou « Boss vaincu : ») | XP, butin, Motivation |
| `chapter:<id>` | toutes les quêtes d'un chapitre faites | XP, butin, Inspiration |
| `campaign:<id>` | campagne terminée | XP, butin, Inspiration |
| `review:<id>` | revue hebdo ou mensuelle | XP, butin (+ butin d'orbite pour l'hebdo), Inspiration |
| `day:<date>` | clôture d'une journée passée | Motivation (ratés + retour vers 50), Inspiration (campagnes au point mort) |
| `reg:day:<date>` | journée complète / parfaite | XP, butin |
| `reg:streak:<habitId>:<jours>:<date>` | palier de série | XP, butin |
| `reg:hweek:<habitId>:<lundi>` | semaine pleine d'une habitude | XP, butin |
| `reg:fweek:<domainId>:<lundi>` | semaine pleine d'une discipline | XP, butin |
| `reg:week:<lundi>` | semaine sans faille | XP, butin |
| `trophy:<id>` | trophée débloqué | XP (non multipliée), butin |
| `ship:<module>:<niveau>` | amélioration achetée | butin négatif (coût) |
| `shield:use:<date>` | bouclier utilisé (date = jour protégé) | — |
| `shield:buy:<uid>` | bouclier fabriqué | butin négatif |
| `onboard:<missionId>` | mission des premiers jours | XP, butin |

À l'ajout d'un événement : l'XP est multipliée par le bonus du Réacteur (sauf trophées), l'Inspiration positive par le bonus de l'Antenne. Le champ `at` sert seulement à ordonner les événements d'une même journée.

**Totaux dérivés** : XP totale = somme des XP ; XP par domaine (un domaine parent cumule ses sous-compétences) ; matériaux = somme des butins ; jauges = rejeu ordonné (bornées 0-100 à chaque pas).

---

## 5. XP, niveaux, butin

- **XP d'une action** : `round(base[difficulté] × facteur[palier] × (1 + Discipline/100))`, base facile 10 / moyenne 20 / difficile 40, facteur min 0,5 / normal 1 / excellent 1,5 (Endurance augmente le min). Danse : difficulté moyenne.
- **Bonus fixes** (quête, chapitre, campagne, récompenses de régularité) : `round(base × (1 + Discipline/100))`.
- **Tâches** : XP d'une action « normale » de l'effort choisi × bonus Logistique ; butin × bonus Logistique.
- **Répartition** : l'XP se répartit entre les domaines selon les poids, l'arrondi va au premier. Sans domaine : `domainId: ''`.
- **Niveaux** (pilote et chaque stat) : passer de *n* à *n+1* coûte `round(100 × n^1,5)` XP (1→2 : 100 ; 5→6 : 1 118 ; 10→11 : 3 162). Niveau 1 au départ.
- **Butin d'une action** : base selon la difficulté × facteur du palier, arrondi (facile 2 Alliage ; moyenne 2 Alliage + 1 Cellule ; difficile 3 Alliage + 2 Cellules + 1 Cristal).
- **Autres butins** : quête 2 Alliage + 2 Cellules ; boss 2 Cellules + 2 Cristaux ; chapitre 3 Cristaux ; campagne 10 Cristaux ; revue hebdo 3 Cellules (+ butin d'orbite) ; revue mensuelle 5 Cellules + 1 Cristal.
- **Récompenses fixes** : chapitre 300 XP, campagne 1 000 XP, revue hebdo 50 XP, revue mensuelle 150 XP.
- **Points de compétence** = niveau du pilote − 1 − points dépensés.

---

## 6. Les trois jauges et la clôture des journées

Trois jauges 0-100 remplacent les points de vie.

**Discipline** (régularité de fond) — calculée, pas stockée : taux de réussite pondéré des **obligations** sur les **28 derniers jours terminés** (le jour même exclu). Poids d'un jour = 29 − âge (les jours récents pèsent plus). Chaque obligation due compte 1 item (réussi s'il y a un log, quel que soit le palier). Pour les habitudes obligatoires « X fois par semaine », un item supplémentaire chaque dimanche, de poids double, réussi à `min(1, faits/attendus)`. Sans aucun item : 0. Effet : multiplicateur d'XP ×(1 + D/100).

**Motivation** (énergie du moment), départ 50 : +3 par obligation validée, +2 par bonus, +6 par quête ; à la clôture d'un jour, −8 par obligation ratée (moins 10 % par niveau de Coque) dont les objectifs hebdo manqués comptés le dimanche ; puis retour vers 50 de 15 % de l'écart (+3 points de % par niveau de Second souffle). Sous 30 : l'app propose le mode minimum.

**Inspiration** (sens et nouveauté), départ 50 : +25 revue hebdo (et mensuelle), +15 chapitre, +30 campagne ; −2 par jour pour chaque campagne **active** sans aucun événement ce jour-là (une campagne en pause ne coûte rien). ≥ 80 : « Élan bientôt disponible » (l'Élan lui-même n'est pas encore implémenté).

**Clôture des journées (`rollover`)** : à l'ouverture, chaque jour entre `lastProcessedDay + 1` et hier (60 jours au plus) est clôturé : un événement `day:<date>` porte la Motivation (ratés, retour vers 50) et l'Inspiration (campagnes au point mort). Un jour de repos n'a pas de ratés. Puis les récompenses de régularité sont recalculées depuis le premier jour clôturé.

**Mode minimum** (par jour) : les habitudes non faites n'affichent que le palier minimum. **Jour de repos** (par jour, posable à l'avance) : aucune obligation ce jour-là, neutre pour tout ; il compte comme secteur allumé.

---

## 7. Régularité : journées, séries, semaines pleines

Recalculées du jour modifié jusqu'à aujourd'hui (400 jours au plus) à chaque coche / décoche / repos / bouclier : les anciennes `reg:` de la période sont supprimées puis recréées. Les nouvelles s'annoncent par une notification de gain. XP de base × Discipline du jour.

- **Journée complète** : toutes les obligations du jour faites (au moins une) : +25 XP, 1 Cellule. **Journée parfaite** : et tous les bonus dus du jour : +45 XP, 2 Cellules + 2 Alliages. Jamais un jour de repos.
- **Série d'une habitude** (quotidienne ou jours fixes) : jours dus consécutifs tenus jusqu'à la date. Un jour non dû, un repos ou un jour protégé par bouclier ne casse rien ; le jour même ne casse pas la série tant qu'il n'est pas fait. Paliers (le jour où on les atteint) : 7 j +40 XP 2 Cellules ; 14 j +80 XP 3 Cellules ; 30 j +200 XP 2 Cristaux ; 60 j +400 XP 3 Cristaux ; 100 j +700 XP 5 Cristaux ; 200 j +1 200 XP 8 Cristaux ; 365 j +2 000 XP 12 Cristaux.
- **Série hebdo** (« X fois par semaine ») : semaines d'affilée tenues (la semaine en cours compte si elle est déjà tenue).
- **Semaine pleine d'une habitude** : tous ses jours dus de la semaine faits, ou l'objectif « X fois » atteint ; au moins 2 éléments. Tombe le jour où la semaine devient complète. +30 XP + 10 par semaine d'affilée au-delà de la première (bonus plafonné à 7, soit +100), 3 Alliages, +1 Cristal à 4, 8, 12, 26 et 52 semaines d'affilée. Libellé « Semaine pleine : <nom> (n semaines d'affilée) ».
- **Semaine pleine d'une discipline** : pour chaque domaine de premier niveau regroupant au moins 2 habitudes ou cours (sous-compétences comprises, la danse inclut ses cours), tout fait dans la semaine, au moins 3 éléments : +60 XP, 3 Cellules.
- **Semaine sans faille** : toutes les obligations de la semaine (habitudes obligatoires et cours obligatoires), au moins 3 : +150 XP, 2 Cristaux.

---

## 8. Boucliers de série

Des jokers rares, **toujours au choix de l'utilisateur**.

- **Réserve** rejouée dans l'ordre des événements : +1 toutes les 7 journées complètes (sans dépasser le maximum), +1 par achat, −1 par usage. Maximum = 2 + 1 tous les 2 niveaux de Coque (4 au plus). Achat au chantier : 6 Cellules, si la réserve n'est pas pleine.
- **Série menacée** un jour donné : habitude quotidienne / à jours fixes due, non faite, avec une série d'au moins 3 jours la veille (pas un repos, pas déjà protégé).
- **Proposition** : sur Aujourd'hui, pour avant-hier puis hier (le plus ancien d'abord), s'il y a des séries menacées et que l'utilisateur n'a pas déjà refusé : « Utiliser un bouclier » ou « Laisser filer ». Sans bouclier en réserve : « En fabriquer un » (vers le chantier).
- **Effet** : le jour est ajouté à `shieldedDays` ; les séries et semaines pleines le sautent, mais le jour reste un raté pour la Discipline et la Motivation, et ne rapporte rien. Événement `shield:use:<jour>`, notification « Bouclier utilisé : … sauvée(s) ». Le lendemain matin, rappel « Bouclier posé sur hier : … ».

---

## 9. L'orbite hebdomadaire

La semaine = 7 **secteurs** (lundi → dimanche : Aube, Forge, Zénith, Jonction, Éclat, Dérive, Havre). État d'un secteur à une date de référence : `future` (après la date), `rest` (repos), `lit` (aucune obligation ou toutes faites), `today` (le jour même pas encore complet), `partial` (passé, au moins la moitié faite), `missed` (passé, moins de la moitié).

- Secteurs allumés = `lit` + `rest`. Points = allumés + 0,5 × partiels.
- **Butin d'orbite** versé à l'amarrage (revue hebdo) : 4 Alliages × points × bonus Propulseurs (+25 %/niveau), plus 3 Cristaux × bonus si les 7 sont allumés (orbite parfaite).
- Chaque lundi, une orbite neuve, quel que soit le résultat de la précédente.

---

## 10. Le vaisseau, les compétences, les trophées

### Modules (5 niveaux chacun)

| Module | Rôle | Effet par niveau | Lore |
| --- | --- | --- | --- |
| Réacteur à fusion | XP | +6 % d'XP | Le cœur du Sillage : plus il tourne fort, plus chaque effort pèse. |
| Coque renforcée | Motivation | −10 % de Motivation perdue par raté ; +1 place de bouclier tous les 2 niveaux | Les mauvais jours cognent moins fort sur un blindage solide. |
| Propulseurs ioniques | Orbite | +25 % de butin d'orbite | Une orbite stable rapporte plus quand on pousse dans le bon sens. |
| Antenne longue portée | Inspiration | +20 % d'Inspiration gagnée | Elle capte les signaux lointains : idées, élans, envies. |

Coût du niveau *n* : Alliage 20n, Cellules 8n, Cristaux ⌈1,5(n−1)⌉ à partir du niveau 2 ; × facteur du module (Antenne 0,8) × (1 − 5 % par niveau d'Ingénierie), arrondi au-dessus. Achat possible seulement si la soute suffit ; l'écran indique ce qui manque.

**Classe du vaisseau** (somme des niveaux, max 20) : Épave 0, Navette 3, Corvette 7, Frégate 12, Croiseur 17, Vaisseau-amiral 20.

### Compétences du pilote (5 niveaux, 1 point par niveau de pilote)

| Compétence | Effet par niveau | Lore |
| --- | --- | --- |
| Second souffle | Motivation : retour vers 50 de +3 points de % par jour (15 % → 30 %) | Le pilote revient plus vite à son niveau de base. |
| Logistique | +15 % d'XP et de butin sur les tâches | Les colis et corvées de bord rapportent davantage. |
| Endurance | Palier minimum ×(0,5 + 0,06 × niveau) | Même un petit effort compte vraiment. |
| Ingénierie | −5 % sur le coût des améliorations | Moins de déchets à l'atelier, plus de pièces pour le chantier. |

### Trophées (22, jamais perdus, vérifiés à chaque sauvegarde)

| Id | Nom | Condition | Récompense | Lore |
| --- | --- | --- | --- | --- |
| first-light | Premier allumage | 1 habitude validée | 20 XP, 3 Alliage | Les systèmes de bord répondent enfin. |
| first-task | Premier colis | 1 tâche terminée | 20 XP, 3 Alliage | Une corvée de moins dans la soute. |
| tasks-10 | Cargo en route | 10 tâches | 60 XP, 3 Cellules | Dix livraisons, la soute respire. |
| tasks-50 | Chef de soute | 50 tâches | 200 XP, 2 Cristaux | Cinquante colis passés par tes mains. |
| logs-100 | Centurion | 100 habitudes validées | 150 XP, 5 Cellules, 1 Cristal | Cent routines de bord accomplies. |
| dance-10 | Rythme galactique | 10 danses | 80 XP, 3 Cellules | Dix danses, et même les étoiles suivent le tempo. |
| streak-7 | Sept jours sans faille | 7 jours de suite toutes obligations faites | 100 XP, 4 Cellules, 1 Cristal | Une semaine entière à pleine puissance. |
| streak-30 | Mois stellaire | 30 jours de suite | 400 XP, 5 Cristaux | Trente jours : même Kronos en est jaloux. |
| orbit-1 | Première orbite | 1 revue hebdo | 40 XP, 5 Alliage | Tu amarres au Havre pour la première fois. |
| orbit-4 | Quatre orbites | 4 revues hebdo | 120 XP, 5 Cellules, 1 Cristal | Un mois de révolutions, la carte se dessine. |
| orbit-perfect | Orbite parfaite | une semaine revue avec 7 secteurs allumés | 150 XP, 3 Cristaux | Sept secteurs allumés, pas un faux pas. |
| days-10 | Pilote fiable | 10 journées complètes | 80 XP, 4 Cellules | Dix journées où tout tourne rond à bord. |
| habit-30 | Habitude ancrée | un palier de série de 30 jours | 250 XP, 3 Cristaux | Trente jours : ce n'est plus un effort, c'est toi. |
| weeks-4 | Métronome | 4 semaines sans faille | 300 XP, 4 Cristaux | Quatre semaines sans faille, réglé comme une horloge de bord. |
| level-5 | Pilote confirmé | niveau 5 | 4 Cellules, 1 Cristal | Le cockpit commence à te ressembler. |
| level-10 | As du cockpit | niveau 10 | 4 Cristaux | On parle de toi dans les ports de Kronos. |
| stat-5 | Spécialiste | une stat au niveau 5 | 100 XP, 4 Cellules | Une discipline devient ta signature. |
| boss | Chasseur de monstres | 1 boss vaincu | 80 XP, 2 Cristaux | Ce qui te faisait peur gît dans le sas. |
| chapter | Cap franchi | 1 chapitre terminé | 100 XP, 1 Cristal | Un chapitre de la carte est enfin lisible. |
| campaign | Destination atteinte | 1 campagne terminée | 300 XP, 6 Cristaux | Un système entier est désormais sur ta carte. |
| shipyard | Chantier naval | un module au niveau 3 | 60 XP, 10 Alliage | L'atelier ne désemplit pas. |
| refit | Grande refonte | 10 niveaux de modules au total | 200 XP, 3 Cristaux | Le Sillage ne ressemble plus à l'épave du départ. |

« Jours de suite » (streak-7/30) = jours consécutifs avec toutes les obligations faites, les repos et les jours sans obligation ne cassent rien, le jour même ne casse pas.

---

## 11. Planification : ce qui est dû un jour donné

- Habitude **active** à une date : non archivée et créée au plus tard ce jour-là.
- **Due** : active et (quotidienne, ou jours fixes contenant ce jour de semaine). Les « X fois par semaine » ne sont jamais « dues » un jour précis : elles s'affichent chaque jour de la semaine où elles sont actives, avec le compte « n/X cette semaine ».
- **Obligations d'un jour** (hors repos) : habitudes obligatoires dues + cours de danse obligatoires qui ont lieu ce jour-là.
- **Cours de danse** : ont lieu le jour de semaine prévu, sauf séance annulée ou période de vacances. Soirées : à leur date, toujours bonus.
- **Tâches affichées pour un jour** : planifiées ce jour-là ou terminées ce jour-là ; et, pour le jour courant seulement, les tâches non faites : planifiées un jour passé (« reportée »), dont l'échéance est arrivée, ou sans date dans les listes aujourd'hui / semaine / mois (pas « un jour »).
- **Routine du jour** : la dernière version dont la date de début est ≤ au jour.

---

## 12. Habitudes, routines, programmes, danse

- **Types** : obligatoire (compte pour la Discipline, un raté coûte de la Motivation) ou bonus (rapporte, ne coûte jamais). **Nouvelles habitudes en bonus par défaut.**
- **Fréquences** : quotidienne, X fois par semaine, jours fixes. **Moment** : matin, journée, soir. Créneau horaire optionnel (agenda).
- **Paliers** : trois lignes de description ; le formulaire rappelle « le minimum doit tenir les mauvais jours ».
- **Stats** : une stat principale et une secondaire optionnelle avec répartition en %. Création d'une catégorie (nom, nom de stat, couleur) depuis le formulaire.
- **Déclencheur** (« quand / après… ») avec suggestions : Au saut du lit, Après le café, Après le dîner, En rentrant du travail, Pendant la pause du midi, Avant de me coucher. Une habitude sans déclencheur reçoit l'astuce « ajoute un déclencheur pour l'ancrer ».
- **Formes** : simple ; **routine** (liste ordonnée d'exercices nom + détail, réordonnables, versionnée : modifier la liste un autre jour que celui de la dernière version crée une nouvelle version datée ; validation en un geste, exercices cochables avant validation) ; **programme** (séances types, on choisit la séance faite à la validation).
- **Validation** : choisir un palier ; re-choisir le même palier décoche ; choisir un autre palier remplace. En mode minimum, seul le palier minimum est proposé.
- **Liste des habitudes** : par habitude, réussite sur 4 semaines, série, semaine en 7 pastilles (fait / raté / à faire / à venir / libre / protégé par bouclier), archivage / désarchivage, édition.
- **Catalogue d'idées** (12, voir §22) : ajout en un geste (habitude bonus, déclencheur, catégorie créée si absente).
- **Danse** : cours fixes (danse, jour, heure, durée, lieu, obligatoire ou bonus, annulation ponctuelle), vacances (période qui suspend les cours), soirées à venir (date, heure, lieu, danses, note). Ils apparaissent le soir dans Aujourd'hui et dans le planning ; une validation donne l'XP à la sous-compétence de la danse.

---

## 13. Tâches et carnet

**Tâches** : ajout rapide (titre, liste, effort, catégorie facultative) ; quatre listes Aujourd'hui / Cette semaine / Ce mois-ci / Un jour ; détail : titre, note, effort (aperçu de la récompense XP + butin), liste, échéance, catégorie (stat qui reçoit l'XP si la tâche n'est pas liée à une campagne), étapes (sous-tâches avec progression), suppression confirmée ; filtre par catégorie (seules les catégories utilisées) ; terminées repliées. Notification « Tâche terminée · +XP ». Une tâche liée à une quête donne son XP au domaine de la campagne.

**Planning** : vue jour / semaine de l'agenda (habitudes avec créneau, cours, soirées, tâches planifiées), création d'une tâche en cliquant un créneau, glisser-déposer d'une tâche de liste vers un créneau (elle garde sa quête), déplanifier, terminer.

**Carnet** : listes à cocher et notes libres qui ne rapportent rien (courses, déco à acheter, à essayer, à visiter, livres à lire, à penser). Ajout de plusieurs éléments d'un coup (collage multi-lignes), cocher, supprimer, vider les cochés, épingler, **transformer un élément en tâche**, créer / supprimer une liste (nom, icône, couleur, type).

---

## 14. Campagnes

Hiérarchie : domaine → **campagne** (nom, intention, stat, statut active / en pause / terminée, arrivée visée) → **chapitres** ordonnés → **quêtes** (nom, XP, boss ?, échéance) → tâches liées.

- Cocher une quête : +XP de la quête (× Discipline) au domaine de la campagne, butin quête ou boss, +6 Motivation. Si toutes les quêtes du chapitre sont faites : chapitre terminé (+300 XP, 3 Cristaux, +15 Inspiration). Décocher annule les deux.
- Terminer la campagne (action explicite) : +1 000 XP × Discipline, 10 Cristaux, +30 Inspiration ; réversible.
- Pause : l'Inspiration cesse de baisser pour elle.
- Affichage : progression (quêtes faites / total, %), chapitre en cours, chapitres suivants, tâches liées cochables, ajout de quête / chapitre / tâche, création à partir d'un **modèle** (7, voir §22 : chaque quête 100 XP sauf mention, arrivée visée = aujourd'hui + durée indicative).
- Une habitude peut être liée à une campagne : ses validations comptent comme progrès (pas de baisse d'Inspiration ce jour-là).

---

## 15. Revues

### Revue hebdo : « amarrage au Havre » (5 étapes)

Semaine concernée : la semaine en cours, sauf lundi et mardi si la semaine passée n'a pas eu sa revue. Brouillon gardé par semaine.

1. **Bilan** : XP de la semaine, % d'obligations tenues (jours écoulés), secteurs allumés, journées complètes ; l'orbite avec le détail jour par jour (fait / attendu, repos) ; les jauges ; habitude par habitude (fait / attendu sur les jours écoulés, %, série), l'habitude tenue à 100 % mise en avant ; exploits de la semaine (récompenses de régularité hors journées, trophées, boucliers utilisés).
2. **Questions** : ce qui a marché (« Une victoire, même petite. Qu'est-ce qui t'a aidé ? ») ; ce qui a coincé (« Sans te juger : où ça a frotté, et pourquoi ? ») suivi de « Si cet obstacle revient, alors je… » ; ce que j'ajuste (« Un seul petit changement pour la semaine qui vient »).
3. **Ajuster** : passer en bonus une habitude obligatoire ratée 3 fois ou plus ; tâches planifiées un jour passé et non faites : Cette semaine / Un jour / abandonner.
4. **Cap** : 3 priorités (deviennent des tâches « Cette semaine ») ; la quête de la semaine parmi les quêtes ouvertes du chapitre en cours des campagnes actives (crée une tâche « Avancer : <quête> » liée, effort difficile si boss sinon moyen) ; jours de repos de la semaine suivante.
5. **Amarrage** : récompense affichée puis versée (+50 XP, 3 Cellules + butin d'orbite, +25 Inspiration), notification « Amarrage au Havre réussi ». Ensuite : écran « Orbite bouclée » avec la prochaine escale.

Journal des revues consultable (réponses, priorités, snapshot).

### Revue mensuelle : « le récit du mois » (3 étapes)

Mois concerné : le mois précédent pendant les 10 premiers jours s'il n'a pas eu sa revue et qu'il a de l'activité, sinon le mois en cours. Clôture possible à partir des 3 derniers jours du mois. Brouillon gardé.

1. **Le récit** : la chronique du mois (§16).
2. **Ton regard** : ce dont je suis fier ; ce que je laisse derrière moi ; l'arc du mois prochain (un thème en quelques mots) ; 3 intentions (deviennent des tâches « Ce mois-ci »).
3. **Clore le chapitre** : +150 XP, 5 Cellules + 1 Cristal, +25 Inspiration ; notification « Chapitre refermé ».

---

## 16. Le conteur : moments et chronique du mois

Module pur `engine/story.ts`. Ton chaleureux, jamais culpabilisant ; variantes de texte choisies de façon **déterministe** (hachage de la clé), pour qu'un même moment se raconte toujours pareil.

### Moments racontés

Affichés **en plein écran, un à la fois**, chacun une seule fois (clé mémorisée dans `moments.seen`), seulement après le tutoriel et hors mode test, pour les 4 derniers jours. À la première ouverture d'une version (ou après import), tout ce qui existe déjà est marqué comme vu (pas d'avalanche) et le niveau courant est mémorisé.

| Moment | Déclencheur | Surtitre / titre | Texte (résumé des variantes) |
| --- | --- | --- | --- |
| streak | `reg:streak` | « Palier de série · N jours » / « <habitude> : N jours d'affilée » | 7 j : une orbite entière, le premier palier est franchi ; 14 j : un rituel de bord ; 30 j : le cap le plus dur (3 semaines à 2 mois) ; 60 j : le Sillage vole presque tout seul ; 100 j : on raconte ton histoire dans les ports de Kronos ; 365 j : ton nom sur les cartes. Mention du déclencheur s'il existe. |
| week | `reg:week` | « Semaine sans faille » / « Sept secteurs, zéro faux pas » | Une orbite d'une propreté rare ; « c'est là que tout a commencé ». |
| habit-weeks | `reg:hweek` à 4/8/12/26/52 semaines | « N semaines d'affilée » / « <habitude>, semaine après semaine » | Le rythme fait partie de la mécanique ; un cristal rejoint la soute. |
| trophy | `trophy:` | « Trophée débloqué » / nom | Lore + « Objectif atteint : <condition> ». |
| level | XP totale | « Montée en grade » / « Pilote de niveau N » | Un point de compétence t'attend sur l'écran Pilote. |
| chapter | `chapter:` | « Campagne · <nom> » / « Cap franchi : <chapitre> » | Un fragment de carte se redessine ; annonce du chapitre suivant. |
| boss | quête boss | « Boss vaincu » / nom | Ce qui te faisait reculer gît dans le sas. |
| campaign | `campaign:` | « Destination atteinte » / nom | Rappel de l'intention ; regarder le chemin avant la prochaine destination. |
| ship | classe ≠ Épave | « Le Sillage change de classe » / « Classe <X> » | L'épave des débuts n'est plus qu'un souvenir. |
| streak-end | série ≥ 7 j cassée, fenêtre du bouclier passée (refusé, ou raté d'au moins 3 jours) | « Fin d'une série » / « <habitude> : N jours, une belle traversée » | Ces jours restent dans le journal ; ne pas rater deux fois ; reprendre même au minimum, une nouvelle série commence à 1. |

Gain d'XP affiché quand le moment en porte un.

### Chronique du mois

`monthStory(data, 1er du mois, asOf)` renvoie : titre d'arc, sous-titre (« Chronique de <mois> <année> · N jours de voyage »), chapitres, épilogue, XP du mois, taux tenu.

- **I. Le départ** : niveau au 1er du mois ; comparaison avec l'XP du mois précédent (mieux si > +15 %, plus calme si < −15 %, même élan sinon, « premier mois complet » sans historique). Chiffres : XP gagnée, niveau avant → après.
- **II. La route** (s'il y avait des obligations) : taux tenu (≥ 85 % « rare régularité », ≥ 60 % « vraie constance », sinon « route sinueuse, chaque secteur allumé a compté »), habitude la plus fiable (au moins 4 jours dus), plus longue série en cours (≥ 5). Chiffres : journées complètes, parfaites, semaines sans faille.
- **III. Les épreuves** (si quelque chose à dire) : la semaine la plus dure (< 70 %, au moins 5 obligations) racontée comme une traversée de champ d'astéroïdes ; l'habitude obligatoire qui résiste (< 60 %) avec une piste (plus petite, autre moment) ; boucliers utilisés ; jours de repos (« c'est aussi ça, durer »).
- **IV. Les trouvailles** : paliers de série, trophées, campagne atteinte ou chapitres, boss ou quêtes, tâches terminées (« colis livrés »).
- **V. Le chantier** : améliorations du mois et classe du vaisseau.
- **VI. Le pilote** : la stat de premier niveau qui a le plus grandi (+XP), niveaux gagnés.
- **Titre d'arc** (premier qui s'applique) : campagne terminée → « Le mois de la destination » ; ≥ 90 % et ≥ 15 journées complètes → « Le mois de la Forge » ; ≥ 3 trophées → « Le mois des trouvailles » ; ≥ 3 améliorations → « Le mois du chantier » ; chapitre ou boss → « Le mois des caps franchis » ; < 50 % → « Le mois des vents contraires » ; ≥ 2 paliers → « Le mois des séries » ; sinon « Le mois de <stat la plus grandie> » ou « L'orbite de <mois> ».
- **Épilogue** selon le taux : ≥ 80 % garder ce qui marche et oser plus loin ; ≥ 50 % une chose à alléger, une à renforcer ; sinon commencer petit, viser le minimum, laisser l'élan revenir.

---

## 17. Le copilote

Au plus **deux conseils du jour** (les plus prioritaires), uniquement le jour courant, chacun écartable jusqu'au lendemain (« Plus tard »). Trois tons : *boost* (on y est presque), *care* (prendre soin), *plan* (organiser). Une action optionnelle (lien vers un écran).

| # | Règle | Condition | Priorité |
| --- | --- | --- | --- |
| 1 | Ne rate pas deux fois | obligation due hier et aujourd'hui, ratée hier (pas repos, pas protégée), pas encore faite aujourd'hui ; propose le minimum | 90 |
| 2 | Série de N jours à portée | série à exactement 1 jour d'un palier, pas encore faite aujourd'hui | 80 + min(10, N/10) |
| 3 | Plus qu'une obligation | ≥ 2 obligations aujourd'hui, une seule restante | 75 |
| 4 | Amarrage au Havre | dimanche, lundi ou mardi, revue de la semaine concernée pas faite, activité dans cette semaine | 85 le dimanche, 70 sinon |
| 5 | Nouvelle orbite, nouveau départ | lundi après une semaine sous 60 % (avec des obligations) | 72 |
| 6 | <habitude> coince | obligation < 40 % sur 14 jours (≥ 5 dus) : minimum ou bonus, ou ajouter un déclencheur si elle n'en a pas | 60 |
| 7 | Beaucoup d'obligations | plus de 8 obligations quotidiennes | 50 |
| 8 | Une pause te ferait du bien | aucun repos sur 14 jours, Motivation d'hier < 45, plus de 20 validations | 55 |
| 9 | <campagne> attend | campagne active sans activité depuis 7 jours avec des quêtes ouvertes | 40 |
| 10 | Un bouclier en vue | réserve non pleine, à ≤ 2 journées complètes du prochain bouclier | 45 |

Règle de conception : chaque nouvelle règle est reliée à un principe de la recherche et a son test.

---

## 18. Prise en main : tutoriel, missions, astuces

**Tutoriel** (premier lancement, rejouable dans Réglages, « Passer » toujours possible), 6 étapes :
1. *Bienvenue à bord — Le Sillage t'attend* : l'intro de l'univers (§22), le vaisseau à l'état d'épave.
2. *Une journée à bord — Valide, même un peu* : démo interactive d'une habitude (« Kiné matin ») où l'on choisit un palier et voit l'XP (6 / 12 / 18) ; le minimum compte toujours, mode minimum.
3. *Le tableau de bord — Trois jauges, aucune punition* : Discipline, Motivation, Inspiration expliquées.
4. *Une semaine = une orbite — Sept secteurs autour de Kronos* : secteurs allumés, séries, journées complètes, boucliers ; le dimanche au Havre, le récit du mois.
5. *Le voyage au long cours — Répare le vaisseau, trace ta route* : matériaux et modules, campagnes, moments racontés.
6. *Partout avec toi — Téléphone, PC, rappels* : synchro, installation, rappels ; « Plus tard » ou « Configurer » (vers Réglages).

**Guide des premiers jours, « Brevet de pilote »** : 12 missions, débloquées au jour J du voyage (J1 = jour de démarrage), qui se valident **toutes seules** dès que l'action est faite (même avant d'être débloquées) et versent leur récompense une fois (`onboard:<id>`, notification « Mission réussie »). Affiche le chapitre du jour, la progression n/12, au plus 3 missions ouvertes (les autres dépliables), la prochaine mission verrouillée ; masquable (réaffichable dans Réglages) ; disparaît une fois tout réussi.

| J | Id | Mission | Validation | Récompense |
| --- | --- | --- | --- | --- |
| 1 | first-habit | Valider une première routine | une habitude ou danse validée | 15 XP, 3 Alliage |
| 1 | tune-habits | Ajuster tes habitudes | astuce de l'écran Habitudes lue | 15 XP, 3 Alliage |
| 1 | first-task | Livrer un premier colis | une tâche terminée | 15 XP, 3 Alliage |
| 2 | sync | Relier le téléphone et le PC | connecté au compte | 25 XP, 3 Alliage, 2 Cellules |
| 2 | install | Installer le Sillage | app lancée en mode installé | 15 XP, 3 Alliage |
| 2 | notify | Activer les transmissions | rappels push actifs sur l'appareil | 15 XP, 3 Alliage |
| 3 | minimum | Oser le minimum | une validation au palier minimum | 15 XP, 3 Alliage |
| 3 | complete-day | Allumer un secteur | une journée complète | 25 XP, 3 Alliage, 2 Cellules |
| 3 | streak-3 | Trois jours d'affilée | une série d'au moins 3 jours | 25 XP, 3 Alliage, 2 Cellules |
| 5 | ship | Première réparation | un module amélioré | 25 XP, 3 Alliage, 2 Cellules |
| 5 | quest | Avancer une campagne | une quête cochée | 25 XP, 3 Alliage, 2 Cellules |
| 7 | review | Amarrer au Havre | une revue hebdo | 40 XP, 3 Cellules, 1 Cristal |

Chapitres du guide : J1 Prise de commandes, J2 Mise en orbite, J3 Premier palier, J5 Le chantier, J7 Premier amarrage.

**Astuces de première visite** : une par écran, visible jusqu'à « Compris » (mémorisé dans `onboarding.hints`, réinitialisable) : Habitudes (« garde en obligatoire seulement ce qui compte vraiment… un déclencheur précis aide le plus »), Vaisseau (chantier, boucliers), Campagnes (destination, modèles, boss), Revue (le dimanche, l'onglet Mois), À faire (horizons, effort), Planning (créneaux, charge tenable), Pilote (stats, points de compétence), Carnet (ne rapporte rien, pour ne rien oublier), Danse (cours et soirées dans Aujourd'hui).

---

## 19. Notifications push

- Réglages synchronisés dans `settings` : fuseau horaire + 6 rappels avec heure et interrupteur. Par défaut : matin 08:00 (actif), mi-journée 13:00 (inactif), soir 20:30, bilan avant la nuit 21:30, revue du dimanche 18:00, récit du mois 19:00 (actifs).
- **Serveur** (`send-reminders`, toutes les 10 min) : pour chaque utilisateur abonné, lit ses données synchronisées, calcule l'heure locale ; un rappel part dans les 15 minutes qui suivent son heure, une seule fois par jour (table `reminder_log` servant de verrou), **et seulement s'il y a quelque chose à dire** :
  - matin / mi-journée / soir : habitudes dues de ce moment pas encore faites (pas un jour de repos). Titres « Secteur <X> : le Sillage se réveille », « Point de mi-orbite », « Le soir tombe sur Kronos » ; corps « <A et B> t'attendent. <déclencheur> : <habitude>. »
  - bilan avant la nuit : obligations restantes ; si la plus longue série en jeu fait ≥ 3 jours : « Ta série de N jours sur <X> est en jeu. Même le minimum (<min>) la garde en vie. »
  - revue : le dimanche, si la revue de la semaine n'est pas faite : « Le Havre est en vue ».
  - mois : le dernier jour du mois si la revue mensuelle n'est pas faite : « Le récit de <mois> est prêt » (ouvre la revue, onglet Mois).
- Abonnements supprimés automatiquement s'ils ont expiré (404/410). Journal purgé après 14 jours.
- **Test** : un appel authentifié par la session de l'utilisateur envoie « Transmission reçue » à tous ses appareils.
- Côté client : demande de permission, abonnement Push (clé VAPID publique), enregistrement de l'abonnement pour l'utilisateur ; couper les rappels sur l'appareil ; consignes Xiaomi (notifications et batterie de Chrome).

---

## 20. Synchronisation entre appareils

- **Compte** : e-mail + mot de passe, ou lien de connexion par e-mail (PKCE, retour `?code=`). Session persistée.
- **Stockage serveur** : table `app_state(user_id, data jsonb, rev, updated_at)`, lecture par RLS (chacun ses données), écriture uniquement via la fonction `push_state(p_data, p_expected)` : insertion si `p_expected = 0`, sinon mise à jour seulement si `rev = p_expected` (sinon retourne null : conflit).
- **Client** : chaque sauvegarde locale marque « à envoyer » et déclenche un envoi 1,5 s plus tard ; vérification à l'ouverture, au retour sur l'app, au retour du réseau et toutes les 30 s. L'appareil garde la **base** (dernière version synchronisée) et sa révision.
- **Cycle** : lire la ligne distante ; aucune → premier envoi ; révision distante = base → envoyer si modifié ; révision différente → adopter le distant si rien de local, sinon **fusion à trois voies** (base, local, distant), appliquer, renvoyer ; jusqu'à 4 essais.
- **Premier lien** d'un appareil ayant déjà des données : vierge (aucun log, revue ni tâche faite) → adopter le distant ; sinon l'utilisateur choisit : fusionner (conseillé), garder en ligne, garder cet appareil.
- **Fusion** : ce qui n'a changé que d'un côté est repris ; listes d'objets à identifiant fusionnées élément par élément (ajouts des deux côtés gardés, suppression appliquée si l'autre côté n'a pas modifié l'élément), en identifiant les **événements par leur source** ; listes simples comme des ensembles ; objets clé par clé ; valeurs simples : le local l'emporte.
- **Statuts** affichés : désactivée, non connecté, synchronisation, à jour (il y a…), hors ligne, erreur, choix en attente. Le mode test ne synchronise jamais.

---

## 21. Écrans et parcours

Navigation : groupes **Bord** (Aujourd'hui, À faire, Planning, Carnet), **Voyage** (Vaisseau, Campagnes, Revue), **Pilote** (Pilote, Habitudes, Danse, Réglages). Sur mobile, 4 accès directs (Aujourd'hui, À faire, Vaisseau, Pilote) + « Plus ». Indicateurs permanents : niveau et XP du pilote, matériaux, état de la synchro. Notifications de gain éphémères (« Tâche terminée · +37 XP · butin »).

**Aujourd'hui** (écran principal), dans cet ordre d'importance :
1. *Poste de pilotage* : date (jours précédent / suivant, revenir à aujourd'hui), secteur du jour et sa phrase, progression de la journée (obligations faites / dues, bonus faits / dus), statut en une phrase (« Le secteur attend : encore N obligations pour allumer le secteur X », « Secteur allumé », « Journée parfaite », « Jour de repos »…), interrupteurs mode minimum et jour de repos, réserve de boucliers, XP et butin gagnés ce jour, niveau, les 7 secteurs de la semaine (sélectionnables).
2. *Transmissions* : proposition de bouclier, bouclier posé hier, alerte réacteur faible, conseils du copilote.
3. *Guide des premiers jours*.
4. *Missions du jour* par moment (Matin « Mise en route des systèmes », Journée « Navigation de croisière », Soir « Retour au calme »), chacun avec sa progression, replié automatiquement quand tout est fait. Par habitude : nom, bonus ?, série, rythme hebdo, déclencheur, palier proposé, gain obtenu, semaine en pastilles, choix du palier, séance (programme), exercices (routine). Le soir inclut cours et soirées de danse.
5. *Colonne de bord* : À faire (tâches du jour, ajout rapide, badges semaine / mois / reportée / échéance, étapes) ; séries en cours (top 5, avancement vers le prochain palier) ; état du vaisseau (orbite, secteurs allumés et butin à l'amarrage, trois jauges) ; journal de bord du jour (événements et gains).

**À faire**, **Planning**, **Carnet**, **Habitudes**, **Danse**, **Campagnes**, **Revue** : voir §12-15.

**Vaisseau** : nom, classe et progression vers la classe suivante, lore ; soute (3 matériaux avec leur lore) ; orbite de la semaine avec butin prévu ; boucliers (réserve, progression, fabrication) ; modules (niveau, effet actuel et suivant, coût, manque) ; compétences (points disponibles, niveaux, effets) ; trophées (gagnés du plus récent au plus ancien, verrouillés avec leur condition, progression globale).

**Pilote** : niveau et XP, stats et sous-compétences (niveau et XP de chacune, vue d'ensemble des stats), jauges, séries, journal de bord complet ; données : copier / télécharger / importer le JSON, réinitialiser (confirmé) ; mode test.

**Réglages** : compte de bord (configuration du projet si absente, connexion / création / lien e-mail, statut, synchroniser, déconnexion, choix au premier lien) ; installer l'app ; rappels (activer, tester, couper, heures et interrupteurs) ; prise en main (revoir le tutoriel, réafficher le guide, remontrer les astuces) ; thème.

**Overlays globaux** : tutoriel (premier lancement), moments racontés (plein écran, un à la fois, « Suite du journal » / « Continuer le voyage »), bandeau du mode test.

---

## 22. Contenus de départ et textes de l'univers

### Univers

- Vaisseau : **Le Sillage**. Planète : **Kronos**, « la planète-horloge ».
- **Intro** : « Tu t'éveilles à bord du Sillage, un vaisseau en orbite basse autour de Kronos, la planète-horloge. Ses cartes de navigation sont corrompues. Chaque révolution complète, sept jours, te fait repasser sept secteurs et recalibre un fragment de la carte. Boucle les orbites, ramasse de quoi réparer le vaisseau, et trace enfin ta route vers les systèmes qui t'attendent. »
- **Secteurs** : Aube (« Premier passage devant l'étoile : on rallume les systèmes. »), Forge (« Les ateliers tournent à plein régime. »), Zénith (« Point le plus proche de Kronos, mi-orbite. »), Jonction (« Croisement des routes commerciales. »), Éclat (« Dernière ligne droite avant le calme. »), Dérive (« Zone silencieuse, on laisse flotter. »), Havre (« Station d'amarrage : revue de bord, orbite bouclée. »).
- **Matériaux** : Alliage (« Débris de coque récupérés partout, le nerf de toute réparation. »), Cellule (« Cellules d'énergie, issues des efforts soutenus. »), Cristal (« Cristaux de navigation, rares : boss, chapitres et exploits. »).
- **Jauges** : Discipline = cohésion de bord ; Motivation = énergie du réacteur ; Inspiration = portée de l'antenne.
- **Correspondances** : semaine = orbite ; jour = secteur ; habitudes = routines de bord ; revue hebdo = amarrage au Havre ; stats = disciplines du pilote ; campagnes = destinations (Trading : la Ceinture des Marchés ; Maison : la Colonie du Havre) ; boss = monstres de l'espace ou avaries majeures ; tâches = colis.

### Domaines (stats) de départ

Danse → Rythme (sous-compétences Salsa, Bachata, Kizomba) ; Sport → Force ; Mobilité / kiné → Souplesse ; Trading → Stratégie ; Projets perso → Créativité ; Bien-être → Sérénité ; Lecture & culture → Savoir ; Maison → Intendance.

### Habitudes de départ

| Id | Nom | Forme | Type | Fréquence | Moment | Difficulté | Paliers (min / normal / excellent) | Stats | Déclencheur |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| reveil | Réveil musculaire | routine | obligatoire | quotidienne | matin | facile | 1 min / 3-5 min / 5 min + gainage | Mobilité 70, Sport 30 | Au saut du lit |
| kine-matin | Kiné matin | routine | obligatoire | quotidienne | matin | moyenne | Étirements seuls / Étirements + renfos / Tout + 1 série en plus | Mobilité | Après le réveil musculaire |
| kine-soir | Kiné soir | routine | obligatoire | quotidienne | soir | moyenne | idem | Mobilité | Avant de me coucher |
| mini-seance | Mini-séance sport | simple | bonus | quotidienne | journée | facile | 5 / 15 / 25 min | Sport | En rentrant du travail |
| salle | Salle | programme (Séance A, B, C) | obligatoire | 3 fois / semaine | journée | difficile | Séance courte / Séance complète / Séance + record | Sport | — |
| trading-analyse | Analyse / journal de trading | simple | obligatoire | lundi-vendredi | journée | moyenne | Lecture du marché 5 min / Analyse + journal / Analyse + journal + étude | Trading (liée à la campagne Trading) | À la clôture du marché |
| lecture | Lecture | simple | bonus | quotidienne | soir | facile | 5 / 10 / 30 min | Lecture & culture | Au lit, avant d'éteindre |
| menage | Ménage express | simple | bonus | quotidienne | journée | facile | 5 min de rangement / 15 min de ménage / Une pièce à fond | Maison | Après le dîner |
| air | Prendre l'air | simple | bonus | quotidienne | journée | facile | 5 min dehors / 20 min de marche / 1 h dehors | Bien-être | Pendant la pause du midi |

### Campagnes de départ

- **Système de trading** (Trading, active) : « Construire un système de trading rigoureux, fondé sur un process plutôt que sur les résultats. » Chapitres Définir ma stratégie → Backtester → Trader en démo → Passer en réel avec un plan (quêtes du modèle « Trading : le process avant le profit »).
- **Aménagement et déco de la maison** (Projets perso, active) : « Aménager la maison pièce par pièce, à mon rythme. » Chapitre « Première pièce (à définir) ».

### Carnet de départ

Listes Courses, Déco à acheter, À essayer, À visiter, Livres à lire ; note libre « À penser ».

### Catalogue de 12 habitudes à essayer (bonus, déclencheur, minimum minuscule)

| Nom | Pourquoi | Stat | Moment | Déclencheur | Paliers | Difficulté |
| --- | --- | --- | --- | --- | --- | --- |
| Lecture | Quelques pages chaque soir, et les livres s'enchaînent. | Savoir | soir | Au lit, avant d'éteindre | 5 / 10 / 30 min | facile |
| Ménage express | Un peu chaque jour plutôt qu'un grand ménage qui pèse. | Intendance | journée | Après le dîner | 5 min de rangement / 15 min de ménage / Une pièce à fond | facile |
| Prendre l'air | Lumière du jour et marche : l'humeur et le sommeil suivent. | Sérénité | journée | Pendant la pause du midi | 5 min dehors / 20 min de marche / 1 h dehors | facile |
| Boire de l'eau | Le plus simple des gestes, à accrocher aux repas. | Sérénité | journée | À chaque repas | 1 verre / 1,5 L / 2 L | facile |
| Trois mercis | Noter trois bonnes choses du jour entraîne l'attention vers ce qui va. | Sérénité | soir | Après m'être brossé les dents | 1 chose / 3 choses / 3 choses + pourquoi | facile |
| Pas d'écran au lit | Un vrai sas avant de dormir. | Sérénité | soir | Quand je me mets au lit | Téléphone hors du lit / Hors de la chambre / Plus d'écran 1 h avant | moyenne |
| Étirements | Quelques minutes suffisent pour garder la souplesse acquise. | Souplesse | soir | Pendant que l'eau du thé chauffe | 2 / 10 / 20 min | facile |
| Marcher | Bouger un peu tous les jours compte plus que l'intensité. | Force | journée | En rentrant du travail | 10 min / 30 min / 8 000 pas | facile |
| Pratique danse | Un pas de base revu chaque jour, et ça se voit en soirée. | Rythme | soir | Avant le dîner, une musique | 1 chanson / 15 min / 30 min de travail | moyenne |
| Apprendre un peu | Une langue, un instrument, un cours : la régularité bat l'intensité. | Savoir | journée | Avec mon café | 5 / 15 / 30 min | moyenne |
| Préparer demain | Deux minutes le soir pour un lendemain plus léger. | Créativité | soir | Après le dîner | Les 3 tâches de demain / Tâches + agenda / Tâches + agenda + sac prêt | facile |
| Journal de trading | Noter chaque décision, même sans trade : on progresse sur le process. | Stratégie | journée | À la clôture du marché | Une ligne / Journal complet / Journal + leçon du jour | moyenne |

### 7 modèles de campagnes (quête = 100 XP sauf mention ; ★ = boss)

1. **Douze livres dans l'année** (Savoir, 52 sem.) — « Retrouver le plaisir de lire, un livre par mois, sans pression. » Préparer la pile (Noter 12 livres envies dans le Carnet ; Choisir le premier livre ; Installer un coin lecture) → Premier trimestre (Livre 1, 2, Livre 3 150) → Deuxième trimestre (4, 5, 6 150) → Troisième trimestre (7, 8, 9 150) → Dernière ligne droite (10, 11, ★ Livre 12 : le dernier 400).
2. **Une maison qui respire** (Intendance, 12 sem.) — « Trier et organiser la maison pièce par pièce, pour qu'elle reste facile à tenir. » Cuisine (Trier placards et frigo ; Nettoyer à fond ; Ranger pour gagner du temps) → Salon (Désencombrer les surfaces ; Trier papiers et objets ; Nettoyer à fond) → Chambre (Trier les vêtements ; Ranger le dressing ; Nettoyer à fond) → Salle de bain (Trier les produits ; Nettoyer à fond) → Le grand défi (★ La pièce que j'évite 400).
3. **Déco : un intérieur qui me ressemble** (Créativité, 16 sem.) — « Aménager et décorer à mon goût, pièce par pièce, avec un budget clair. » Inspiration (20 images ; 3 couleurs et matières ; la première pièce) → Plan et budget (Mesurer ; Lister les achats dans « Déco à acheter » ; Fixer le budget) → Mise en place (Peinture ou murs ; Mobilier principal ; Textiles et lumière ; Objets et plantes) → Finitions (★ Pièce terminée : photo avant / après 300).
4. **Remise en forme en 12 semaines** (Force, 12 sem.) — « Construire une base solide : régularité d'abord, intensité ensuite. » Fondations (Point de départ ; 4 semaines à 3 séances ; Horaires fixes) → Progression (Augmenter charges ou durée ; 4 semaines à 3 séances ; 1 séance cardio) → Consolidation (4 semaines à 3 séances ; Préparer le test de fin) → Bilan (★ Refaire le test et comparer 400).
5. **Passer un cap en danse** (Rythme, 12 sem.) — « Gagner en aisance et en musicalité, et oser inviter en soirée. » Bases solides (Revoir les pas de base ; Filmer une passe ; Posture) → Musicalité (Temps sur 10 morceaux ; Morceau inconnu sans se perdre ; 2 jeux de pieds) → Soirées (2 soirées ; Inviter 5 personnes ; ★ Danser toute une soirée sans pause 300).
6. **Trading : le process avant le profit** (Stratégie, 26 sem.) — « Construire un système rigoureux, mesuré sur le respect du plan, jamais sur les gains. » Définir ma stratégie (Marchés et horaires ; Règles d'entrée et de sortie ; Risque par trade ; ★ Valider le plan par écrit 200) → Backtester (Collecter les données ; 100 situations ; Analyser ; ★ Backtest complet et conclusions 300) → Trader en démo (20 trades démo selon le plan ; Journal de chaque trade ; Revue mensuelle du process) → Passer en réel avec un plan (Petite taille, 20 trades ; Respect du plan > 90 % ; ★ Un mois en réel sans enfreindre une règle 500).
7. **Des matins qui démarrent bien** (Sérénité, 6 sem.) — « Une routine du matin courte et solide, qui tient même les jours pressés. » Choisir (Heure de lever réaliste ; 3 gestes de moins de 10 min ; Préparer la veille) → Tenir (1 semaine complète ; 2 semaines complètes ; ★ 30 matins tenus 400).

### Textes d'interface notables

Questions de revue, conseils du copilote, moments et chronique : voir §15-17 (à reprendre mot pour mot ou dans le même esprit). Libellés des paliers : Min, Normal, Excellent. Moments : Matin, Journée, Soir. Difficultés : Facile, Moyenne, Difficile.

---

## 23. Mode test

Lancé depuis Pilote, stockage séparé (les vraies données ne sont jamais touchées), ni synchro, ni rappels, ni tutoriel, ni moments. Génère un scénario (données de départ + Méditation, Cuisiner un vrai repas 2×/sem obligatoire, domaine Cuisine, cours de salsa mardi 20 h obligatoire et bachata jeudi bonus, quêtes et boss dans les campagnes, tâches variées) et joue 4 semaines avec un aléa reproductible par date (qualité de semaine entre 0,5 et 0,95). Bandeau : valider tout aujourd'hui, +1 jour, +1 semaine (jours passés clôturés comme en vrai), jouer 1 semaine, quitter.

---

## 24. Constantes de jeu (config complète)

```ts
XP_BASE = { easy: 10, medium: 20, hard: 40 }
TIER_FACTOR = { min: 0.5, normal: 1, excellent: 1.5 }
XP_REWARDS = { chapter: 300, campaign: 1000, weeklyReview: 50, monthlyReview: 150 }
LOOT_BASE = { easy: { metal: 2 }, medium: { metal: 2, energy: 1 }, hard: { metal: 3, energy: 2, crystal: 1 } }
LOOT_REWARDS = { quest: { metal: 2, energy: 2 }, boss: { energy: 2, crystal: 2 }, chapter: { crystal: 3 }, campaign: { crystal: 10 },
                 weeklyReview: { energy: 3 }, monthlyReview: { energy: 5, crystal: 1 }, orbitSector: { metal: 4 }, orbitPerfect: { crystal: 3 } }
REGULARITY = {
  dayComplete: { xp: 25, loot: { energy: 1 } }, dayPerfect: { xp: 45, loot: { energy: 2, metal: 2 } },
  streakMilestones: [7: 40 XP {energy 2}, 14: 80 {energy 3}, 30: 200 {crystal 2}, 60: 400 {crystal 3}, 100: 700 {crystal 5}, 200: 1200 {crystal 8}, 365: 2000 {crystal 12}],
  habitWeek: { xp: 30, perStreakWeek: 10, maxStreakBonus: 7, loot: { metal: 3 } }, habitWeekMilestones: [4, 8, 12, 26, 52], habitWeekMinItems: 2,
  familyWeek: { xp: 60, loot: { energy: 3 }, minItems: 3 }, weekComplete: { xp: 150, loot: { crystal: 2 } }
}
SHIELD = { earnEvery: 7, maxBase: 2, hullLevelsPerSlot: 2, cost: { energy: 6 }, minStreak: 3 }
EFFECTS = { reactorXp: 0.06, hullShield: 0.1, antennaInspiration: 0.2, thrustersOrbit: 0.25,
            recoveryPull: 0.03, logisticsTask: 0.15, enduranceMin: 0.06, engineeringCost: 0.05 }
MODULE_MAX_LEVEL = 5; SKILL_MAX_LEVEL = 5
LEVEL_BASE = 100; LEVEL_EXPONENT = 1.5
GAUGES = { disciplineWindowDays: 28, motivationStart: 50, inspirationStart: 50,
  motivation: { obligatoryDone: 3, bonusDone: 2, questDone: 6, obligatoryMissed: -8, dailyPullToward: 50, dailyPullRatio: 0.15 },
  inspiration: { weeklyReview: 25, chapterDone: 15, campaignDone: 30, newChallenge: 10, idleCampaignPerDay: -2 },
  minimumModeBelow: 30, momentumFrom: 80 }
DANCE_XP_DIFFICULTY = 'medium'
```

Calibrage mesuré (mode test, 13 semaines, ~75 % de réussite) : ~1 200 XP, ~90 Alliages, ~31 Cellules, 4-6 Cristaux par semaine ; niveau 10 vers la semaine 6-10, 20 vers 13 mois ; vaisseau complet en ~13 semaines ; Motivation moyenne 70, sous 30 environ 5 % des jours.

---

## 25. Comportements à couvrir par des tests

La V3 a 60 tests ; une reconstruction doit au moins garantir :

- Valider rapporte XP et butin ; décocher retire tout (sauf trophée et mission, jamais perdus).
- Journée complète puis parfaite ; décocher les défait.
- Clôture des jours : ratés → Motivation, retour vers 50 ; repos neutre.
- Discipline pondérée sur 28 jours ; objectifs hebdo le dimanche.
- Séries : repos et jours non dus ne cassent rien ; paliers versés le bon jour, une fois.
- Semaines pleines (habitude, discipline, sans faille) versées le jour où la semaine se complète.
- Boucliers : gain toutes les 7 journées complètes, achat, proposition après un raté, usage sauve la série sans rapporter d'XP, refus mémorisé.
- Orbite : états des secteurs, demi-secteurs, butin et orbite parfaite.
- Vaisseau : coûts, effets, classes ; compétences ; trophées débloqués une seule fois.
- Tâches (XP selon l'effort, Logistique), quêtes, chapitres, campagne, modèle de campagne joué jusqu'au bout.
- Revue hebdo (récompense + butin d'orbite) et mensuelle.
- Catalogue d'habitudes, contenus versés une seule fois, import des données de la version précédente.
- Copilote : chaque règle.
- Moments : palier raconté une fois, niveaux, fin de série, aucun moment rejoué à l'import ; chronique du mois (chapitres, titre, épilogue).
- Missions : récompense unique, état de l'appareil, déblocage par jour.
- Fusion : un seul côté modifié, ajouts des deux côtés, suppression d'un côté, événements par source, ensembles, objets, fusion imbriquée.

---

## 26. Pas encore fait / pistes

- **Élan** (dépenser 50 d'Inspiration pour doubler l'XP d'une quête pendant 24 h ou débloquer un défi).
- Rappels au moment du déclencheur de chaque habitude ; plage silencieuse.
- Vue mois du planning ; point campagne par campagne dans la revue mensuelle ; arcs mensuels regroupant des quêtes.
- Mode guidé des routines avec minuteur ; intégration de l'app salle (séances reçues → valide « Salle », records).
- Titres du pilote gagnés par les séries (identité) ; petites trouvailles surprises rares (récompense variable, à doser).
- Équipage (personnages à bonus), carte de la galaxie pour les campagnes, événements d'orbite (défi de la semaine), défi de la semaine, combos entre habitudes, bonus d'équilibre.
- Graphiques d'historique ; ouverture à d'autres utilisateurs ; synchro Google Agenda.
- Questions ouvertes : nom de l'app et des stats ; habitudes de trading détaillées ; chapitres réels des campagnes Trading et Maison ; stack de l'app salle.
