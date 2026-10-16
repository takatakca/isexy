# PRIORITÉ RELÈVE — 16 octobre 2026

## 16 octobre 2026 — migration 0011 et Cron (publication conditionnelle)

- Dernier commit de code vérifié avant cette note : `7778ede04ba8653ceb15352066a00f351d84d807`, branche `main`.
- La migration `0011_atomic_credit_checkout.sql` et `fulfill_stripe_credit_purchase` ajoutent une transaction atomique, protégée par session Stripe, pour les achats de crédits/minutes. **Non appliquées à Supabase** : CI initiale `38883496854` en échec sur la fixture SQL (`id` ambigu); test corrigé au commit `7778ede`, nouveau run `38884128241` à vérifier.
- En production, les migrations ISEXY appliquées restent `0001`–`0010`; le webhook Stripe publié reste **v2** (sans RPC 0011).
- Le workflow `.github/workflows/isexy-allowance-cron.yml` (commit `3a6b4188`) prévoit une exécution quotidienne à 04:13 UTC avec **JWT anon Supabase + secret Cron privé**, sans désactiver `verify_jwt`. Le handler modifié refuse GET et exige un secret d'au moins 16 caractères. Le handler actualisé n'est pas encore déployé; secret GitHub `ISEXY_CRON_SECRET` non vérifié, aucune exécution du Cron confirmée.
- CI verte confirmée : run `38883203014` (SHA `abb2b0bd`); Render observé `08b41aa6` live; les SHA ultérieurs et leur CI sont à revérifier.
- Blocages inchangés : secrets de déploiement GitHub → Supabase, Coolify/ISEXY.CA, Stripe sandbox et idempotence des autres produits, OTP, SMS, téléphonie et messagerie réels.



**Fichiers touchés depuis la relève précédente :**
`supabase/isexy-migrations/0011_atomic_credit_checkout.sql`,
`scripts/isexy/test/atomic-credit-checkout.sql`,
`supabase/functions/isexy-stripe-webhook/index.ts`,
`supabase/functions/isexy-reset-allowances/index.ts`,
`.github/workflows/ci-cd.yml`,
`.github/workflows/isexy-allowance-cron.yml`,
`WORKLOG.md`, et les cinq fichiers de suivi `docs/`.

**Contrôles effectués :** GitHub CI/jobs/logs (erreur précise relevée),
GitHub main, Render `live`, introspection SQL des colonnes/contraintes
et comptages de transactions (0 crédit, 0 webhook), sans mutation métier.
Aucun essai Stripe réel, aucun reset Cron réel.

**Prochaine action exacte :**
1. Relire `main`, `docs/AGENT_HANDOFF.md` puis le run `38884128241`.
2. Si toutes les validations passent, appliquer 0011 (schema `isexy`
   uniquement) avec checksum, vérifier le RPC et ses privilèges de
   service puis déployer `isexy-stripe-webhook` mis à jour.
3. Vérifier la CI du nouveau workflow Cron, déployer
   `isexy-reset-allowances` en conservant `verify_jwt=true`,
   approvisionner `ISEXY_CRON_SECRET` GitHub via accès sécurisé et
   vérifier un run autorisé. Si la CI échoue, corriger plutôt que déployer.
4. Résoudre les secrets `ISEXY_DB_URL` et `SUPABASE_ACCESS_TOKEN`
   de GitHub, les contrôles Coolify/ISEXY.CA et les tests fournisseurs.

**Blocages et autorisations** : aucune valeur de secret documentée;
GitHub backend auto-deploy saute actuellement ses étapes. La relève
ne constitue pas un orchestrateur de redémarrage automatique.

---

# Relève immédiate — 16 octobre 2026, vérifications Stripe et Data API

**Dépôt :** `takatakca/isexy`, branche `main`.
**Dernier SHA de code avant ce commit documentaire :**
`f6e6a0297cc8936246ced9ab922f52b697a342b3`.
Relire le nouveau SHA `main` après la présente sauvegarde.

## Terminé et publié

