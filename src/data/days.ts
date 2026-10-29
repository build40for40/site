import { START, TOTAL_DAYS, UK_TZ } from "./site";

export interface Sponsor {
  name: string;
  amount: number;
}

export interface Idea {
  id: number;
  title: string;
  problem: string;
  owner: string;
  sponsors: Sponsor[];
}

export interface ShippedIdea extends Idea {
  buildTime: string;
  appUrl: string;
  recordingUrl: string;
}

export type DayStatus = "shipped" | "live" | "queued" | "guest" | "open";

export interface Day {
  key: string;
  day: number;
  date: string;
  status: DayStatus;
  idea?: Idea | ShippedIdea;
  rank?: number;
}

export interface PoolIdea {
  key: string;
  idea: Idea;
}

export type Phase = "before" | "live" | "after";

export const GUEST_DAYS = new Set([10, 15, 21, 28, 34, 40]);
export const SPONSOR_AMOUNTS = [10, 20, 40, 100];
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

export function buildBoard(ideas: Idea[], history: Record<number, ShippedIdea>, now: number) {
  const { today, phase, isToday } = clock(now);
  const ranked = ideas.toSorted((a, b) => raised(b) - raised(a));
  const days: Day[] = [];
  let next = 0;
  let rank = 0;

  for (let day = 1; day <= TOTAL_DAYS; day++) {
    const base = { key: `day-${day}`, day, date: dayDate(day) };
    const started = day < today || (day === today && phase !== "before");
    if (GUEST_DAYS.has(day)) {
      days.push({ ...base, status: "guest" });
    } else if (started) {
      const idea = history[day] ?? ranked[next++];
      const status = day === today && phase === "live" ? "live" : "shipped";
      days.push(idea ? { ...base, status, idea } : { ...base, status: "open" });
    } else if (next < ranked.length) {
      days.push({ ...base, status: "queued", idea: ranked[next++], rank: ++rank });
    } else {
      days.push({ ...base, status: "open" });
    }
  }

  const pool: PoolIdea[] = ranked.slice(next).map((idea) => ({ key: `pool-${idea.id}`, idea }));
  return { today, phase, isToday, days, pool };
}

const firstNames = ["Maia", "Rohan", "Priya", "Ken", "Lena", "Sam", "Tom", "Jo", "Ayesha", "Dan", "Ellie", "Femi", "Grace", "Hugo", "Isla", "Kemi", "Leo", "Nina", "Omar", "Ravi", "Sofia", "Theo", "Wren", "Zara"];

function mockSponsors(total: number, count: number, seed: number): Sponsor[] {
  const n = Math.min(count, total);
  if (!n) return [];
  const weights = Array.from({ length: n }, (_, i) => 1 / (i + 1));
  const sum = weights.reduce((a, b) => a + b, 0);
  const amounts = weights.map((w) => Math.max(1, Math.round((total * w) / sum)));
  amounts[0] += total - amounts.reduce((a, b) => a + b, 0);
  return amounts.map((amount, i) => ({ name: i % 4 === 3 ? "Anonymous" : firstNames[(seed * 5 + i * 3) % firstNames.length], amount }));
}

const mockIdea = ([title, problem, total, count]: [string, string, number, number], id: number): Idea => ({
  id,
  title,
  problem,
  owner: firstNames[(id * 7 + 2) % firstNames.length],
  sponsors: mockSponsors(total, count, id),
});

export const ideas: Idea[] = ([
  ["Endless standups", "Fifteen people, one meeting, nobody listening. Turn updates into a two-minute digest.", 1200, 5],
  ["Parking ticket dread", "Photograph a parking sign and get a plain yes or no on whether you can park there right now.", 850, 7],
  ["Duplicate photos", "Find the 400 near-identical shots of the same sunset and keep the best one.", 600, 3],
  ["Overdue library books", "Every library card in the house in one place, with a nudge before the fines start.", 420, 9],
  ["Noisy group chats", "Catch up on 300 unread messages with a summary of the bits that actually need you.", 300, 5],
  ["Tracking job applications", "Forward the confirmation email and it builds the pipeline for you.", 250, 5],
  ["Kids' screen time", "A screen time deal the whole family can see and nobody can fudge.", 180, 2],
  ["Finding a quiet café", "Somewhere nearby with wifi, a socket and no blender for the next hour.", 120, 3],
  ["Last-minute gifts", "Tell it who they are and your budget, get three gifts you can buy before 18:00.", 100, 1],
  ["Shared chore rotas", "A chore rota for flatmates that remembers who actually did the bins.", 60, 4],
  ["Forgotten birthdays", "Birthdays from every app in one feed, with a reminder a week early.", 40, 2],
  ["Chasing invoices", "Polite, then less polite, reminders for freelancers who'd rather not.", 25, 1],
  ["Picking a paint colour", "Point your camera at a wall and try twenty colours before buying a tester pot.", 20, 2],
  ["Splitting the bill", "Photograph the receipt, tap what you had, everyone gets a payment link.", 15, 1],
  ["Notes nobody reads", "Turn meeting notes into the three actions people actually need.", 12, 2],
  ["Lost Wi-Fi passwords", "A QR code for guests so nobody reads the router upside down again.", 10, 1],
  ["Choosing a podcast", "Say how long your commute is, get one episode that fits it exactly.", 10, 1],
  ["Moving house", "Every account to update when you move, as one checklist.", 8, 1],
  ["Borrowing tools", "See which neighbour has a drill before you buy a third one.", 5, 1],
  ["Unread newsletters", "One weekly digest of the newsletters you meant to read.", 5, 1],
  ["Pet medication", "Shared reminders so the dog doesn't get its pill twice.", 4, 1],
  ["Booking a court", "Find a free tennis court near you without opening six council websites.", 3, 1],
  ["Expiring coupons", "Every voucher and code in one list, sorted by when it dies.", 3, 1],
  ["Habit burnout", "A habit tracker that forgives you for missing a day.", 2, 1],
  ["Car maintenance", "MOT, tax and service dates for your car, nudged at the right time.", 2, 1],
  ["Language partners", "Match with someone learning your language who speaks the one you want.", 1, 1],
  ["Potluck planning", "Stop five people bringing hummus.", 1, 1],
  ["Planting dates", "What to sow this week for your postcode.", 0, 0],
  ["Commute playlists", "A playlist exactly as long as today's train.", 0, 0],
  ["Shift swaps", "Swap shifts with coworkers without the 40-message group chat.", 0, 0],
] as [string, string, number, number][]).map(mockIdea);

