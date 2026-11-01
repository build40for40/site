# build40for40.com

Static Astro site with Vue islands, served by a Cloudflare Worker as static assets. The Worker in `worker/` handles `/api/*`, and forms and Stripe payments are saved to D1. See README.md for commands and deploys.

## Conventions

- **Lean by default:** pages and sections are `.astro` and ship no JS. Use a Vue component only where something must be interactive, hydrated with `client:visible` unless it's above the fold.
- **Tailwind only:** no custom CSS. Colours and fonts are tokens in the `@theme` block of `src/styles/global.css`, so add a token there rather than a hex value in markup. Keep text at WCAG AA contrast.
- **Content lives in `src/data/`:** `site.ts` holds dates, links, prices, guests and team, and `days.ts` ranks ideas into the 40 days. Ideas are the `problems` in D1, loaded from `/api/problems`. Shipped history is still mock data.
- **The problems pool lives in `src/pool/`:** physics, motion, artwork, search and data are separate modules, and `ProblemsPool.vue` only wires them together. Tunables are in `src/pool/config.ts`.
- **UK time:** every time shown is Europe/London, with the viewer's local time beside it where it matters.
- **Phone first:** check layouts at 390px wide with no horizontal scroll.
- **Voice:** informal and funny, no corporate language. No dashes mid-sentence in copy.

## Development

Start the dev server in the background with `npx astro dev --background`, and manage it with `astro dev stop`, `astro dev status` and `astro dev logs`.

The home page runs on the real clock. Add `?now=2026-11-10T11:20Z` to its URL to see the board at any other moment, such as mid-build or after a day ships.

Run wrangler as `npm run wrangler -- <args>`, never `npx wrangler`: the script runs as the `40for40` auth profile and drops the global Cloudflare credentials in the shell, which would otherwise win.

Astro docs: https://docs.astro.build. Check the relevant guide before working on routing, framework components, content collections or styling.