- Commit `830c1062` : sécurisation des métadonnées client au checkout
  (nouveau `_shared/checkout-metadata.ts`, tests Deno).
  Tests GitHub `38882342512` SUCCESS.
  Edge Function `isexy-create-one-time-payment` déployée **ACTIVE v3**.
- Commit `5b9a6845` : webhook Stripe n'acquitte plus les événements
  non traités; paiements uniques crédités seulement lorsque
  `payment_status=paid`; prise en charge de
  `checkout.session.async_payment_succeeded`.
  Tests GitHub `38882538662` SUCCESS;
  `isexy-stripe-webhook` déployé **ACTIVE v2**.
- Commit `705cc269` : état de paiement de l'interface sécurisé en
  échec fermé, autorisation checkout conditionnelle et redirection
  limitée à l'hôte Stripe; contrôle serveur plus strict des clés.
  Tests GitHub `38882680228` SUCCESS;
  `isexy-payments-gate-status` déployé **ACTIVE v2**.
- Commit `f6e6a029` : ajout du smoke test de Data API
  `/rest/v1/ticket_categories` sur le schéma `isexy` dans
  `.github/workflows/ci-cd.yml`. Render de ce SHA observé **live**.
  GitHub Actions run `38882814481` en cours au dernier relevé.
- Préservation : migrations 0001–0010 déjà appliquées, 25 Edge
  Functions ISEXY (deux quarantaines), identité TAKATAK V1,
  aucune donnée Cuba supprimée.

## Fichiers modifiés durant cette session

`WORKLOG.md`;
`supabase/functions/_shared/checkout-metadata.ts`;
`supabase/functions/isexy-create-one-time-payment/index.ts`;
`supabase/functions/isexy-stripe-webhook/index.ts`;
`supabase/functions/isexy-payments-gate-status/index.ts`;
`src/hooks/usePaymentsGate.ts`;
`src/pages/Premium.tsx`;
`scripts/isexy/test/checkout-metadata.test.ts`;
`.github/workflows/ci-cd.yml`;
et les cinq documents de suivi dans `docs/`.

## Contrôles réellement exécutés

- Relecture AGENTS, WORKLOG, décisions, queue et ancienne relève,
  branche `main`, PR et issues ouvertes (aucune), CI et jobs,
  service et SHA de déploiement Render.
- GitHub : Deno tests metadata, vérifications TypeScript, build,
  migrations PostgreSQL V1 stand-in et contrôles de séparation réussis
  sur `830c1062`, `5b9a6845`, `705cc269`.
- Supabase : consultation des 10 migrations et des grants au schéma
  `isexy`; déploiement direct avec retour ACTIVE des trois
  fonctions Stripe (one-time v3, webhook v2, gate v2).
- Web : tentative directe de `https://isexy.onrender.com/release.json`
  et `https://isexy.ca`, non accessible depuis l'outil web;
  Render et smoke CI servent de source de statut de publication.
- Aucun débit Stripe, remboursement, OTP, appel téléphonique, ni
  réinitialisation de quotas réel n'a été déclenché.

## Risques et accès nécessaires

1. Le webhook protège les duplications de statut, mais les écritures
   des avantages/transactions ne sont pas toutes atomiques.
   Un événement `failed` retourne 503 sur répétition et nécessite
   rapprochement manuel; **ne pas déclarer le traitement commercial prêt**.
2. `ISEXY_DB_URL` et `SUPABASE_ACCESS_TOKEN` sont toujours absents
   ou indisponibles dans GitHub Actions : jobs backend sautés.
3. `isexy-reset-allowances` nécessite toujours JWT Gateway et secret
   Cron. Pas de job périodique confirmé. Une tentative antérieure de
   modification de la configuration avait été bloquée; ne pas
   contourner les contrôles de sécurité.
4. `isexy.ca` et Coolify non vérifiés en conditions réelles.
   Secrets Stripe, Twilio, fournisseur mail/IA et Auth TAKATAK
   non validés de bout en bout.
5. N'afficher ni enregistrer les clés privées en documentation ou logs.

## Prochaine action exacte

1. Vérifier le run `38882814481` (en particulier le nouveau
   test `ISEXY Data API`) et le SHA `main` puis Render `live`.
