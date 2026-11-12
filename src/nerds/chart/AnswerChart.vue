<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { draw, niceTicks, sourceLine, type Dataset } from "./draw";
import type { ChartSpec } from "./spec";

const props = defineProps<{ spec: ChartSpec; data: Dataset }>();

const COLOURS = ["var(--color-series-1)", "var(--color-series-2)", "var(--color-series-3)", "var(--color-series-4)"];
const PAD = { top: 12, right: 14, bottom: 26, left: 46 };
const PLOT_HEIGHT = 220;
const ROW = 34;
const BAR_ROW = 26;
const BAR_LABEL = 92;

const box = ref<HTMLElement>();
const width = ref(640);
const hover = ref<number | null>(null);
let observer: ResizeObserver | undefined;
onMounted(() => {
  observer = new ResizeObserver(([entry]) => (width.value = Math.max(280, entry.contentRect.width)));
  if (box.value) observer.observe(box.value);
});
onBeforeUnmount(() => observer?.disconnect());

const drawing = computed(() => draw(props.spec, props.data));
const number = (v: number) => (v === 0 ? "0" : v >= 100 ? Math.round(v).toLocaleString("en-GB") : String(+v.toPrecision(2)));

const innerWidth = computed(() => width.value - PAD.left - PAD.right);
const yearX = (from: number, to: number) => (year: number) => PAD.left + ((year - from) / Math.max(1, to - from)) * innerWidth.value;
const yearTicks = (from: number, to: number) => {
  const step = width.value < 480 ? 20 : 10;
  const ticks = [];
  for (let y = Math.ceil(from / step) * step; y <= to; y += step) ticks.push(y);
  return ticks;
};

const lines = computed(() => {
  const d = drawing.value;
  if (d?.kind !== "lines") return null;
  const ticks = niceTicks(Math.max(...d.series.flatMap((s) => s.points.map((p) => p.y))));
  const top = ticks[ticks.length - 1] || 1;
  const x = yearX(d.from, d.to);
  const y = (v: number) => PAD.top + PLOT_HEIGHT - (v / top) * PLOT_HEIGHT;
  return {
    ...d,
    x,
    y,
    ticks,
    years: yearTicks(d.from, d.to),
    height: PAD.top + PLOT_HEIGHT + PAD.bottom,
    paths: d.series.map((s, i) => ({ ...s, colour: COLOURS[i], d: s.points.map((p, j) => `${j ? "L" : "M"}${x(p.x).toFixed(1)},${y(p.y).toFixed(1)}`).join("") })),
  };
});

const nearest = computed(() => {
  const l = lines.value;
  if (!l || hover.value === null) return null;
  const year = hover.value;
  const rows = l.paths.flatMap((s) => {
    const point = s.points.reduce<(typeof s.points)[number] | null>((best, p) => (!best || Math.abs(p.x - year) < Math.abs(best.x - year) ? p : best), null);
    return point && Math.abs(point.x - year) <= 5 ? [{ name: s.name, colour: s.colour, point }] : [];
  });
  return rows.length ? { year, rows, left: l.x(year) } : null;
});

function track(event: PointerEvent) {
  const l = lines.value;
  if (!l || !box.value) return;
  const ratio = (event.clientX - box.value.getBoundingClientRect().left - PAD.left) / innerWidth.value;
  hover.value = Math.round(l.from + Math.min(1, Math.max(0, ratio)) * (l.to - l.from));
}

const spans = computed(() => {
  const d = drawing.value;
  if (d?.kind !== "spans") return null;
  const x = yearX(d.from, d.to + 1);
  return { ...d, x, years: yearTicks(d.from, d.to), height: PAD.top + d.rows.length * ROW + PAD.bottom };
});

const bars = computed(() => {
  const d = drawing.value;
  if (d?.kind !== "bars") return null;
  const max = Math.max(1, ...d.bars.map((b) => b.value));
  const room = width.value - BAR_LABEL - 44;
  return { ...d, height: d.bars.length * BAR_ROW, rows: d.bars.map((b) => ({ ...b, length: Math.max(b.value ? 2 : 0, (b.value / max) * room) })) };
});

const table = computed(() => {
  const d = drawing.value;
  if (!d) return null;
  if (d.kind === "bars") return { head: ["", d.unit], rows: d.bars.map((b) => [b.label, String(b.value)]) };
  if (d.kind === "spans") return { head: ["Trend", "Years in fashion"], rows: d.rows.map((r) => [r.name, r.spans.map(([s, e]) => (s === e ? `${s}` : `${s} to ${e}`)).join(", ")]) };
  const step = d.to - d.from > 40 ? 10 : 5;
  const years = [];
  for (let y = Math.ceil(d.from / step) * step; y <= d.to; y += step) years.push(y);
  return {
    head: ["Year", ...d.series.map((s) => s.name)],
    rows: years.map((year) => [String(year), ...d.series.map((s) => {
      const point = s.points.find((p) => Math.abs(p.x - year) <= (step === 10 ? 5 : 0));
      return point ? number(point.y) : "";
    })]),
  };
});
</script>

