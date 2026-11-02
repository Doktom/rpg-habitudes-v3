# Cahier des charges – App RPG d'habitudes

Oct 29, 2026 · @ATJ

Une webapp perso (mobile + PC) qui réunit suivi d'habitudes, planification hebdo/mensuelle et projets au long cours, avec une couche RPG fondée sur la motivation plutôt que la punition.

## Vision et principes

L'app transforme la régularité en progression visible : chaque action nourrit un personnage, des stats et des projets au long cours.

1. **On ne perd jamais d'XP ni de niveau.** Les conséquences portent sur l'élan (jauges, multiplicateur), jamais sur l'acquis.
2. **Motivation plutôt que punition.** Pas de mort, pas de PV. Les matériaux du vaisseau ne se perdent jamais, ils se dépensent seulement quand on choisit une amélioration.
3. **Anti tout-ou-rien.** Paliers minimum / normal / excellent, fréquences souples, jours de repos.
4. **Récompenser le processus, pas le résultat.** Surtout pour le trading : on gamifie l'analyse et le respect du plan, jamais le P&L.
5. **Sobre d'abord.** Interface épurée au lancement ; l'habillage graphique (avatar, illustrations) vient ensuite sans refonte.

## Utilisateurs et plateformes

Un seul utilisateur au départ, mais un modèle multi-utilisateur dès le premier jour.

- **Auth** : compte unique (email + lien magique ou mot de passe), chaque donnée rattachée à un `user_id`.
- **Mobile** : usage rapide dans la journée (cocher, lancer une routine). Webapp installable (PWA).
- **PC** : planification, revues, gestion des campagnes.
- **Hors-ligne** : pouvoir cocher ses habitudes sans réseau, synchronisation au retour.
- **Plus tard** : ouverture à d'autres utilisateurs, sans fonctions sociales prévues pour l'instant.

## Domaines et stats

Chaque domaine de vie est une stat RPG ; certaines ont des sous-compétences avec leur propre niveau. Les noms de stats sont provisoires.

| Domaine | Stat | Sous-compétences | Alimentée par |
| --- | --- | --- | --- |
| Danse | Rythme | Salsa, Bachata, Kizomba | Cours, soirées, entraînement, chorés |
| Sport | Force | (par programme, plus tard) | Salle 3x/sem, mini-séance bonus, réveil musculaire |
| Mobilité / kiné | Souplesse | — | Routines kiné matin et soir, renfos |
| Trading | Stratégie | — | Analyse, journal, étude, backtest |
| Projets perso | Créativité | Un par campagne (ex. Maison) | Sessions de travail, étapes de campagne |
| Bien-être (optionnel) | Sérénité | — | Sommeil, méditation, prendre l'air |
| Lecture & culture | Savoir | — | Lecture quotidienne |
| Maison | Intendance | — | Ménage express |

Une habitude ou une quête peut alimenter plusieurs stats avec une répartition (ex. réveil musculaire : 70 % Souplesse, 30 % Force). L'utilisateur peut créer, renommer ou archiver des domaines. **V0** : une catégorie (nom, nom de stat, couleur) se crée directement depuis le formulaire d'une habitude, via « + Nouvelle catégorie (stat) », et devient la stat principale de l'habitude.

## XP et niveaux

Une journée type rapporte environ 140 XP ; le niveau 10 arrive vers 2 mois, le niveau 20 vers 10 à 13 mois selon la Discipline. Toutes les valeurs sont réglables dans un fichier de config.

**XP d'une action**

```latex
XP = base \times palier \times (1 + D/100)
```

- *base* selon la difficulté choisie : facile 10, moyenne 20, difficile 40.
- *palier* : minimum ×0,5, normal ×1, excellent ×1,5.
- *D* = jauge Discipline (0 à 100), donc un multiplicateur de ×1 à ×2.

