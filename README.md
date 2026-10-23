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

The R1 UI is built. Forms are saved to Workers KV, payments are stubbed, and day data in `src/data/days.ts` is mock data. Still to come: Stripe with auto-unlock, the admin screen, day pages, the app gallery, OG images and analytics. Open questions include prices, VAT and the receiving entity.

## Stack

Astro 7 + Vue 3 islands + Tailwind 4, built as a static site and served as static assets by a Cloudflare Worker. The Worker in `worker/` only handles `/api/*`.

```sh
npm install
npm run dev      # localhost:4321
npm run build    # outputs dist/
npm run preview  # build + the Worker and a local KV on localhost:8787
npm run types    # regenerate worker types after changing wrangler.jsonc
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

Every form posts to `/api/forms/<form>` (`subscribe`, `join`, `help`, `guest`, `problem`). The Worker checks the fields, saves them to the `FORMS` KV namespace and redirects to `/thanks/`. The home page's Join box is the exception: it saves the email if it's valid, then sends everyone to the full form at `/join/` with whatever they typed already filled in. Each person who joins has one entry, keyed `join:<email>`. The Join box creates it, and the full form fills in the rest, keeping the original `joinedAt`. The other forms are keyed `<form>:<time>:<id>`, so a prefix list comes back oldest first. Ticking Sponsor on the full form shows the amounts in `sponsorAmounts` in `src/data/site.ts`. Picking one only records it. On Submit, the Worker saves the chosen `sponsor` amount with the answers and redirects to that amount's Stripe Payment Link with the email prefilled. The amount is dropped if Sponsor was unticked, and an empty link goes to `/thanks/` instead. In Stripe, every link sells the one Sponsor product at one of its GBP prices (lookup keys `sponsor_<pence>`), with `sponsor` metadata set to the same value, and sends people back to `/thanks/` after paying. Each amount has a live `link` and a sandbox `testLink`: only `build40for40.com` and its subdomains use the live one, so local dev servers and workers.dev previews check out in the sandbox (pay with a test card such as `4242 4242 4242 4242`). A hidden `website` field catches bots, which get the thanks page without being saved.

`npm run dev` runs the Worker for `/api/*` with a local KV, and so does `npm run preview` (the built site on port 8787). Plain `astro preview` serves only the static files, so forms 404 there. To read real submissions:

```sh
npm run wrangler -- kv key list --binding FORMS --remote --prefix help:
npm run wrangler -- kv key get --binding FORMS --remote "join:someone@example.com"
```

## Where things live

- Site config (start date, links, prices, guests, team): `src/data/site.ts`
- Day data and statuses (mock data for now): `src/data/days.ts`
- Theme tokens: `src/styles/global.css`
- Form handling (fields, limits, storage): `worker/index.ts`
