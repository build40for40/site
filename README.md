# 40for40.app

Astro 7 + Vue 3 islands + Tailwind 4, built as a static site for Cloudflare Pages.

```sh
npm install
npm run dev      # localhost:4321
npm run build    # outputs dist/
npm run deploy   # build + wrangler pages deploy
```

Cloudflare Pages git integration: build command `npm run build`, output directory `dist`.

- Site config (start date, links, prices, guests, team): `src/data/site.ts`
- Day data and statuses (mock data for now): `src/data/days.ts`
- Theme tokens: `src/styles/global.css`
