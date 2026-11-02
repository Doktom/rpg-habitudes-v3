---
name: rpg-habitudes
description: "Tom's habit-tracker RPG webapp: V0, V2, V3 repos, local paths, sites, Supabase setup status"
metadata:
  node_type: memory
  type: project
  modified: 2026-11-02T23:15:38.057Z
  originSessionId: 05052893-06ab-43d2-8001-58b1fec2086b
---

Trois dépôts GitHub (compte Doktom), clonés dans C:\Users\tom\Documents\GitHub\ :
- `rpg-habitudes` = V0 figée (tag `v0.1-base`), `rpg-habitudes-v2` = V2 figée (tag `v0.2-base`).
- `rpg-habitudes-v3` = **travail actif**, version 0.4.0 au 2026-11-02 : synchro Supabase, PWA + rappels push, récits (revue mensuelle, moments), tutoriel + guide des premiers jours, Aujourd'hui refait. Site https://doktom.github.io/rpg-habitudes-v3/.

Supabase : projet `ihqmeozeyzsihzjvjsgk` configuré le 2026-11-03 (tables, fonction send-reminders, secrets, cron) ; guide `docs/supabase.md`. Les réglages sensibles (JWT off, secrets) doivent être faits par Tom lui-même. Secrets VAPID + CRON générés dans `supabase/.env.local` (ignoré par git, seulement sur ce PC). Téléphone : Android (Redmi/Xiaomi, voir [[redmi-phone-cleanup]]).

Le navigateur intégré de Claude refuse les service workers : SW/push/installation se vérifient sur le vrai téléphone.

**Why:** l'utilisateur dit « on reprend » sans chemin ; la V3 est le travail actif.
**How to apply:** travailler dans rpg-habitudes-v3 (git pull d'abord) ; lire son CLAUDE.md et la dernière entrée de docs/journal-sessions.md. Prochaine étape probable : aider à créer le projet Supabase puis tester sur le Redmi.
