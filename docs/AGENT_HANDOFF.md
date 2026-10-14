## Mise à jour de relève — 2026-10-14 18:18 UTC

- Dernier SHA applicatif poussé avant cette mise à jour documentaire :
  `b668f2cdd3678af80950465027c3a918d5f38932` (`main`).
  **Lire `main` pour le dernier SHA documentaire**, car cette page est
  mise à jour dans un nouveau commit.
- `0006_require_adult_profiles.sql` enregistrée/appliquée dans V1 avec
  empreinte `80725d01a8d7c4537f4501e0149326ee74f3b9e2fbdc4fba667a5004fe772b62`.
  Le déclencheur refuse les dates de naissance correspondant à moins de
  18 ans. Test du schéma ajouté au job migrations GitHub.
- `src/pages/MySubscription.tsx` ne présente plus le forfait gratuit comme
  un résultat fiable lorsqu'une vérification Stripe échoue.
- `isexy-verify-iap-receipt` v2 déployée sur V1 : retourne HTTP 501 en
  absence de vraie vérification d'achats mobiles; ne crédite pas de droit.
- Render `isexy` : SHA `b668f2cd` confirmé **live** à 18:18 UTC.
- GitHub Actions : dernière CI pleinement verte vérifiée `75139c2`
  (run `38612705942`); `e0f9a445` a été annulée avant ses tests,
  `b668f2cd` était encore en attente. Revenir lire les nouveaux runs.
- Prochaine action : contrôler le run le plus récent, puis confirmer
  Coolify/ISEXY.CA, les secrets de publication et les parcours utilisateurs.

---

# ISEXY — Relève de l'agent

Date : 2026-10-14 (heure Montréal). Repository : `takatakca/isexy`,
branche publication `main`. Lire d'abord `AGENTS.md`, `WORKLOG.md`,
`docs/PROJECT_STATUS.md`, `docs/TASK_QUEUE.md` et les décisions.

## Dernière tâche terminée

Migration de performance ISEXY `0005_core_relationship_indexes.sql` :
12 index ciblés codés, commités et appliqués au schéma `isexy` du projet
Supabase `pcjfahhlozsseqqevimi`. L'advisor FK passe de 82 à 71.
Migration précédente `0004_pin_normalize_gender_search_path.sql`
appliquée et avis sécurité associé disparu.

## Tâche actuellement en cours

Confirmer l'exécution CI et la publication Render du SHA de la migration
0005 puis déterminer l'état réel de Coolify et `isexy.ca`, avant la recette
des intégrations. Le suivi de travail est revendiqué dans `WORKLOG.md`.

## Fichiers modifiés dans cette reprise

- `WORKLOG.md` (revendication et progression).
- `supabase/isexy-migrations/0005_core_relationship_indexes.sql`.
- `docs/PROJECT_STATUS.md`, `docs/TASK_QUEUE.md`,
  `docs/AGENT_HANDOFF.md`, `docs/DECISIONS.md`, `docs/DEPLOYMENT.md`.

## Commits et vérifications réelles

- Dernier SHA **fonctionnel** avant les fichiers de relève :
  `75139c2018a2f02271303a6dca5663b99aa7f912`. Lire
  `git rev-parse HEAD` ou la branche GitHub pour le SHA documentaire
  ultérieur : ne pas déduire que le même commit sert déjà en production.
- CI complète `38612389598` sur `eabe0204` : SUCCESS.
  CI `38612705942` sur `75139c2` : en cours à la dernière lecture.
- Render statique `srv-db37s2s9v7es73b8g60g` : publication
  `dep-db7s9f60tbcc73er35vg` de `eabe0204` observée `live`
  (`main`, autoDeploy=yes, `dist`).
- Supabase SQL : 69 tables, 68 avec RLS; 0 profils; migrations
  0001–0005; empreinte 0005
  `822305b838f1d1e8b5f484ecc3a66ccf2914a36341b80531b604923c6ccd383b`.
- Edge Functions : 25 des 27 `isexy-*` ACTIVE. Exceptions :
  `isexy-subscription-resets` et `isexy-seed-profiles` non publiées.
- Vérifications réalisées via connexions GitHub, Supabase et Render.
  Aucun essai utilisateur final Stripe/OTP/appel n'a été réalisé.

## Blocages et accès nécessaires (ne pas publier de valeurs)

- GitHub Actions : `ISEXY_DB_URL`, `SUPABASE_ACCESS_TOKEN` absents
  de l'environnement de déploiement ou non disponibles pour le job;
  les étapes GitHub de migration / Edge Functions sont **SKIPPED**.
- Coolify : URL du panel connue `coolify.takatak.ca`, mais pas
  d'attestation de configuration, de SHA déployé ou de redirection DNS.
- Domaine `isexy.ca` : état SSL/DNS et santé des routes non prouvés.
- Secrets fournisseurs `ISEXY_STRIPE_*`, `ISEXY_ANTHROPIC_API_KEY`,
  téléphonie et SMTP/Resend : présence/fonctionnement non certifiés.
- Deux fonctions non publiées : contrôler l'authentification,
  l'idempotence et la destination avant un éventuel déploiement.
  Ne jamais injecter de faux profils en production.

## Prochaine action exacte

1. Lire la dernière exécution de
   `https://github.com/takatakca/isexy/actions`; vérifier le SHA
   en tête de `main`, les 4 jobs de vérification et tout step SKIPPED.
2. Interroger Render pour le dernier `live` sur
   `srv-db37s2s9v7es73b8g60g` et comparer au SHA `main`.
3. Vérifier la vraie app Coolify, son domaine et les routes profondes.
4. Reprendre le premier P0 encore ouvert de `TASK_QUEUE.md`; garder
   `WORKLOG.md` à jour à chaque commit.

**Ne jamais** prétendre que ISEXY est entièrement en production tant que
les services d'identité, de paiement, d'appel et le domaine principal n'ont
pas été vérifiés de bout en bout.
