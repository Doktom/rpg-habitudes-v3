# Synchro et rappels : mise en place de Supabase

L'app garde ses données dans le navigateur. Supabase (gratuit) ajoute :

- **un compte de bord** (e-mail + mot de passe) : les données sont sauvegardées en ligne et fusionnées entre le téléphone et le PC, même après une utilisation hors ligne ;
- **les rappels push** : une fonction serveur regarde toutes les 10 minutes ce qui reste à faire et envoie une notification à l'heure choisie dans Réglages, même app fermée.

À faire une seule fois, environ 15 minutes. Les fichiers cités sont dans le dossier `supabase/` du dépôt.

## 1. Créer le projet

1. Créer un compte sur https://supabase.com, puis **New project** (nom : `sillage`, région : *West EU (Paris)*). Noter le mot de passe de base de données dans un gestionnaire de mots de passe (il ne sert pas à l'app).
2. **SQL Editor > New query** : coller tout `supabase/schema.sql`, puis **Run**. Le script crée les tables `app_state`, `push_subscriptions`, `reminder_log` et la fonction `push_state`, avec les règles d'accès (chacun ne voit que ses données).
3. **Authentication > URL Configuration** :
   - *Site URL* : `https://doktom.github.io/rpg-habitudes-v3/`
   - *Redirect URLs* : ajouter `https://doktom.github.io/rpg-habitudes-v3/` et `http://localhost:5173/`
4. Facultatif : **Authentication > Sign In / Providers > Email**, décocher *Confirm email* pour ne pas avoir à cliquer le lien de confirmation à la création du compte.

## 2. Relier l'app au projet

Dans **Project Settings > API** (ou *Data API*), copier :

- *Project URL* (`https://xxxx.supabase.co`) ;
- la clé publique (*anon* / *publishable*). Elle n'est pas secrète : la sécurité repose sur les règles d'accès créées à l'étape 1. **Ne jamais utiliser la clé `service_role` / *secret* dans l'app.**

Ensuite, une fois pour toutes (recommandé) : dans le dépôt GitHub, **Settings > Secrets and variables > Actions > Variables**, créer `SUPABASE_URL` et `SUPABASE_KEY` avec ces deux valeurs, puis relancer le déploiement (onglet Actions, *Run workflow*). Avec le CLI GitHub :

```bash
gh variable set SUPABASE_URL --repo Doktom/rpg-habitudes-v3 --body "https://xxxx.supabase.co"
gh variable set SUPABASE_KEY --repo Doktom/rpg-habitudes-v3 --body "<clé publique>"
gh workflow run deploy.yml --repo Doktom/rpg-habitudes-v3
```

À défaut, l'écran **Réglages** de l'app propose de coller l'URL et la clé (à refaire sur chaque appareil).

## 3. La fonction des rappels

Les secrets sont déjà générés dans `supabase/.env.local` sur le PC où la V3 a été préparée (fichier ignoré par git, à ne jamais committer) : `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`. La clé VAPID publique est aussi écrite dans `src/lib/sync/config.ts`. Si ce fichier est perdu, regénérer les clés avec `npx web-push generate-vapid-keys`, mettre la nouvelle clé publique dans `config.ts` et refaire cette étape.

**Avec le tableau de bord (sans rien installer)**

1. **Edge Functions > Deploy a new function > Via Editor**, nom : `send-reminders`. Coller le contenu de `supabase/functions/send-reminders/index.ts`, puis **Deploy**.
2. Dans les réglages de la fonction, désactiver **Verify JWT** (*Enforce JWT verification*) : la fonction vérifie elle-même le secret du cron et la session de l'utilisateur.
3. **Edge Functions > Secrets** : ajouter les quatre valeurs de `supabase/.env.local`.

**Ou avec le CLI Supabase**

```bash
npx supabase login
```

```bash
npx supabase functions deploy send-reminders --project-ref <PROJECT_REF> --no-verify-jwt
```

```bash
npx supabase secrets set --env-file supabase/.env.local --project-ref <PROJECT_REF>
```

`<PROJECT_REF>` est l'identifiant dans l'URL du projet (`https://<PROJECT_REF>.supabase.co`).

## 4. Le déclencheur toutes les 10 minutes

Dans **SQL Editor**, coller `supabase/cron.sql` en remplaçant `<PROJECT_REF>` et `<CRON_SECRET>` (la valeur de `supabase/.env.local`), puis **Run**. Vérifier dans **Integrations > Cron** que la tâche `sillage-rappels` tourne.

## 5. Sur chaque appareil

1. Ouvrir https://doktom.github.io/rpg-habitudes-v3/ (Chrome sur Android).
2. **Réglages > Compte de bord** : *Créer mon compte* la première fois, *Se connecter* ensuite. Sur un appareil qui a déjà ses propres données, l'app demande s'il faut fusionner, garder celles en ligne ou celles de l'appareil (fusionner est le bon choix par défaut).
3. **Installer** : menu ⋮ de Chrome > *Installer l'application*.
4. **Rappels** : *Activer les rappels ici*, accepter la permission, puis *Tester*.
5. Xiaomi / Redmi : Paramètres > Applis > Chrome : autoriser les notifications et mettre l'économiseur de batterie sur *Aucune restriction*, sinon les rappels peuvent arriver en retard.

## Fonctionnement

- **Synchro** (`src/lib/sync/sync.svelte.ts`) : un document JSON par utilisateur (`app_state.data`) avec un numéro de révision. Chaque sauvegarde locale est envoyée 1,5 s plus tard ; l'app regarde les changements à l'ouverture, au retour sur l'onglet et toutes les 30 s. Si les deux appareils ont changé, la fusion à trois voies (`merge.ts`) garde les ajouts et suppressions des deux côtés, à partir de la dernière version commune. `push_state` refuse un envoi si un autre appareil a écrit entre-temps : l'app refusionne et réessaie.
- **Rappels** (`supabase/functions/send-reminders`) : pour chaque utilisateur abonné, la fonction lit ses données synchronisées et ses réglages (heures, fuseau horaire), et n'envoie que s'il reste quelque chose à faire. `reminder_log` évite tout doublon dans la journée.
- **Mode test** : ni synchro ni rappels, les vraies données ne sont jamais touchées.
