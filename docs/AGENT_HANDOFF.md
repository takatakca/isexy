## Relève supplémentaire — 15 octobre 2026, dernier correctif d'allocations

- Dernier commit applicatif avant cette mise à jour : `59496103ecc185d3da49cf5302c3667ed902865c` sur `main`.
- `supabase/functions/isexy-reset-allowances/index.ts` :
  la fonction répond désormais HTTP 500 si un RPC de remise à niveau
  hebdomadaire, mensuelle ou d'expiration de promotions échoue.
- Publication directe confirmée dans Supabase : `isexy-reset-allowances`
  version **2**, état ACTIVE, **verify_jwt=true** conservé.
- `731a6e2e` : CI GitHub SUCCESS et release Render LIVE.
  `59496103` : dernier job CI en cours et Render en cours
  à la lecture avant le commit documentaire; reconsulter ensuite.
- Les fonctions privilégiées `*_unchecked`, l'accès par adresse e-mail et
  les cinq RPC contrôlés restent non exécutables par les rôles publics.
- **Blocage non résolu** : le scheduler doit posséder un JWT valide
  pour passer la Gateway ainsi que `ISEXY_CRON_SECRET` pour passer
  le handler. L'accès à la configuration effective et une vérification
  programmée manquent. Ne pas supprimer la vérification JWT par défaut.
- Les autres P0 restent ouverts : GitHub → Supabase, Coolify,
  isexy.ca/DNS/TLS, secrets et tests fournisseurs.
- Prochaine action : relever la conclusion CI du dernier `main`, vérifier
  le SHA Render publié, résoudre le Cron de façon autorisée puis
  reprendre `docs/TASK_QUEUE.md`. Aucune exécution en arrière-plan
  n'a été configurée.

---

# Relève prioritaire — 15 octobre 2026

## Dernière tâche terminée

- Audit des privilèges côté SQL, migrations `0007_secure_allowance_resets.sql`
  et `0008_restrict_privileged_maintenance_rpcs.sql` enregistrées et
  appliquées dans `pcjfahhlozsseqqevimi`. 0007 empêche des réinitialisations
  anonymes et bloque les grants de boost répétés; 0008 réserve nettoyage OTP
  et télémétrie au service, et restreint l'annuaire administratif au personnel.
- Le 15 octobre, les permissions des cinq RPC sensibles ont été contrôlées
  via `has_function_privilege` pour anon, authenticated et service_role.
- `src/pages/CubanSignup.tsx` ne crée plus un profil avec la fausse
  date `2000-01-01` et n'enregistre plus une vérification si un transfert
  de justificatif échoue.
- `.github/workflows/ci-cd.yml` exclut toujours le semeur de faux profils
  et l'ancien global reset du déploiement automatique.

## Tâche actuellement en cours / blocage identifié

- Le Cron d'allocations `isexy-reset-allowances` reste avec
  `verify_jwt=true`, alors que le handler exige `x-cron-secret`.
  La tentative de sécuriser la configuration et le retour d'erreur n'a
  pas pu être poussée : **action refusée par un contrôle de sécurité**
  de l'outil, aucun code ni service modifié dans cette tentative.
  Examiner une solution approuvée et maintenir les RPC protégés.
- Contrôler ensuite Coolify, `isexy.ca`, Auth TAKATAK, secrets de production,
  événements Stripe et les scénarios utilisateurs.

## Dernier SHA, versions, résultats

- **Dernier SHA applicatif avant ce document** :
  `f889e93111a5821dacd5c9a75b59cbad324d5127` sur `main`.
  Comparer avec la branche car la présente relève constitue un commit
  documentaire ultérieur.
- Render statique `srv-db37s2s9v7es73b8g60g` :
  commit `f889e931` observé **live**.
- CI : `e353ede9` et `e12c3ade` réussis;
  `f889e931` en cours à la dernière vérification;
  les jobs de publication Supabase/SSH restent sautés faute de secrets.
- Supabase : 69 tables ISEXY; 25 fonctions `isexy-*` ACTIVE (manquent
  `isexy-seed-profiles` volontairement et `isexy-subscription-resets`
  mis en quarantaine).
- Migrations 0007 et 0008 présentes dans `isexy.schema_migrations` avec :
  0007 `d6e961cd67886798e84638a9e42752851ad9a6ac798cc25182c9d7e690b20cbc`;
  0008 `36ff15f2626dd6e837138d776720a768aa16ae8bee6c6f0f2b34333951af01a2`.
- Fichiers changés depuis la relève précédente :
  `src/pages/CubanSignup.tsx`, `.github/workflows/ci-cd.yml`,
  `supabase/isexy-migrations/0007_*.sql`,
  `supabase/isexy-migrations/0008_*.sql`,
  `scripts/isexy/test/allowance-rpc-permissions.sql`,
  `scripts/isexy/test/privileged-rpc-permissions.sql`,
  `WORKLOG.md` et les cinq documents de suivi.

## Vérifications effectuées

- GitHub : lecture de `main`, WORKLOG, issues/PR ouvertes, CI et jobs
  (dernier run vert prouvé : `e353ede9`).
- Render : liste des déploiements de service, SHA `f889e931` live.
- Supabase : `execute_sql` (permissions, migrations et définitions),
  `list_edge_functions`, `get_advisors(type=security)`.
- Aucun test utilisateur OTP, appel, paiement réel ou diagnostic Coolify
  n'a été certifié. Les lectures publiques directes du domaine ISEXY
  n'ont pas fourni de preuve indépendante de santé.

## Accès manquants, sans secrets

- `ISEXY_DB_URL` et `SUPABASE_ACCESS_TOKEN` dans GitHub Actions
  pour les migrations/functions automatiques.
- Console Coolify, preuve DNS/TLS pour `isexy.ca`, contrôle du SHA servi.
- Confirmation des secrets `ISEXY_*` (Stripe, Anthropic, cron, Twilio,
  courrier), des webhooks fournisseurs et Auth redirect URLs.

## Prochaine action exacte

1. Lire le dernier SHA `main` et les conclusions des jobs CI post-0008,
   puis comparer à la dernière release Render live.
2. Résoudre le décalage Cron/JWT sans exposer l'endpoint ; tester un appel
   sans secret (401) et un appel du scheduler autorisé (200 ou erreur
   explicite). Ne pas exécuter une réinitialisation sur des utilisateurs
   réels pour un test.
3. Configurer les secrets GitHub de production avec accès autorisé,
   puis confirmer que migrations et fonctions ne sont plus `skipped`.
4. Vérifier Coolify, domaine, Auth, Stripe et les autres P0 de
   `docs/TASK_QUEUE.md`. Mettre à jour WORKLOG et ce document.

---

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
