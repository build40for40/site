---
name: finish-day
description: Put a finished day's app on build40for40.com by adding it to the shipped history in src/data/days.ts and opening the PR, then talk the user through the day's LinkedIn post and draft it. Use when a day ships or when a shipped day gets new links. Triggers include "finish day 3", "day 3 shipped", "ship today", "add the recording for day 2", "here's today's app link", or a link to an app under build40for40.com.
---

# Finish a day

From 16:40 UK a day counts as shipped. Until it has an entry in `history` in `src/data/days.ts`, its box links the full build to the Twitch channel and hides "Try this idea". This skill adds that entry and gets it to production through a PR (steps 1 to 7), then helps write the day's LinkedIn post while it's fresh (step 8). It does no setup for the next day: the `kickoff-day` skill makes the board, page and repo when that day starts.

## 1. Get the inputs

Ask for everything below in one message, and go ahead with whatever the user has. Only the app link is required. Reuse links and media already supplied in the conversation. Do not ask for build time or block wrap-up on it; preserve an existing value or use the history schema’s default of `"4:40:00"` for a new entry.

| Input | Field | If missing |
| --- | --- | --- |
| App link | `appUrl` | Stop. A day can't ship without one |
| Short app demo, when available | `demoUrl`, `demoPoster` | Leave them out. Reuse an existing hosted demo and poster rather than upload duplicates |
| Full build recording (YouTube, or a Twitch VOD) | `recordingUrl` | Use `links.twitch` from `src/data/site.ts` |
| Shorts: title, platform and link for each | `shorts` | `[]`. YouTube shorts are picked up by the 08:00 cron, so only add one here to override it or for TikTok and Instagram |
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

- Keep a short app demo separate from `recordingUrl`, which is the full build. The day box plays `demoUrl` inline on desktop and mobile. A landing-page screenshot is suitable when the user requests one.
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

## 8. Draft the LinkedIn post

Once the PR is open, start on the day's LinkedIn post while CI runs. You're the user's thinking partner for a first draft, not the author of the final post. Skip this step when the user is only adding links to a day that already shipped, or when the day's page under "Linkedin Posts" already has a "Posted" section.

The `linkedin-post` skill has the sources, voice, format and where drafts are saved. This step adds the conversation before the draft. **Work in this order, and never skip ahead:**

1. **Raw material first.** Read what `linkedin-post` steps 2 and 3 list: the posts that went out, then the day's repo, its Superthread page with the prep, demo and retro notes, and its board. Search transcripts for moments rather than reading them in full. Tell the user in a few lines what you read and what wasn't there.
2. **Key questions second.** Ask these in one message, and let them answer by typing or in Wispr Flow:
   1. What's the one line that makes the app click, and why is it called that?
   2. Which of the day's three form factors did you go with, and why?
   3. What was funny, dumb or impressive about today?
   4. What went wrong, and how much time was left at the worst moment?
   5. What's the best thing anyone said: the guest, the problem owner or the team?
   6. Who's posting it, and who or what should be tagged?
   7. What image or clip have you got?

   Help them find the story rather than fill in a form. Use what you read to jog their memory ("the retro says the deploy broke at 16:20, was that on stream?"), and follow up on anything funny, tense or surprising. Ask whether there's a running joke or a callback to an earlier day. If an answer contradicts the notes, trust the user.
3. **Draft third,** only once they say they're ready or the questions are covered. Write two or three versions with different hooks, plus the comments, tags and media, as in `linkedin-post` steps 4 and 5. Above the drafts, add:

   > A first draft. Whoever posts it will rewrite most of it to make it funnier and punchier.

   Then save it as in `linkedin-post` step 6. When the user comes back with what they posted, follow its step 7.
