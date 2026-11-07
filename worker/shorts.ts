import { dayStart, type Short } from "../src/data/days";
import { TOTAL_DAYS } from "../src/data/site";

// The channel's public feed of its latest videos. No key needed.
export const FEED_URL = "https://www.youtube.com/feeds/videos.xml?channel_id=UCbtnD0lMmfszxgCgKJnQV1w";

export interface FeedShort {
  videoId: string;
  title: string;
  publishedAt: string;
}

const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const unescape = (text: string) =>
  text.replace(/&(#x?[0-9a-f]+|\w+);/gi, (match, code: string) =>
    code[0] === "#" ? String.fromCodePoint(parseInt(code.slice(code[1] === "x" ? 2 : 1), code[1] === "x" ? 16 : 10)) : (entities[code] ?? match),
  );

// Only shorts: full streams and other videos link to /watch, not /shorts. Hashtags at the end of a title are dropped.
export function parseFeed(xml: string): FeedShort[] {
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].flatMap(([, entry]) => {
    const videoId = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
    const title = entry.match(/<title>([^<]*)<\/title>/)?.[1];
    const publishedAt = entry.match(/<published>([^<]+)<\/published>/)?.[1];
    const isShort = /<link rel="alternate" href="https:\/\/www\.youtube\.com\/shorts\//.test(entry);
    return videoId && title !== undefined && publishedAt && isShort ? [{ videoId, title: unescape(title).replace(/(\s+#[\p{L}\p{N}_]+)+\s*$/u, "").trim(), publishedAt }] : [];
  });
}

// A short belongs to the last build that started before it went up, so the one posted that night or over the weekend
// lands on the right day. Anything from before Day 1 belongs to no day.
export function dayFor(publishedAt: string) {
  const at = Date.parse(publishedAt);
  let day = 0;
  while (day < TOTAL_DAYS && dayStart(day + 1) <= at) day++;
  return day || null;
}

// Run by the morning cron. Only adds shorts it hasn't seen, so a day fixed by hand is never overwritten.
export async function syncShorts(db: D1Database, fetchFeed: () => Promise<string>, now = new Date()) {
  const found = parseFeed(await fetchFeed()).flatMap((short) => {
    const day = dayFor(short.publishedAt);
    return day ? [{ ...short, day }] : [];
  });
  if (!found.length) return 0;
  await db.batch(
    found.map(({ videoId, day, title, publishedAt }) =>
      db
        .prepare("INSERT INTO youtube_shorts (video_id, day, title, published_at, found_at) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT DO NOTHING")
        .bind(videoId, day, title, publishedAt, now.toISOString()),
    ),
  );
  return found.length;
}

export async function listShorts(db: D1Database) {
  const { results } = await db.prepare("SELECT day, video_id, title FROM youtube_shorts ORDER BY published_at").all<{ day: number; video_id: string; title: string }>();
  const shorts: Record<number, Short[]> = {};
  for (const { day, video_id, title } of results) (shorts[day] ??= []).push({ title, platform: "youtube", url: `https://www.youtube.com/shorts/${video_id}` });
  return shorts;
}

export const fetchFeed = async () => {
  const response = await fetch(FEED_URL);
  if (!response.ok) throw new Error(`YouTube feed returned ${response.status}`);
  return response.text();
};
