# 40for40.app

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

The R1 UI is built. Forms and payments are stubbed, and day data in `src/data/days.ts` is mock data. Still to come: form handling, Stripe with auto-unlock, the admin screen, day pages, the app gallery, OG images and analytics. Open questions include prices, VAT and the receiving entity.

## Stack

Astro 7 + Vue 3 islands + Tailwind 4, built as a static site for Cloudflare Pages.

```sh
npm install
npm run dev      # localhost:4321
npm run build    # outputs dist/
npm run deploy   # build + wrangler pages deploy
```

## Deploys

GitHub Actions (`.github/workflows/deploy.yml`) builds every push and pull request. Pushes to `main` deploy to production, other branches get a preview URL. Deploys are skipped until these repo secrets exist:

- `CLOUDFLARE_ACCOUNT_ID`: from the Cloudflare dashboard sidebar.
- `CLOUDFLARE_API_TOKEN`: a custom token with **Account > Cloudflare Pages > Edit**.

```sh
gh secret set CLOUDFLARE_ACCOUNT_ID
gh secret set CLOUDFLARE_API_TOKEN
```

The first deploy creates the `40for40` Pages project. Then add `40for40.app` under the project's Custom domains. Response headers live in `public/_headers`; preview deploys on `*.pages.dev` are marked `noindex`.

## Where things live

- Site config (start date, links, prices, guests, team): `src/data/site.ts`
- Day data and statuses (mock data for now): `src/data/days.ts`
- Theme tokens: `src/styles/global.css`
