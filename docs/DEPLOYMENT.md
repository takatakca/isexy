## Déploiement vérifié — 16 octobre 2026 (référence courante)

- Run GitHub `38951304397` SUCCESS, Render `445fc829` LIVE.
- 12 migrations ISEXY appliquées sur Supabase V1; `0012`
  sha256 `b6efb8f9e9daa9c11868cf4102be0e8bbb846ec7bcd1faaced89f0460196d905`.
- Ordre respecté : CI (migration stand-in) → apply SQL sur `isexy`
  → vérifier grants et checksum → déployer `isexy-stripe-webhook`
  v6 ACTIVE; pas de mutation `public/auth`.
- `isexy-send-ticket-confirmation` v2 ACTIVE;
  `isexy-reset-allowances` v3 ACTIVE avec JWT requis.
- GitHub auto-déploiement Supabase encore désactivé faute de
  secrets disponibles, déploiements directs utilisés.
- Render est l'hébergement observé. Coolify, `isexy.ca`, DNS
  et TLS non vérifiés; pas de test commerce réellement facturé.

---

## Dernière vérification du 16 octobre 2026

- Render `dd06a77b` LIVE; GitHub CI du code `38950628292` en cours au dernier contrôle, runs 38949682815/38950001783/38950381063 success.
- Backend publié directement (sans secrets du pipeline) : `isexy-stripe-webhook` v4 ACTIVE (mapping sûr), `isexy-send-ticket-confirmation` v2 ACTIVE (auth propriétaire/staff), `isexy-reset-allowances` v3 ACTIVE (JWT), migration 0011 et 11 migrations au total.
- Webhook Stripe modifié dans `dd06a77b` **pas encore publié** au moment de cette note; attendre CI puis l'activer.
- GitHub Actions → Supabase et SSH toujours skipped; Coolify/ISEXY.CA, DNS/TLS non vérifiés.
- Réalité commerciale non prouvée : Stripe test checkout/webhooks, cartes, abonnements, email Resend, OTP et VOIP; ne pas déclarer production commerciale terminée.

---

## 16 octobre 2026 — migration 0011 et Cron (publication conditionnelle)

- Dernier commit de code vérifié avant cette note : `7778ede04ba8653ceb15352066a00f351d84d807`, branche `main`.
- La migration `0011_atomic_credit_checkout.sql` et `fulfill_stripe_credit_purchase` ajoutent une transaction atomique, protégée par session Stripe, pour les achats de crédits/minutes. **Non appliquées à Supabase** : CI initiale `38883496854` en échec sur la fixture SQL (`id` ambigu); test corrigé au commit `7778ede`, nouveau run `38884128241` à vérifier.
- En production, les migrations ISEXY appliquées restent `0001`–`0010`; le webhook Stripe publié reste **v2** (sans RPC 0011).
- Le workflow `.github/workflows/isexy-allowance-cron.yml` (commit `3a6b4188`) prévoit une exécution quotidienne à 04:13 UTC avec **JWT anon Supabase + secret Cron privé**, sans désactiver `verify_jwt`. Le handler modifié refuse GET et exige un secret d'au moins 16 caractères. Le handler actualisé n'est pas encore déployé; secret GitHub `ISEXY_CRON_SECRET` non vérifié, aucune exécution du Cron confirmée.
- CI verte confirmée : run `38883203014` (SHA `abb2b0bd`); Render observé `08b41aa6` live; les SHA ultérieurs et leur CI sont à revérifier.
- Blocages inchangés : secrets de déploiement GitHub → Supabase, Coolify/ISEXY.CA, Stripe sandbox et idempotence des autres produits, OTP, SMS, téléphonie et messagerie réels.


**Ordre impératif :** CI verte 0011 → appliquer SQL → vérifier permissions → déployer webhook mis à jour. Ne jamais déployer le nouveau webhook avec RPC absent. Cron : JWT Gateway maintenu et secret privé GitHub/Supabase apparié.

---

## Validation de publication — 16 octobre 2026

- Render autoDeploy sur `main` est confirmé. Le SHA
  `f6e6a029` a été observé `live`. La CI de cette
  version est à relire jusqu'à sa conclusion; les SHA
  `830c1062`, `5b9a6845` et `705cc269`
  ont terminé leur CI avec `success`.
- Publication manuelle directe Supabase TAKATAK V1 :
  `isexy-create-one-time-payment` ACTIVE **v3**,
  `isexy-stripe-webhook` ACTIVE **v2**,
  `isexy-payments-gate-status` ACTIVE **v2**.
  Pas de publication automatique GitHub du backend :
  `ISEXY_DB_URL` et `SUPABASE_ACCESS_TOKEN` toujours
  non disponibles dans les jobs GitHub.
