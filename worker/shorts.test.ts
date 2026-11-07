import { expect, test } from "vitest";
import { dayFor, listShorts, parseFeed, syncShorts } from "./shorts";
import { testDb } from "./test-db";

const entry = (id: string, title: string, published: string, kind = "shorts") => `<entry>
  <id>yt:video:${id}</id>
  <yt:videoId>${id}</yt:videoId>
  <title>${title}</title>
  <link rel="alternate" href="https://www.youtube.com/${kind === "shorts" ? `shorts/${id}` : `watch?v=${id}`}"/>
  <published>${published}</published>
</entry>`;

const feed = [
  entry("qwL6EUNxmhc", "Did we create the world&#39;s greatest recipe app? 🤤", "2026-11-07T00:07:31+00:00"),
  entry("683Tiy0KMk4", "40 for 40 Live Stream", "2026-11-06T18:24:00+00:00", "watch"),
  entry("F3FZkOdvFHc", "Can you find what time you were born using astrology?", "2026-11-02T23:28:00+00:00"),
  entry("EaJNlFuyq0U", "What is a cron job? &amp; more #vibecoding #learntocode", "2026-11-01T13:04:00+00:00"),
].join("\n");

test("reads only shorts from the feed, unescaping titles and dropping trailing hashtags", () => {
  expect(parseFeed(feed)).toEqual([
    { videoId: "qwL6EUNxmhc", title: "Did we create the world's greatest recipe app? 🤤", publishedAt: "2026-11-07T00:07:31+00:00" },
    { videoId: "F3FZkOdvFHc", title: "Can you find what time you were born using astrology?", publishedAt: "2026-11-02T23:28:00+00:00" },
    { videoId: "EaJNlFuyq0U", title: "What is a cron job? & more", publishedAt: "2026-11-01T13:04:00+00:00" },
  ]);
});

test("files a short under the last build that started before it, and nothing before Day 1", () => {
  expect(dayFor("2026-11-02T23:28:00Z")).toBe(1);
  expect(dayFor("2026-11-03T09:59:00Z")).toBe(1);
  expect(dayFor("2026-11-03T10:00:00Z")).toBe(2);
  expect(dayFor("2026-11-07T00:07:31Z")).toBe(5);
  expect(dayFor("2026-11-08T20:00:00Z")).toBe(5);
  expect(dayFor("2026-11-01T13:04:00Z")).toBeNull();
});

test("saves new shorts by day and never overwrites a day fixed by hand", async () => {
  const { db, sqlite } = testDb();
  expect(await syncShorts(db, async () => feed)).toBe(2);
  sqlite.prepare("UPDATE youtube_shorts SET day = 4 WHERE video_id = 'qwL6EUNxmhc'").run();
  await syncShorts(db, async () => feed);
  expect(await listShorts(db)).toEqual({
    1: [{ title: "Can you find what time you were born using astrology?", platform: "youtube", url: "https://www.youtube.com/shorts/F3FZkOdvFHc" }],
    4: [{ title: "Did we create the world's greatest recipe app? 🤤", platform: "youtube", url: "https://www.youtube.com/shorts/qwL6EUNxmhc" }],
  });
});
