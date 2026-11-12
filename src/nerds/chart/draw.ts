import { SOURCE_LABEL, type ChartSpec, type Source } from "./spec";

export interface DatasetTrend {
  id: string;
  name: string;
  category: string;
  periods: { start: number; end: number; region: string }[];
  ngram?: Record<string, number[]> | null;
  counts?: Partial<Record<"vam" | "met" | "runway", Record<string, number>>>;
}

export interface Dataset {
  meta: { years: { from: number; to: number } };
  series: { ngramYears: { from: number; to: number } };
  trends: DatasetTrend[];
}

export interface Point {
  x: number;
  y: number;
}

export type Drawing =
  | { kind: "lines"; from: number; to: number; unit: string; series: { id: string; name: string; points: Point[] }[]; missing: string[] }
  | { kind: "spans"; from: number; to: number; rows: { id: string; name: string; spans: [number, number][] }[] }
  | { kind: "bars"; unit: string; bars: { label: string; value: number }[] };

const NGRAM_KEY: Partial<Record<Source, string>> = { books_uk: "en-GB", books_us: "en-US" };
const SMOOTH = 2;

function smooth(points: Point[]) {
  return points.map((p, i) => {
    const window = points.slice(Math.max(0, i - SMOOTH), i + SMOOTH + 1);
    return { x: p.x, y: window.reduce((sum, w) => sum + w.y, 0) / window.length };
  });
}

function popularity(trend: DatasetTrend, source: Source, data: Dataset): Point[] {
  const key = NGRAM_KEY[source];
  if (key) {
    const first = data.series.ngramYears.from;
    return smooth((trend.ngram?.[key] ?? []).map((y, i) => ({ x: first + i, y })));
  }
  if (source === "runway") {
    return Object.entries(trend.counts?.runway ?? {}).map(([year, share]) => ({ x: Number(year), y: share * 100 }));
  }
  // Museum dates pile up on round years, so they only mean something per decade.
  const decades = new Map<number, number>();
  for (const counts of [trend.counts?.vam, trend.counts?.met])
    for (const [year, n] of Object.entries(counts ?? {})) {
      const decade = Math.floor(Number(year) / 10) * 10;
      decades.set(decade, (decades.get(decade) ?? 0) + n);
    }
  if (!decades.size) return [];
  const points: Point[] = [];
  for (let d = Math.min(...decades.keys()); d <= Math.max(...decades.keys()); d += 10) points.push({ x: d + 5, y: decades.get(d) ?? 0 });
  return points;
}

export function mergedSpans(trend: DatasetTrend, from: number, to: number): [number, number][] {
  const clipped = trend.periods
    .map((p): [number, number] => [Math.max(from, p.start), Math.min(to, p.end)])
    .filter(([s, e]) => e >= s)
    .sort((a, b) => a[0] - b[0]);
  const spans: [number, number][] = [];
  for (const [s, e] of clipped) {
    const last = spans[spans.length - 1];
    if (last && s <= last[1] + 1) last[1] = Math.max(last[1], e);
    else spans.push([s, e]);
  }
  return spans;
}

const UNIT: Record<Source, string> = { books_uk: "per million words", books_us: "per million words", runway: "% of looks", museum: "pieces per decade" };

export function draw(spec: ChartSpec, data: Dataset): Drawing | null {
  const byId = new Map(data.trends.map((t) => [t.id, t]));
  const picked = spec.trends.flatMap((id) => byId.get(id) ?? []);

  if (spec.chart === "popularity") {
    const all = picked.map((t) => ({ id: t.id, name: t.name, points: popularity(t, spec.source, data).filter((p) => p.x >= spec.from && p.x <= spec.to) }));
    const series = all.filter((s) => s.points.some((p) => p.y > 0));
    if (!series.length) return null;
    return { kind: "lines", from: spec.from, to: spec.to, unit: UNIT[spec.source], series, missing: all.filter((s) => !series.includes(s)).map((s) => s.name) };
  }

  if (spec.chart === "timeline") {
    const rows = picked.map((t) => ({ id: t.id, name: t.name, spans: mergedSpans(t, spec.from, spec.to) })).filter((r) => r.spans.length);
    return rows.length ? { kind: "spans", from: spec.from, to: spec.to, rows } : null;
  }

  const pool = data.trends.filter((t) => !spec.category || t.category === spec.category);
  const inFashion = (t: DatasetTrend, from: number, to: number) => t.periods.some((p) => p.start <= to && p.end >= from);
  if (spec.countBy === "decade") {
    const bars = [];
    for (let d = Math.floor(spec.from / 10) * 10; d <= spec.to; d += 10) bars.push({ label: `${d}s`, value: pool.filter((t) => inFashion(t, d, d + 9)).length });
    return { kind: "bars", unit: "trends in fashion", bars };
  }
  const counts = new Map<string, number>();
  for (const t of pool) if (inFashion(t, spec.from, spec.to)) counts.set(t.category, (counts.get(t.category) ?? 0) + 1);
  const bars = [...counts].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  return bars.length ? { kind: "bars", unit: "trends in fashion", bars } : null;
}

export const sourceLine = (spec: ChartSpec) =>
  spec.chart === "popularity" ? SOURCE_LABEL[spec.source] : "Years in fashion, from Wikipedia's fashion history articles";

export function niceTicks(max: number, count = 4) {
  if (!(max > 0)) return [0];
  const raw = max / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? raw;
  const ticks = [];
  for (let v = 0; v < max + step * 0.999; v += step) ticks.push(+v.toPrecision(6));
  return ticks;
}
