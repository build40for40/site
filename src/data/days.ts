import type { Brand } from "./brands";
import { START, TOTAL_DAYS, UK_TZ } from "./site";

export { SPONSOR_AMOUNTS } from "./site";

export interface Sponsor {
  name: string;
  amount: number;
  group?: string;
}

export interface Idea {
  id: string;
  title: string;
  problem: string;
  owner?: string;
  sponsors: Sponsor[];
  seed?: string;
  submittedAt?: string;
  categories?: string[];
  // Every payment with when it landed, so a day's pick can be frozen at its 10:00 start.
  paid?: { at: string; amount: number }[];
}

export interface Short {
  title: string;
  platform: Brand;
  url: string;
}

export interface ShippedIdea extends Idea {
  buildTime: string;
  appUrl: string;
  recordingUrl: string;
  postUrl?: string;
  screenshot?: string;
  // A frame from the day's stream, behind "Watch the full build".
  still?: string;
  shorts: Short[];
  // True for a day that ran out of clock without shipping. It keeps its box, recording and write-up, but shows as Shipwrecked.
  wrecked?: boolean;
}

export type DayStatus = "shipped" | "wrecked" | "live" | "queued" | "guest" | "open";

export interface Day {
  key: string;
  day: number;
  date: string;
  status: DayStatus;
  idea?: Idea | ShippedIdea;
  rank?: number;
  sponsors?: Sponsor[];
}

export interface PoolIdea {
  key: string;
  idea: Idea;
}

export type Phase = "before" | "live" | "after";

export const GUEST_DAYS = new Set([11]);
export const DEFAULT_AMOUNT = 40;

const DAY_MS = 86_400_000;
// The stream runs from 10:00 to a fixed 16:40 UK (6:40 after the start), not a timer, so lunch and breaks come out of the same window.
export const BUILD_MS = (6 * 60 + 40) * 60_000;
const startMs = Date.parse(START);

export const dayStart = (day: number) => startMs + (Math.floor((day - 1) / 5) * 7 + ((day - 1) % 5)) * DAY_MS;

const ukDate = (ms: number, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone: UK_TZ, ...opts }).format(ms);
export const dayDate = (day: number) => ukDate(dayStart(day), { weekday: "short", day: "numeric", month: "short" });
const calendarDay = (ms: number) => ukDate(ms, { year: "numeric", month: "2-digit", day: "2-digit" });

export const raised = (idea: Idea) => idea.sponsors.reduce((sum, s) => sum + s.amount, 0);
// What an idea had raised by a moment. Without payment times every sponsor counts.
export const raisedBy = (idea: Idea, ms: number) =>
  idea.paid ? idea.paid.reduce((sum, p) => sum + (Date.parse(p.at) < ms ? p.amount : 0), 0) : raised(idea);
const byFunding = (money: (idea: Idea) => number) => (a: Idea, b: Idea) => money(b) - money(a) || (a.submittedAt ?? "").localeCompare(b.submittedAt ?? "");

export function clock(now: number): { today: number; phase: Phase; isToday: boolean } {
  const days = Array.from({ length: TOTAL_DAYS }, (_, i) => i + 1);
  const same = days.find((day) => calendarDay(dayStart(day)) === calendarDay(now));
  if (same) {
    const start = dayStart(same);
    const phase = now < start ? "before" : now < start + BUILD_MS ? "live" : "after";
    return { today: same, phase, isToday: true };
  }
  const next = days.find((day) => dayStart(day) > now);
  return next ? { today: next, phase: "before", isToday: false } : { today: TOTAL_DAYS, phase: "after", isToday: false };
}

export function buildBoard(ideas: Idea[], history: Record<number, ShippedIdea>, now: number, guestSponsors: Record<number, Sponsor[]> = {}) {
  const { today, phase, isToday } = clock(now);
  const started = (day: number) => day < today || (day === today && phase !== "before");
  // Only ideas with money behind them get a day, the most first and the oldest first on a tie. Everything at $0 waits
  // in the pool, after any funded overflow.
  const loaded = new Map(ideas.map((idea) => [idea.id, idea]));
  const shipped = new Set(Object.values(history).map((idea) => idea.id));
  const waiting = ideas.filter((idea) => !shipped.has(idea.id));
  // A day locks at 10:00: a started day without history takes the top idea by what was paid before its start, so a
  // sponsor arriving mid-build only reshuffles the days still to come.
  const locked = new Map<number, Idea>();
  for (let day = 1; day <= TOTAL_DAYS; day++) {
    if (GUEST_DAYS.has(day) || !started(day) || history[day]) continue;
    const taken = new Set([...locked.values()].map((idea) => idea.id));
    const start = dayStart(day);
    const pick = waiting.filter((idea) => !taken.has(idea.id) && raisedBy(idea, start) > 0).toSorted(byFunding((idea) => raisedBy(idea, start)))[0];
    if (pick) locked.set(day, pick);
  }
  const lockedIds = new Set([...locked.values()].map((idea) => idea.id));
  const ranked = waiting.filter((idea) => !lockedIds.has(idea.id) && raised(idea) > 0).toSorted(byFunding(raised));
  const unfunded = waiting.filter((idea) => !lockedIds.has(idea.id) && raised(idea) === 0);
  const days: Day[] = [];
  let next = 0;
  let rank = 0;

  for (let day = 1; day <= TOTAL_DAYS; day++) {
    const base = { key: `day-${day}`, day, date: dayDate(day) };
    if (GUEST_DAYS.has(day)) {
      days.push({ ...base, status: "guest", sponsors: guestSponsors[day] ?? [] });
    } else if (started(day)) {
      const idea = history[day] ? { ...history[day], ...loaded.get(history[day].id) } : locked.get(day);
      const status = day === today && phase === "live" ? "live" : history[day]?.wrecked ? "wrecked" : "shipped";
      days.push(idea ? { ...base, status, idea } : { ...base, status: "open" });
    } else if (next < ranked.length) {
      days.push({ ...base, status: "queued", idea: ranked[next++], rank: ++rank });
    } else {
      days.push({ ...base, status: "open" });
    }
  }

  const pool: PoolIdea[] = [...ranked.slice(next), ...unfunded].map((idea) => ({ key: `pool-${idea.id}`, idea }));
  return { today, phase, isToday, days, pool };
}