2. Si le test REST renvoie 406, vérifier l'exposition du schéma
   `isexy` sur le projet existant, sans toucher aux schémas
   `public` et `auth`. Si 401/403, inspecter la clé publiable
   et les grants RLS appropriés.
3. Remplacer les écritures Stripe non atomiques par une transaction
   vérifiée/idempotente et un chemin de reprise d'événement.
   Effectuer ensuite les tests d'achat fictifs en mode Stripe test.
4. Résoudre le déploiement backend automatisé, le Cron et le domaine
   Coolify avec les accès réellement autorisés; terminer les P0
   de `docs/TASK_QUEUE.md`.

---

## Relève additionnelle — 15 octobre 2026, corrections après le commit de statut

Dernier commit de code **avant le présent commit documentaire** :
`e05bcba8eb07177dcb8d930ca8f816e31ef2f4e6` sur `main`.
Relire toujours le SHA réel de `main`.

- `0978d574` a introduit `dist/release.json` et son contrôle SHA
  côté GitHub Actions; son run `38792318115` s'est terminé **SUCCESS**.
- `62ca7c10` : la bannière marketing 50 % non matérialisée dans Stripe
  a été retirée de `src/pages/Premium.tsx`; le bouton d'achat est
  désactivé lorsque le contrôle de paiements le bloque.
  CI `38792435198` : les validations build/DB ont réussi, mais
  le **smoke test a échoué** parce qu'un autre commit était déjà
  déployé. Ne pas présenter ce run comme entièrement vert.
- `470f9ee2` : le contrôle SHA sait maintenant reconnaître et ignorer
  explicitement un run remplacé par un nouveau commit sur `main`.
- `e05bcba8` : `src/pages/ContactUs.tsx` n'annonce plus
  faussement une confirmation email; seul `data.success=true`
  venant du service d'email prouve son envoi.
- Dernier statut des plateformes observé lors de cette mise à jour :
  Render `c0891259` **live**, `e05bcba8` encore en construction;
  GitHub Actions pour `e05bcba8` **en cours**. Ce ne sont pas
  des échecs certifiés ni des succès de la dernière version.
- Le backend Supabase V1 conserve les migrations `0001` à `0010`,
  les politiques tickets corrigées et les six fonctions Stripe en v2
  ACTIVE. Aucun nouveau projet Supabase payant créé.
- Blocages identiques : GitHub Actions saute la publication backend
  faute de secrets, Coolify/ISEXY.CA non prouvés, Cron/JWT non validé,
  Stripe live, Auth SMS et emails en recette réelle non testés.

**Prochaine action exacte** : vérifier les jobs CI du dernier `main`,
puis comparer Render `live` avec ce SHA et `/release.json`. En cas
d'échec de smoke test, lire le journal et distinguer un commit supplanté
d'un vrai retard de Render. Continuer ensuite la file P0
(`docs/TASK_QUEUE.md`) et ne déclarer la production prête
qu'après vérification réelle des fournisseurs et du domaine.

---

# Relève prioritaire du 15 octobre 2026 — tickets, Stripe et preuve de version

**Repository :** `takatakca/isexy`, branche `main`. Dernier commit applicatif poussé **avant** cette mise à jour documentaire : `470f9ee2a23a9fcee5378f501e5c412d064c7415`. Relire `main` pour retrouver le SHA du commit documentaire ajouté ensuite.

## Dernières tâches terminées

1. Migrations `0009_protect_support_ticket_staff_fields.sql` et `0010_support_ticket_rls_uses_verified_claims.sql`, appliquées uniquement au schéma `isexy` de TAKATAK V1. Empreintes enregistrées dans `isexy.schema_migrations` :
   - 0009 : `98c44df82118a09921c02acb7e65a7d923973a221a2bb68505a6d046ee5953fa`
   - 0010 : `98c6f7a1d6693e604a2c3f31d04565ba06f086c85f29d2e16ac2b6cc8a6589ee`
