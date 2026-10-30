# build40for40.com

40 for 40 is 40 apps in 40 days, built live on Twitch from London with special guests who have never vibe coded. It starts on 2 November 2026. Each day's box stays locked until someone pays to unlock it. It's a community, not a startup: nobody can invest, and it isn't raising.

## What the site is for

Before Day 1, its job is to get people to help, in this priority order: office space, AI tool credits and partner intros, then guests and problems to solve. From Day 1 it becomes the daily home of the build: watch, unlock, sponsor, presale, and see what shipped.

**Audiences:** supporters (space, tools, a CTO for a day), special guests, problem owners, unlockers and sponsors, viewers and builders, press.

**The daily cycle:** at 9am the day's box appears, locked, and a timer starts counting up. The first payment unlocks it, credits the payer and reveals the problem and guests. The team then moves it through Building and Check-in to Shipped, or marks it Paused. At 5pm the app link and demo recording go up.

## Releases

| Release | Due | Contents |
| --- | --- | --- |
| R1: Recruit | 24 Oct 2026 | Home page, help / guest / problem forms, team and guests, countdown, privacy notice |
| R2: Launch | 1 Nov 2026 | Locked box, payments, automatic unlock, Twitch embed, Day 1 page |
| R3: Run | During the 40 days | Live day status, app gallery, credits, daily updates, press page |

## Constraints

- **Phone first:** the home page loads in under 2s on 4G.
- **Accessibility and privacy:** WCAG 2.2 AA. UK GDPR notice; guest names and photos appear only with written consent.
- **UK time:** everything shows Europe/London time (GMT during the run), with the viewer's local time beside it.
- **Payments:** hosted checkout only (Stripe), no account, under a minute on a phone. A payment flips the day to Unlocked within 60 seconds. The team can also unlock by hand, and payers choose how they're credited: name, company or anonymous.
- **Editing:** the team edits day status, problem, guests and app links without a deploy.
- **Sharing:** every page and day gets its own Open Graph title and image.
- **Out of scope:** investment or donations, visitor accounts, built-in chat, hosting the apps, translations.

## Status

The R1 UI is built. Forms are saved to D1, sponsors pay through Stripe Payment Links, and the days and problems pool are ranked from the problems in D1. Shipped history in `src/data/days.ts` is still mock data. Still to come: Stripe with auto-unlock, the admin screen, day pages, the app gallery and OG images. Open questions include prices, VAT and the receiving entity.

## Stack

Astro 7 + Vue 3 islands + Tailwind 4, built as a static site and served as static assets by a Cloudflare Worker. The Worker in `worker/` only handles `/api/*`.

```sh
npm install
npm run dev      # localhost:4321
npm run build    # outputs dist/
npm run preview  # build + the Worker with a local D1 on localhost:8787
npm run types    # regenerate worker types after changing wrangler.jsonc
npm test         # unit tests (Vitest), next to the files they cover
npm run db:seed  # fake problems and payments in the local D1
npm run deploy   # build + wrangler deploy
npm run wrangler -- deployments list
```

Locally, wrangler runs as the `40for40` auth profile. Run it through `npm run wrangler --`, never bare `npx wrangler`: the script drops any global `CLOUDFLARE_API_KEY` and `CLOUDFLARE_EMAIL`, which wrangler would otherwise use ahead of the profile. `account_id` in `wrangler.jsonc` makes wrangler refuse to act on any other account. To create the profile on a new machine:

```sh
env -u CLOUDFLARE_API_KEY -u CLOUDFLARE_EMAIL npx wrangler auth create 40for40
```

## Deploys

GitHub Actions (`.github/workflows/deploy.yml`) builds every push and pull request. Pushes to `main` deploy to production at `build40for40.com`. Pull requests upload a preview version at `<branch>-40for40.40for40.workers.dev`. Deploys are skipped until these repo secrets exist:

- `CLOUDFLARE_ACCOUNT_ID`: the `account_id` in `wrangler.jsonc`.
- `CLOUDFLARE_API_TOKEN`: a custom token on the 40for40 account with **Account > Workers Scripts > Edit**.

```sh
gh secret set CLOUDFLARE_ACCOUNT_ID
gh secret set CLOUDFLARE_API_TOKEN
```

`build40for40.com` and `www.build40for40.com` are custom domains set in `wrangler.jsonc`, and Cloudflare manages their DNS records and certificates on deploy. Response headers live in `public/_headers`, and everything on `*.workers.dev` is marked `noindex`.

## Forms

Every form posts to `/api/forms/<form>` (`subscribe`, `join`, `help`, `guest`, `problem`). The Worker checks the fields and saves them. The home page posts them in the background and shows a thank you in place of the form, and without JavaScript the Worker redirects back to `/`. A hidden `website` field catches bots, which get the same answer without being saved.

### Data

Everything lives in the `40for40` D1 database, with the schema in `worker/migrations/`:

- **`people`:** one row per email. The Join box creates it, and later forms fill in or change answers without clearing ones they leave out, keeping the original `joined_at`. `involved` is a JSON array and `sponsor` is the amount in pence picked before checkout.
- **`problems`:** one row per problem submitted, so a second problem from the same person never replaces the first.
- **`payments`:** one row per paid Stripe Checkout Session, written by the webhook.
- **`help_offers`** and **`guest_applications`:** one row per submission of the hidden help and guest forms.