const mockShipped = (day: number, title: string, problem: string, total: number, count: number, buildTime: string): ShippedIdea => ({
  ...mockIdea([title, problem, total, count], 100 + day),
  buildTime,
  appUrl: "#",
  recordingUrl: "#",
});

export const history: Record<number, ShippedIdea> = {
  1: mockShipped(1, "Splitting rent fairly", "A calculator that splits rent by room size, light and closet space.", 110, 2, "4:38:12"),
  2: mockShipped(2, "Forgotten subscriptions", "Forward your receipts and it lists every recurring charge before it renews.", 100, 1, "4:12:40"),
  3: mockShipped(3, "Meetings across time zones", "Paste a list of cities, get the three least painful hours for everyone.", 40, 3, "4:39:58"),
  4: mockShipped(4, "Dying houseplants", "Snap a plant and get a watering schedule dropped into your calendar.", 1000, 1, "3:57:21"),
  5: mockShipped(5, "Group trip budgets", "One shared link where everyone logs costs and sees who owes whom.", 1010, 2, "4:31:05"),
  6: mockShipped(6, "Lost warranty receipts", "Photograph a receipt once and get pinged before the warranty runs out.", 25, 3, "4:40:00"),
  7: mockShipped(7, "What's for dinner", "List what's in your fridge and get three recipes that use it up.", 110, 2, "4:21:07"),
};

export const pad = (n: number) => String(n).padStart(2, "0");

export const hms = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
};

export function countdownParts(ms: number): [number, string][] {
  const s = Math.max(0, Math.floor(ms / 1000));
  const parts: [number, string][] = [[Math.floor(s / 3600) % 24, "h"], [Math.floor(s / 60) % 60, "m"], [s % 60, "s"]];
  return s >= 86_400 ? [[Math.floor(s / 86_400), "d"], ...parts] : parts;
}

export function mergedSponsors(sponsors: Sponsor[]) {
  const rows = new Map<string, number>();
  for (const { name, amount } of sponsors) rows.set(name, (rows.get(name) ?? 0) + amount);
  return [...rows].map(([name, amount]) => ({ name, amount })).toSorted((a, b) => b.amount - a.amount);
}

export const sponsorCount = (sponsors: Sponsor[]) =>
  new Set(sponsors.filter((s) => s.name !== "Anonymous").map((s) => s.name)).size + sponsors.filter((s) => s.name === "Anonymous").length;

export const listOf = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0]);

export type EntryStatus = DayStatus | "pool";

export interface Entry {
  key: string;
  status: EntryStatus;
  day?: number;
  date?: string;
  idea?: Idea | ShippedIdea;
  rank?: number;
}

export function statusLabel(entry: Entry, today: number) {
  if (entry.status === "queued") return entry.day === today ? "Up first" : raised(entry.idea!) ? "In the queue" : "Needs a sponsor";
  return { shipped: "Shipped", live: "Live now", guest: "Guest day", open: "Up for grabs", pool: "In the pool" }[entry.status];
}

export const tones: Record<EntryStatus, { glow: string; dot: string; text: string; border: string; ring: string }> = {
  shipped: { glow: "from-shipped/45 to-shipped/5", dot: "bg-shipped", text: "text-shipped", border: "border-shipped", ring: "ring-shipped" },
  live: { glow: "from-live/45 to-live/5", dot: "bg-live", text: "text-live", border: "border-live", ring: "ring-live" },
  queued: { glow: "from-queued/25 to-transparent", dot: "bg-queued", text: "text-queued", border: "border-queued", ring: "ring-queued" },
  guest: { glow: "from-guest/45 to-guest/5", dot: "bg-guest", text: "text-guest", border: "border-guest", ring: "ring-guest" },
  open: { glow: "", dot: "ring-1 ring-night-edge ring-inset", text: "text-night-sub", border: "border-night-edge", ring: "ring-night-edge" },
  pool: { glow: "", dot: "ring-1 ring-queued ring-inset", text: "text-night-sub", border: "border-night-edge", ring: "ring-night-edge" },
};
