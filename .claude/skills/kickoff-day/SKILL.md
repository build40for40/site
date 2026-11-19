---
name: kickoff-day
description: Kick off a build day once its problem is revealed at 10:00. Confirms the day's problem against the live site, sets up the day's Superthread board and page, and creates the day's public GitHub repo with its first commit. Later, once the app has a name, it serves the app at build40for40.com/<app>/ with CI. Use when a day starts or its repo is needed. Triggers include "kick off day 4", "kickoff", "start day 4", "set up day 4", "make today's repo", or "the app is called X, put it live".
---

# Kick off a day

At 10:00 UK the day's box opens and the build starts. This skill sets up everything the day needs: its Superthread board and page, and its GitHub repo. Nothing is set up the night before, since the ranking can change until the box opens. Day 1 (`joyo`) is the reference repo.

## 1. Confirm the problem

Work out today's day number with `clock()` in `src/data/days.ts`. Then rank production's ideas the way `buildBoard` does, leaving out the ideas already in `history`:

```bash
curl -s https://build40for40.com/api/problems | jq -c --argjson shipped '["<history ids>"]' '.ideas | map(select(.id as $id | $shipped | index($id) | not) | . + {raised: (.sponsors | map(.amount) | add // 0)}) | map(select(.raised > 0)) | sort_by(-.raised, .submittedAt) | .[:3][] | {id, title, owner, raised, submittedAt}'
```

The first result is the problem the site is showing now. On Day 3 a problem submitted at 09:30 overtook the one that had been top the night before, so if the top two are close, or the top one was submitted overnight, ask the user which one the team is building. If the day is in `GUEST_DAYS`, ask the user for the problem.