To change the schema, add a numbered `.sql` file to `worker/migrations/`. `npm run db:migrate` applies it to the local database, and deploys (`npm run deploy` and CI) apply it to production first.

### Problems and the pool

`GET /api/problems?offset=&limit=` returns problems ranked by money raised, with the team's `title` (or the start of the problem when there isn't one), the submitter's first name and each payment as an anonymous sponsor. Emails never leave the Worker. The home page loads the first 40 for the days, then the rest a page at a time once the page has loaded, and each one drops into the pool.

`GET /api/pool/search?q=` finds candidates with D1 full-text search (`problems_fts`, kept in sync by triggers) and reranks them with TypeSafe's Jev when `TYPESAFE_API_KEY` is set. If Jev is slow, down or unset, it returns the full-text ranking, and the browser falls back to its own word match if the Worker fails. Only the search and each candidate's title and problem text are sent to Jev. To try Jev locally, put a key in `.dev.vars`. In production, `npm run wrangler -- secret put TYPESAFE_API_KEY`.

Artwork is seeded from the problem id. Setting `ARTWORK_SUBMITTER_SEEDS` to `on` (with an `ARTWORK_SEED_SECRET` secret) gives one person's problems a family look, which also reveals that they came from the same person.

### Sponsoring

Ticking Sponsor on the full form shows the amounts in `sponsorAmounts` in `src/data/site.ts`. Picking one only records it. On Submit, the Worker saves the answers and redirects to that amount's Stripe Payment Link with the email prefilled, and with `client_reference_id` set to the problem's id when they submitted one. The amount is dropped if Sponsor was unticked, and an empty link goes to `/thanks/` instead. In Stripe, every link sells the one Sponsor product at one of its GBP prices (lookup keys `sponsor_<pence>`), with `sponsor` metadata set to the same value, and sends people back to `/thanks/` after paying. Each amount has a live `link` and a sandbox `testLink`: only `build40for40.com` and its subdomains use the live one, so local dev servers and workers.dev previews check out in the sandbox (pay with a test card such as `4242 4242 4242 4242`).

Stripe sends `checkout.session.completed` and `checkout.session.async_payment_succeeded` to `/api/stripe/webhook` on the live account. The Worker checks the signature against the `STRIPE_WEBHOOK_SECRET` Worker secret, then saves paid sessions to `payments` with the payer's email and the problem from `client_reference_id`. Stripe retries failed deliveries, and a repeat of the same session is ignored. To replace the secret, roll it in the Stripe dashboard and run `npm run wrangler -- secret put STRIPE_WEBHOOK_SECRET`.

### Running and reading forms

`npm run dev` runs the Worker for `/api/*` with a local D1, and so does `npm run preview` (the built site on port 8787). Before the first run, create the local tables with `npm run db:migrate`, add fake problems with `npm run db:seed`, and copy `.dev.vars.example` to `.dev.vars`. Stripe can't reach a local server, so to test the webhook locally, set any `STRIPE_WEBHOOK_SECRET` in `.dev.vars` and sign test events with it. Plain `astro preview` serves only the static files, so forms 404 there. To read real submissions:

```sh
npm run wrangler -- d1 execute 40for40 --remote --command "SELECT * FROM people ORDER BY joined_at"
npm run wrangler -- d1 execute 40for40 --remote --command "SELECT * FROM payments ORDER BY paid_at"
```

## Where things live

- Site config (start date, links, prices, guests, team): `src/data/site.ts`
- Day ranking and statuses: `src/data/days.ts`
- Problems pool (physics, motion, artwork, search): `src/pool/`, settings in `src/pool/config.ts`
- Theme tokens: `src/styles/global.css`
- Form handling (fields, limits, storage): `worker/index.ts`, with the database schema in `worker/migrations/`

## Analytics

PostHog (EU) runs in cookieless mode: nothing is stored in the browser, and PostHog hashes IP, user agent and host into a visitor id that changes daily. The project needs **Cookieless server hash mode** on (Project settings > Web analytics), or every event is dropped.

The browser sends page views, clicks, errors, `form_submitted`, `join_opened` when the join form pops up, `checkout_started` from a day and `stream_loaded`. The Worker sends `form_saved` once a form is stored, with the same cookieless fields so it joins the visitor's funnel. The Stripe webhook sends `payment_completed`, keyed by Checkout Session since it can't be tied to a visitor.

- **Build:** `PUBLIC_POSTHOG_PROJECT_TOKEN` and `PUBLIC_POSTHOG_HOST` in `.env` locally, and for CI as a repo secret (the token, since GitHub rejects it as a variable) and a repo variable (the host).
- **Worker:** the same names. `PUBLIC_POSTHOG_HOST` is in `wrangler.jsonc`, and `PUBLIC_POSTHOG_PROJECT_TOKEN` is a secret (`.dev.vars` locally, `npm run wrangler -- secret put PUBLIC_POSTHOG_PROJECT_TOKEN` in production).
