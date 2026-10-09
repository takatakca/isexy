# ISEXY repositioning: Canadian social network (18+)

**Owner decision (2026-10-09):** ISEXY is no longer a dating app. It is a
Canadian social network for adults (18+): member profiles, swipes to find
people to talk with and become friends, chat (with live translation), phone
calls and webcam video calls. Launch in Canada (English and French); later the
rest of North America and other countries.

**Unchanged:** 18+ only, verification, moderation, block/report, safety tools,
Takatak Auth, payments (Canadian members, Canadian cards, CAD prices).

## What changed

- **Wording, everywhere users or reviewers can see it:**
  - App UI, landing page, About, FAQ, Help Center, Terms/Privacy/legal pages,
    SEO tags, sitemap, `llms.txt`, PWA manifest.
  - Notification emails and WhatsApp/push texts.
  - The AI concierge's instructions and the translation prompt.
  - Admin labels and Stripe product descriptions.

  Dating and romance wording is replaced with friendship, conversation and
  social wording that matches what the app does. "Match" stays as the name of
  the mutual-like mechanic: you both swiped right, so you can chat.
- **Renamed pages** (the old URLs redirect, so links keep working):

  | Old | New |
  | --- | --- |
  | Double Date `/double-date` | Double Hangout `/double-hangout` |
  | Love Stories `/love-stories` | Community Stories `/community-stories` |
  | Matchmaker `/matchmaker` | Introductions `/introductions` |
  | Dating Regulations `/dating-regulations` | Online Safety & Regulations `/regulations` |

- **Profile options:**
  - "Looking for" offers friendship goals (new friends, someone to talk to,
    people to do things with, language exchange, networking).
  - "Open to…" offers ways to connect (chatting, phone calls, video calls,
    meeting up in public, group hangouts).
  - "Love style" becomes "Friendship style".
  - Romantic profile prompts are reworded; prompt ids and stored values are
    unchanged, so existing answers stay valid. Nothing is deleted.
- **Default market Canada:**
  - English and French are listed first.
  - The app opens in French when the browser is French, English otherwise.
  - New profiles default to `country = 'Canada'` (database default, already in place).
- **Seeded database text:** migration `supabase/isexy-migrations/0003_social_network_wording.sql`.
  - It contains **only `UPDATE`s matched by the seeded title, never a `DELETE`**.
  - Help Center: How to Create Your Profile, Safety Tips for Meeting People,
    Subscription Plans Explained, How Matching Works, Account Recovery.
  - Community forum: the "Dating & Relationships" category becomes
    "Friendship & Social Life", the Success Stories description changes, two
    general posts are reworded, and the old brand in the support email template
    is replaced.

## Cuba: ON HOLD (nothing removed or changed)

The owner put the Cuba removal on hold: members in Cuba may stay as free users,
and all payments come from Canadian members with Canadian cards. **Nothing
below was removed or changed**, and no database data was deleted. Where shared
copy mixed dating wording with a Cuba mention, only the dating words were
changed; the Cuba mention stays.

Inventory for the owner's decision:

| Kind | Items |
| --- | --- |
| Pages / routes | `src/pages/CubanSignup.tsx` (`/cuban-signup`), `CubanRewards.tsx` (`/cuban-rewards`), `CubanCashout.tsx` (`/cuban-cashout`), `CubanDonations.tsx` (`/donate/:recipientId?`), `TeamCubaDate.tsx` (`/team-cubadate`), the Cuban verification review in `AdminVerifications.tsx` |
| Tables / columns | `isexy.cuban_verifications`, `isexy.donations`, `isexy.gift_packages` (phone top-ups, food packages, cash gifts), `isexy.gift_transactions`, `isexy.star_cashout_requests`; `profiles.is_cuban`, `carnet_front_url`, `carnet_back_url` |
| Storage | bucket `isexy-cuban-verifications` |
| Edge functions | `isexy-send-verification-notification` (Cuban verification emails), `isexy-create-one-time-payment` (donations, top-ups, food packages), Cuba-related branches in `isexy-stripe-webhook`, `isexy-send-whatsapp-otp` (Cuban WhatsApp number check) |
| Seeded content still mixing dating + Cuba | forum posts "Tips for a great first date in Havana", "We met on CubaDate and got married!", "Learning Spanish for better connections"; Cuban city forum categories (e.g. La Habana "dating spots", Trinidad "romance"); Help Center "Understanding Cuban Verification" |
| Other | Cuba cities in Passport Mode, Cuba sections in Safety, Terms, Privacy and Online Safety & Regulations, Cuba facts in the AI concierge instructions |

When the owner confirms, a follow-up can remove or reword these surgically.
Rows would be unpublished or reworded with `UPDATE`, never deleted.

## Also done

- Invented or unverifiable claims are removed:
  - "3× more likely to match" (4 places)
  - "All profiles are verified" (verification is optional; the badge exists)
  - fake user counts, couple testimonials, an invented press timeline and
    leadership names
  - "a new relationship every 3 seconds"
  - Swipe Surge "15× / 250%"
  - the "Face Check™" name, which nothing implements
- Romantic stock photos (wedding rings, wedding chairs, heart hands, a couple
  at sunset, heart bokeh, an oil massage) are replaced with friendship photos
  in Community Stories, Explore and News.
- SEO and app-store wording:
  - Site title "ISEXY — Meet new people & make friends in Canada (18+)".
  - Schema.org category `SocialNetworkingApplication`.
  - `llms.txt`, the sitemap and the pre-rendered pages contain no dating wording.
- Safety:
  - Canada is listed first in the emergency resources, with the Canadian
    Anti-Fraud Centre added.
  - The "Sexual Health" tips are now "Boundaries & Consent".
  - Community Guidelines: no sexual messages or images without clear consent.
  - The Online Safety & Regulations page covers the Criminal Code (fraud,
    extortion/sextortion, non-consensual images), PIPEDA, Law 25 and 18+.

## Waiting on the owner

| Item | Why it waits |
| --- | --- |
| **Hero image** `public/images/hero-bg.png` (Welcome and Sign-in pages) | It shows romantic couples (one kissing) with "Experience Cuba & Canada, Together" baked into the image. It is both dating and Cuba imagery, so it stays until the Cuba decision; replacing it needs a new image (e.g. friends talking, Canadian setting). |
| Cuba legal text in Online Safety & Regulations | Spousal sponsorship and the 2022 Cuban Family Code text use legal terms (spouse, marriage, couples). It is Cuba-specific, so it is on hold. |
| Cuba seeded forum posts | Listed above; would be reworded or unpublished with `UPDATE`. |
| WhatsApp message templates | `missed_call_notification` and `video_call_notification` are approved in Meta, not in this repo. If their text mentions dating, they need re-approval in Meta. |
| "Reports are reviewed within 24 hours" (FAQ, report flow) | A staffing promise. Keep it only if the moderation team can meet it. |
| Terms §14 says ISEXY "does not conduct identity verification" | Photo verification exists. Legal should align the wording. |
| Support address `cubaresort.ca@gmail.com`, footer "© 2025" | Not dating wording; update when an isexy.ca support address exists. |
