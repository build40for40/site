# build40for40.com

40 for 40 is 40 apps in 40 days, built live on Twitch from London with special guests who have never vibe coded. It starts on 2 November 2026. Each day's box stays locked until someone pays to unlock it. It's a community, not a startup: nobody can invest, and it isn't raising.

## What the site is for

Before Day 1, its job is to get people to help, in this priority order: office space, AI tool credits and partner intros, then guests and problems to solve. From Day 1 it becomes the daily home of the build: watch, unlock, sponsor, presale, and see what shipped.

**Audiences:** supporters (space, tools, a CTO for a day), special guests, problem owners, unlockers and sponsors, viewers and builders, press.

**The daily cycle:** at 10am the day's box appears, locked, and a timer starts counting up. The first payment unlocks it, credits the payer and reveals the problem and guests. The team then moves it through Building and Check-in to Shipped, or marks it Paused. At 5pm the app link and demo recording go up.

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

The R1 UI is built. Forms are saved to D1, sponsors pay through Stripe Embedded Checkout, and the days and problems pool are ranked from the problems in D1. Shipped days are added by hand to `history` in `src/data/days.ts`. Still to come: Stripe with auto-unlock, the admin screen, day pages, the app gallery and OG images. Open questions include prices, VAT and the receiving entity.

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
npm run deploy   # emergency only: production deploys come from CI on main
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

- **`people`:** one row per email. The first form someone sends creates it, and later forms fill in or change answers without clearing ones they leave out, keeping the original `joined_at`. `involved` is a JSON array and `sponsor` is the amount in pence picked before checkout.
- **`problems`:** one row per problem submitted, so a second problem from the same person never replaces the first. A sponsored one has `awaiting_payment` set until it's paid, and stays off the site until then.
- **`problem_categories`:** how well each problem fits each category, from 0 to 1. `problems` records who sorted it (`categorised_by`), against which list (`categories_version`) and how likely it is to be meant sincerely (`sincere`).
- **`payments`:** one row per paid Stripe Checkout Session, written by whichever comes first of the webhook and the page asking. It backs a problem or a guest `day`, with the `name` to credit (null is Anonymous).
- **`help_offers`** and **`guest_applications`:** one row per submission of the hidden help and guest forms.

To change the schema, add a numbered `.sql` file to `worker/migrations/`. `npm run db:migrate` applies it to the local database, and deploys (`npm run deploy` and CI) apply it to production first.

### Problems and the pool

`GET /api/problems?offset=&limit=` returns problems ranked by money raised, with the team's `title` (or the start of the problem when there isn't one), the submitter's first name and each payment's sponsor, by the name they gave or as Anonymous. Named payments group only by the payer's email; anonymous payments always stay separate. The same rule applies to guest-day sponsors. Emails never leave the Worker; named sponsors get an opaque HMAC group token signed with the Stripe key so new payments can join the right group in the browser. Problems waiting for their payment are left out. The home page loads the first 40 for the days, then the rest a page at a time once the page has loaded, and each one drops into the pool.

`GET /api/pool/search?q=` finds candidates with D1 full-text search (`problems_fts`, kept in sync by triggers) and reranks them with TypeSafe's Jev when `TYPESAFE_API_KEY` is set. If Jev is slow, down or unset, it returns the full-text ranking, and the browser falls back to its own word match if the Worker fails. Both leave out filler words such as "my" and "the", which would match almost every problem. Browse lists every word match. The join form floats up only the best few, without a match percentage, since word matches rank problems but don't say how alike they are. Only the search and each candidate's title and problem text are sent to Jev. To try Jev locally, put a key in `.env`. In production, `npm run wrangler -- secret put TYPESAFE_API_KEY`.

### Categories

Every problem is sorted into the categories in `src/data/categories.ts`, which the Browse panel offers as topic chips. Jev answers one yes or no per category, plus whether the problem is meant sincerely, and every category's score goes into `problem_categories`. A problem is in each category scoring at least `fits` (up to three, best first), and in Other when none do. A best score between `unsure` and `fits` isn't settled either way. Only the title and problem text are sent to Jev, and the Worker logs every request it sends, so `npm run wrangler -- tail` shows exactly what was asked.

New problems are sorted right after they're saved. A problem whose sort fails, or that was saved while `TYPESAFE_API_KEY` was unset, stays unsorted until someone sorts it by hand. Each sort records the `CATEGORIES_VERSION` it used, so bump it when the list changes. Each sort sends a `problem_categorised` event to PostHog with the problem's id, its categories, `fit` (`fits`, `unsure` or `none`), its best score and `sincere`, so an insight or alert on `fit != fits` finds the ones that need a look. The thresholds only change how scores are read, so moving them needs no new sort.

To sort a problem by hand, mark it as the team's so the classifier leaves it alone, and give each category it's in a score of 1. With no categories it's in Other:

```sh
npm run wrangler -- d1 execute 40for40 --remote --command "UPDATE problems SET categorised_by = 'team' WHERE id = '<id>'; DELETE FROM problem_categories WHERE problem_id = '<id>'; INSERT INTO problem_categories VALUES ('<id>', 'food', 1)"
```

To list the problems that fit nothing or might be junk:

```sh
npm run wrangler -- d1 execute 40for40 --remote --command "SELECT p.id, p.title, p.sincere, max(c.score) AS best FROM problems p JOIN problem_categories c ON c.problem_id = p.id GROUP BY p.id HAVING best < 0.7 OR p.sincere < 0.7 ORDER BY best"
```

Locally, the seed sorts its fake problems by hand.

### Titles