| Événement | XP de base |
| --- | --- |
| Habitude ou routine | 10 / 20 / 40 selon difficulté |
| Tâche terminée | 10 / 20 / 40 selon son effort (facile par défaut), × Discipline |
| Quête terminée | 50 à 200 (fixé à la création) |
| Boss vaincu | 100 à 300 |
| Chapitre de campagne terminé | 300 |
| Campagne terminée | 1 000 + haut fait |
| Revue hebdo / mensuelle | 50 / 150 |

**Niveaux**

```latex
XP_{niveau \to niveau+1} = 100 \times niveau^{1,5}
```

Niveau 1 → 2 : 100 XP ; 5 → 6 : 1 118 XP ; 10 → 11 : 3 162 XP. La même courbe sert au niveau global du personnage et au niveau de chaque stat et sous-compétence (l'XP d'une action est répartie entre ses stats).

**Exemple de journée** (Discipline 30) : réveil musculaire 10 + kiné matin 20 + kiné soir 20 + salle 40 + analyse trading 20 = 110 × 1,3 = 143 XP.

## Les trois jauges

Trois jauges de 0 à 100 remplacent les points de vie : elles modulent la progression sans jamais retirer d'acquis.

| Jauge | Mesure | Calcul | Effet |
| --- | --- | --- | --- |
| Discipline | Régularité de fond | Taux de réussite des habitudes obligatoires sur 28 jours glissants, les jours récents pèsent plus. Un palier minimum compte comme réussi. | Multiplicateur d'XP ×1 à ×2 |
| Motivation | Énergie du moment | +3 par obligatoire validée, +6 par étape de quête, +2 par bonus ; −8 par obligatoire ratée. Revient vers 50 de 15 % de l'écart chaque jour. | Sous 30 : l'app propose le mode minimum |
| Inspiration | Sens et nouveauté | +25 revue hebdo, +15 chapitre, +30 campagne, +10 nouveau défi ; −2 par jour sans progrès sur une campagne active. | À 80 et plus : « Élan » activable |

- **Mode minimum** : pour la journée, chaque habitude affiche seulement son palier minimum. Il préserve la Discipline.
- **Élan** : consomme 50 d'Inspiration pour doubler l'XP d'une quête choisie pendant 24 h, ou débloquer un défi spécial.
- **Jours de repos** posés à l'avance : neutres pour les trois jauges.
- Les seuils et valeurs sont à calibrer après 2-3 semaines d'usage réel.

## Univers, vaisseau et récompenses

Toute action rapporte de l'XP **et** des matériaux (Alliage, Cellule, Cristal) selon sa difficulté. Les matériaux améliorent les quatre modules du **Sillage**, un vaisseau en orbite autour de Kronos dont la révolution de 7 jours reproduit la semaine : un secteur par jour, allumé quand les obligations sont faites, et une orbite bouclée à la revue hebdo qui verse du butin. Les niveaux du pilote donnent des points de compétence ; 22 trophées récompensent les jalons.

**Régularité** (02/11/2026) : la constance est récompensée en plus de chaque action, au moment où elle se produit (notification de gain), et la récompense disparaît si l'on décoche ce qui l'a déclenchée.

