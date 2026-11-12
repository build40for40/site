export const CHARTS = ["popularity", "timeline", "count"] as const;
export const SOURCES = ["books_uk", "books_us", "runway", "museum"] as const;
export const COUNT_BY = ["decade", "category"] as const;

export type ChartKind = (typeof CHARTS)[number];
export type Source = (typeof SOURCES)[number];
export type CountBy = (typeof COUNT_BY)[number];

export interface ChartSpec {
  chart: ChartKind;
  title: string;
  note: string;
  trends: string[];
  source: Source;
  countBy: CountBy;
  category: string;
  from: number;
  to: number;
}

export interface ChartAnswer {
  q: string;
  spec: ChartSpec | null;
  reason?: "unanswerable" | "unavailable";
  model?: string;
  ms: number;
}

export const MAX_QUESTION = 200;
export const MAX_TRENDS: Record<ChartKind, number> = { popularity: 4, timeline: 10, count: 0 };

export const SOURCE_LABEL: Record<Source, string> = {
  books_uk: "Mentions in British books, per million words",
  books_us: "Mentions in American books, per million words",
  runway: "Share of catwalk looks, in percent",
  museum: "Pieces kept by the V&A and the Met",
};

export const SOURCE_YEARS: Record<Source, [number, number]> = {
  books_uk: [1920, 2022],
  books_us: [1920, 2022],
  runway: [1988, 2024],
  museum: [1920, 2026],
};

export const JSON_SCHEMA = {
  type: "object",
  properties: {
    answerable: { type: "boolean" },
    chart: { type: "string", enum: CHARTS },
    title: { type: "string" },
    note: { type: "string" },
    trends: { type: "array", items: { type: "string" } },
    source: { type: "string", enum: SOURCES },
    countBy: { type: "string", enum: COUNT_BY },
    category: { type: "string" },
    from: { type: "integer" },
    to: { type: "integer" },
  },
  required: ["answerable", "chart", "title", "note", "trends", "source", "countBy", "category", "from", "to"],
  additionalProperties: false,
} as const;

interface Known {
  ids: ReadonlySet<string>;
  categories: ReadonlySet<string>;
  years: { from: number; to: number };
}

const text = (value: unknown, max: number) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "");
const oneOf = <T extends string>(value: unknown, options: readonly T[]) => (options.includes(value as T) ? (value as T) : undefined);

// The model's reply is untrusted: anything that names a trend, chart or year the dataset doesn't have is dropped here.
export function cleanSpec(raw: unknown, known: Known): ChartSpec | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const chart = oneOf(r.chart, CHARTS);
  const title = text(r.title, 120);
  if (r.answerable !== true || !chart || !title) return null;

  const listed = Array.isArray(r.trends) ? r.trends : [];
  const trends = [...new Set(listed.filter((id): id is string => typeof id === "string" && known.ids.has(id)))].slice(0, MAX_TRENDS[chart]);
  if (chart !== "count" && !trends.length) return null;

  const source = oneOf(r.source, SOURCES) ?? "books_uk";
  const [lo, hi] = chart === "popularity" ? SOURCE_YEARS[source] : [known.years.from, known.years.to];
  const year = (value: unknown, fallback: number) => (Number.isInteger(value) ? Math.min(hi, Math.max(lo, value as number)) : fallback);
  let from = year(r.from, lo);
  let to = year(r.to, hi);
  if (to - from < 5) [from, to] = [lo, hi];

  return {
    chart,
    title,
    note: text(r.note, 240),
    trends,
    source,
    countBy: oneOf(r.countBy, COUNT_BY) ?? "decade",
    category: typeof r.category === "string" && known.categories.has(r.category) ? r.category : "",
    from,
    to,
  };
}
