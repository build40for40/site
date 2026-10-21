import { START, TOTAL_DAYS, UK_TZ } from "./site";

export type Status = "locked" | "sponsored" | "unlocked" | "building" | "checkin" | "shipped" | "paused";

export interface Backer {
  name: string;
  amount: number;
}

export interface Day {
  day: number;
  status: Status;
  title?: string;
  description?: string;
  backers: Backer[];
  image?: string;
  appUrl?: string;
  recordingUrl?: string;
  note?: string;
}

export const statusMeta: Record<Status, { label: string; dot: string }> = {
  locked: { label: "LOCKED", dot: "bg-locked" },
  sponsored: { label: "SPONSORED", dot: "bg-sponsored" },
  unlocked: { label: "UNLOCKED", dot: "bg-live" },
  building: { label: "BUILDING", dot: "bg-live" },
  checkin: { label: "CHECK-IN", dot: "bg-live" },
  shipped: { label: "SHIPPED", dot: "bg-shipped" },
  paused: { label: "PAUSED", dot: "bg-paused" },
};

export const legend = [
  { label: "shipped", dot: "bg-shipped" },
  { label: "live", dot: "bg-live" },
  { label: "sponsored", dot: "bg-sponsored" },
  { label: "locked", dot: "bg-locked" },
];

export const isRevealed = (status: Status) => status !== "locked" && status !== "sponsored";
export const isLive = (status: Status) => status === "unlocked" || status === "building" || status === "checkin";

export const dayLabel = (day: number) => String(day).padStart(2, "0");

export const dayDate = (day: number) => new Date(Date.parse(START) + (day - 1) * 86_400_000);

export const formatUkDate = (date: Date) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: UK_TZ }).format(date);

export const formatDayDate = (day: number) => formatUkDate(dayDate(day));

const shipped: [string, string][] = [
  ["Splitting rent fairly", "A calculator that splits rent by room size, light and closet space."],
  ["Forgotten subscriptions", "Forward your receipts and it lists every recurring charge before it renews."],
  ["Meetings across time zones", "Paste a list of cities, get the three least painful hours for everyone."],
  ["Dying houseplants", "Snap a plant and get a watering schedule dropped into your calendar."],
  ["Group trip budgets", "One shared link where everyone logs costs and sees who owes whom."],
  ["Lost warranty receipts", "Photograph a receipt once and get pinged before the warranty runs out."],
];

const backers: Record<number, Backer[]> = {
  1: [{ name: "Maya R.", amount: 10 }, { name: "Anonymous", amount: 1 }],
  2: [{ name: "Ken O.", amount: 100 }],
  3: [{ name: "Priya S.", amount: 1 }],
  4: [{ name: "Northwind", amount: 1000 }],
  5: [{ name: "Northwind", amount: 1000 }, { name: "Tom & Jo", amount: 10 }],
  6: [{ name: "Anonymous", amount: 1 }],
  7: [{ name: "Lena K.", amount: 100 }, { name: "Sam P.", amount: 10 }],
  8: [{ name: "Sam P.", amount: 10 }],
  12: [{ name: "Northwind", amount: 100 }],
  15: [{ name: "Café Owl", amount: 100 }],
  22: [{ name: "Anonymous", amount: 1 }],
  40: [{ name: "Ryan H.", amount: 1000 }, { name: "Northwind", amount: 1000 }],
};

export const days: Day[] = Array.from({ length: TOTAL_DAYS }, (_, i) => {
  const day = i + 1;
  const dayBackers = backers[day] ?? [];
  if (day <= shipped.length) {
    const [title, description] = shipped[i];
    return { day, status: "shipped", title, description, backers: dayBackers, appUrl: "#", recordingUrl: "#" };
  }
  if (day === 7) {
    return {
      day,
      status: "building",
      title: "What's for dinner",
      description: "List what's in your fridge and get three recipes that use it up.",
      backers: dayBackers,
    };
  }
  return { day, status: dayBackers.length ? "sponsored" : "locked", backers: dayBackers };
});

export const topBackers = (list: Day[], limit = 5) => {
  const totals = new Map<string, { name: string; days: number; total: number }>();
  for (const { backers } of list) {
    for (const { name, amount } of backers) {
      if (name === "Anonymous") continue;
      const entry = totals.get(name) ?? { name, days: 0, total: 0 };
      entry.days += 1;
      entry.total += amount;
      totals.set(name, entry);
    }
  }
  return [...totals.values()].sort((a, b) => b.total - a.total).slice(0, limit);
};
