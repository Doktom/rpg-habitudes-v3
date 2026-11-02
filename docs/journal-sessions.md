# Journal des sessions

Entrées les plus récentes en haut.

## 2026-11-02 (soir) — V3 0.4.0 : téléphone + PC, rappels, récits, prise en main, Aujourd'hui refait

**Demande** : utiliser l'app sur le téléphone (Android, Redmi) et le PC avec sauvegarde ; des notifications ; des revues mensuelles et des moments (séries, caps) racontés de façon ludique plutôt que des stats froides ; un tutoriel et un guide des premiers jours ; une page Aujourd'hui plus claire et compartimentée, dans l'univers et la charte.

**Décisions**

- Serveur : **Supabase gratuit** (choix de l'utilisateur), compte e-mail + mot de passe (ou lien par e-mail). Un document JSON par utilisateur (`app_state`), versionné ; écriture par `push_state` avec contrôle de révision. Fusion à trois voies (`src/lib/sync/merge.ts`) depuis la dernière version commune : ajouts et suppressions des deux côtés gardés, événements identifiés par leur source. Premier lien d'un appareil qui a déjà des données : l'utilisateur choisit (fusionner / en ligne / cet appareil).
- Rappels : push Web (VAPID) envoyés par une fonction Supabase appelée toutes les 10 min par pg_cron ; elle lit les données synchronisées et n'envoie que s'il reste quelque chose à faire. Réglages dans les données (`settings`), donc synchronisés.
- Récits : `engine/story.ts` (moments + chronique du mois), ton bienveillant, variantes déterministes. Les moments existants à l'import sont marqués comme vus (pas d'avalanche).
- Prise en main : tutoriel 6 écrans, 12 missions des premiers jours récompensées (`onboard:<id>`, ne se perdent pas, comme les trophées), astuces de première visite.

**Réalisé**

- `src/lib/sync/` (config, merge, sync, push), `supabase/` (schema.sql, cron.sql, fonction send-reminders), `docs/supabase.md`. Clés VAPID et secret du cron générés dans `supabase/.env.local` (ignoré par git) ; clé publique dans `config.ts`. Variables `SUPABASE_URL` / `SUPABASE_KEY` lues par le workflow de déploiement.
- PWA : manifeste, icônes (planète + vaisseau, normales et masquables), service worker (cache de la version, page hors ligne, push, clic sur notification) adapté à SvelteKit 3 (`$app/manifest`, `$app/env`).
- Écran Réglages (compte, installation, rappels avec heures, test, prise en main, thème) ; nuage de synchro dans la barre latérale.
- Revue : onglets Semaine / Mois ; `MonthReview` (récit, ton regard, clore le chapitre). `MomentOverlay` en plein écran. `Tutorial`, `FirstDaysGuide`, `PageHint` sur les 9 autres écrans.
- Aujourd'hui refait : poste de pilotage (anneau de la journée `DayRing`, statut, secteurs), transmissions, guide, missions par moment repliables, colonne de bord (À faire, séries avec jauge de palier, état du vaisseau, journal replié).
- Copilote : la suggestion de revue ne s'affiche plus pour une semaine sans activité.
- Tests : 47 → 60 (fusion entre appareils, moments, fin de série, import sans avalanche, chronique du mois, missions). Types au vert, build au vert.
- Vérifié dans le navigateur (dev) : tutoriel, validation d'une habitude → trophée raconté et mission réussie, Aujourd'hui à 1 280 px et 375 px sans débordement, Réglages, chronique du mois en mode test.

**Pas vérifié** : service worker, installation et push (le navigateur intégré de Claude refuse les service workers) ; synchro réelle (projet Supabase pas encore créé).

**Suite (03/11, nuit)** : projet Supabase créé et configuré (`ihqmeozeyzsihzjvjsgk`) : schéma, Site URL et redirections, fonction déployée depuis le tableau de bord (erreurs désormais lisibles, clé serveur des nouveaux projets gérée), secrets, cron. Appel manuel de la fonction : `{"users":0,"sent":0}`. Variables du dépôt posées, site redéployé avec la config.

**Prochaine étape** : tester sur le Redmi : compte, installation, rappels (« Tester »), synchro PC ↔ téléphone.

## 2026-11-02 (suite) — V3 : version complète et cohérente