- **Journée complète** : toutes les obligations du jour faites (+25 XP, 1 Cellule). **Journée parfaite** : les bonus du jour aussi (+45 XP, 2 Cellules, 2 Alliages).
- **Séries d'une habitude** : jours dus consécutifs tenus (repos et jours non dus ne cassent rien). Paliers à 7, 14, 30, 60, 100, 200 et 365 jours, de +40 XP à +2 000 XP, avec Cellules puis Cristaux.
- **Semaine pleine d'une habitude** : tous ses jours dus de la semaine, ou son objectif « X fois par semaine » atteint (au moins 2 séances). +30 XP, puis +10 XP par semaine d'affilée (jusqu'à +100) ; 1 Cristal à 4, 8, 12, 26 et 52 semaines d'affilée.
- **Semaine pleine d'une discipline** (Danse, Sport, Mobilité…) : tout ce qui la concerne fait dans la semaine, cours de danse compris (au moins 3 éléments) : +60 XP, 3 Cellules.
- **Semaine sans faille** : toutes les obligations de la semaine : +150 XP, 2 Cristaux.
- L'écran Aujourd'hui montre la progression vers la journée complète, les séries en cours (flamme et prochain palier) et la semaine de chaque habitude en sept pastilles.
- XP multipliée par la Discipline et les bonus du vaisseau, comme le reste. Valeurs dans `REGULARITY` (`src/lib/config.ts`), à calibrer à l'usage.
- **Boucliers de série** (des jokers, à ne pas gaspiller) : le lendemain d'un raté qui casse une série d'au moins 3 jours, l'écran Aujourd'hui propose « Utiliser un bouclier » ou « Laisser filer » (proposition valable deux jours) ; c'est toujours l'utilisateur qui choisit. Le bouclier protège la journée ratée : les séries et les semaines pleines continuent, mais le jour ne compte pas comme fait (pas d'XP ; Discipline et Motivation voient le raté). Un bouclier toutes les 7 journées complètes, ou fabriqué au chantier du Vaisseau (6 Cellules). Réserve de 2, +1 tous les 2 niveaux de Coque (4 au maximum). Valeurs dans `SHIELD`.

Le détail (lore, tables de butin, coûts, effets, trophées) est dans `docs/univers.md`. Les noms sont provisoires. Le graphisme viendra dans une grosse mise à jour ultérieure.

## Mode test

Le mode test génère un scénario complet (habitudes, danse, tâches, campagnes avec quêtes et boss) et joue 4 semaines. Il vit dans son propre stockage : les vraies données ne sont jamais modifiées. Un bandeau permet ensuite de **valider tout aujourd'hui**, d'avancer d'**1 jour** ou d'**1 semaine** (les jours passés sont clôturés comme en vrai, avec leurs ratés), de **jouer 1 semaine** automatiquement, ou de quitter. Lancé depuis l'écran Personnage.

## V3 : ce qui marche pour tenir des habitudes

La V3 (dépôt `rpg-habitudes-v3`, à partir de la V2 au tag `v0.2-base`) s'appuie sur la synthèse `docs/recherche-motivation.md`. Chaque mécanique y est reliée à un principe solide (commencer petit, intentions de mise en œuvre, progrès visibles, pas de punition, ne pas rater deux fois, nouveaux départs, prévoir les obstacles, pas trop à la fois, repos).

- **Déclencheur par habitude** (« Quand / après… ») : affiché sur la carte du jour et dans Habitudes, avec des suggestions ; une habitude sans déclencheur reçoit une astuce.
- **Copilote** sur Aujourd'hui : au plus deux conseils du jour, écartables jusqu'au lendemain. Règles : ne pas rater deux fois (avec le palier minimum), série à un jour d'un palier, journée presque complète, revue de la semaine (dimanche à mardi), nouveau départ le lundi après une semaine sous 60 %, habitude qui coince (moins de 40 % sur 14 jours : déclencheur, minimum ou bonus), trop d'obligations (plus de 8), pause conseillée (14 jours sans repos et Motivation sous 45), campagne au point mort depuis 7 jours, bouclier en vue.
- **Habitudes** : nouvelles habitudes en bonus par défaut ; catalogue de 12 idées à essayer (lecture, ménage, prendre l'air, boire de l'eau, trois mercis, pas d'écran au lit, étirements, marcher, pratique danse, apprendre, préparer demain, journal de trading), chacune avec un palier minimum minuscule et un déclencheur ; réussite sur 4 semaines, série et semaine en pastilles pour chaque habitude.
- **Modèles de campagnes** : Douze livres dans l'année, Une maison qui respire, Déco, Remise en forme en 12 semaines, Passer un cap en danse, Trading : le process avant le profit, Des matins qui démarrent bien ; étapes, quêtes, boss final et arrivée visée. La campagne Trading de départ reçoit ses quêtes si elle était vide.
- **Revue** : « Si cet obstacle revient, alors je… » après « Ce qui a coincé ».
- **Aujourd'hui** : l'action d'abord (copilote, joker, journée complète, habitudes, tâches), la vue d'ensemble (orbite, jauges) ensuite.
- **Aujourd'hui (V3.1)** refait en tableau de bord compartimenté : un poste de pilotage en tête (date, secteur, anneau de la journée obligations + bonus, statut en une phrase, mode minimum, repos, boucliers, les sept secteurs cliquables) ; les transmissions (joker, copilote) ; le guide des premiers jours ; puis deux colonnes : les missions par moment (Matin, Journée, Soir, chacun replié une fois terminé) et la colonne de bord (À faire, séries avec la jauge vers le prochain palier, état du vaisseau, journal de bord replié).
- **Cohérence** : la récompense de fin de campagne profite de la Discipline comme les quêtes et les étapes.

## Habitudes, routines et programmes

Trois objets récurrents couvrent tous les cas : l'habitude simple, la routine (liste d'exercices) et l'objectif de fréquence lié à un programme.

**Propriétés communes**

- Type : **obligatoire** (compte pour Discipline, un raté baisse Motivation) ou **bonus** (gagne XP et Motivation, ne coûte jamais rien).
- Fréquence : quotidienne, X fois par semaine (jours libres), ou jours fixes.
- Paliers minimum / normal / excellent, chacun décrit en une ligne.
- Moment de la journée (matin, soir, libre) et créneau par défaut optionnel dans l'agenda.
- Difficulté, stats alimentées, campagne liée (optionnelle), rappel (optionnel).
- Série comptée en périodes réussies (jours ou semaines), jamais cassée par un jour de repos.

**Routines** : une habitude composée d'une liste ordonnée d'exercices (nom, durée ou répétitions, note). Validation en un geste ou exercice par exercice. Le contenu est versionné : ajouter un renfo du kiné crée une nouvelle version datée, l'historique garde les anciennes. En V2, un mode guidé enchaîne les exercices avec un minuteur.

**Programmes** : un objectif de fréquence (ex. 3 séances par semaine) associé à des séances types. Au MVP on note seulement la séance faite ; le détail charges/répétitions viendra de ton app salle, intégrée plus tard.

**Configuration de départ**

| Nom | Forme | Type | Fréquence | Moment | Stat |
| --- | --- | --- | --- | --- | --- |
| Réveil musculaire (3-5 min) | Routine | Obligatoire | Quotidienne | Matin | Souplesse, Force |
| Kiné matin (étirements + renfos) | Routine | Obligatoire | Quotidienne | Matin | Souplesse |
| Kiné soir (étirements + renfos) | Routine | Obligatoire | Quotidienne | Soir | Souplesse |
| Mini-séance sport | Habitude | Bonus | Quotidienne | Libre | Force |
| Salle | Programme | Obligatoire | 3x / semaine | Libre | Force |
| Cours ou soirée de danse | Habitude taguée Salsa / Bachata / Kizomba | Obligatoire ou bonus | Selon planning | Créneau fixe | Rythme |
| Analyse / journal de trading | Habitude | Obligatoire | Jours de marché | Libre | Stratégie |

**Paramétrage danse**

Un écran dédié gère les cours réguliers, les vacances de l'école et les soirées, qui alimentent ensuite l'agenda et l'écran Aujourd'hui.

- **Cours fixes** : danse (Salsa, Bachata ou Kizomba), jour de la semaine, heure, durée, lieu, obligatoire ou bonus. Ils se répètent chaque semaine.
- **Périodes de vacances** : dates de début et de fin pendant lesquelles les cours fixes sont suspendus, sans effet sur les jauges.
- **Cours annulé** : une séance précise peut être annulée sans toucher au cours récurrent.
- **Soirées ponctuelles** : saisies longtemps à l'avance (date, heure, lieu, danses concernées, note). Elles comptent comme bonus.
- Valider un cours ou une soirée donne l'XP à la sous-compétence de la danse concernée.

Le contenu des routines (kiné, réveil musculaire) sera saisi et enrichi au fil de l'eau.

## Campagnes, chapitres, quêtes et boss

Les projets au long cours sont des **campagnes** : un fil rouge découpé en chapitres, quêtes et tâches, affiché comme un parcours.

1. **Domaine** (stat)
   1. **Campagne** : le projet fil rouge, avec une intention et une date cible optionnelle.
      1. **Chapitre** : un grand jalon. Les chapitres sont ordonnés ; le suivant peut être verrouillé jusqu'à la fin du précédent.
         1. **Quête** : un objectif concret avec critère de fin et XP fixée.
            1. **Tâche** : une action planifiable dans la liste ou l'agenda.

- Une habitude peut être liée à une campagne : ses validations comptent pour sa progression.
- Un **boss** est une tâche ou quête redoutée, marquée comme telle, qui rapporte un gros bonus.
- Un **arc** est un thème mensuel optionnel qui regroupe des quêtes de plusieurs campagnes (ex. « Novembre : rigueur »).
- Vue campagne : carte de progression (chapitres faits, en cours, verrouillés), % d'avancement, dernière activité.

**Exemples de départ** (contenu à remplir par toi)

| Campagne | Domaine | Chapitres possibles | Rythme |
| --- | --- | --- | --- |
| Système de trading | Trading | Définir ma stratégie → Backtester → Trader en démo → Passer en réel avec un plan | Hebdomadaire |
| Aménagement et déco de la maison | Projets perso | Une pièce par chapitre (plan, achats, travaux, finitions) | Étalé sur plusieurs mois, pauses possibles |
| Progresser en danse | Danse | Un chapitre par objectif (ex. une choré de bachata, un niveau de salsa) | Mensuel |

Une campagne peut être mise **en pause** : l'Inspiration cesse alors de baisser pour elle. Utile pour la maison, qui avance par vagues.

## Planification

Deux couches complémentaires : des listes souples sans horaire, et un agenda horaire où l'on glisse ce qu'on veut caser.

- **Listes** : Aujourd'hui, Cette semaine, Ce mois-ci, Un jour. Une tâche peut venir d'une quête ou être libre.
- **Écran « À faire »** (V0) : todo list dédiée. Ajout rapide d'une tâche avec sa liste, son effort et une catégorie facultative (la stat qui reçoit l'XP, si la tâche n'est pas liée à une campagne). Chaque tâche se détaille : note, effort (aperçu de la récompense), échéance, catégorie, sous-tâches. Filtre par catégorie, tâches terminées repliées.
- **Todo du jour** : l'écran Aujourd'hui affiche les tâches planifiées ce jour-là, plus les tâches libres d'aujourd'hui, de la semaine et du mois, les tâches reportées et celles dont l'échéance est arrivée (badges « semaine », « mois », « reportée »). Les tâches « Un jour » n'y apparaissent pas.
- **Agenda** : vues jour et semaine (PC), jour (mobile). Créneaux ponctuels ou récurrents (ex. cours de salsa le mardi à 20 h).
- **Glisser-déposer** d'une tâche de liste vers un créneau ; elle reste liée à sa quête.
- Les habitudes avec créneau par défaut apparaissent dans l'agenda ; les autres restent dans la liste du jour.
- **Vue mois** : charge de chaque semaine, échéances de quêtes, jours de repos.
- Une tâche non faite glisse au lendemain sans pénalité ; après 3 reports, la revue hebdo la signale.
- Pas de synchro Google Agenda pour l'instant.

## Rituel de revue

La revue hebdo (dimanche, environ 10 min) et la revue mensuelle sont des parcours guidés qui bouclent bilan et planification.

**Revue hebdo**

1. Bilan automatique : XP gagnée, niveaux, évolution des trois jauges, taux de réussite par habitude, séries.
2. Trois questions courtes : ce qui a marché, ce qui a coincé, ce que j'ajuste.
3. Ajustements proposés : alléger une habitude ratée plus de 3 fois, traiter les tâches reportées.
4. Planification : 3 priorités de la semaine, boss de la semaine, créneaux de la salle, jours de repos.
5. Récompense : +50 XP et +25 Inspiration.

**V2 (02/11/2026)** : la revue hebdo est un « amarrage au Havre » en cinq étapes : Bilan (chiffres, orbite, jauges, habitude par habitude avec séries, exploits de la semaine : récompenses de régularité, trophées, boucliers), Questions, Ajuster (passer en bonus une habitude obligatoire ratée 3 fois ou plus ; replanifier ou abandonner les tâches en retard), Cap (3 priorités, une quête de campagne à faire avancer qui crée une tâche liée, jours de repos de la semaine suivante), Amarrage (récompense affichée, puis versée). Le brouillon est gardé si l'on quitte l'écran. Lundi et mardi, la revue porte sur la semaine passée si elle n'a pas été faite.

**Revue mensuelle** : même trame sur le mois, plus le point sur chaque campagne (chapitre en cours, prochaine étape, pause ou reprise), l'évolution des stats et le choix de l'arc du mois suivant.

**V3.1 (02/11/2026)** : la revue mensuelle est un **récit**, pas un tableau de chiffres (onglet « Mois » de l'écran Revue). Le conteur de bord (`engine/story.ts`) écrit la chronique du mois en chapitres : Le départ (niveau, comparaison au mois d'avant), La route (taux tenu, habitude la plus fiable, plus longue série), Les épreuves (la semaine la plus dure racontée comme une traversée, l'habitude qui résiste, boucliers, repos ; toujours bienveillant), Les trouvailles (paliers, trophées, campagnes, boss, tâches), Le chantier, Le pilote (la stat qui a le plus grandi), un épilogue et un titre d'arc (« Le mois de la Forge », « Le mois des vents contraires »…). Puis « Ton regard » (fierté, ce que je laisse, l'arc du mois prochain, 3 intentions qui vont dans « Ce mois ») et « Clore le chapitre » (+150 XP, butin), possible à partir des trois derniers jours du mois ; les dix premiers jours, la revue porte sur le mois précédent.

**Moments racontés** : un palier de série (7, 14, 30, 60, 100, 200, 365 jours), une semaine sans faille, 4 / 8 / 12 / 26 / 52 semaines pleines d'affilée, un trophée, un niveau, un chapitre, un boss, une campagne, une nouvelle classe de vaisseau, et la fin d'une série de 7 jours ou plus (racontée avec douceur : « ne pas rater deux fois ») s'affichent en plein écran, une fois chacun, avec un texte dans l'univers. Les moments déjà passés à l'import ne sont pas rejoués.

Les réponses sont archivées et consultables : elles forment un journal de bord.

## Notifications

Notifications push via la PWA, toutes désactivables une par une.

- Rappel par habitude ou routine, à l'heure choisie (ex. kiné soir à 21 h 30).
- Rappel avant un créneau d'agenda.
- Rappel de revue hebdo (dimanche) et mensuelle.
- Alertes douces : Motivation basse → mode minimum disponible ; Élan disponible.
- Plage silencieuse configurable (ex. 23 h – 7 h).

Sur iPhone, les notifications nécessitent d'installer l'app sur l'écran d'accueil ; Android et PC fonctionnent directement.

**V3.1 (02/11/2026)** : rappels push envoyés par une fonction Supabase (`supabase/functions/send-reminders`, appelée toutes les 10 minutes), à partir des données synchronisées : routines du matin, de mi-journée et du soir (seulement s'il en reste), bilan avant la nuit (obligations restantes et série en jeu), revue du dimanche (si pas faite), récit du mois (dernier jour). Chaque rappel a son heure et se coupe dans Réglages ; rien n'est envoyé s'il n'y a rien à dire. Bouton « Tester ». Mise en place : `docs/supabase.md`.

## Prise en main (V3.1)

- **Tutoriel** au premier lancement, six écrans illustrés avec les vrais composants (le vaisseau, un palier à essayer, les jauges, l'orbite) ; rejouable depuis Réglages.
- **Guide des premiers jours** (« Brevet de pilote ») sur Aujourd'hui : 12 missions débloquées jour après jour (jour 1 : valider une routine, ajuster ses habitudes, livrer un colis ; jour 2 : synchro, installation, rappels ; jour 3 : palier minimum, journée complète, 3 jours d'affilée ; jour 5 : première réparation, une quête ; jour 7 : première revue). Chacune se valide toute seule et rapporte un petit butin (`engine/onboarding.ts`). Masquable.
- **Astuce de première visite** sur chaque écran, une fois, jusqu'à « Compris ».

## Écrans

Dix écrans principaux ; l'écran Aujourd'hui est la page d'accueil sur mobile.

| Écran | Contenu | Usage principal |
| --- | --- | --- |
| Aujourd'hui | Habitudes du jour par moment (matin, journée, soir), tâches du jour, jauges, XP du jour | Mobile, plusieurs fois par jour |
| À faire | Todo list : listes (aujourd'hui, semaine, mois, un jour), tâches détaillées, catégories, terminées | Les deux |
| Vaisseau | Soute de matériaux, orbite de la semaine, modules, compétences du pilote, trophées | Les deux |
| Planning | Listes + agenda jour/semaine/mois, glisser-déposer | PC surtout |
| Carnet | Listes à cocher et notes libres qui ne sont pas des tâches : courses, déco à acheter, à essayer, à visiter, livres à lire, à penser ; un élément peut devenir une tâche | Mobile surtout |
| Personnage | Niveau, stats et sous-compétences, jauges, hauts faits, séries | Les deux |
| Campagnes | Liste des campagnes, carte de progression, chapitres, quêtes | PC surtout |
| Habitudes | Création et édition des habitudes, routines, programmes ; historique | PC surtout |
| Revue | Parcours guidé hebdo/mensuel, archive des revues | Dimanche, PC ou mobile |

Navigation : barre du bas sur mobile, barre latérale sur PC. Réglages (domaines, notifications, jours de repos, export des données) accessibles depuis Personnage.

## Modèle de données

Onze tables suffisent au MVP ; toutes portent un `user_id` protégé par des règles d'accès par utilisateur.

| Table | Champs clés | Relations |
| --- | --- | --- |
| profile | niveau, xp\_total, discipline, motivation, inspiration, réglages | 1 par utilisateur |
| domain | nom, stat, couleur, icône, parent\_id (sous-compétence), xp, niveau | arbre domaine → sous-compétences |
| habit | nom, forme (simple/routine/programme), type (obligatoire/bonus), fréquence, paliers, moment, difficulté, rappel, créneau par défaut, archivée | → domain (répartition %), → campaign optionnelle |
| routine\_version | habit\_id, date de début, liste ordonnée d'exercices | → habit |
| habit\_log | habit\_id, date, palier, exercices faits, tag (ex. Salsa), note | → habit |
| campaign | nom, intention, statut (active/pause/terminée), date cible | → domain |
| chapter | ordre, nom, statut, verrouillé | → campaign |
| quest | nom, critère de fin, xp, boss, échéance, statut | → chapter ou libre, → arc optionnel |
| task | titre, liste (jour/semaine/mois/un jour), date, créneau début/fin, récurrence, reports, statut | → quest optionnelle |
| review | type (hebdo/mensuelle), période, réponses, snapshot des chiffres | — |
| event | type (xp, jauge, niveau, haut fait), montant, source, date | journal de tout ce qui modifie la progression |

Le journal `event` permet de recalculer XP et jauges si les formules changent, et alimente les graphiques de la revue.

## Stack technique

SvelteKit + Supabase : peu de code, gratuit à cette échelle, prêt pour plusieurs utilisateurs.

| Couche | Choix | Pourquoi |
| --- | --- | --- |
| Front | SvelteKit + TypeScript | Léger, rapide sur mobile, simple à apprendre |
| Style | Tailwind CSS | Sobre au départ, thème graphique ajoutable ensuite |
| Données + auth | Supabase (Postgres, Auth, Row Level Security) | Base relationnelle adaptée au modèle, sécurité par utilisateur incluse |
| Calculs planifiés | Supabase Edge Functions + cron | Calcul quotidien des jauges, envoi des rappels |
| PWA | Service worker (vite-plugin-pwa), Web Push | Installation, notifications |
| Hors-ligne | File d'attente locale (IndexedDB) | Cocher sans réseau, synchro au retour |
| Hébergement | Vercel ou Netlify (offre gratuite) | Déploiement automatique depuis Git |
| Glisser-déposer agenda | Bibliothèque de calendrier compatible Svelte | À choisir au démarrage du dev |

Les formules d'XP et de jauges vivent dans un module partagé et testé, avec les constantes dans un fichier de config.

**Intégration future de l'app salle** : l'app de suivi d'habitudes exposera un point d'entrée pour recevoir les séances terminées (date, programme, séance, volume). Chaque séance reçue valide l'objectif « Salle » et pourra créer des hauts faits (records). Le format exact dépendra de la stack de cette app.

## Périmètre

Le MVP vise un usage quotidien réel en 4 à 6 semaines de dev ; le reste s'ajoute une fois les formules calibrées.

**V0 prototype (29 octobre 2026)** : une première version tourne déjà, avec les données stockées dans le navigateur (export/import JSON) en attendant Supabase. Elle couvre les écrans Aujourd'hui, Planning (listes + agenda semaine avec glisser-déposer), Campagnes, Personnage, Habitudes (routines versionnées), Danse (cours fixes, vacances, soirées) et Revue hebdo, ainsi que le moteur XP / niveaux / jauges. Pas encore : comptes et synchro, PWA et notifications, vue mois, revue mensuelle.

**MVP**

- Auth, profil, domaines et sous-compétences
- Habitudes, routines (checklist versionnée), programme salle (séance faite), paliers, types obligatoire/bonus, fréquences, jours de repos
- XP, niveaux global et par stat, trois jauges, mode minimum
- Écran Aujourd'hui, écran Personnage simple
- Listes + agenda semaine avec glisser-déposer
- Campagnes, chapitres, quêtes, tâches, boss (vue liste)
- Revue hebdo guidée
- PWA installable, rappels d'habitudes et de revue

**V2**

- Mode guidé des routines avec minuteur
- Revue mensuelle complète et arcs
- Élan, hauts faits, carte de progression visuelle des campagnes
- Hors-ligne robuste
- Graphiques d'historique
- Intégration de l'app salle
- Habillage graphique : avatar, illustrations, thèmes

**Plus tard**

- Ouverture à d'autres utilisateurs
- Synchro Google Agenda
- Économie de récompenses réelles

## Questions ouvertes

- [ ] Nom de l'app et noms définitifs des stats
- [x] Liste précise des exercices kiné matin et soir, et des renfos à ajouter
- [x] Contenu de la routine réveil musculaire
- [x] Cours de danse : jours et horaires fixes ? Lesquels sont obligatoires, lesquels bonus ?
- [ ] Trading : quelles habitudes de processus, et quels jours ?
- [ ] Chapitres réels des campagnes Trading et Maison
- [ ] Stack de l'app salle, pour préparer l'intégration
- [x] Validation des valeurs d'XP et de jauges après 2-3 semaines d'usage