export const history: Record<number, ShippedIdea> = {
  1: {
    id: "708b9fc7-f16c-4d31-b542-eadb1ede7350",
    title: "Unknown birth time",
    problem: "I want to know what time i was born on my birthday to get an accurate astrology reading",
    owner: "Samira",
    sponsors: [{ name: "Samira", amount: 104 }],
    buildTime: "4:40:00",
    appUrl: "https://build40for40.com/joyo/",
    recordingUrl: "https://www.youtube.com/watch?v=KA8ltrIe1Lk",
    postUrl: "https://build40for40.substack.com/p/we-spent-104-to-find-out-what-time",
    screenshot: "/screenshots/joyo.webp",
    still: "/stills/day-01.webp",
    shorts: [{ title: "Can you find what time you were born using astrology?", platform: "youtube", url: "https://www.youtube.com/shorts/F3FZkOdvFHc" }],
  },
  2: {
    id: "08b686ea-ed39-441f-9f21-d3b82dbd2f86",
    title: "Learning games from scratch",
    problem: "I want to play video games, but I never learned how. I’d love to play games like Fortnite with my family, but almost everything designed to help assumes I already understand how modern games work.",
    owner: "JaneZee",
    sponsors: [{ name: "JaneZee", amount: 104 }],
    buildTime: "4:40:00",
    appUrl: "https://build40for40.com/sidekick/",
    recordingUrl: "https://www.twitch.tv/build40for40",
    still: "/stills/day-02.webp",
    shorts: [{ title: "Twitch challenged us to build a tool to make gaming more accessible for women", platform: "youtube", url: "https://www.youtube.com/shorts/nLoslaN7rog" }],
  },
  3: {
    id: "061c4947-8b2e-4a55-a628-12b3e843fdef",
    title: "Hard to know which brands are ethical",
    problem: "Christmas is the busiest shopping period of the year, but it's hard to know which brands have actually been good all year. Nobody has time to research every company behind the toys and gifts on their list.",
    owner: "Santa",
    sponsors: [{ name: "Santa", amount: 105 }],
    buildTime: "4:40:00",
    appUrl: "https://build40for40.com/naughty-list/",
    recordingUrl: "https://www.twitch.tv/build40for40",
    screenshot: "/screenshots/naughty-list.jpg",
    still: "/stills/day-03.webp",
    shorts: [{ title: "Santa paid us $105 to find out which brands were on the naughty list", platform: "youtube", url: "https://www.youtube.com/shorts/Whn0ejL9Rfs" }],
  },
  4: {
    id: "d9cbe60b-9d63-4fb8-8b2e-9760323f7b5a",
    title: "Cold outreach to founders",
    problem: "Building a business is deeply personal, and when it comes to succession, founders don't want cold outreach from strangers: they want a trusted partner who understands their life’s work.",
    owner: "Aqil",
    sponsors: [{ name: "Aqil", amount: 104 }, { name: "Rohan", amount: 40 }],
    buildTime: "4:40:00",
    appUrl: "https://build40for40.com/synergy/",
    recordingUrl: "https://www.twitch.tv/build40for40",
    screenshot: "/screenshots/synergy.webp",
    still: "/stills/day-04.webp",
    shorts: [{ title: "How to get acquired by Private Equity", platform: "youtube", url: "https://www.youtube.com/shorts/e5QekR32v0w" }],
  },
  5: {
    id: "6fab6179-d296-4b82-8b62-9d007728fc0f",
    title: "Recipes stuck on Instagram",
    problem: "I have thousands of recipes saved on Instagram that I always want to try, but I forget because I don’t want to be on Instagram all the time, especially when cooking.",
    owner: "Mac",
    sponsors: [{ name: "Anonymous", amount: 80 }, { name: "Rohan", amount: 8 }],
    buildTime: "4:40:00",
    wrecked: true,
    appUrl: "https://build40for40.com/sous/",
    recordingUrl: "https://www.twitch.tv/build40for40",
    screenshot: "/screenshots/sous.webp",
    shorts: [{ title: "Did we create the world's greatest recipe app?", platform: "youtube", url: "https://www.youtube.com/shorts/qwL6EUNxmhc" }],
  },
  6: {
    id: "160bacac-038f-45fc-acbe-52b000cf46a4",
    title: "Repurposing writing into content",
    problem: "I want to turn my Substack posts and a book that I have written into a content engine for marketing. Breaking it up into social media scripts and content that I can use - no hallucination.",
    owner: "Kate",
    sponsors: [{ name: "Kate", amount: 80 }],
    buildTime: "4:40:00",
    appUrl: "https://build40for40.com/hookr/",
    recordingUrl: "https://www.twitch.tv/build40for40",
    postUrl: "https://build40for40.substack.com/p/lets-get-you-out-of-my-saves-and",
    screenshot: "/screenshots/hookr.webp",
    shorts: [],
  },
  8: {
    id: "e5d2dfc8-5b99-45d3-889d-2c9808116dd7",
    title: "Sudden mass layoffs",
    problem: "Yesterday, while we were building Poppy, my wife called me unexpectedly. The entire company of Fortis Games shut down and the reports say 440 people will lose their jobs. How can we help?",
    owner: "Lawrence",
    sponsors: [{ name: "Lawrence", amount: 45 }],
    buildTime: "4:40:00",
    appUrl: "https://build40for40.com/handup/",
    recordingUrl: "https://www.twitch.tv/build40for40",
    screenshot: "/screenshots/handup.webp",
    shorts: [],
  },
};

