# 40for40.app

Static Astro site with Vue islands, deployed to Cloudflare Pages. See README.md for commands and deploys.

## Conventions

- **Lean by default:** pages and sections are `.astro` and ship no JS. Use a Vue component only where something must be interactive, hydrated with `client:visible` unless it's above the fold.
- **Tailwind only:** no custom CSS. Colours and fonts are tokens in the `@theme` block of `src/styles/global.css`, so add a token there rather than a hex value in markup. Keep text at WCAG AA contrast.
- **Content lives in `src/data/`:** `site.ts` holds dates, links, prices, guests and team, and `days.ts` holds the 40 days. Day data is mock data until the backend exists.
- **UK time:** every time shown is Europe/London, with the viewer's local time beside it where it matters.
- **Phone first:** check layouts at 390px wide with no horizontal scroll.
- **Voice:** informal and funny, no corporate language. No dashes mid-sentence in copy.

## Development

Start the dev server in the background with `npx astro dev --background`, and manage it with `astro dev stop`, `astro dev status` and `astro dev logs`.

Astro docs: https://docs.astro.build. Check the relevant guide before working on routing, framework components, content collections or styling.