Each new problem gets a short title from Claude Haiku, alongside its sort with Jev, when `ANTHROPIC_API_KEY` is set. Only the problem text is sent. The title is written only while the problem has none, so one the team sets is never replaced. If titling fails, the problem shows the start of its text until someone sets a title by hand. `worker/titles.ts` hides the provider behind a `Titler`, so changing model is one default and changing provider is one new function. To try it locally, put a key in `.env`. In production, `npm run wrangler -- secret put ANTHROPIC_API_KEY`.

Artwork is seeded from the problem id. Setting `ARTWORK_SUBMITTER_SEEDS` to `on` (with an `ARTWORK_SEED_SECRET` secret) gives one person's problems a family look, which also reveals that they came from the same person.

### Sponsoring

Sponsors pay with Stripe's Embedded Checkout in a dialog on the page, so nobody leaves the site, and nothing counts until the Worker has checked with Stripe that it's paid.

```
Join form, Sponsor + amount ──▶ POST /api/forms/join ──▶ problem saved with awaiting_payment = 1 (hidden)
Day box Sponsor button ───────▶ POST /api/checkout ───┐            │
                                                      ▼            ▼
                                   Checkout Session (USD, Sponsor product, problem id or guest day)
                                                      │
                     dialog mounts Checkout ◀─────────┘   declines and 3D Secure are handled inside it
                                │ paid
                                ▼
           GET /api/checkout/<id> ──▶ Worker asks Stripe ──▶ payments row, problem shown
           Stripe webhook ──────────────────────────────────▶ the same, whichever lands first
```

- **Join form:** with Sponsor picked, Submit saves the problem hidden and opens checkout for that amount, with the email prefilled and the form's first name as the credit. Once it's paid, the form folds up and lands on a day or in the pool by the amount paid. Closing checkout keeps the form as it was and says nothing was sent. A problem whose payment never comes stays hidden for good, and trying again sends a new one.
- **Day box:** the Sponsor button opens checkout for the idea, or for the guest day on guest days. Checkout asks for an optional name to show on the site, unless they ticked anonymous. `GET /api/days` returns each guest day's sponsors.
- **Leaving the page:** payment methods that redirect come back to `/?checkout=<id>`, which saves the payment and opens what was paid for.
- **Still processing:** bank-style payments that clear later stay hidden until Stripe sends `checkout.session.async_payment_succeeded`.

Suggested amounts come from `SPONSOR_AMOUNTS` in `src/data/site.ts`. Each picker also has Custom for a custom whole-dollar USD amount from $4 to $4,040,040, validated on both submission routes using the shared limits in that file. Amounts are priced on the session itself, so Stripe needs no price or link per amount. The Worker pins Stripe's API to the same release as `@stripe/stripe-js` (`STRIPE_VERSION` in `worker/checkout.ts`), so bump them together.

Local dev uses the Stripe sandbox and everything on a URL (production and PR previews) uses live Stripe and the production database, since previews share the Worker's secrets:

- `STRIPE_SECRET_KEY`: a restricted key that can write Checkout Sessions.
- `STRIPE_PUBLISHABLE_KEY`: handed to the page with each session.
- `STRIPE_SPONSOR_PRODUCT`: the Sponsor product's id. Without it, sessions name the product themselves.
- `STRIPE_WEBHOOK_SECRET`: the signing secret of the webhook endpoint.

Put the sandbox values in `.env`, and the live ones in production with `npm run wrangler -- secret put <name>`. Pay in the sandbox with test cards such as `4242 4242 4242 4242`, `4000 0000 0000 0002` (declined) and `4000 0025 0000 3155` (3D Secure).

Stripe sends `checkout.session.completed` and `checkout.session.async_payment_succeeded` to `/api/stripe/webhook`. The Worker checks the signature, then saves paid sessions to `payments` with the payer's email, the problem from `client_reference_id`, the guest day and the credited name. Stripe retries failed deliveries, and a repeat of the same session is ignored. To replace the secret, roll it in the Stripe dashboard and put it again.

### Running and reading forms

`npm run dev` runs the Worker for `/api/*` with a local D1, and so does `npm run preview` (the built site on port 8787). Before the first run, create the local tables with `npm run db:migrate`, add fake problems with `npm run db:seed`, and copy `.env.example` to `.env`. It holds every local secret: Astro reads the `PUBLIC_` ones at build time and the Worker reads them all, unless a `.dev.vars` exists, which wrangler would read instead. To get sandbox webhooks locally, run `stripe listen --forward-to localhost:4321/api/stripe/webhook` and put the `whsec_` it prints in `STRIPE_WEBHOOK_SECRET`. Plain `astro preview` serves only the static files, so forms 404 there. To read real submissions:

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

The browser sends page views, clicks, errors, `form_submitted`, `join_opened` when the join form pops up, `checkout_started` and `checkout_closed` from the checkout dialog, and `stream_loaded`. The Worker sends `form_saved` once a form is stored, with the same cookieless fields so it joins the visitor's funnel. The Stripe webhook sends `payment_completed`, keyed by Checkout Session since it can't be tied to a visitor.

- **Build:** `PUBLIC_POSTHOG_PROJECT_TOKEN` and `PUBLIC_POSTHOG_HOST` in `.env` locally, and for CI as a repo secret (the token, since GitHub rejects it as a variable) and a repo variable (the host).
- **Worker:** the same names. `PUBLIC_POSTHOG_HOST` is in `wrangler.jsonc`, and `PUBLIC_POSTHOG_PROJECT_TOKEN` is a secret (`.env` locally, `npm run wrangler -- secret put PUBLIC_POSTHOG_PROJECT_TOKEN` in production).