**Demande** : analyser ce qui marche dans le suivi d'habitudes et la motivation ; faire un gros contrôle de toute l'app (tests, cohérence, tâches) ; ajouter des campagnes et des recommandations ; sortir une version pertinente, complète et bonne, dans une V3 séparée sur GitHub.

**Décisions**

- V3 dans un nouveau dépôt public `Doktom/rpg-habitudes-v3`, créé à partir de la V2 figée au tag `v0.2-base` (historique complet). Stockage propre (`rpg-habitudes-v3:*`), import en lecture seule des données V2 (ou V0) au premier lancement. Site : https://doktom.github.io/rpg-habitudes-v3/.
- Synthèse de recherche `docs/recherche-motivation.md` : 13 principes, chacun relié à ce que fait l'app ; garde-fou pour toute nouvelle mécanique.
- Ajouts : copilote, déclencheurs, catalogue d'habitudes, 7 modèles de campagnes, « si… alors… » dans la revue (détail dans le cahier des charges, section « V3 »).
- Aujourd'hui : l'orbite et les jauges passent sous les tâches, pour que l'action soit en haut sur mobile.

**Contrôle**

- Code relu (store, moteur, écrans). Corrigé : la fin de campagne n'appliquait pas la Discipline ; le copilote annonçait une série « à un jour du palier » le lendemain d'un oubli ; espace manquante après le déclencheur.
- Tests : 29 → 47, dont 13 parcours de bout en bout sur le store (valider / décocher, journée complète et parfaite, trophée, clôture des jours, boucliers proposés / utilisés / refusés / fabriqués, tâche, campagne modèle jouée jusqu'au bout, revue, catalogue, versement unique des contenus, import de données V2) et 5 sur le copilote.
- Navigateur, mode test : les dix écrans à 1 280 px et 375 px, sans erreur console ni débordement ; catalogue (ajout d'une idée), création d'habitude avec déclencheur, modèle de campagne, champ « si… alors… », copilote affiché.
- Écran Habitudes refait au système de design ; en-tête de Danse aligné.

**Prochaine étape** : utiliser la V3 au quotidien, puis calibrer ; ensuite Supabase et la PWA.

## 2026-11-02 (suite) — V2 : écran Revue

**Réalisé**

- La revue hebdo devient l'« amarrage au Havre », un parcours en cinq étapes avec une barre d'étapes cliquable et des boutons Retour / Suivant :
  1. **Bilan** : XP, obligations tenues, secteurs allumés, journées complètes ; orbite de la semaine avec le détail jour par jour ; jauges ; habitude par habitude (barre, fait / attendu sur les jours écoulés, série) avec l'habitude tenue à 100 % mise en avant ; exploits de la semaine (récompenses de régularité, trophées, boucliers utilisés).
  2. **Questions** : ce qui a marché, ce qui a coincé, ce que j'ajuste, avec des invites bienveillantes.
  3. **Ajuster** : passer en bonus une habitude obligatoire ratée 3 fois ou plus ; tâches en retard à remettre dans « Cette semaine », « Un jour » ou à abandonner.
  4. **Cap** : trois priorités, une quête de campagne de la semaine (crée une tâche « Avancer : … » liée à la quête), jours de repos de la semaine suivante.
  5. **Amarrage** : récompense affichée (+50 XP, Cellules, butin d'orbite, +25 Inspiration), puis versée avec une notification.
- Brouillon gardé par semaine si l'on quitte l'écran. Lundi et mardi, la revue porte sur la semaine passée si elle n'a pas été faite. Écran « Orbite bouclée » une fois la revue faite, et journal des revues replié en bas.
- `habitWeekProgress` accepte une date limite pour ne compter que les jours écoulés.
- Vérifié avec le mode test (semaine jouée jusqu'au samedi) : bilan rempli, brouillon conservé, quête choisie, priorité saisie, amarrage (+50 XP, 16 Alliages, 3 Cellules), tâches créées, écran « Orbite bouclée » ; mobile 375 px sans débordement. Types, tests et build au vert.

**Pas fait** : revue mensuelle (point campagnes, évolution des stats, arc du mois).

**Prochaine étape** : Habitudes, puis Danse.

## 2026-11-02 (suite) — Boucliers de série

**Décisions** : les boucliers sont des jokers que l'utilisateur choisit d'utiliser (« il ne faut pas en abuser ») : le lendemain d'un raté qui casse une série d'au moins 3 jours, l'écran Aujourd'hui propose « Utiliser un bouclier » ou « Laisser filer ». Rien n'est dépensé automatiquement. Le jour reste un raté pour la Discipline et la Motivation (pas d'XP) : seules les séries et les semaines pleines sont sauves. Un bouclier toutes les 7 journées complètes, ou fabriqué au chantier pour 6 Cellules ; réserve de 2, agrandie par la Coque renforcée (+1 tous les 2 niveaux).

**Réalisé**

- Moteur `shields.ts` (réserve rejouée depuis le journal, séries menacées) + 3 tests (29 au total). Le calcul des séries saute les jours protégés sans faire perdre le jour aux habitudes faites ce jour-là.
- Store : `useShield(date)` et `declineShield(date)` sur choix de l'utilisateur, `buyShield` au chantier ; notification à l'utilisation.
- Aujourd'hui : carte « Hier, une série s'est cassée » avec les séries concernées, la réserve, et les boutons « Laisser filer » / « Utiliser un bouclier » (ou « En fabriquer un » si la réserve est vide).
- Aujourd'hui : réserve de boucliers dans la carte de régularité (lien vers le Vaisseau, infobulle « prochain bouclier dans N journées complètes »), message « Hier, un bouclier a pris le choc : … », pastille bleue sur le jour protégé.
- Vaisseau : carte « Boucliers de série » dans la soute, avec la réserve et le bouton « Fabriquer » (6 Cellules).
- Vérifié avec le mode test : bouclier gagné dans le scénario, achat (réserve 1 sur 2), proposition le lendemain d'un raté (Lecture, 8 jours), utilisation qui rend la série et retire la proposition, notification. Types, tests et build au vert.

**Prochaine étape** : écran Revue (avec le bilan des séries et des boucliers de la semaine), puis Habitudes, Danse.

## 2026-11-02 (suite) — Régularité, nouvelles habitudes, Carnet

**Demandes** : récompenser la régularité (journée où tout est fait, semaine complète, semaine entière à tenir une habitude quotidienne comme lire 10 minutes, idem pour les routines, le sport, la danse) ; ajouter des habitudes du quotidien (lecture, ménage, prendre l'air) ; un système de notes et de listes qui ne sont pas des tâches (courses, déco à acheter, à essayer, à visiter, à penser) ; le tout pratique, intuitif et ludique.

**Décisions**

- Récompenses de régularité (détail et valeurs dans le cahier des charges, section « Univers, vaisseau et récompenses ») : journée complète / parfaite, paliers de série par habitude (7 → 365 jours), semaine pleine par habitude (qui grandit avec les semaines d'affilée), semaine pleine par discipline, semaine sans faille. Versées au moment où elles se produisent, avec une notification ; retirées si l'on décoche.
- Trois trophées de plus (22) : Pilote fiable, Habitude ancrée, Métronome.
- Nouvelles catégories « Lecture & culture » (Savoir) et « Maison » (Intendance). Nouvelles habitudes quotidiennes, en **bonus** pour ne jamais pénaliser : Lecture (5 / 10 / 30 min), Ménage express (5 min / 15 min / une pièce à fond), Prendre l'air (5 min / 20 min de marche / 1 h dehors). Elles s'ajoutent une seule fois aux données existantes (`contentVersion`), et se passent en obligatoire depuis Habitudes si besoin.
- Carnet : listes à cocher et notes libres, sans XP (ce ne sont pas des tâches). Un élément peut devenir une tâche de « Cette semaine », qui rapporte alors de l'XP.

**Réalisé**

- Moteur `regularity.ts` + 5 tests (26 au total), branché dans le store (`syncRegularity`).
- Aujourd'hui : carte « Vers la journée complète » (barre obligations + bonus, récompense en jeu, séries en cours avec flamme et prochain palier), flamme de série et semaine en sept pastilles sur chaque habitude.
- Écran Carnet (menu Bord, et « Plus » sur mobile) : six listes de départ (Courses, Déco à acheter, À essayer, À visiter, Livres à lire, À penser), création avec type, icône et couleur, ajout à la chaîne avec Entrée, collage d'une liste entière, renommer, épingler, modifier un élément d'un clic, cochés repliés avec « Tout effacer », recherche dans tout le carnet, dernière liste ouverte retenue.
- Vérifié avec le mode test (scénario régénéré) : séries et semaines pleines versées sur l'historique, notification « Journée parfaite » en recochant une obligation, ajout à la chaîne, collage de trois lignes, élément transformé en tâche, note libre ; mobile 375 px sans débordement. Corrigé : le mode test créait une seconde habitude « lecture » (même identifiant).

**Pistes proposées (pas développées)** : bouclier de série (gagné tous les 7 jours, il sauve une série après un jour raté) ; défi de la semaine tiré le lundi ; enchaînements (réveil musculaire puis kiné le même matin) ; titres du pilote gagnés par les séries ; alerte douce « série en danger » le soir ; Élan (Inspiration haute : XP ×1,2 pour la journée) ; bilan des séries dans la revue du dimanche ; livres lus du Carnet comptés pour un trophée.

**Prochaine étape** : retours de l'utilisateur sur ces mécaniques et les pistes, puis Revue, Habitudes, Danse.

## 2026-11-02 (suite) — V2 : écran Campagnes

**Décision** : l'écran suit le lore (`docs/univers.md`) : une campagne est une **destination** à rejoindre, ses chapitres sont les **étapes** de la route. Statuts affichés « En route », « À quai » (pause), « Atteinte ». Les données et le moteur ne changent pas.

**Réalisé**

- Liste : en-tête « Destinations » avec trois chiffres (campagnes en route, quêtes accomplies, XP de campagne), cartes avec catégorie, intention, mini carte de route (une balise par étape), avancement et prochaine quête ; sections En route, À quai et Destinations atteintes (repliée) ; état vide illustré.
- Création : nom, stat, intention et arrivée visée (champ `target` du modèle, enfin utilisé).
- Détail : en-tête avec la carte de route en grand (départ, étapes faites, étape en cours mise en avant, étapes verrouillées, destination ; un clic sur une balise fait défiler jusqu'à l'étape), panneau « Modifier » (nom, stat, intention, arrivée, suppression confirmée), mise à quai / reprise.
- Étapes en cartes : pastille d'état, barre de progression, récompense de l'étape ; quêtes avec case ronde (couleur pêche pour les boss), icône de boss, XP et butin ; tâches liées avec case ronde et ajout rapide.
- Ajout de quête : XP en pilules (50, 100, 200, 400), bascule Boss, focus direct sur le nom.
- Carte « Arrivée à destination » avec la récompense (+1 000 XP, 10 Cristaux) et une confirmation avant de terminer la campagne.
- Notifications de gain : quête accomplie, boss vaincu, étape atteinte, tâche terminée, destination atteinte.
- Vérifié avec le mode test en sombre et en clair (1 280 px) et sur mobile (375 px, pas de débordement) : quête accomplie (+73 XP), ajout d'une quête boss. Types au vert, 21 tests au vert.

**Prochaine étape** : Revue, puis Habitudes, Danse.

## 2026-11-02 (suite) — V2 : écran Planning

**Réalisé**

- En-tête comme Aujourd'hui : secteur du jour (vue Jour) ou dates de l'orbite (vue Semaine), flèches qui avancent d'un jour ou d'une semaine, sélecteur Jour / Semaine.
- Bandeau des sept secteurs (jour, date, nom du secteur, un point par élément planifié, icône de repos) : un clic ouvre la vue Jour.
- Vue Jour par défaut sous 1 024 px de large (le cahier prévoit l'agenda jour sur mobile), vue Semaine sur PC.
- Agenda aux jetons du thème, défilant dans sa carte avec les jours collés en haut ; il s'ouvre une heure avant maintenant. Ligne rouge « maintenant » sur aujourd'hui. Blocs colorés par type avec icône : cours (rose), soirée (fuchsia), habitude (sarcelle), tâche (accent), tâche faite barrée.
- Créer une tâche en touchant un créneau vide (heure préremplie, focus sur le titre) ; glisser-déposer conservé, avec surbrillance du créneau visé.
- Fiche d'un créneau : titre, date, début, fin, effort en pilules avec aperçu de la récompense, Terminer / Rouvrir (avec notification de gain), Retirer de l'agenda, suppression confirmée.
- Listes « À caser » en panneau latéral : poignée, pastille de catégorie, date, ajout rapide.
- Vérifié avec le mode test en sombre et en clair (1 280 px) et sur mobile (375 px, pas de débordement) : création au clic, Terminer (+18 XP), glisser-déposer d'une liste vers vendredi 10 h. Types au vert, 21 tests au vert.

**Note** : la carte mentale (artifact `Bq2ySz5W8oPtYHMQpmxQz9`) n'est pas accessible depuis le compte utilisé pour cette session ; `docs/carte-mentale.md` a servi de référence et le compte rendu n'a pas pu y être ajouté.

**Prochaine étape** : Campagnes, puis Revue, Habitudes, Danse.

## 2026-11-02 — Reprise sur plusieurs PC

**Décision** : pour reprendre le projet d'un PC à l'autre, GitHub sert de synchro (pas OneDrive) ; `CLAUDE.md` et ce journal portent tout le contexte nécessaire.

**Réalisé** : section « Travailler sur plusieurs PC » dans `CLAUDE.md` (`git pull` en début de session, push systématique en fin) ; état et numérotation des prochaines étapes corrigés.

**Prochaine étape** : reprendre la refonte graphique avec l'écran Planning, puis Campagnes, Revue, Habitudes, Danse.

## 2026-10-30 — V2 : écran Pilote

**Réalisé**

- Fiche du pilote : grand anneau de niveau, XP vers le niveau suivant et total, trois indicateurs (jours sans faille, trophées, points de compétence à dépenser, ces deux derniers menant au Vaisseau).
- Jauges en pleine largeur.
- Disciplines : radar SVG des stats (`StatRadar`) à côté des cartes de stats (niveau dans une pastille à la couleur de la stat, barre de progression, sous-compétences en tuiles).
- Journal de bord regroupé par jour, avec une icône par type d'événement (routine, danse, tâche, quête, revue, trophée, vaisseau, bilan du jour), XP, butin et variations de jauges ; « Voir plus » par lots de 25.
- Réglages en trois cartes : apparence (thème), mode test, données (export, copie, import, réinitialisation confirmée).
- Vérifié avec le mode test en largeur PC (1 280 px) et mobile (375 px) : aucun débordement horizontal, libellés du radar entiers après élargissement du cadre. Types au vert.

**Prochaine étape** : Planning, puis Campagnes, Revue, Habitudes, Danse.

## 2026-10-29 (nuit, suite) — V2 : écran À faire

**Réalisé**

- En-tête « Manifeste de bord » avec trois chiffres : tâches à faire, faites cette semaine, XP gagnée sur les tâches cette semaine.
- Ajout rapide : grand champ, liste et effort en sélecteurs à pilules (`Segmented`), catégorie, aperçu de la récompense.
- Filtres par catégorie en puces colorées (seules les catégories utilisées apparaissent).
- Quatre listes illustrées, avec un message d'accueil quand elles sont vides. Case ronde dont l'anneau prend la couleur de l'effort (`TaskCheck`) ; ligne avec catégorie, échéance (en rouge si dépassée), étapes, début de la note et XP prévue.
- Détail repensé : titre, détails, effort et liste en pilules, échéance, catégorie, étapes avec barre de progression, suppression confirmée.
- Notification de gain (« Tâche terminée · +37 XP ») quand une tâche est terminée, ici et dans Aujourd'hui (`Toasts`).
- Vérifié en sombre, en clair et sur mobile avec le mode test. Types au vert.

**Prochaine étape** : écran Pilote.

## 2026-10-29 (nuit, suite) — V2 : écran Vaisseau

**Réalisé**

- Illustration du Sillage en SVG (`ShipArt`) qui évolue avec les modules : le réacteur s'allume et rayonne, la coque passe de fissurée à blindée, les propulseurs crachent une flamme de plus en plus longue, l'antenne grandit et émet. Flottement et animations douces, désactivés si le système demande moins d'animations ; éclat lumineux sur la partie améliorée.
- En-tête : nom, classe, progression vers la classe suivante, lore.
- Soute en trois tuiles illustrées ; orbite avec le détail des points et du butin d'amarrage.
- Modules et compétences en cartes : icône, niveaux en pilules, effet actuel et suivant, coût avec icônes, matériaux manquants indiqués.
- Trophées en médaillons, gagnés d'abord (du plus récent au plus ancien), cadenas pour les autres, barre de progression.
- Vérifié en sombre, en clair et sur mobile avec le mode test (9 améliorations : passage d'Épave à Corvette, trophée « Chantier naval » débloqué). Types au vert.

**Prochaine étape** : écran À faire, puis Pilote.

## 2026-10-29 (nuit, suite) — V2 : système de design, coque et écran Aujourd'hui

**Contexte** : la V0 est figée au tag `v0.1-base` du dépôt `rpg-habitudes` ; ce dépôt `rpg-habitudes-v2` porte la refonte graphique.

**Décisions**

- Direction graphique : **Nuit douce** (bleu nuit, lavande, pêche pour les récompenses) en thème sombre par défaut, **Aube orbitale** (crème, brume violette, corail) en thème clair, plus un mode automatique.
- Police Nunito (ronde, douce), icônes Lucide, coins très arrondis, ombres légères, champ d'étoiles discret en fond.
- Les écrans s'écrivent avec des jetons de thème ; la palette `zinc` et les teintes d'accent sont rebranchées sur le thème, donc les écrans pas encore refaits suivent déjà les deux thèmes.
- Navigation repensée : barre latérale groupée (Bord, Voyage, Pilote) avec la carte du pilote (niveau, XP, matériaux) ; sur mobile, barre flottante à 4 écrans + « Plus ». « Perso » devient « Pilote » dans le menu.
- Stockage V2 séparé (`rpg-habitudes-v2:*`), import en lecture seule des données V0.

**Réalisé** : jetons et thèmes (`app.css`, `theme.svelte.ts`, script anti-flash dans `app.html`), composants `OrbitRing`, `LevelRing`, `LootLine`, `ThemeSwitch`, `Gauges` et `TierButtons` refaits ; écran Aujourd'hui refait (en-tête avec le secteur du jour, orbite elliptique autour de Kronos, jauges illustrées, cartes de routine avec gain affiché après validation, todo du jour, journal de bord). Vérifié dans le navigateur en sombre, en clair et sur mobile. Tests 21/21, types au vert.

**Prochaine étape** : refaire l'écran Vaisseau (soute, modules, compétences, trophées en vrai visuel), puis À faire et Pilote.

## 2026-10-29 (nuit, suite) — Calibrage avec le mode test

**Méthode** : scénario de 12 semaines généré par le mode test (utilisateur simulé à ~75 % de réussite), mesures semaine par semaine (XP, matériaux par source, niveaux, trophées, jauge Motivation), puis rejeu des mêmes journées avec des réglages candidats pour la Motivation.

**Constats**

- XP : ~1 200 par semaine, niveau 10 vers la semaine 6 (en partie grâce aux quêtes du scénario), cohérent avec le cahier ; rien à changer.
- Matériaux : environ 90 Alliages, 31 Cellules, 4 à 6 Cristaux par semaine ; les coûts de départ donnaient un vaisseau complet en ~13 semaines en Alliages, mais 19 en Cristaux.
- Motivation : moyenne 83, saturée (≥ 95) un jour sur quatre, sous 30 seulement 2 jours sur 87 : la jauge ne servait presque à rien.
- Orbite : en moyenne 2 secteurs allumés et 4 à moitié par semaine ; l'amarrage rapportait 1 à 7 Alliages, trop peu pour être la boucle centrale.
- Les compétences (3 niveaux × 4) s'épuisaient au niveau 13 du pilote.

**Réglages**

- Motivation : +3 obligatoire (était +5), +2 bonus (+3), +6 quête (+10), retour vers 50 de 15 % (10 %). Résultat : moyenne 70, aucun jour saturé, 5 % des jours sous 30.
- Orbite : un secteur à moitié fait (≥ 50 % des obligations) compte pour un demi-secteur ; 4 Alliages par secteur (1), 3 Cristaux pour l'orbite parfaite (2). Une semaine rapporte maintenant 8 à 26 Alliages.
- Cristaux : coût ⌈1,5(n−1)⌉ au lieu de 2(n−1), pour que les trois ressources arrivent ensemble.
- Compétences : 5 niveaux au lieu de 3 (20 points, niveau 21 du pilote), effets par niveau réduits en conséquence.

**Tests** : 21 au vert, types au vert.

**À vérifier à l'usage** : le simulateur joue plus de tâches qu'un utilisateur moyen ; la Motivation de départ (50) et la difficulté d'allumer un secteur sont à confirmer en vrai.

## 2026-10-29 (nuit, suite) — Univers spatial, récompenses, mode test

**Demandes** : détailler les tâches ; rendre visibles dans la todo du jour celles de la semaine et du mois ; faire récompenser toutes les tâches ; mécanique de trophées et de récompenses ; mode test avec simulation sur plusieurs semaines ; univers futuriste spatial avec un vaisseau qui orbite en 7 jours, avec XP, matériaux et compétences pour le faire évoluer.

**Décisions**

- Univers : le **Sillage** en orbite autour de **Kronos**. Une orbite = une semaine ; un secteur par jour, allumé quand les obligations sont faites ; l'amarrage au Havre (revue hebdo) boucle l'orbite et verse du butin. Détail dans `docs/univers.md`.
- Trois matériaux (Alliage, Cellule, Cristal). Toute action (habitude, danse, tâche, quête, revue) rapporte de l'XP et du butin selon sa difficulté.
- Quatre modules du vaisseau (Réacteur, Coque, Propulseurs, Antenne) et quatre compétences du pilote (1 point par niveau). 19 trophées.
- Le principe « pas d'économie » du cahier est remplacé : les matériaux ne se perdent jamais, ils se dépensent sur une amélioration choisie.
- Mode test dans un stockage séparé, avec une horloge simulée ; recharge de la page à chaque saut de date.

**Réalisé** : tâches détaillées (note, effort, échéance, sous-tâches), todo du jour enrichie, écran Vaisseau, bandeau et scénario du mode test. Tests passés de 10 à 20, vérification de types au vert, build GitHub Pages au vert ; mode test essayé dans le navigateur (génération, amélioration d'un module, compétence, validation, saut d'une semaine).

**Calibrage** : le scénario de test rapporte ~96 Alliage par semaine, trop pour les coûts de départ (tout le vaisseau en un mois) ; les coûts ont été multipliés par 2,5 pour viser environ 3 mois. À revoir après usage réel.

**Pas fait** : équipage, carte de la galaxie, événements d'orbite, renommer ou archiver une catégorie, habillage graphique.

## 2026-10-29 (suite) — La carte mentale devient l'outil de pilotage

**Décision** : la carte mentale sert d'outil de pilotage et d'interface d'échange, en plus du chat.

**Réalisé** : branche « Échanges » dans la carte, avec « Pour Claude » (demandes de l'utilisateur) et « Réponses de Claude » (comptes rendus). Règles de début et de fin de session ajoutées dans CLAUDE.md.

## 2026-10-29 (suite) — Carte mentale

**Objectif** : un outil visuel pour construire et imaginer les modules et mécaniques.

**Décisions**

- Carte mentale interactive hébergée sur claude.ai (privée), avec base de données partagée : l'utilisateur l'édite, Claude la lit et l'écrit d'une session à l'autre.
- Statuts : en place, prévu, à explorer, abandonné. Types : module, mécanique, idée, question.
- Copie lisible versionnée dans `docs/carte-mentale.md`.

**Réalisé**

- Page `tools/carte-mentale.html` : arbre horizontal, zoom et déplacement, glisser un nœud sur un autre pour le rattacher, replier les branches, filtres par statut, recherche, raccourcis clavier, export Markdown.
- Carte remplie avec l'état du projet (55 nœuds), dont 4 idées de mécaniques suggérées à trier : combos entre habitudes, défi de la semaine, titres de personnage, bonus d'équilibre.
- Script `tools/carte-export.mjs` et règles dans CLAUDE.md.

**Prochaine étape** : l'utilisateur trie les idées et en ajoute ; la session suivante part de la carte pour choisir quoi développer.

## 2026-10-29 (suite) — GitHub Pages

**Décisions** : le dépôt devient public (Pages n'est pas disponible sur un dépôt privé avec le compte gratuit) ; le site est déployé automatiquement à chaque push.

**Réalisé** : workflow GitHub Actions (tests, build avec `BASE_PATH`, déploiement Pages) ; site vérifié en ligne sur https://doktom.github.io/rpg-habitudes/.

## 2026-10-29 (suite) — Mise en ligne de test

**Objectif** : avoir un lien pour tester l'app dans le navigateur.

**Décisions**

- GitHub Pages écarté pour l'instant : il rendrait le site public, à décider explicitement plus tard.
- Lien de test privé hébergé sur claude.ai (partageable depuis le menu Partager) : https://claude.ai/artifact/DQ5iFZruSWtsrguVE7pd4x
- Routage par hash et dossier `app/` pour fonctionner sur n'importe quel hébergement statique.

**Réalisé**

- Script `npm run build:artifact` qui prépare la page publiée.
- Remplacement des `confirm()`/`alert()` par une confirmation dans la page ; ajout d'un bouton « Copier le JSON » (le téléchargement de fichier est bloqué sur le lien de test).
- Vérifié en local avec la page publiée telle quelle ; pas pu ouvrir le lien claude.ai depuis le navigateur de Claude (non connecté).

**Prochaine étape** : tester le lien sur téléphone et PC, remonter les retours.

## 2026-10-29 (suite) — V0 prototype

**Objectif** : ajouter le paramétrage danse au cahier des charges et développer une première version utilisable.

**Décisions**

- Danse : cours fixes hebdomadaires (même horaire chaque semaine, suspendus pendant les vacances), annulation d'une séance précise, soirées ponctuelles saisies à l'avance (bonus).
- Le contenu des routines (kiné, réveil musculaire) sera saisi au fil de l'eau dans l'app.
- V0 sans backend : stockage navigateur + export/import JSON ; Supabase viendra ensuite.
- SvelteKit 3 : config dans `vite.config.ts`, imports internes via `#lib/...`.

**Réalisé**

- Cahier des charges : section « Paramétrage danse » et note V0 dans « Périmètre ».
- Moteur testé (10 tests) : XP, niveaux, répartition entre stats, Discipline sur 28 jours, Motivation et Inspiration rejouées depuis un journal d'événements, clôture des journées passées, calendrier danse avec vacances.
- Écrans : Aujourd'hui, Planning (listes + agenda semaine, glisser-déposer), Campagnes, Personnage, Habitudes (routines versionnées), Danse, Revue hebdo.
- Vérifié dans le navigateur (PC et mobile) : validation d'habitudes, cours et soirée de danse, glisser-déposer d'une tâche, quête qui clôture un chapitre.

**Pas encore fait** : comptes et synchro Supabase, PWA et notifications, vue mois, revue mensuelle, Élan, mode guidé des routines.

**Prochaine étape** : utiliser la V0 au quotidien, saisir les vrais cours de danse et les exercices des routines, puis brancher Supabase et la PWA.

## 2026-10-29 — Cadrage du concept et cahier des charges v1

**Objectif** : affiner le concept avant tout développement.

**Décisions**

- Usage perso d'abord, modèle multi-utilisateur dès le départ ; mobile + PC via une PWA.
- Couche RPG : stats par domaine (Danse avec Salsa / Bachata / Kizomba, Sport, Mobilité/kiné, Trading, Projets perso), XP et niveaux, jamais de perte d'acquis.
- Pas de PV ni de mort : trois jauges Discipline (multiplicateur d'XP), Motivation (mode minimum), Inspiration (Élan).
- Pas d'économie de récompenses pour l'instant.
- Habitudes à paliers (minimum / normal / excellent), types obligatoire / bonus, fréquences souples, jours de repos.
- Routines versionnées (réveil musculaire, kiné matin et soir avec renfos), programme salle 3x/semaine.
- Campagnes fil rouge → chapitres → quêtes → tâches ; exemples Trading, Maison (aménagement et déco), Danse.
- Planification : listes souples + agenda horaire avec glisser-déposer ; pas de synchro Google Agenda.
- Rituel de revue hebdo et mensuel ; notifications push.
- Visuel sobre au départ.
- Stack : SvelteKit + Supabase + Tailwind (choix délégué à Claude).
- L'app salle existante sera intégrée plus tard.

**Réalisé**

- Cahier des charges v1 (doc partagé + `docs/cahier-des-charges.md`).
- Création du dépôt GitHub, `CLAUDE.md` et ce journal.

**Questions ouvertes** : voir la section « Questions ouvertes » du cahier des charges.

**Prochaine étape** : répondre aux questions ouvertes, puis initialiser le projet SvelteKit + Supabase et attaquer le MVP.