- La nouvelle vérification REST `Accept-Profile: isexy`
  lors du smoke test GitHub complète le contrôle de
  `release.json`. Un grant au schéma seul ne prouve
  pas que le Data API est exposé au niveau PostgREST.
- URL de production `isexy.ca` et Coolify non prouvés.
  Ne pas reconfigurer DNS ni exposer les secrets sans
  validation réelle.
- Pas de test Stripe live ni de Cron opérationnel
  confirmé. Le rapprochement des événements échoués
  reste une action d'administration nécessaire.

---

## Suivi de déploiement — 15 octobre 2026, dernière mise à jour

Le build génère `release.json`. GitHub compare ce SHA avec le commit
attendu. Une exécution dépassée par un commit ultérieur est explicitement
notée et n'est plus un échec artificiel de déploiement.
`0978d574` a passé la CI; `62ca7c10` a échoué au seul test de SHA
parce qu'un nouveau commit avait déjà pris sa place sur Render.
Le correctif est dans `470f9ee2`.

À la dernière lecture, Render servait `c0891259`, `e05bcba8`
était encore en construction et sa CI en cours.
Ne jamais déclarer un SHA déployé avant statut `live`.

La publication des fonctions Stripe v2 sur TAKATAK V1 est confirmée
par connexion Supabase directe. Le job Github de déploiement
`ISEXY_DB_URL` / `SUPABASE_ACCESS_TOKEN` reste désactivé/faute de
secrets disponibles. Aucun déploiement Coolify ni domaine ISEXY.CA
n'est confirmé. Les contrôles OTP, paiement et mail doivent être
éprouvés avec les vrais fournisseurs.

---

## Contrôle des releases — 15 octobre 2026

Le build génère `dist/release.json` via `scripts/generate-seo.mjs` :
`commit` (SHA public) et `built_at` (ISO 8601). Les variables build
acceptées sont `RENDER_GIT_COMMIT`, `GITHUB_SHA` et `SOURCE_COMMIT`.
Le smoke test GitHub du site Render exige une correspondance de SHA;
un run dépassé par un commit plus récent est noté comme tel.

À la dernière vérification : `0978d574` était Render LIVE, tandis que
`470f9ee2` venait de partir vers Render/CI. Les six fonctions Stripe v2
ont été publiées **directement** sur Supabase. Cela ne corrige pas les
secrets GitHub indisponibles, et les étapes de publication automatique
Supabase restent `skipped`.

Migrations 0009–0010 de tickets appliquées directement à TAKATAK V1,
empreintes vérifiées. Aucun changement au schéma `public` V1.

---

## État du Cron — 15 octobre 2026

`isexy-reset-allowances` v2 renvoie HTTP 500 si une opération SQL
de maintenance échoue et demeure `verify_jwt=true`.
Son handler exige `x-cron-secret` (secret Edge `ISEXY_CRON_SECRET`).
La passerelle exige en plus un JWT utilisateur valide. Un simple secret
Cron ne suffit pas. **Aucun Cron opérationnel n'est confirmé**;
ne pas activer les tâches planifiées avant une configuration autorisée
et une vérification des deux couches d'authentification.
L'ancienne fonction `isexy-subscription-resets` reste non déployée
et exclue de GitHub Actions.

---

## Vérification du 15 octobre 2026

- Dernier commit Render confirmé live avant la présente mise à jour :
  `f889e931`. Les compilations GitHub `e353ede9` et `e12c3ade`
  ont réussi; la plus récente était encore en cours.
- Migrations `0007` et `0008` déjà appliquées à TAKATAK V1. Les RPC
  de réinitialisation et de nettoyage ne sont plus exposées aux comptes
  anonymes ou membres standard.
- Le job `isexy-reset-allowances` reste inaccessible au seul Cron secret
  lorsque l'Edge Gateway exige un JWT. Aucun Cron n'est déclaré opérationnel.
  `isexy-subscription-resets` demeure exclu des déploiements.
- Secrets et déploiement GitHub → Supabase non configurés ou indisponibles;
  Coolify/ISEXY.CA non vérifiés.

---

## Actualisation — 2026-10-14 18:18 UTC

La migration `0006_require_adult_profiles.sql` impose une date de naissance
correspondant à au moins 18 ans aux modifications et insertions de profils
ISEXY; elle est déjà appliquée à TAKATAK V1. Le test
`scripts/isexy/test/adult-profiles.sql` a été ajouté à GitHub Actions,
mais son exécution finale reste à revérifier. Le dernier commit Render
confirmé `live` est `b668f2cd`. La fonction d'achats mobiles
`isexy-verify-iap-receipt` v2 renvoie un code 501 tant qu'aucun système
Apple/Google de vérification des reçus n'est installé.

