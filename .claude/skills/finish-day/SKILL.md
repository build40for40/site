---
name: finish-day
description: Put a finished day's app on build40for40.com by adding it to the shipped history in src/data/days.ts and opening the PR, then set up the next day's Superthread board and page. Use when a day ships, when a shipped day gets new links, or when the next day needs setting up. Triggers include "finish day 3", "day 3 shipped", "ship today", "add the recording for day 2", "here's today's app link", "set up day 4", or a link to an app under build40for40.com.
---

# Finish a day

From 16:40 UK a day counts as shipped. Until it has an entry in `history` in `src/data/days.ts`, its box links the full build to the Twitch channel and hides "Try this idea". This skill adds that entry and gets it to production through a PR (steps 1 to 7), then sets up the next day (step 8). If the user only asks to set up a day, go straight to step 8.

## 1. Get the inputs

Ask for everything below in one message, and go ahead with whatever the user has. Only the app link is required.

| Input | Field | If missing |
| --- | --- | --- |
| App link | `appUrl` | Stop. A day can't ship without one |
| Full build recording (YouTube, or a Twitch VOD) | `recordingUrl` | Use `links.twitch` from `src/data/site.ts` |
| Build time, if it wasn't the full 4:40:00 | `buildTime` | `"4:40:00"` |
| Shorts: title, platform and link for each | `shorts` | `[]` |
| A screenshot or GIF that shows what the app does | `screenshot` | Offer to take one of the live app |
| A still from the day's stream | `still` | Pick a frame from the Twitch recording's thumbnails, save as `public/stills/day-NN.webp` |
| Substack write-up | `postUrl` | Leave it out |

The problem's title, text, owner and sponsors aren't needed from the user: they come from D1.

## 2. Find the day's problem

Work out the day number with `clock()` in `src/data/days.ts` (Day 1 is Monday 2 November 2026, weekdays only). Then rank production's ideas the way `buildBoard` does, leaving out ideas already in `history`:

```bash
curl -s https://build40for40.com/api/problems | jq -c --argjson shipped '["<history ids>"]' '.ideas | map(select(.id as $id | $shipped | index($id) | not) | . + {raised: (.sponsors | map(.amount) | add // 0)}) | map(select(.raised > 0)) | sort_by(-.raised, .submittedAt) | .[:3][] | {id, title, owner, raised}'
```

The first result is the day's problem, but sponsorships after 10:00 can reorder the ranking. Check it against the app itself (`curl -s <appUrl> | grep -io '<title>[^<]*'`), and if they don't clearly match, ask the user which problem was built.

## 3. Check the links

Every URL should answer 200 (`curl -sIL <url> | grep HTTP`). Use the trailing slash form for apps on build40for40.com, such as `https://build40for40.com/sidekick/`, so there's no redirect.

## 4. Add the screenshot

- Save it as `public/screenshots/<app>.webp`, 960px wide and ideally under 300 KB. Convert with `cwebp` (still images) or `gif2webp` (animations), both from `brew install webp`. If neither is installed, ask before installing.
- Strip metadata before committing: `exiftool -all= -overwrite_original <file>`. The pre-commit hook blocks images that still have it.
- It shows behind the play button at 35% opacity, so something that moves or shows the app working is better than a sign-in screen.
- To capture the live app, open it in the browser pane at desktop width and take a screenshot.

## 5. Write the history entry

Add the day to `history` in `src/data/days.ts`, in the same shape as the entries already there:

```ts
  3: {
    id: "<D1 problem id>",
    title: "<title>",
    problem: "<the first sentence or two of the problem>",
    owner: "<owner>",
    sponsors: [{ name: "<name>", amount: <amount> }],
    buildTime: "4:40:00",
    appUrl: "https://build40for40.com/<app>/",
    recordingUrl: "https://www.youtube.com/watch?v=<id>",
    postUrl: "<substack link>",
    screenshot: "/screenshots/<app>.webp",
    shorts: [{ title: "<title>", platform: "youtube", url: "https://www.youtube.com/shorts/<id>" }],
  },
```

- `id` must be the production D1 id. Title, problem, owner and sponsors are only fallbacks: the board swaps in the live values by id.
- Leave out `postUrl` and `screenshot` when there are none. Don't add empty strings.
- `platform` is a key in `src/data/brands.ts`. YouTube Shorts play inside the day box, and the rest open as links.
- To add links to a day that's already shipped (a recording that's just been uploaded, a new short), edit its existing entry.

## 6. Check it

- Restart the dev server first (`npx astro dev stop`, then `npx astro dev --background`). It doesn't always reload after `days.ts` changes, so you can end up checking the old board.
- Open `http://localhost:<port>/?now=<day's date>T18:00Z` and click the day's tile. Check that the title is right, "Try this idea ↗" goes to the app, "Watch the full build" goes to the recording, and the shorts and screenshot show. Local D1 has seed data, so the title and sponsors come from your fallbacks.
- Run `npm test`.

## 7. Ship it

- Branch from `origin/main` with a name like `ship-day-3-<app>`, with no `/` in it.
- Commit, push and open a PR with `gh pr create`. Explain the why in the body (which day, which app, which links are still to come), and don't list files.
- Enable auto-merge (`gh pr merge --auto --squash`) and wait for CI. Merging deploys it in about a minute.
- Never deploy by hand. See Deploys in `AGENTS.md`.
- If the recording, shorts or write-up are still to come, say so in the summary so the user knows to come back with them.

## 8. Set up the next day

Day N+1 needs a Superthread board and a Superthread page before 10:00. Its GitHub repo gets made at 10:00 by the `kickoff-day` skill, not here. Skip this after Day 40.

### Find the problem

Run the ranking from step 2 again with day N's id added to the shipped list. The first result is the next day's problem, and it should match "Up next" on build40for40.com. If day N+1 is in `GUEST_DAYS`, its problem is a secret until 10:00, so ask the user for it.

Ask the user for the day's form factor (Day 2's was "Local LLM / SLM"). If it isn't decided yet, write "TBC".

### Superthread

Everything goes in the General space (id 2). Use the `superthread-cli` skill for the `st` commands. Check `st boards list -s 2` and `st pages list -s 2` first, and skip anything that already exists.

- **Board** called `day<N+1>` (lowercase, no space, like `day3`), with the same columns as the other day boards:

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

- **Starter cards** in To do. Every day so far started by defining the problem, and the Day 2 retro asked for a content check on the board:
  - "Define the 5 W's"
  - "Where are we on content progress?"
- **Page** called "Day N+1" under the Days page (id 7), in the same format as "Day 2":

  ```bash
  st pages create -s 2 --parent-page 7 --title "Day 4" --content "$(cat <<'MD'
  **Problem:** <title>

  **Form factor:** <form factor>

  <the problem, in full, as it is on the site>
  MD
  )"
  ```

  The prep, demo and retro pages get added under it during the day, so don't create them now.

### Report

Tell the user what you created, with links to the board (its public link too) and the page, and whether the form factor is still TBC. The ranking can still change if someone sponsors before 10:00, so tell them to check the page against the site when the box opens.