export const pad = (n: number) => String(n).padStart(2, "0");

export function countdownParts(ms: number): [number, string][] {
  const s = Math.max(0, Math.floor(ms / 1000));
  const parts: [number, string][] = [[Math.floor(s / 3600) % 24, "h"], [Math.floor(s / 60) % 60, "m"], [s % 60, "s"]];
  return s >= 86_400 ? [[Math.floor(s / 86_400), "d"], ...parts] : parts;
}

export const countdown = (ms: number) => countdownParts(ms).map(([value, unit]) => `${pad(value)}${unit}`).join(" ");

export function mergedSponsors(sponsors: Sponsor[]) {
  const rows: Sponsor[] = [];
  const named = new Map<string, Sponsor>();
  for (const sponsor of sponsors) {
    const previous = sponsor.name !== "Anonymous" && sponsor.group ? named.get(sponsor.group) : undefined;
    if (previous) previous.amount += sponsor.amount;
    else {
      const row = { ...sponsor };
      rows.push(row);
      if (sponsor.name !== "Anonymous" && sponsor.group) named.set(sponsor.group, row);
    }
  }
  return rows.toSorted((a, b) => b.amount - a.amount);
}

export const sponsorCount = (sponsors: Sponsor[]) => mergedSponsors(sponsors).length;

export const listOf = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0]);

export type EntryStatus = DayStatus | "pool" | "us";

export interface Entry {
  key: string;
  status: EntryStatus;
  day?: number;
  date?: string;
  idea?: Idea | ShippedIdea;
  rank?: number;
  sponsors?: Sponsor[];
}

export function statusLabel(entry: Entry, today: number) {
  if (entry.status === "queued") return entry.day === today ? "Up first" : raised(entry.idea!) ? "In the queue" : "Needs a sponsor";
  return { shipped: "Shipped", wrecked: "Shipwrecked", live: "Live now", guest: "Guest day", open: "Up for grabs", pool: "In the pool", us: "Sponsor us" }[entry.status];
}

export const tones: Record<EntryStatus, { dot: string; text: string; border: string; ring: string }> = {
  shipped: { dot: "bg-shipped", text: "text-shipped", border: "border-shipped", ring: "ring-shipped" },
  wrecked: { dot: "bg-wrecked", text: "text-wrecked", border: "border-wrecked", ring: "ring-wrecked" },
  live: { dot: "bg-live", text: "text-live", border: "border-live", ring: "ring-live" },
  queued: { dot: "bg-queued", text: "text-queued", border: "border-queued", ring: "ring-queued" },
  guest: { dot: "bg-guest", text: "text-guest", border: "border-guest", ring: "ring-guest" },
  open: { dot: "ring-1 ring-night-edge ring-inset", text: "text-night-sub", border: "border-night-edge", ring: "ring-night-edge" },
  pool: { dot: "ring-1 ring-queued ring-inset", text: "text-night-sub", border: "border-night-edge", ring: "ring-night-edge" },
  us: { dot: "bg-pop-blue", text: "text-pop-cyan", border: "border-pop-blue", ring: "ring-pop-blue" },
};