---

## État vérifié le 14 octobre 2026

- **Dépôt / branche** : `takatakca/isexy`, `main`. Dernier changement
  applicatif avant cette mise à jour documentaire : `75139c2018a2f02271303a6dca5663b99aa7f912`.
- **Render** : site statique `srv-db37s2s9v7es73b8g60g`, source `main`,
  déploiement automatique activé (`new_commit`), build `npm ci && npm run build`,
  publication `dist`, URL `https://isexy.onrender.com`. Le déploiement du
  commit `eabe0204ae385de7672e00d0b3af93893d523b74` a été observé
  `live`; **revérifier le dernier SHA après les nouveaux commits**.
- **Coolify / isexy.ca** : cibles documentées, mais état effectif **non
  vérifié**. Ne pas les annoncer en production sans comparaison du SHA,
  preuve de DNS/TLS et contrôle des routes profondes.
- **Supabase partagé** `pcjfahhlozsseqqevimi` : schéma `isexy` présent,
  69 tables, 68 tables applicatives sous RLS, les migrations 0001 à 0005
  enregistrées. La migration 0005 ajoute 12 index de relations; l'avis
  de clés étrangères sans index couvre encore 71 contraintes.
- **Edge Functions** : 25/27 `isexy-*` en état ACTIVE. Non déployées :
  `isexy-seed-profiles` (outil de données de démonstration, à laisser désactivé
  en production) et `isexy-subscription-resets` (maintenance programmée,
  publication bloquée en attente de vérification). `ACTIVE` ne garantit pas
  que les secrets fournisseurs sont configurés.
- **CI GitHub** : compilation, contrôle TypeScript, Deno, migrations sur banc
  PostgreSQL et règles de sécurité OK au dernier run complet consulté.
  **L'étape GitHub de publication Supabase est sautée** lorsque
  `ISEXY_DB_URL` et `SUPABASE_ACCESS_TOKEN` sont absents.
  L'étape SSH est optionnelle et également sautée si non configurée.
  La publication manuelle des 25 fonctions ne remplace pas ce paramétrage.
- **Vérification métier manquante** : OTP Google/SMS/email, inscription 18+,
  photo, découverte, match, messages temps réel, appels, concierge avec
  fournisseur, essais Stripe, webhooks, modération, désinscription et
  parcours de paiement. La base compte 0 profil au dernier contrôle.
- La description historique ci-dessous explique la configuration souhaitée,
  et peut contenir des instructions de première mise en service déjà effectuées.

Voir aussi : [PROJECT_STATUS](PROJECT_STATUS.md), [TASK_QUEUE](TASK_QUEUE.md)
et [AGENT_HANDOFF](AGENT_HANDOFF.md).

---

# ISEXY deployment

ISEXY runs on **TAKATAK V1** (Supabase `pcjfahhlozsseqqevimi`, `isexy` schema,
`isexy-*` edge functions) and is hosted on **Coolify** (coolify.takatak.ca, project ISEXY;
Nixpacks static site from `/dist`, configured by `nixpacks.toml`), with **Render**
(`https://isexy.onrender.com`) kept as a fallback for now.
First-time setup and every human step: [`V1-MIGRATION.md`](V1-MIGRATION.md).

`.github/workflows/ci-cd.yml` runs on every push and pull request:

| Stage | What happens | Turns on when |
| --- | --- | --- |
| **Verify** | `npm ci` → typecheck → `npm run build` (incl. SEO generation) → `deno check` of every `isexy-*` function → lint report | always |
| **ISEXY migrations on a V1 stand-in** | Postgres 16 + `scripts/isexy/test/v1-mock.sql` (Supabase roles, auth, storage, realtime, plus V1 lookalike objects in `public`) → `migrate.sh` dry run → `--apply` → re-run is a no-op; the guard fails the job if any V1 object changes | always |
| **V1 safety rules** | fails on `supabase/migrations/`, `supabase db push`, a bare `supabase functions deploy`, a function not named `isexy-*`, `public.*` in ISEXY migrations, or any Lovable dependency | always |
| **Deploy ISEXY to TAKATAK V1** | `migrate.sh` dry run on V1 → `migrate.sh --apply` (isexy schema only) → deploy each `isexy-*` function by name | push to `main`; migrations when `ISEXY_DB_URL` exists, functions when `SUPABASE_ACCESS_TOKEN` exists; waits for the `production` environment's reviewers |
| **Publish website** | Coolify (and Render, fallback) deploy `main` on their own. Optional: rsync `dist/` to an SSH host with an atomic swap | SSH part only when all `ISEXY_DEPLOY_*` secrets exist |
| **Smoke test** | `/`, `/auth`, `/discover`, `/knowledge-base`, `/faq` must return 200; warns if `isexy-*` functions are missing | push to `main` |

