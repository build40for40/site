# 40for40.app

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

- Site config (start date, links, prices, guests, team): `src/data/site.ts`
- Day data and statuses (mock data for now): `src/data/days.ts`
- Theme tokens: `src/styles/global.css`
