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
}

export type DayStatus = "shipped" | "live" | "queued" | "guest" | "open";

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

export const GUEST_DAYS = new Set([10]);
export const DEFAULT_AMOUNT = 40;

const DAY_MS = 86_400_000;
export const BUILD_MS = (4 * 60 + 40) * 60_000;
const startMs = Date.parse(START);

export const dayStart = (day: number) => startMs + (Math.floor((day - 1) / 5) * 7 + ((day - 1) % 5)) * DAY_MS;

const ukDate = (ms: number, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone: UK_TZ, ...opts }).format(ms);
export const dayDate = (day: number) => ukDate(dayStart(day), { weekday: "short", day: "numeric", month: "short" });
const calendarDay = (ms: number) => ukDate(ms, { year: "numeric", month: "2-digit", day: "2-digit" });

export const raised = (idea: Idea) => idea.sponsors.reduce((sum, s) => sum + s.amount, 0);

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
  const ranked = waiting.filter((idea) => raised(idea) > 0).toSorted((a, b) => raised(b) - raised(a) || (a.submittedAt ?? "").localeCompare(b.submittedAt ?? ""));
  const unfunded = waiting.filter((idea) => raised(idea) === 0);
  const days: Day[] = [];
  let next = 0;
  let rank = 0;

  for (let day = 1; day <= TOTAL_DAYS; day++) {
    const base = { key: `day-${day}`, day, date: dayDate(day) };
    if (GUEST_DAYS.has(day)) {
      days.push({ ...base, status: "guest", sponsors: guestSponsors[day] ?? [] });
    } else if (started(day)) {
      const idea = history[day] ? { ...history[day], ...loaded.get(history[day].id) } : ranked[next++];
      const status = day === today && phase === "live" ? "live" : "shipped";
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
  return { shipped: "Shipped", live: "Live now", guest: "Guest day", open: "Up for grabs", pool: "In the pool", us: "Sponsor us" }[entry.status];
}

export const tones: Record<EntryStatus, { dot: string; text: string; border: string; ring: string }> = {
  shipped: { dot: "bg-shipped", text: "text-shipped", border: "border-shipped", ring: "ring-shipped" },
  live: { dot: "bg-live", text: "text-live", border: "border-live", ring: "ring-live" },
  queued: { dot: "bg-queued", text: "text-queued", border: "border-queued", ring: "ring-queued" },
  guest: { dot: "bg-guest", text: "text-guest", border: "border-guest", ring: "ring-guest" },
  open: { dot: "ring-1 ring-night-edge ring-inset", text: "text-night-sub", border: "border-night-edge", ring: "ring-night-edge" },
  pool: { dot: "ring-1 ring-queued ring-inset", text: "text-night-sub", border: "border-night-edge", ring: "ring-night-edge" },
  us: { dot: "bg-pop-blue", text: "text-pop-cyan", border: "border-pop-blue", ring: "ring-pop-blue" },
};
