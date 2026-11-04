---
name: kickoff-day
description: Kick off a build day once its problem is revealed at 10:00. Confirms the day's problem against the live site, fixes the day's Superthread page if the ranking changed overnight, and creates the day's public GitHub repo with its first commit. Later, once the app has a name, it serves the app at build40for40.com/<app>/ with CI. Use when a day starts or its repo is needed. Triggers include "kick off day 4", "kickoff", "start day 4", "make today's repo", or "the app is called X, put it live".
---

# Kick off a day

At 10:00 UK the day's box opens and the build starts. The Superthread board and page were set up the night before by step 8 of the `finish-day` skill. This skill makes the GitHub repo for the day and checks the page still matches the problem that's actually being built. Day 1 (`joyo`) is the reference repo.

## 1. Confirm the problem

Work out today's day number with `clock()` in `src/data/days.ts`. Then rank production's ideas the way `buildBoard` does, leaving out the ideas already in `history`:

```bash
curl -s https://build40for40.com/api/problems | jq -c --argjson shipped '["<history ids>"]' '.ideas | map(select(.id as $id | $shipped | index($id) | not) | . + {raised: (.sponsors | map(.amount) | add // 0)}) | map(select(.raised > 0)) | sort_by(-.raised, .submittedAt) | .[:3][] | {id, title, owner, raised, submittedAt}'
```

The first result is the problem the site is showing now. On Day 3 a problem submitted at 09:30 overtook the one that had been top the night before, so if the top two are close, or the top one was submitted overnight, ask the user which one the team is building. If the day is in `GUEST_DAYS`, ask the user for the problem.

Ask for the form factor too if the Superthread page still says TBC.

## 2. Check the Superthread page

Use the `superthread-cli` skill. In the General space (id 2), find the "Day N" page under Days (id 7) and the `dayN` board.

- If the page is missing, or shows a different problem, write it again in the same format as "Day 2": `**Problem:**` with the title, `**Form factor:**`, then the problem in full. Use `st pages update <id> --content` on an existing page.
- If the board is missing, create it as in step 8 of `finish-day`.
- Add the repo link to the page once the repo exists: a `**Repo:**` line under the form factor.

## 3. Create the repo

Follow "Starting a new repo" in the 40 for 40 folder's `CLAUDE.md` (the parent of the site checkout). Check `gh repo view build40for40/dayN` first, and skip anything that already exists.

```bash
gh repo create build40for40/day4 --public --description "<title>, built live for 40 for 40"
gh repo edit build40for40/day4 --enable-auto-merge --delete-branch-on-merge
```

The second line copies Joyo's settings. GitHub sometimes answers these with a 502, so check they took with `gh api repos/build40for40/day4 --jq '{allow_auto_merge, delete_branch_on_merge}'`, and run it again if they didn't.

In the 40 for 40 folder, `git init -b main` a `dayN` folder next to `site/` with `origin` set to `git@github.com:build40for40/dayN.git`, and commit straight to `main`:

- `AGENTS.md` about this repo only: the day number and date, the problem's title and full text, the owner, the form factor, a pointer to `../AGENTS.md` for shared context, and that it's served at `build40for40.com/<app>/` once it has a name.
- `CLAUDE.md` as a symlink: `ln -s AGENTS.md CLAUDE.md`.
- A `.gitignore` that covers `.env*`, `.dev.vars*` (keeping the `.example` files), `.wrangler/`, `node_modules/` and `dist/`.

The pre-commit hooks run on their own. If one blocks the commit, fix the content and never bypass it. If a push fails with an Internal Server Error, push again.

CI deploys use the `CLOUDFLARE_API_TOKEN` organisation secret, so don't add one to the repo. Check the repo can see it with `gh api repos/build40for40/day4/actions/organization-secrets --jq '.secrets[].name'`, and if it can't, tell the user.

## 4. Report

Tell the user the repo link, whether the page needed fixing, and whether the form factor is still TBC.

## 5. When the app has a name

Apps are served at `build40for40.com/<app>/` by their own Worker, so this waits until the team names the app. Once the repo has a scaffold with a `package.json`, open a PR on the day's repo that copies these from `joyo`:

- **`wrangler.jsonc`:** the 40 for 40 `account_id`, routes for `build40for40.com/<app>` and `build40for40.com/<app>/*` on the `build40for40.com` zone, and `preview_urls: true` so PRs get preview links. Change `name`, the routes and anything under `/joyo/` to the app's name.
- **The `wrangler` script in `package.json`:** `env -u CLOUDFLARE_API_KEY -u CLOUDFLARE_EMAIL wrangler --profile 40for40`.
- **`.github/workflows/ci.yml`:** tests and build on every PR, a preview upload with a link commented on the PR, and a deploy on pushes to `main`. Change the `/joyo/` in the preview link to the app's path.

The app must build for its own path, or its assets load from the site's root. Joyo sets Vite's `base: '/joyo/'`, and Sidekick uses `base: './'`. Merge the PR and check `https://build40for40.com/<app>/` answers 200. Then the app link is ready for `finish-day` at the end of the day.