2. Le trigger `isexy_support_ticket_staff_fields_guard` est activé. Un membre authentifié peut enrichir son ticket, pas inventer une réponse ou changer son statut. Les politiques RLS ne demandent plus de SELECT direct sur `auth.users`.
3. `RestorePurchase.tsx` crée un ticket réellement stocké avec confirmation visible et référence de suivi, plutôt qu'un toast fictif.
4. Fonction partagée `_shared/stripe-customer.ts` : aucune réattribution d'un client Stripe déjà lié à un autre UID ISEXY. Six Edge Functions publiées **v2 ACTIVE**. `_shared/app-url.ts` forme les redirections depuis `ISEXY_APP_URL`, à défaut le domaine Render.
5. Suppression du faux compte à rebours 50 %; CTA Premium désactivé lorsque la passerelle paiement signale un blocage.
6. `release.json` public contient le SHA du build; CI vérifie le SHA servi et distingue les runs dépassés.

## Fichiers modifiés

- `supabase/isexy-migrations/0009_*.sql`, `0010_*.sql`
- `scripts/isexy/test/support-ticket-staff-fields.sql`
- `scripts/isexy/test/stripe-customer.test.ts`
- `src/pages/RestorePurchase.tsx`, `src/pages/Premium.tsx`
- `supabase/functions/_shared/stripe-customer.ts`, `app-url.ts`
- `supabase/functions/isexy-create-{checkout,credit-purchase,minute-purchase,one-time-payment}/index.ts`
- `scripts/generate-seo.mjs`, `.github/workflows/ci-cd.yml`
- `WORKLOG.md`, et les cinq fichiers de suivi `docs/`

## Vérifications exécutées

- GitHub : lecture des branches, commits, PR/issues, jobs et journaux d'erreur. Une première tentative CI a échoué parce qu'une politique ticket référençait `auth.users`. Correction dans migration 0010. Runs `38791730778`, `38791823170` et `38792318115` ensuite **SUCCESS**.
- PostgreSQL TAKATAK V1 : vérification du trigger activé, policies `pg_policies`, versions et checksums de migrations 0009–0010.
- Supabase Functions : après déploiement direct des six fonctions Stripe, toutes confirmées `ACTIVE` en version 2.
- Render : la release `0978d574` observée `live`, SHA ultérieur `470f9ee2` encore en cours de build à la dernière lecture.
- Attention : aucune réservation, paiement réel, appel ni profil client final n'a été exécuté.

## Tâche en cours et blocages

1. Confirmer que la plus récente CI `main` est verte ET que `release.json` annonce le SHA actif de Render.
2. **GitHub → Supabase toujours désactivé** : les secrets `ISEXY_DB_URL` et `SUPABASE_ACCESS_TOKEN` ne sont pas disponibles dans les jobs de déploiement, les étapes sont `skipped`. Ne pas prétendre que l'autodéploiement du backend est opérationnel.
3. Coolify, DNS/TLS et `https://isexy.ca` ne sont pas vérifiés. La cible ISEXY réelle n'est pas certifiée.
4. `isexy-reset-allowances` requiert un JWT d'accès à la Gateway **et** le secret Cron; aucun déclenchement planifié validé.
5. Intégrations d'identité TAKATAK Auth Google/SMS/email, Stripe test/live, téléphonie, IA, transfert d'achat réel et email support : recette à effectuer.
6. Fonctions `isexy-seed-profiles` et `isexy-subscription-resets` intentionnellement exclues des déploiements (risques documentés); 25 fonctions `isexy-*` actives.
7. Les données Cuba historiques restent intactes conformément aux décisions du propriétaire.

## Prochaine action exacte

1. Lire `main`, le dernier run `CI/CD` GitHub et la liste des déploiements Render. Vérifier `/release.json` du SHA le plus récent, y compris les éventuels échecs du smoke-test.
2. Faire la recette réelle des tickets (création et accès membre), des fonctions Stripe v2 avec compte TAKATAK uniquement SMS, sans enregistrer de paiement réel avant validation.
3. Fournir les accès/secrets manquants par canaux sécurisés et activer GitHub → Supabase puis Coolify/ISEXY.CA, et vérifier DNS/TLS et la version servie.
4. Continuer les P0 de `TASK_QUEUE.md`, puis consigner les commits, tests et déploiements dans cette relève.

---

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