Stages without their secrets are skipped with a notice, so the pipeline stays
green and switches on as soon as you add them. **Never** run `supabase db push`
for ISEXY: V1's migration history belongs to `takatak-v1`.

## GitHub → Settings → Secrets and variables → Actions

### Secrets

| Name | Value |
| --- | --- |
| `ISEXY_DB_URL` | V1 session-pooler connection string (Connect → Session pooler, port 5432) with the database password |
| `SUPABASE_ACCESS_TOKEN` | Supabase personal access token of an account in the V1 organization |
| `VITE_TURN_CREDENTIAL` | *(recommended)* TURN password baked into the web build (use short-lived/limited credentials) |
| `ISEXY_DEPLOY_HOST` / `_PORT` / `_USER` / `_PATH` / `_SSH_KEY` / `_KNOWN_HOSTS` | *(optional)* extra SSH host to publish `dist/` to |

Function secrets (Stripe, Claude, Resend, Twilio, WhatsApp, VAPID, cron) are set
on V1 itself as `ISEXY_*` names, not in GitHub: see `V1-MIGRATION.md` › 3.6.

### Variables

| Name | Value |
| --- | --- |
| `ISEXY_SITE_URL` | Public URL (default `https://isexy.onrender.com`; later `https://isexy.ca`) |
| `SUPABASE_PROJECT_REF` | default `pcjfahhlozsseqqevimi` |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` | defaults: V1 URL and anon key |
| `VITE_GA4_ID` | *(optional)* Google Analytics 4 measurement ID |
| `VITE_META_PIXEL_ID` | *(optional)* Meta Pixel ID |
| `VITE_TURN_URL` | *(recommended)* comma-separated TURN URLs, e.g. `turn:turn.isexy.ca:3478?transport=udp,turns:turn.isexy.ca:5349?transport=tcp` — needed for calls on strict mobile NAT (Cuba); the older name `VITE_TURN_URLS` is still read |
| `VITE_TURN_USERNAME` | *(recommended)* TURN username |
| `VITE_STUN_URL` | *(optional)* comma-separated STUN URLs; default Google public STUN |
| `VITE_PHONE_LINE_NUMBER` | *(optional)* the Twilio number members call for the phone line by phone, as shown, e.g. `+1 514 555 0100`; without it the app hides the "Use the phone line by phone" card |
| `VITE_TURN_RELAY_ONLY` | *(optional, testing)* `true` sends every call through TURN (proves TURN works); leave unset in production |

Calls without TURN still connect on most home Wi-Fi, but two phones on mobile
data often never do. With TURN set, Phone Line calls (people who are not
matched) always go through TURN so neither side learns the other's IP
address. Details: `src/lib/iceServers.ts`.

## Database migrations by hand

```sh
ISEXY_DB_URL='postgresql://…' scripts/isexy/migrate.sh           # dry run, rolled back
ISEXY_DB_URL='postgresql://…' scripts/isexy/migrate.sh --apply   # apply
```

New migration: add `supabase/isexy-migrations/0003_<name>.sql`, schema-qualify
everything with `isexy.` and set `SET LOCAL search_path = isexy, extensions;` at
the top. Never edit a file that was already applied (checksummed).

## Static hosting notes

The app is a single-page app: the host must serve `index.html` for unknown paths.
Public pages also exist as `dist/<page>/index.html` with pre-rendered meta tags.
On Coolify see `V1-MIGRATION.md` › 3.9. On an Apache host (if ever used again) add to the web root `.htaccess`:

```apache
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]

<IfModule mod_headers.c>
  Header always set X-Content-Type-Options "nosniff"
  Header always set Referrer-Policy "strict-origin-when-cross-origin"
  Header always set Permissions-Policy "camera=(self), microphone=(self), geolocation=(self)"
  <FilesMatch "\.(js|css|woff2?|png|svg)$">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </FilesMatch>
</IfModule>
```

## Rollback

Releases live in `<ISEXY_DEPLOY_PATH>.releases/<sha>`. Point the symlink back:

```sh
ln -sfn <path>.releases/<previous-sha> <path>.next && mv -Tf <path>.next <path>
```

Website: Coolify → ISEXY → Deployments → redeploy a previous one (Render fallback: Deploys → *Rollback*).

Database migrations are forward-only: fix forward with a new
`supabase/isexy-migrations/000N_*.sql`. Removing ISEXY entirely is described in
`docs/V1-MIGRATION.md` › Rollback.
