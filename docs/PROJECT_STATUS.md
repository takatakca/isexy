# ISEXY — État réel du projet

## Dernier état vérifié — 16 octobre 2026 (plus récent que les notes historiques ci-dessous)

- **Dernier SHA de code avant le présent commit documentaire :** `445fc8295b15cb581eb31d599f9a41bd7dcbe397` sur `main`.
- **GitHub Actions :** run `38951304397` **SUCCESS** (TypeScript, build, Deno, migrations PostgreSQL stand-in, sécurité V1, smoke test). Render a confirmé le même SHA **LIVE**.
- **Supabase TAKATAK V1** `pcjfahhlozsseqqevimi` : **12 migrations ISEXY (0001–0012)** appliquées dans `isexy`. La migration `0012_atomic_boost_checkout` est enregistrée avec SHA256 `b6efb8f9e9daa9c11868cf4102be0e8bbb846ec7bcd1faaced89f0460196d905`; index unique de sessions Stripe créé.
- **RPC des boosts :** `isexy.fulfill_stripe_boost_purchase(uuid,text,text)` ne peut être exécuté que par `service_role` (anon=false, authenticated=false). Les soldes Boosts, Super Likes, Primetime et Super Boosts et leurs mouvements sont écrits dans la même transaction; rejouer une même session ne la crédite pas deux fois. Aucun achat réel existant n'a été modifié (`boost_transactions=0` lors de la vérification).
- **Webhook Stripe :** `isexy-stripe-webhook` **v6 ACTIVE**, déployé après la migration et la CI. Le webhook hérite des protections précédentes (identité TAKATAK vérifiée, crédit/minutes atomiques, Premium actif uniquement si Stripe confirme le statut, retour d'erreur si écriture métier échoue).
- **Autres fonctions :** `isexy-send-ticket-confirmation` v2 ACTIVE avec contrôle propriétaire/staff, `isexy-reset-allowances` v3 ACTIVE, JWT vérifié. Deux fonctions restent volontairement exclues (seed de faux membres, réinitialisation d'abonnement non auditée).
- **Blocages de finalisation :** GitHub Actions saute encore les étapes de publication backend faute de `ISEXY_DB_URL` et `SUPABASE_ACCESS_TOKEN`; aucun Cron quotidien HTTP 200 confirmé (`ISEXY_CRON_SECRET` GitHub non vérifié); Coolify / `isexy.ca`, SSL et DNS non vérifiés; paiements Stripe sandbox, cadeaux/dons/recharges, notifications Resend, OAuth/OTP/VOIP et véritable vérification d'âge à tester. **Le produit n'est pas terminé à 100 %.**
- L'ensemble des données Cuba est conservé; aucune création de projet Supabase facturable ni modification du schéma `public/auth`.

---


## Vérification prioritaire — 16 octobre 2026 (relève courante)

- Dernier SHA de code `dd06a77ba9616c46670287614fba7310ce505d63` sur `main` **avant** le présent commit documentaire. Render `dd06a77b` observé `live`, mais CI du SHA `38950628292` encore en cours à la dernière vérification.
- CI confirmées `38949682815` (SHA `1d2d5e77`, success), `38950001783` (SHA `a2bb95b1`, success), `38950381063` (SHA `9fa72736`, success).
- Supabase TAKATAK V1 `pcjfahhlozsseqqevimi` : 11 migrations ISEXY (0001–0011) appliquées, crédit/minute transactionnel service-role-only; pas de modification des identités ni du schéma `public`.
- `isexy-stripe-webhook` **ACTIVE v4** : identification exclusive par `user_id` de session Stripe issue du serveur, vérification du profil et de l'identifiant propriétaire du client Stripe. **Plus aucune attribution par email**; anciennes sessions sans identité vérifiable nécessitent rapprochement manuel.
- `isexy-send-ticket-confirmation` **ACTIVE v2** : ticket propriétaire ou staff uniquement, pas d'envoi déclenchable anonymement par numéro de ticket. Pour un ticket créé anonymement, la confirmation email directe peut ne pas être envoyée; le ticket demeure enregistré et traçable.
- `9fa72736` : aucune promotion Premium pour statut Stripe `incomplete`, `past_due`, `unpaid`, `canceled`; seul `active`/`trialing` permet l'attribution. `dd06a77b` : retour d'erreur sur échec d'enregistrement ou de synchronisation des droits et vérification du statut payé pour abonnement chat. **Ces deux corrections récentes de webhook ne sont pas encore publiées sur Supabase**; v4 reste stable jusqu'à CI du dernier commit.
- Hébergement : Render disponible et publie `main`; `isexy.ca` / Coolify / DNS / TLS non vérifiés. GitHub → Supabase continue d'ignorer les étapes qui nécessitent `ISEXY_DB_URL` et `SUPABASE_ACCESS_TOKEN`. Cron v3 avec JWT+secret existe, mais job effectif non prouvé.
- Pas de paiement réel, d'appel ni de message sortant à un vrai client effectué. Le statut 100 % reste **NON atteint**.

---


## 16 octobre 2026 — migration 0011 et Cron (publication conditionnelle)

- Dernier commit de code vérifié avant cette note : `7778ede04ba8653ceb15352066a00f351d84d807`, branche `main`.
- La migration `0011_atomic_credit_checkout.sql` et `fulfill_stripe_credit_purchase` ajoutent une transaction atomique, protégée par session Stripe, pour les achats de crédits/minutes. **Non appliquées à Supabase** : CI initiale `38883496854` en échec sur la fixture SQL (`id` ambigu); test corrigé au commit `7778ede`, nouveau run `38884128241` à vérifier.
- En production, les migrations ISEXY appliquées restent `0001`–`0010`; le webhook Stripe publié reste **v2** (sans RPC 0011).
- Le workflow `.github/workflows/isexy-allowance-cron.yml` (commit `3a6b4188`) prévoit une exécution quotidienne à 04:13 UTC avec **JWT anon Supabase + secret Cron privé**, sans désactiver `verify_jwt`. Le handler modifié refuse GET et exige un secret d'au moins 16 caractères. Le handler actualisé n'est pas encore déployé; secret GitHub `ISEXY_CRON_SECRET` non vérifié, aucune exécution du Cron confirmée.
- CI verte confirmée : run `38883203014` (SHA `abb2b0bd`); Render observé `08b41aa6` live; les SHA ultérieurs et leur CI sont à revérifier.
- Blocages inchangés : secrets de déploiement GitHub → Supabase, Coolify/ISEXY.CA, Stripe sandbox et idempotence des autres produits, OTP, SMS, téléphonie et messagerie réels.


## Point de reprise — 16 octobre 2026

- Source de vérité : `takatakca/isexy` `main`, **dernier commit applicatif** avant la présente documentation : `f6e6a0297cc8936246ced9ab922f52b697a342b3`.
- CI confirmées : `830c1062` run `38882342512` SUCCESS;
  `5b9a6845` run `38882538662` SUCCESS;
  `705cc269` run `38882680228` SUCCESS.
  La CI `f6e6a029` était encore en cours à la dernière vérification.
- Render : `f6e6a029` observé **live**; la CI SHA de cette version doit être consultée jusqu'au résultat définitif.
- Paiements :
  - `_shared/checkout-metadata.ts` autorise seulement les champs de destination nécessaires aux cadeaux et aides Cuba; jamais `profile_id`, `user_id`, `product_id` ni `package_id` injectés par le client;
  - `isexy-create-one-time-payment` a été déployée ACTIVE v3 directement à Supabase;
  - `isexy-stripe-webhook` ACTIVE v2 : un paiement unique non soldé ne crédite pas les avantages; événements `async_payment_succeeded` gérés; un événement en échec ou en cours n'est plus acquitté comme terminé;
  - `isexy-payments-gate-status` ACTIVE v2 : clé de paiement manquante ou invalide ne permet pas la vente, même avec flag live; le navigateur bloque le checkout tant que le statut n'est pas connu et n'ouvre que `checkout.stripe.com`.
- Data API : la base confirme les privilèges USAGE au schéma `isexy` pour `anon` et `authenticated`, et SELECT pour `ticket_categories`. Nouveau smoke test GitHub vérifie une réponse REST HTTP 200 avec `Accept-Profile: isexy`, résultat encore à collecter.
- Garde-fous inchangés : 10 migrations ISEXY appliquées; identités TAKATAK centrales; aucun ajout de projet Supabase facturable, aucun profil synthétique ni suppression Cuba.
- Points P0 non résolus : validation réelle des traitements de paiement et du webhook de bout en bout (écritures de crédits et rejeu partiel non atomiques), secrets GitHub `ISEXY_DB_URL` / `SUPABASE_ACCESS_TOKEN` (étapes de publication Supabase sautées), authentification Cron JWT + secret, Coolify / `isexy.ca` DNS et TLS, OAuth/OTP/Twilio/resend en conditions réelles.

---


**Complément du 15 octobre 2026 :** la bannière artificielle de réduction 50 % a été retirée; le bouton Premium suit le verrou de paiement. La confirmation courriel des tickets n'est annoncée que sur réponse fournisseur positive. Les runs CI intermédiaires peuvent échouer au contrôle de SHA lorsqu'un autre commit les a déjà remplacés; `470f9ee2` distingue ces cas. Le dernier SHA applicatif avant cette note est `e05bcba8`, CI et Render encore à vérifier. Voir `AGENT_HANDOFF.md`.

## Sécurité, paiements et publication — 15 octobre 2026

- **Dernier commit applicatif avant cette documentation** : `470f9ee2a23a9fcee5378f501e5c412d064c7415` sur `main`.
- **Tests CI confirmés** : `99c1ea05` (run `38791823170`) et `0978d574` (run `38792318115`) SUCCESS, incluant les tests de tickets et d'appartenance Stripe. Les commits postérieurs étaient en file à la dernière vérification; reconsulter GitHub pour la conclusion définitive.
- **Render confirmé live** : `0978d574` au dernier relevé; le nouveau SHA `470f9ee2` était encore en construction. AutoDeploy depuis `main` est actif.
- **Supabase TAKATAK V1** `pcjfahhlozsseqqevimi` : migrations ISEXY **0001–0010** enregistrées avec checksum; déclencheur de protection des champs de tickets activé; politiques SELECT/UPDATE basées sur claims Auth plutôt que la lecture interdite d'`auth.users`. Les tests SQL CI passent.
- **Stripe** : six Edge Functions (`isexy-create-checkout`, `isexy-create-credit-purchase`, `isexy-create-minute-purchase`, `isexy-create-one-time-payment`, `isexy-check-subscription`, `isexy-customer-portal`) sont en **version 2 ACTIVE**, déployées directement. Elles partagent le correctif de propriété des clients Stripe; les créations acceptent un membre identifié par son UID même si son email est absent; les URL de retour sont construites depuis l'URL serveur, non `Origin`.
- **Restauration d'achat** : `src/pages/RestorePurchase.tsx` enregistre réellement un ticket relié à un utilisateur authentifié, avec numéro et suivi; aucune restauration ni attribution d'abonnement n'est prétendue sans vérification.
- **Tarifs promotionnels** : bannière 50 % / compte à rebours retirée de `Premium.tsx` : aucune réduction serveur correspondante n'était appliquée. Le bouton respecte le verrouillage `usePaymentsGate`.
- **Preuve de release** : `scripts/generate-seo.mjs` écrit `dist/release.json` avec SHA issu du build (Render, GitHub ou source); le smoke test GitHub compare le SHA, et ignore explicitement les anciennes exécutions supplantées par un commit plus récent.
- **Non vérifié / humain** : Coolify/ISEXY.CA (version et TLS), secrets `ISEXY_DB_URL` et `SUPABASE_ACCESS_TOKEN` GitHub, planificateur Cron à JWT + secret, authentification réelle Google/SMS, Stripe en test de bout en bout, Twilio et IA, RLS via client public sur site. La CI verte n'implique toujours pas la publication automatique Supabase, car ce job saute ses étapes lorsqu'aucun secret n'est disponible.
- **État** : produit **non certifié 100 %**, malgré corrections publiées.

---


**Mise à jour 2026-10-15 :** correctif `59496103` sur les erreurs de maintenance des allocations, Edge Function `isexy-reset-allowances` v2 ACTIVE et `verify_jwt=true`. Le planificateur Cron reste non vérifié. La dernière CI validée avant ce correctif était `731a6e2e` (SUCCESS), Render `731a6e2e` LIVE.

## Revue du 15 octobre 2026 (état plus récent que les notes historiques ci-dessous)

- `main` : `f889e93111a5821dacd5c9a75b59cbad324d5127` avant cette mise à jour documentaire.
- Render `srv-db37s2s9v7es73b8g60g` : SHA `f889e931` confirmé **live**.
  GitHub Actions sur ce SHA était **en cours**; `e353ede9` et
  `e12c3ade` avaient leurs runs CI **success**.
- Supabase TAKATAK V1 `pcjfahhlozsseqqevimi` : huit migrations ISEXY
  0001–0008 appliquées, 69 tables, 25/27 Edge Functions `isexy-*` actives.
- Correctifs : `6140d541` bloque les profils Cuba à date de naissance
  inventée et exclut deux fonctions à risque du déploiement automatique;
  `e12c3ade` empêche la soumission de pièces justificatives non chargées;
  `e353ede9` restreint les RPC de réinitialisation et rend l'octroi mensuel
  conditionnel à la date prévue; `f889e931` ferme les RPC de maintenance et
  contrôle le rôle dans le listing administratif.
- Permissions vérifiées dans PostgreSQL : anon et authenticated ne peuvent
  pas appeler les RPC de maintenance ni réinitialiser globalement les quotas;
  seuls les membres autorisés de l'équipe obtiennent des résultats de
  `get_admin_users`. Aucun nouvel avertissement ciblant le schéma ISEXY
  dans l'analyse de sécurité Supabase consultée.
- Bloquant : `isexy-reset-allowances` reste déployée avec
  `verify_jwt=true` et attend `x-cron-secret`. Un Cron utilisant uniquement
  ce secret peut donc échouer avant l'exécution. Le correctif de configuration
  tenté n'a **pas été appliqué** : opération bloquée par les vérifications de
  sécurité du connecteur. Ne pas dire que la maintenance Cron est active.
- GitHub → Supabase : secrets de déploiement absents/non disponibles dans
  le job; publication SQL/fonctions depuis GitHub reste **skipped**.
  Coolify, `isexy.ca` (DNS et TLS), clés Stripe/Twilio/Claude et achats réels
  ne sont pas validés.
- Aucune suppression des parcours Cuba ni activation de profils de
  démonstration.

---


Dernière revue : 2026-10-14, dépôt `takatakca/isexy`, branche `main`.

## Objectif produit

Réseau social canadien 18+ (FR/EN), rencontres amicales, découverte, chat
traduit, appels audio/vidéo, PhoneLine, support et abonnements.
ISEXY garde son interface propre. TAKATAK V1 fournit l'identité partagée;
les données de l'application restent dans le schéma `isexy` avec RLS.
Les fonctions et services liés à Cuba restent en place sur décision du
propriétaire : **aucune suppression Cuba autorisée**.

## Éléments démontrés

| Couche | Vérification | Statut |
| --- | --- | --- |
| GitHub | `main`, écriture possible, aucune PR / issue ouverte lors du relevé | Confirmé |
| CI | Run complet `38612389598` sur `eabe0204` réussi; run `38612705942` de la migration 0005 démarré | CI connue verte avant 0005; revérifier |
| Render | Service statique `isexy`, `main`, déploiement automatique, un SHA observé `live` | Confirmé pour `eabe0204` |
| Coolify / `isexy.ca` | Hôte cible décrit par `docs/V1-MIGRATION.md`, pas de preuve de SHA ni DNS/TLS | Non vérifié |
| TAKATAK V1 | `pcjfahhlozsseqqevimi`, 69 tables ISEXY, 68 sous RLS | Confirmé |
| Migrations | 0001–0008 enregistrées; empreintes 0004 et 0005 contrôlées | Appliquées |
| Edge Functions | 25 noms `isexy-*` ACTIVE sur 27 | Partiel |
| Fournisseurs | Stripe, Anthropic, Twilio/WhatsApp, mail, TURN : secrets et scénarios non vérifiés | Non certifié |
| Comptes | 0 lignes dans `isexy.profiles` au contrôle | Pas de recette réelle |

## Correctifs de cette reprise

- `d713375` : authentification SMS sans courriel pour la facturation,
  URL de retour du portail Stripe contrôlée côté serveur.
- `f54b35f` : migration 0004, recherche SQL figée; l'avertissement
  `isexy.normalize_gender` a disparu des recommandations sécurité.
- `75139c2` : migration 0005, index pour messagerie, blocage, groupes,
  support et voix; alertes d'index FK de 82 à 71 après application.

## Définition de « terminé »

Ne pas compter une CI verte comme preuve que les Edge Functions se sont
publiées : les étapes de publication peuvent être sautées. Pour déclarer le
site terminé, obtenir au minimum la version active des deux hébergeurs,
le domaine de production et SSL, l'accès API au schéma, les secrets
fournisseurs, une recette 18+/sécurité et les paiements testés puis validés.

Voir `TASK_QUEUE.md` pour les prochaines actions classées.

## Nouveaux correctifs de sécurité et d'expérience (14 octobre)

- Commit `6c90acc9` : `MySubscription` indique une erreur récupérable lorsque
  Stripe est indisponible, au lieu d'afficher faussement un forfait gratuit.
- Commit `e0f9a445` : migration `0006_require_adult_profiles.sql`
  enregistrée et appliquée, contrôle côté PostgreSQL de 18 ans minimum pour
  insertion et modification de `birth_date`, test ajouté dans CI.
  Cette mesure contrôle l'âge **déclaré**, pas l'identité réelle.
- Commit `b668f2cd` : vérification Apple/Google inachevée maintenant en
  échec explicite HTTP 501, fonction IAP version 2 active; aucun abonnement
  n'est accordé sur des justificatifs non vérifiés.
- Render : commit `b668f2cdd3678af80950465027c3a918d5f38932`
  confirmé `live` le 14 octobre à 18:18 UTC.
- **CI récente** : `75139c2` vert, les runs plus récents peuvent être
  annulés ou en attente dans la file GitHub. Revérifier la CI du SHA final.