<template>
  <figure class="m-0 flex flex-col gap-3 border border-night-edge bg-night-panel p-4 text-night-text sm:p-5">
    <figcaption class="flex flex-col gap-1">
      <h3 class="text-base font-semibold text-balance sm:text-lg">{{ spec.title }}</h3>
      <p v-if="spec.note" class="text-sm text-night-sub">{{ spec.note }}</p>
    </figcaption>

    <p v-if="!drawing" class="text-sm text-night-sub">The dataset has nothing to draw for that one. Try a different trend or a wider stretch of years.</p>

    <ul v-if="lines && lines.paths.length > 1" class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-night-sub">
      <li v-for="s in lines.paths" :key="s.id" class="flex items-center gap-1.5">
        <span class="h-0.5 w-4" :style="{ background: s.colour }"></span>{{ s.name }}
      </li>
    </ul>

    <div ref="box" class="relative min-w-0">
      <svg v-if="lines" :width="width" :height="lines.height" role="img" :aria-label="spec.title" class="block touch-pan-y" @pointermove="track" @pointerdown="track" @pointerleave="hover = null">
        <g v-for="t in lines.ticks" :key="t">
          <line :x1="PAD.left" :x2="width - PAD.right" :y1="lines.y(t)" :y2="lines.y(t)" class="stroke-night-line" />
          <text :x="PAD.left - 6" :y="lines.y(t) + 4" text-anchor="end" class="fill-night-muted text-[11px] tabular-nums">{{ number(t) }}</text>
        </g>
        <text v-for="y in lines.years" :key="y" :x="lines.x(y)" :y="lines.height - 8" text-anchor="middle" class="fill-night-muted text-[11px] tabular-nums">{{ y }}</text>
        <path v-for="s in lines.paths" :key="s.id" :d="s.d" fill="none" :stroke="s.colour" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
        <g v-if="nearest">
          <line :x1="nearest.left" :x2="nearest.left" :y1="PAD.top" :y2="PAD.top + PLOT_HEIGHT" class="stroke-night-muted" stroke-dasharray="3 3" />
          <circle v-for="r in nearest.rows" :key="r.name" :cx="lines.x(r.point.x)" :cy="lines.y(r.point.y)" r="4" :fill="r.colour" class="stroke-night-panel" stroke-width="2" />
        </g>
      </svg>
      <div
        v-if="lines && nearest"
        class="pointer-events-none absolute top-2 z-10 flex min-w-32 flex-col gap-1 border border-night-edge bg-night p-2 text-xs"
        :class="nearest.left > width / 2 ? '-translate-x-full' : ''"
        :style="{ left: `${nearest.left + (nearest.left > width / 2 ? -10 : 10)}px` }"
      >
        <span class="font-semibold tabular-nums">{{ nearest.year }}</span>
        <span v-for="r in nearest.rows" :key="r.name" class="flex items-center gap-1.5">
          <span class="h-0.5 w-3 shrink-0" :style="{ background: r.colour }"></span>
          <span class="text-night-sub">{{ r.name }}</span>
          <span class="ml-auto pl-2 font-semibold tabular-nums">{{ number(r.point.y) }}</span>
        </span>
      </div>

      <svg v-if="spans" :width="width" :height="spans.height" role="img" :aria-label="spec.title" class="block">
        <g v-for="y in spans.years" :key="y">
          <line :x1="spans.x(y)" :x2="spans.x(y)" :y1="PAD.top" :y2="spans.height - PAD.bottom" class="stroke-night-line" />
          <text :x="spans.x(y)" :y="spans.height - 8" text-anchor="middle" class="fill-night-muted text-[11px] tabular-nums">{{ y }}</text>
        </g>
        <g v-for="(row, i) in spans.rows" :key="row.id">
          <text :x="PAD.left" :y="PAD.top + i * ROW + 12" class="fill-night-text text-xs">{{ row.name }}</text>
          <rect
            v-for="[s, e] in row.spans"
            :key="s"
            :x="spans.x(s)"
            :y="PAD.top + i * ROW + 18"
            :width="Math.max(3, spans.x(e + 1) - spans.x(s) - 2)"
            height="8"
            rx="4"
            fill="var(--color-series-1)"
          >
            <title>{{ row.name }}: {{ s === e ? s : `${s} to ${e}` }}</title>
          </rect>
        </g>
      </svg>

      <svg v-if="bars" :width="width" :height="bars.height" role="img" :aria-label="spec.title" class="block">
        <g v-for="(b, i) in bars.rows" :key="b.label">
          <text :x="BAR_LABEL - 8" :y="i * BAR_ROW + 17" text-anchor="end" class="fill-night-sub text-xs">{{ b.label }}</text>
          <rect :x="BAR_LABEL" :y="i * BAR_ROW + 5" :width="b.length" height="16" rx="4" fill="var(--color-series-1)">
            <title>{{ b.label }}: {{ b.value }} {{ bars.unit }}</title>
          </rect>
          <text :x="BAR_LABEL + b.length + 6" :y="i * BAR_ROW + 17" class="fill-night-text text-xs tabular-nums">{{ b.value }}</text>
        </g>
      </svg>
    </div>

    <p v-if="lines?.missing.length" class="text-xs text-night-muted">No data from this source for {{ lines.missing.join(", ") }}.</p>
    <p v-if="drawing" class="text-xs text-night-muted">
      <template v-if="lines">{{ sourceLine(spec) }}{{ spec.source === "museum" ? ", per decade" : "" }}.</template>
      <template v-else-if="bars">Number of {{ bars.unit }}{{ spec.category ? `, ${spec.category} only` : "" }}, {{ spec.from }} to {{ spec.to }}.</template>
      <template v-else>{{ sourceLine(spec) }}.</template>
      Claude picked this chart. The numbers come straight from the dataset.
    </p>

    <details v-if="table" class="text-xs text-night-sub">
      <summary class="cursor-pointer text-night-sub">See the numbers</summary>
      <div class="mt-2 overflow-x-auto">
        <table class="w-full border-collapse text-left tabular-nums">
          <thead>
            <tr><th v-for="h in table.head" :key="h" class="border-b border-night-line py-1 pr-3 font-semibold text-night-text">{{ h }}</th></tr>
          </thead>
          <tbody>
            <tr v-for="row in table.rows" :key="row[0]">
              <td v-for="(cell, i) in row" :key="i" class="border-b border-night-line py-1 pr-3">{{ cell }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>
  </figure>
</template>