Ask for the form factor too, unless the day's Superthread page already has it, and for the app's name. Since Day 14 the team picks three form factors each day rather than one, to keep the build flexible (Day 14's were CLI, WhatsApp and Agents), so ask for all three. The repo is named after the app (`joyo`, `sidekick`, `naughty-list`), lowercase with hyphens. If the app doesn't have a name yet, use `dayN` for now and rename it in step 5.

## 2. Set up Superthread

Everything goes in the General space (id 2). Use the `superthread-cli` skill for the `st` commands. Check `st boards list -s 2` and `st pages list -s 2` first, and skip anything that already exists.

- **Board** called `dayN` (lowercase, no space, like `day3`), with the same columns as the other day boards:

  ```bash
  st boards create -s 2 --title day4 --list "To do:todo" --list "Doing:doing" --list "Done:done" --list "Cancelled:canceled"
  ```

- **Make the board public**, like every day board, so viewers can follow along. `st` can't do this, so call the API with the token `st auth login` saved, without printing it:

  ```bash
  curl -s -X PATCH -H "Authorization: Bearer $(awk '/^token:/{print $2}' ~/.config/superthread/config.yaml | tr -d '"')" \
    -H "Content-Type: application/json" -d '{"is_public": true}' \
    "https://api.superthread.com/v1/tSyziWPE/boards/<board id>" | jq -r '.board.public_settings.url'
  ```

  It prints the board's public link. Run it on an existing day board too if it isn't public yet.

- **One starter card** in To do, "Define the 5 W's", since every day starts by defining the problem. Don't add any others.
- **Page** called "Day N" under the Days page (id 7), in the same format as "Day 2". On an existing page that shows a different problem, write it again with `st pages update <id> --content`.

  ```bash
  st pages create -s 2 --parent-page 7 --title "Day 4" --content "$(cat <<'MD'
  **Problem:** <title>

  **Form factor:** <the three picks, separated by commas>

  **Repo:** [build40for40/<repo>](https://github.com/build40for40/<repo>)

  <the problem, in full, as it is on the site>
  MD
  )"
  ```

  Add the `**Repo:**` line once the repo exists. The prep, demo and retro pages get added under the page during the day, so don't create them.

## 3. Create the repo

Follow "Starting a new repo" in the 40 for 40 folder's `CLAUDE.md` (the parent of the site checkout). Below, `<repo>` is the app's name, or `dayN` if it hasn't got one. Check `gh repo view build40for40/<repo>` first, and skip anything that already exists.

```bash
gh repo create build40for40/<repo> --public --description "<title>, built live for 40 for 40"
gh repo edit build40for40/<repo> --enable-auto-merge --delete-branch-on-merge --enable-squash-merge --enable-merge-commit=false --enable-rebase-merge=false
```

The second line turns on auto-merge, makes squash the only way to merge a PR and deletes each branch once it's merged. GitHub sometimes answers these with a 502, so check they took with `gh api repos/build40for40/<repo> --jq '{allow_auto_merge, allow_squash_merge, allow_merge_commit, allow_rebase_merge, delete_branch_on_merge}'` (true, true, false, false, true), and run it again if they didn't.

CI checks get required on `main` once CI exists, at the end of step 5.

In the 40 for 40 folder, `git init -b main` a `<repo>` folder next to `site/` with `origin` set to `git@github.com:build40for40/<repo>.git`, and commit straight to `main`:

- `AGENTS.md` about this repo only: the day number and date, the problem's title and full text, the owner, the three form factor picks, a pointer to `../AGENTS.md` for shared context, and that it's served at `build40for40.com/<app>/` once it has a name.
- `CLAUDE.md` as a symlink: `ln -s AGENTS.md CLAUDE.md`.
- A `.gitignore` that covers `.env*`, `.dev.vars*` (keeping the `.example` files), `.wrangler/`, `node_modules/` and `dist/`.

The pre-commit hooks run on their own. If one blocks the commit, fix the content and never bypass it. If a push fails with an Internal Server Error, push again.

CI deploys use the `CLOUDFLARE_API_TOKEN` organisation secret, so don't add one to the repo. Check the repo can see it with `gh api repos/build40for40/<repo>/actions/organization-secrets --jq '.secrets[].name'`, and if it can't, tell the user.

## 4. Report

Tell the user the repo link, the board's public link and the page, whether they were created or already there, and whether the form factor is still TBC. Say too that `main` won't require CI checks until the repo has CI (step 5).

## 5. When the app has a name

If the repo started as `dayN`, rename it after the app first:

```bash
gh repo rename <app> -R build40for40/dayN --yes
mv dayN <app>    # in the 40 for 40 folder
git -C <app> remote set-url origin git@github.com:build40for40/<app>.git
```

GitHub redirects the old name. Update the `**Repo:**` link on the Superthread page and the title in `AGENTS.md` too.

Apps are served at `build40for40.com/<app>/` by their own Worker. Once the repo has a scaffold with a `package.json`, open a PR on the day's repo that copies these from `joyo`:

- **`wrangler.jsonc`:** the 40 for 40 `account_id`, routes for `build40for40.com/<app>` and `build40for40.com/<app>/*` on the `build40for40.com` zone, and `preview_urls: true` so PRs get preview links. Change `name`, the routes and anything under `/joyo/` to the app's name.
- **The `wrangler` script in `package.json`:** `env -u CLOUDFLARE_API_KEY -u CLOUDFLARE_EMAIL wrangler --profile 40for40`.
- **`.github/workflows/ci.yml`:** tests and build on every PR, a preview upload with a link commented on the PR, and a deploy on pushes to `main`. Change the `/joyo/` in the preview link to the app's path.

The app must build for its own path, or its assets load from the site's root. Joyo sets Vite's `base: '/joyo/'`, and Sidekick uses `base: './'`. Merge the PR and check `https://build40for40.com/<app>/` answers 200. Then the app link is ready for `finish-day` at the end of the day.

### Require CI on `main`

Once a CI workflow is on `main`, whether from this PR or a template's own workflow, add a ruleset so nothing merges to `main` without passing it. Handup's "main: require CI" is the reference.

The required checks are the jobs that run on `pull_request` with no `paths` filter, named as GitHub shows them: the job's `name:` if it has one, otherwise its id (`ci` in Joyo and the web-app, cli-agent and whatsapp-agent templates, `check` in browser-extension and mobile-app). A job with a `paths` filter never reports on PRs that don't touch those paths, so requiring it would block them. Check the names on a real PR with `gh pr checks`.

```bash
gh api repos/build40for40/<repo>/rulesets --method POST --input - <<'JSON'
{
  "name": "main: require CI",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "rules": [{
    "type": "required_status_checks",
    "parameters": {
      "strict_required_status_checks_policy": false,
      "required_status_checks": [{ "context": "ci", "integration_id": 15368 }]
    }
  }]
}
JSON
```

`15368` is GitHub Actions. List one entry per required job. Check `gh api repos/build40for40/<repo>/rulesets` first and update the existing ruleset instead of adding a second. From then on, changes reach `main` through PRs: a direct push to `main` is rejected because its checks haven't run.
