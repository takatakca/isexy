# ISEXY ads: owner guide

Free members see small, labelled banners; **anyone who pays for anything sees
no ads**. Each ad space asks, in this order:

1. **TAKATAK ads** (your ad server on takatak.ca);
2. **Google AdSense**, only once `VITE_ADSENSE_CLIENT` and that space's
   `VITE_ADSENSE_SLOT_*` are set;
3. the house banner "Go ad-free with ISEXY Plus" (links to `/premium`).

Nothing is required to ship: with no setting at all, free members see the
house banner (or a TAKATAK ad once the publisher below exists) and the site
never loads anything from Google.

Code: `src/lib/ads.ts` (spaces, pages, order, TAKATAK and AdSense calls),
`src/components/AdSlot.tsx` (the banner), `src/hooks/useAdFree.ts` (asks the
server), `supabase/isexy-migrations/0016_ads.sql` (`isexy.get_my_ad_status()`,
who is ad-free), `vite.config.ts` (`ads.txt` and the AdSense verification tag),
the Advertising sections of `/privacy` and `/cookie-policy`
(`src/components/AdvertisingPolicy.tsx`, EN + FR) and the "Advertising" choice
of the cookie banner (`src/lib/consent.ts`).

Contents: [Who sees ads](#who-sees-ads) · [Ad spaces](#ad-spaces) ·
[TAKATAK side](#takatak-side) · [AdSense side](#adsense-side) ·
[Consent](#consent-and-privacy) · [Content-Security-Policy](#content-security-policy) ·
[How to test](#how-to-test)

## Who sees ads

The server decides (`isexy.get_my_ad_status()`, 0016); the browser only shows
what it answers, and shows nothing while it waits or when it cannot ask (for
example before 0016 is applied): paying members never see an ad flash.

| Member | Ads? | `reason` |
|---|---|---|
| Staff (`user_roles` admin or moderator) | no | `staff` |
| Any active plan: Plus, Gold, Platinum, from Stripe (active or trialing, 1 day of grace after the period end), a redeemed code, a loyalty reward, a staff grant, or the plan on the profile | no | `plan` |
| Active chat subscription | no | `chat_subscription` |
| **Any successful payment in the last 30 days**: credits, call minutes, Super Likes, Boosts, a gift sent, a donation, or a Stripe plan period that started in that window (a plan cancelled after one paid week keeps ads away for the rest of the 30 days) | no | `recent_payment` |
| Everyone else (bonus credits, the monthly free Boost and gifts received are not payments) | yes | `free` |
| Signed-out visitors | only on public content pages (FAQ, Safety Tips, Help, Help Centre, About, News, Community Stories) | — |

The answer is cached 5 minutes per member; coming back from a Stripe checkout
re-reads it at once (`useCheckoutReturn`), so ads disappear right after a
purchase.

**Changing the 30 days** (all together, then re-run the tests below):

1. SQL: `c_ad_free_after_payment` in `get_my_ad_status()`. While 0016 is not
   applied on V1, edit `0016_ads.sql`; once it is applied, **never edit it**:
   add a new migration (`0017_…sql`) with the same `CREATE OR REPLACE FUNCTION
   isexy.get_my_ad_status()` and the new interval.
2. Pages: `AD_FREE_DAYS_AFTER_PAYMENT` in `src/lib/ads.ts` (the Premium page
   note and the Privacy / Cookie policy text read it).
3. Tests: the "40 days ago" / "45 days ago" members of
   `scripts/isexy/test/ads-smoke.sql`; `e2e/ads-e2e.mjs` L9 checks that the SQL
   and the page constant agree.

## Ad spaces

These codes are what the app sends as `placementCode` (TAKATAK) and the
`VITE_ADSENSE_SLOT_*` suffix (AdSense). Every slot reserves its height before
anything loads (no layout shift).

| Code | Pages | Shape (slot / AdSense unit height) | AdSense variable | Visitors |
|---|---|---|---|---|
| `isexy-discover-banner` | `/discover`, a slim strip above the bottom nav | slim, 72 / 50 px | `VITE_ADSENSE_SLOT_DISCOVER` | no |
| `isexy-list-banner` | `/matches` (Messages), `/matches-list`, `/likes`, `/who-liked-you`: after the 3rd row (top of a shorter list) | banner, 120 / 100 px | `VITE_ADSENSE_SLOT_LIST` | no |
| `isexy-feed-inline` | `/explore`, `/news`, `/community-stories`: one card every 6 items | card, 300 / 250 px | `VITE_ADSENSE_SLOT_FEED` | yes (News, Stories) |
| `isexy-profile-banner` | `/profile`, `/settings`, at the bottom | banner, 120 / 100 px | `VITE_ADSENSE_SLOT_PROFILE` | no |
| `isexy-content-inline` | `/faq`, `/safety-tips`, `/help-support`, `/about`, `/knowledge-base` | card, 300 / 250 px | `VITE_ADSENSE_SLOT_CONTENT` | yes |

Never an ad on: chats and group chats, calls and the Phone Line, Premium /
plans / every purchase and checkout page, Loyalty, My Stars, sign-in,
onboarding and profile setup, staff and support pages, legal pages, the 404
page (`AD_FREE_ROUTES` in `src/lib/ads.ts`, checked before any space).

## TAKATAK side

Contract (takatak-v1 `src/app/api/ads/*`): the browser POSTs
`{publisherCode, placementCode, context}` to `{VITE_TAKATAK_ADS_URL}/api/ads/serve`
(default `https://takatak.ca`), shows the answer as text (never HTML), sends
`impression` to `/api/ads/events` after the ad was half visible for 1 second
(once), and a tap opens the ad's `clickUrl` (`/api/ads/click`, which records
the click and redirects with `ttclid`) in a new tab.

**1. Create the publisher `isexy` and its 5 placements.** TAKATAK has no
publisher screen yet; do it the way `scripts/seed-ahmv-ads-publisher.ts` does
for AHMV (copy it to `scripts/seed-isexy-ads-publisher.ts`, run it with
`npx tsx` and TAKATAK's `DATABASE_URL`):

```ts
const PUBLISHER_CODE = "isexy";
const publisher = {
  name: "ISEXY", domain: "isexy.ca", category: "social", country: "Canada",
  // Leave region/city empty: they are the targeting fallback for members who did
  // not accept personalized ads (a city here would match all of them).
  region: null, city: null,
  allowedOrigins: ["https://isexy.ca", "https://www.isexy.ca", "https://isexy.onrender.com"],
  status: "active",
};
const PLACEMENTS = [
  { code: "isexy-discover-banner", name: "ISEXY Discover — slim banner", pagePattern: "/discover", format: "banner", width: 320, height: 50 },
  { code: "isexy-list-banner", name: "ISEXY Matches / Messages / Likes — banner", pagePattern: "/matches*", format: "banner", width: 320, height: 100 },
  { code: "isexy-feed-inline", name: "ISEXY Explore / News / Stories — inline card", pagePattern: "/explore*", format: "card", width: 300, height: 250 },
  { code: "isexy-profile-banner", name: "ISEXY Profile / Settings — banner", pagePattern: "/profile", format: "banner", width: 320, height: 100 },
  { code: "isexy-content-inline", name: "ISEXY FAQ / Help / About — inline card", pagePattern: "/faq", format: "card", width: 300, height: 250 },
];
```

- `allowedOrigins`: TAKATAK answers "no ad" to any other origin (a local test
  build on `127.0.0.1` gets no ad: that is expected). Add a domain here before
  serving ISEXY from it.
- `category` replaces the `category: "social"` the app sends: campaigns that
  target categories must list `social`.
- The codes must match exactly; a placement that is missing or not `active`
  answers "no ad" and the slot moves on to AdSense / the house banner.

**2. Link campaigns.** A campaign is served on ISEXY when it is `active`,
inside its dates, has budget left, its advertiser's TAKATAK ADS subscription is
paid and includes the campaign's scope, and it has an `active` creative with an
http(s) destination:

- **TAKATAK ADS Direct** (`single_site`): must list the ISEXY placement ids
  (`placementIds` when creating the campaign in TAKATAK's Ads workspace /
  `POST /api/ads/campaigns`). Pick the placements where it should run.
- **Local network** / **Max Lead Pro**: eligible on every active placement of
  every publisher, ISEXY included, without linking.
- Targeting the app can satisfy: `locales` `en` / `fr`; `devices` `mobile` /
  `tablet` / `desktop`; `categories` `social`; `countries` / `cities` match the
  member's profile only for members who accepted personalized ads (otherwise
  TAKATAK uses the publisher's country, `Canada`). Region and postal prefix
  are never sent.
- Creatives: headline (shown up to 90 characters), body (140), call to action
  (24), optional https image. Content must suit an 18+ **friendship / social**
  audience: nothing sexual, no dating or hook-up offers, nothing illegal in
  Canada.

**3. Tracking.** Impressions and clicks are recorded only when TAKATAK has
`ADS_EVENT_SIGNING_SECRET` (32+ characters) set; without it ads still show,
with a direct link and no counting.

## AdSense side

1. **Apply** at adsense.google.com with the site `isexy.ca` (the Render
   fallback `isexy.onrender.com` cannot be added to AdSense: there, ads come
   from TAKATAK or the house banner only).
2. **Set `VITE_ADSENSE_CLIENT=ca-pub-…`** (the publisher id `pub-…` shown in
   AdSense → Account → Settings → Account information, with `ca-` in front) in the **Coolify build environment**
   (ISEXY → Environment Variables, "Build variable" ticked) and Render's
   environment, then redeploy. The build then writes
   `<meta name="google-adsense-account" content="ca-pub-…">` into every page
   and `https://isexy.ca/ads.txt`
   (`google.com, pub-…, DIRECT, f08c47fec0942fa0`). Check both URLs, then in
   AdSense → Sites → isexy.ca choose the **meta tag** (or ads.txt)
   verification and **request review**. Until a slot id is set the app loads
   nothing from Google, so the review sees no ad code: that is fine with the
   meta tag method.
3. **Keep Auto ads OFF** (AdSense → Ads → By site → isexy.ca), and anchor /
   vignette formats too: once the AdSense script has loaded, Auto ads would
   place ads on chat, checkout and legal pages, which the app keeps ad-free.
4. **After approval**, create one **display ad unit** per space (AdSense →
   Ads → By ad unit → Display ads, "Responsive"), named like the codes:
   `isexy-discover-banner` (horizontal), `isexy-list-banner` (horizontal),
   `isexy-feed-inline` (square), `isexy-profile-banner` (horizontal),
   `isexy-content-inline` (square). From each unit's code copy the
   `data-ad-slot` number into `VITE_ADSENSE_SLOT_DISCOVER`, `_LIST`, `_FEED`,
   `_PROFILE`, `_CONTENT` (same place as step 2) and redeploy. A space whose
   variable is empty never asks AdSense. You may start without
   `VITE_ADSENSE_SLOT_DISCOVER`: that strip sits just above the bottom nav, and
   Google is strict about ads near navigation (accidental clicks).
5. **Privacy & messaging** (AdSense → Privacy & messaging): create the
   **European regulations** consent message (Google requires a certified
   consent tool for visitors from the EEA, the UK and Switzerland, otherwise
   it serves them limited ads only) and publish it for isexy.ca. If the
   account offers a message type that can target **Canada** (Google adds
   regions over time), publish it for Canada too, in English and French.
   ISEXY's own banner stays the reference for Quebec's Law 25: without the
   "Advertising" choice the app asks Google for non-personalized ads only
   (`requestNonPersonalizedAds = 1`), whatever Google's message says.
6. **Policy notes** (AdSense Program policies / Google Publisher Policies):
   - No sexual content anywhere ads can show: member photos, bios, Explore
     posts and stories must stay moderated (no nudity, no sexual
     solicitation); ISEXY is positioned as an 18+ **friendship / social**
     network, so keep that wording on pages with ads. Before applying, replace
     `public/og-image.png` ("Premium dating between Canada & Cuba",
     HANDOFF Left #29).
   - No ads on pages without content or on sign-in / checkout / thank-you
     pages: already enforced by `AD_FREE_ROUTES`.
   - Label: the app writes "Advertisements" / "Publicités" above every Google
     unit (Google's allowed wording). Never ask members to click ads and never
     click your own ads (test with the e2e stub below, or look without
     clicking).
   - The Privacy Policy already has the required disclosure (Google's cookies,
     https://policies.google.com/technologies/partner-sites, opting out at
     https://adssettings.google.com), section 12, EN + FR.

## Consent and privacy

- The cookie banner and `/cookie-policy` have an **Advertising** choice (off
  by default; never pre-selected for Global Privacy Control / Do Not Track
  visitors; choices saved before it existed read as off).
- **Off**: AdSense gets `requestNonPersonalizedAds = 1` before its script runs
  (and again whenever the choice changes); TAKATAK gets only the space,
  language, device type and the category.
- **On**: personalized AdSense, and TAKATAK also gets the city and country on
  the member's profile. Never a name, email, phone, profile id, photo or
  message. TAKATAK requests carry no cookies (`credentials: "omit"`).
- Whether a member is ad-free is computed on the server from their own plan
  and purchase rows; it is never sent to TAKATAK or Google.

## Content-Security-Policy

ISEXY sets **no** Content-Security-Policy today (checked: `index.html`,
`vercel.json`, `nixpacks.toml`, the Apache example in `DEPLOYMENT.md`, Coolify
settings in `V1-MIGRATION.md` 3.9), so nothing needs changing. If one is ever
added, it must allow at least:

| Directive | Hosts |
|---|---|
| `script-src` | `https://pagead2.googlesyndication.com` `https://tpc.googlesyndication.com` `https://adservice.google.com` `https://fundingchoicesmessages.google.com` |
| `frame-src` | `https://googleads.g.doubleclick.net` `https://tpc.googlesyndication.com` `https://www.google.com` `https://fundingchoicesmessages.google.com` |
| `connect-src` | the TAKATAK origin (`https://takatak.ca` or `VITE_TAKATAK_ADS_URL`) `https://pagead2.googlesyndication.com` `https://adservice.google.com` `https://fundingchoicesmessages.google.com` |
| `img-src` | `https:` (TAKATAK creatives are hosted by advertisers; Google images come from several hosts) |

## How to test

Locally, on a mocked backend (nothing reaches TAKATAK, Google or V1):

```bash
# SQL (throwaway Postgres 16 with v1-mock + every migration applied, as CI):
printf 'BEGIN;\n\\i scripts/isexy/test/ads-smoke.sql\nROLLBACK;\n' | psql "$ISEXY_DB_URL" -X -q -v ON_ERROR_STOP=1

# Browser, configured build (TAKATAK on a test host + AdSense stub, 5 slot ids):
NODE_OPTIONS="--import=./e2e/no-network.mjs" VITE_TAKATAK_ADS_URL=https://ads.takatak.test \
  VITE_ADSENSE_CLIENT=ca-pub-1234567890123456 VITE_ADSENSE_SLOT_DISCOVER=1111111111 \
  VITE_ADSENSE_SLOT_LIST=2222222222 VITE_ADSENSE_SLOT_FEED=3333333333 \
  VITE_ADSENSE_SLOT_PROFILE=4444444444 VITE_ADSENSE_SLOT_CONTENT=5555555555 \
  npx vite build --outDir /tmp/isexy-dist-ads
npx vite preview --outDir /tmp/isexy-dist-ads --port 4410 --strictPort --host 127.0.0.1 &
E2E_ADS_MODE=configured E2E_BASE=http://127.0.0.1:4410 node --experimental-strip-types --no-warnings \
  --import ./e2e/offline-browser.mjs e2e/ads-e2e.mjs
# Plain build (nothing set): npm run build, preview dist/ on 4410, E2E_ADS_MODE=plain.
```

On the live site, after 0016 and the build variables are deployed:

1. TAKATAK: `curl -s -X POST https://takatak.ca/api/ads/serve -H 'Origin: https://isexy.ca'
   -H 'Content-Type: application/json' -d '{"publisherCode":"isexy","placementCode":"isexy-feed-inline","context":{"locale":"en","device":"mobile","category":"social"}}'`
   → `"filled":true` with an eligible campaign. `"filled":false`: check the
   publisher/placement status and origins, then the campaign (status, dates,
   budget, the advertiser's subscription, Direct placements, targeting).
2. A free test member sees a banner on `/discover`, `/matches`, `/explore`,
   `/profile` and `/faq`, labelled "Advertisement" / "Publicité" (TAKATAK),
   "Advertisements" / "Publicités" (AdSense) or "ISEXY Plus" (house banner),
   and none on a chat, `/premium` or `/privacy`.
3. Buy one pack of Super Likes in Stripe test mode with that member: back in
   the app, the banners are gone (DevTools → Network → `get_my_ad_status`
   answers `{"ad_free": true, "reason": "recent_payment", "until": …}`).
4. A signed-out visitor sees an ad on `/faq` and `/news`, none on `/auth`.
5. With the cookie banner's Advertising choice off, the AdSense ad requests
   (`googleads.g.doubleclick.net/pagead/ads?…`) carry `npa=1`
   (non-personalized); switch it on and the next requests do not.
