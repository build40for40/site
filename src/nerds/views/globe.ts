// "Who wore it first?": a globe where each trend flies from where it started to where it
// landed, from Samira's arrivals pilot (public/nerds-of-fashion/arrivals.json).

import { geoDistance, geoGraticule10, geoInterpolate, geoOrthographic, geoPath, type GeoPermissibleObjects } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import land110 from "world-atlas/land-110m.json";
import { BASE, clamp, token } from "../data";
import { FONT, reducedMotion, stage } from "../stage";
import type { View } from "../view";

interface Arrival {
  term: string;
  origin_place: string | null;
  origin_year: number | null;
  origin_source?: string;
  origin_sentence?: string;
  place: string;
  place_type: "country" | "city" | "language";
  arrival_year: number;
  method: string;
  confidence: "high" | "medium" | "low";
  source?: string;
  source_sentence?: string;
  source_sentence_en?: string;
  event?: string;
  year_is?: string;
}

// [longitude, latitude]. Countries sit on a central point, the Soviet Union on Moscow.
const PLACES: Record<string, [number, number]> = {
  Australia: [134, -25],
  Estonia: [25.5, 58.7],
  France: [2.3, 46.6],
  Germany: [10.4, 51.1],
  Italy: [12.5, 42.8],
  Japan: [138.3, 36.2],
  Luxembourg: [6.13, 49.61],
  Melbourne: [144.96, -37.81],
  "Mexico City": [-99.13, 19.43],
  Netherlands: [5.3, 52.1],
  "New York City": [-74.0, 40.71],
  Norway: [8.5, 61],
  Paris: [2.35, 48.86],
  Romania: [24.97, 45.94],
  "South Korea": [127.9, 36.5],
  "Soviet Union": [37.62, 55.75],
  Sweden: [15, 62],
  Tanzania: [34.9, -6.4],
  "United States": [-98, 39],
  "Vatican City": [12.45, 41.9],
  London: [-0.13, 51.51],
  Seattle: [-122.33, 47.61],
  Tokyo: [139.69, 35.69],
  "United Kingdom": [-2, 54],
};

const TRENDS: { term: string; label: string }[] = [
  { term: "miniskirt", label: "Miniskirt" },
  { term: "punk fashion", label: "Punk" },
  { term: "New Look (Dior)", label: "Dior's New Look" },
  { term: "bell-bottoms", label: "Bell-bottoms" },
  { term: "hip hop fashion", label: "Hip hop" },
  { term: "grunge fashion", label: "Grunge" },
  { term: "shoulder pads", label: "Shoulder pads" },
  { term: "skinny jeans", label: "Skinny jeans" },
  { term: "Harajuku street style", label: "Harajuku" },
  { term: "athleisure", label: "Athleisure" },
];
const slug = (term: string) => term.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const ARCHIVES: Record<string, string> = {
  wikipedia: "Wikipedia",
  "newspapers:nb": "Norwegian newspapers (Nasjonalbiblioteket)",
  "newspapers:delpher": "Dutch newspapers (Delpher)",
  "newspapers:elux": "Luxembourg newspapers (eluxemburgensia)",
  "newspapers:ddb": "German newspapers (Deutsche Digitale Bibliothek)",
  "newspapers:digar": "Estonian newspapers (DIGAR)",
};

let arrivalsLoading: Promise<Arrival[]> | undefined;
const loadArrivals = () =>
  (arrivalsLoading ??= fetch(`${BASE}/arrivals.json`).then((response) => {
    if (!response.ok) throw new Error(`arrivals.json: ${response.status}`);
    return response.json() as Promise<Arrival[]>;
  }));

const landTopology = land110 as unknown as Topology;
const LAND = feature(landTopology, landTopology.objects.land) as GeoPermissibleObjects;
const GRATICULE = geoGraticule10();

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const view: View = {
  id: "globe",
  tab: "world",
  title: "Who wore it first?",
  blurb: "Ten trends flying from where they started to wherever got them next",
  how: "Pick a trend and watch it spread. Drag to spin the globe, tap a dot for the evidence.",
  sources: ["wikipedia", "ngram"],
  order: 1,
  mount(root, context) {
    const wrap = el("div", "flex flex-col gap-3");
    root.append(wrap);

    const chips = el("div", "flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]");
    chips.setAttribute("role", "tablist");
    chips.setAttribute("aria-label", "Pick a trend");
    wrap.append(chips);

    const frame = el("div", "relative overflow-hidden rounded-2xl border border-nof-line bg-nof-night");
    wrap.append(frame);

    const replay = el("button", "absolute right-3 top-3 z-10 rounded-full border border-nof-line bg-nof-panel px-3 py-1.5 font-nof-body text-xs font-semibold text-nof-sub hover:text-nof-text", "Replay");
    replay.type = "button";
    const zoomButton = el("button", "absolute right-3 top-14 z-10 rounded-full border border-nof-line bg-nof-panel px-3 py-1.5 font-nof-body text-xs font-semibold text-nof-sub hover:text-nof-text", "Whole world");
    zoomButton.type = "button";
    const buttons = el("div", "absolute right-3 top-3 z-10 flex gap-2");
    replay.className = replay.className.replace("absolute right-3 top-3 z-10 ", "");
    zoomButton.className = zoomButton.className.replace("absolute right-3 top-14 z-10 ", "");
    buttons.append(zoomButton, replay);
    frame.append(buttons);

    const card = el("div", "min-h-28 rounded-2xl border border-nof-line bg-nof-panel p-4 font-nof-body text-sm text-nof-sub");
    card.setAttribute("aria-live", "polite");
    wrap.append(card);

    const legend = el("div", "flex flex-wrap items-center gap-x-4 gap-y-1 font-nof-body text-xs text-nof-muted");
    legend.innerHTML =
      '<span class="flex items-center gap-1.5"><span class="inline-block h-0.5 w-5 bg-nof-pink"></span>Solid evidence</span>' +
      '<span class="flex items-center gap-1.5"><span class="inline-block h-0.5 w-5 bg-nof-gold"></span>Decent evidence</span>' +
      '<span class="flex items-center gap-1.5"><span class="inline-block h-0.5 w-5 border-t border-dashed border-nof-muted"></span>A hunch with a source</span>';
    if (!context.compact) wrap.append(legend);

    const honest = el(
      "p",
      "font-nof-body text-xs leading-relaxed text-nof-muted",
      "Honest bit: digitised newspapers only let us date Norway, the Netherlands, Luxembourg, Germany and Estonia properly. Far away dots come from single Wikipedia sentences, and nothing here can date Africa, South America or most of Asia yet. A missing dot means nobody wrote it down, not that nobody wore it.",
    );
    if (!context.compact) wrap.append(honest);

    const credit = el("p", "font-nof-body text-[11px] leading-relaxed text-nof-muted");
    credit.innerHTML =
      'Sources: Wikipedia in many languages (CC BY-SA 4.0), Google Books Ngram (CC BY 3.0), and newspaper archives at the <a class="underline hover:text-nof-text" href="https://www.nb.no/" target="_blank" rel="noopener">Nasjonalbiblioteket</a>, <a class="underline hover:text-nof-text" href="https://www.delpher.nl/" target="_blank" rel="noopener">Delpher</a>, <a class="underline hover:text-nof-text" href="https://eluxemburgensia.lu/" target="_blank" rel="noopener">eluxemburgensia</a>, the <a class="underline hover:text-nof-text" href="https://www.deutsche-digitale-bibliothek.de/" target="_blank" rel="noopener">Deutsche Digitale Bibliothek</a> and <a class="underline hover:text-nof-text" href="https://dea.digar.ee/" target="_blank" rel="noopener">DIGAR</a>. Dug up by Samira.';
    if (!context.compact) wrap.append(credit);

    let rows: Arrival[] = [];
    let term = TRENDS.find((t) => slug(t.term) === context.params.trend)?.term ?? "miniskirt";
    let selected: Arrival | null = null;
    let playStart = performance.now();
    let rotation: [number, number] = [-10, -40];
    let target: [number, number] = [-10, -40];
    let home: [number, number] = [-10, -40];
    let zoom = 1;
    let zoomTarget = 1;
    const renderZoom = () => (zoomButton.textContent = zoomTarget > 1 ? "Whole world" : "Zoom in");
    let dragging = false;
    let lastDrag = 0;
    let dragFrom: { x: number; y: number; rot: [number, number]; moved: boolean } | null = null;

    const projection = geoOrthographic().precision(0.6);
    const colours = {
      night: token("--color-nof-night", "#0e0d12"),
      panel: token("--color-nof-panel", "#17151d"),
      raised: token("--color-nof-raised", "#211e29"),
      line: token("--color-nof-line", "#302c3a"),
      text: token("--color-nof-text", "#f2eee6"),
      sub: token("--color-nof-sub", "#cfc9d6"),
      muted: token("--color-nof-muted", "#a39fae"),
      pink: token("--color-nof-pink", "#ff6fa8"),
      gold: token("--color-nof-gold", "#e8c27a"),
    };
    const confidenceColour = (c: Arrival["confidence"]) => (c === "high" ? colours.pink : c === "medium" ? colours.gold : colours.muted);

    const mapped = () => rows.filter((row) => row.term === term && row.place_type !== "language" && PLACES[row.place]);
    const books = () => rows.filter((row) => row.term === term && row.place_type === "language");
    const origin = () => {
      const row = rows.find((r) => r.term === term);
      return row?.origin_place && PLACES[row.origin_place] ? { place: row.origin_place, year: row.origin_year, at: PLACES[row.origin_place], row } : null;
    };
    const span = () => {
      const list = mapped();
      const o = origin();
      const first = Math.min(o?.year ?? Infinity, ...list.map((r) => r.arrival_year));
      const last = Math.max(...list.map((r) => r.arrival_year));
      return { first: Number.isFinite(first) ? first : last, last };
    };
    const centreOn = () => {
      const list = mapped().map((r) => PLACES[r.place]);
      const o = origin();
      if (o) list.push(o.at);
      if (!list.length) return;
      // Centre on the north-west Europe cluster when it's there, since that's where the evidence is.
      const europe = list.filter(([lon, lat]) => lon > -15 && lon < 40 && lat > 35);
      const pick = europe.length >= 2 ? europe : list;
      zoomTarget = europe.length >= 2 ? 1.9 : 1;
      renderZoom();
      let lon = pick.reduce((s, p) => s + p[0], 0) / pick.length;
      let lat = pick.reduce((s, p) => s + p[1], 0) / pick.length;
      if (o && europe.length < 2) [lon, lat] = [(o.at[0] + lon) / 2, (o.at[1] + lat) / 2];
      target = [-lon, -clamp(lat, -20, 50) * 0.8];
      home = [...target] as [number, number];
    };

    const currentYear = () => {
      const { first, last } = span();
      if (reducedMotion()) return last + 0.999;
      const elapsed = (performance.now() - playStart) / 1000;
      const years = last - first + 1;
      const speed = Math.max(2.2, years / 6);
      return Math.min(last + 0.999, first - 0.6 + elapsed * speed);
    };

    const renderChips = () => {
      chips.replaceChildren(
        ...TRENDS.map((t) => {
          const on = t.term === term;
          const count = rows.filter((r) => r.term === t.term && r.place_type !== "language").length;
          const button = el(
            "button",
            `shrink-0 rounded-full border px-3 py-1.5 font-nof-body text-sm font-semibold transition-colors ${on ? "border-nof-pink bg-nof-pink text-nof-pink-ink" : "border-nof-line bg-nof-panel text-nof-sub hover:border-nof-muted hover:text-nof-text"}`,
          );
          button.type = "button";
          button.setAttribute("role", "tab");
          button.setAttribute("aria-selected", String(on));
          button.textContent = t.label;
          if (rows.length) {
            const small = el("span", `ml-1.5 font-mono text-[11px] ${on ? "text-nof-pink-ink" : "text-nof-muted"}`, String(count));
            button.append(small);
          }
          button.addEventListener("click", () => choose(t.term, true));
          return button;
        }),
      );
    };

    const quoteOf = (row: Arrival) => row.source_sentence_en || row.source_sentence || "";
    const renderCard = () => {
      card.replaceChildren();
      const o = origin();
      if (!selected) {
        const t = TRENDS.find((x) => x.term === term)!;
        const list = mapped();
        const head = el("p", "font-nof-display text-lg font-bold text-nof-text", t.label);
        const line = el(
          "p",
          "mt-1",
          o
            ? `Started in ${o.place}${o.year ? ` around ${o.year}` : ""}, then turned up in ${list.length} place${list.length === 1 ? "" : "s"} we can date.`
            : `Nobody agrees where it started, but we can date it in ${list.length} place${list.length === 1 ? "" : "s"}.`,
        );
        card.append(head, line);
        if (o?.row.origin_sentence) {
          const q = el("blockquote", "mt-2 border-l-2 border-nof-line pl-3 italic text-nof-muted", `“${o.row.origin_sentence}”`);
          card.append(q);
        }
        const b = books();
        if (b.length) {
          const bookLine = el(
            "p",
            "mt-2 text-xs text-nof-muted",
            `In books it first rises in ${b
              .sort((x, y) => x.arrival_year - y.arrival_year)
              .map((r) => `${r.place.replace(/ books$/, "").replace(/-language$/, "")} ${r.arrival_year}`)
              .join(", ")}. Languages aren't places, so they're not on the globe.`,
          );
          card.append(bookLine);
        }
        card.append(el("p", "mt-2 text-xs text-nof-muted", "Tap a dot for the evidence."));
        return;
      }
      const row = selected;
      const top = el("div", "flex items-baseline justify-between gap-3");
      top.append(el("p", "font-nof-display text-lg font-bold text-nof-text", `${row.place}, ${row.year_is === "latest" ? "by " : ""}${row.arrival_year}`));
      const badge = el(
        "span",
        `shrink-0 rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold uppercase ${row.confidence === "high" ? "bg-nof-pink text-nof-pink-ink" : row.confidence === "medium" ? "bg-nof-gold text-nof-night" : "border border-nof-line text-nof-muted"}`,
        `${row.confidence} confidence`,
      );
      top.append(badge);
      card.append(top);
      const lag = o?.year ? row.arrival_year - o.year : null;
      const meta = [ARCHIVES[row.method] ?? row.method];
      if (lag !== null) meta.push(lag <= 0 ? "same year as the start" : `${lag} year${lag === 1 ? "" : "s"} after ${o!.place}`);
      if (row.event) meta.push(row.event);
      if (context.born) {
        const age = row.arrival_year - context.born;
        meta.push(age < 0 ? `${-age} years before you were born` : `you were ${age}`);
      }
      card.append(el("p", "mt-1 text-xs text-nof-muted", meta.join(" · ")));
      const quote = quoteOf(row);
      if (quote) card.append(el("blockquote", "mt-2 border-l-2 border-nof-line pl-3 text-nof-sub [overflow-wrap:anywhere]", quote.length > 360 ? `${quote.slice(0, 357)}…` : quote));
      if (row.source) {
        const link = el("a", "mt-2 inline-block text-xs font-semibold text-nof-pink underline", "See the source");
        link.setAttribute("href", row.source);
        link.setAttribute("target", "_blank");
        link.setAttribute("rel", "noopener");
        card.append(link);
      }
      const back = el("button", "ml-4 mt-2 text-xs font-semibold text-nof-muted underline hover:text-nof-text", "Back to the overview");
      back.type = "button";
      back.addEventListener("click", () => {
        selected = null;
        context.setParam("place", null);
        renderCard();
        s.draw();
      });
      card.append(back);
    };

    const choose = (next: string, user = false) => {
      term = next;
      selected = null;
      playStart = performance.now();
      centreOn();
      if (user) {
        context.setParam("trend", slug(term));
        context.setParam("place", null);
      }
      renderChips();
      renderCard();
    };

    // Screen positions of visible dots, for tapping.
    let hits: { x: number; y: number; row: Arrival }[] = [];

    const s = stage(frame, {
      height: context.compact ? "min(62vh, 460px, 110vw)" : "min(72vh, 600px, 118vw)",
      animate: true,
      label: "A globe showing where each fashion trend started and the places it reached, with the year it arrived",
      render({ ctx, width, height, dt }) {
        zoom += (zoomTarget - zoom) * (1 - Math.exp(-dt * 3));
        const radius = Math.min(width, height) * 0.44 * zoom;
        const cx = width / 2;
        const cy = height / 2 + (width < 500 ? 18 : 10);

        // Ease towards the target unless someone's spinning it, then drift gently.
        if (!dragging) {
          const idle = performance.now() - lastDrag > 4000;
          if (idle) {
            const k = 1 - Math.exp(-dt * 2);
            rotation = [rotation[0] + (target[0] - rotation[0]) * k, rotation[1] + (target[1] - rotation[1]) * k];
            if (!reducedMotion()) target = [home[0] + 22 * Math.sin(performance.now() / 9000), home[1]];
          }
        }
        projection.scale(radius).translate([cx, cy]).rotate([rotation[0], rotation[1], 0]);
        const path = geoPath(projection, ctx);

        ctx.fillStyle = colours.night;
        ctx.fillRect(0, 0, width, height);

        // Glow behind the globe.
        const glow = ctx.createRadialGradient(cx, cy, radius * 0.7, cx, cy, radius * 1.25);
        glow.addColorStop(0, "rgba(255,111,168,0.10)");
        glow.addColorStop(1, "rgba(255,111,168,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, width, height);

        ctx.beginPath();
        path({ type: "Sphere" });
        ctx.fillStyle = colours.panel;
        ctx.fill();
        ctx.beginPath();
        path(GRATICULE);
        ctx.strokeStyle = colours.line;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 0.6;
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.beginPath();
        path(LAND);
        ctx.fillStyle = colours.raised;
        ctx.fill();
        ctx.strokeStyle = colours.line;
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.beginPath();
        path({ type: "Sphere" });
        ctx.strokeStyle = colours.line;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        if (!rows.length) {
          ctx.fillStyle = colours.muted;
          ctx.font = FONT.body(14);
          ctx.textAlign = "center";
          ctx.fillText("Loading the globe…", cx, cy);
          return;
        }

        const centre: [number, number] = [-rotation[0], -rotation[1]];
        const visible = (p: [number, number]) => geoDistance(p, centre) < Math.PI / 2 - 0.02;
        const year = currentYear();
        const o = origin();
        const list = mapped().sort((a, b) => a.arrival_year - b.arrival_year);
        hits = [];

        const lifted = (p: [number, number], lift: number) => {
          const [x, y] = projection(p) ?? [cx, cy];
          return [cx + (x - cx) * (1 + lift), cy + (y - cy) * (1 + lift)] as const;
        };

        // Arcs.
        const placeCount = new Map<string, number>();
        for (const row of list) {
          const to = PLACES[row.place];
          const progress = clamp((year - row.arrival_year + 1) / 0.9, 0, 1);
          if (progress <= 0) continue;
          const n = placeCount.get(row.place) ?? 0;
          placeCount.set(row.place, n + 1);
          const colour = confidenceColour(row.confidence);
          const faded = selected && selected !== row ? 0.35 : 1;
          if (o) {
            const interpolate = geoInterpolate(o.at, to);
            const distance = geoDistance(o.at, to);
            const height = Math.min(0.16, 0.04 + distance * 0.07) + n * 0.025;
            ctx.beginPath();
            let pen = false;
            const steps = 48;
            for (let i = 0; i <= steps * progress; i++) {
              const t = i / steps;
              const p = interpolate(t) as [number, number];
              const lift = height * Math.sin(Math.PI * t);
              if (!visible(p)) {
                pen = false;
                continue;
              }
              const [x, y] = lifted(p, lift);
              if (pen) ctx.lineTo(x, y);
              else ctx.moveTo(x, y), (pen = true);
            }
            ctx.strokeStyle = colour;
            ctx.globalAlpha = (row.confidence === "low" ? 0.55 : 0.95) * faded;
            ctx.lineWidth = row.confidence === "high" ? 2.4 : row.confidence === "medium" ? 1.8 : 1.3;
            ctx.setLineDash(row.confidence === "low" ? [4, 4] : []);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 1;
          }
          // Landing dot and label.
          if (progress >= 1 && visible(to)) {
            const [x, y] = lifted(to, 0);
            const fresh = clamp(1 - (year - row.arrival_year - 0.3) / 1.2, 0, 1);
            if (fresh > 0 && !reducedMotion()) {
              ctx.beginPath();
              ctx.arc(x, y, 6 + (1 - fresh) * 18, 0, Math.PI * 2);
              ctx.strokeStyle = colour;
              ctx.globalAlpha = fresh * 0.8;
              ctx.lineWidth = 1.5;
              ctx.stroke();
              ctx.globalAlpha = 1;
            }
            ctx.beginPath();
            ctx.arc(x, y, selected === row ? 6.5 : 4.5, 0, Math.PI * 2);
            ctx.fillStyle = colour;
            ctx.globalAlpha = faded;
            ctx.fill();
            ctx.strokeStyle = colours.night;
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.globalAlpha = 1;
            hits.push({ x, y, row });
          }
        }

        // Labels, skipping any that would land on top of one already drawn.
        const placed: { x: number; y: number; w: number }[] = [];
        const originLabel = o ? `Started in ${o.place}${o.year ? ` ${o.year}` : ""}` : "";
        if (o && visible(o.at)) {
          const [ox, oy] = lifted(o.at, 0);
          ctx.font = FONT.body(width < 500 ? 12 : 13, 700);
          const w = ctx.measureText(originLabel).width + 10;
          placed.push({ x: ox - w / 2, y: oy - 21, w }, { x: ox - 10, y: oy, w: 20 });
        }
        ctx.font = FONT.mono(width < 500 ? 10 : 11, 600);
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        const labelled = new Set<string>();
        const ordered = [...hits].sort((a, b) => (a.row === selected ? -1 : b.row === selected ? 1 : 0));
        for (const hit of ordered) {
          if (labelled.has(hit.row.place) && hit.row !== selected) continue;
          const text = `${hit.row.place} ${hit.row.arrival_year}`;
          const w = ctx.measureText(text).width;
          let x = hit.x + 8;
          if (x + w > width - 6) x = hit.x - 8 - w;
          const y = hit.y;
          if (hit.row !== selected && placed.some((p) => Math.abs(p.y - y) < 15 && x < p.x + p.w && x + w > p.x)) continue;
          placed.push({ x, y, w });
          labelled.add(hit.row.place);
          ctx.fillStyle = colours.night;
          ctx.globalAlpha = 0.7;
          ctx.fillRect(x - 3, y - 7, w + 6, 14);
          ctx.globalAlpha = 1;
          ctx.fillStyle = hit.row === selected ? colours.text : colours.sub;
          ctx.fillText(text, x, y);
        }

        // Origin.
        if (o && visible(o.at)) {
          const [x, y] = lifted(o.at, 0);
          const pulse = reducedMotion() ? 0.5 : (performance.now() / 1400) % 1;
          ctx.beginPath();
          ctx.arc(x, y, 7 + pulse * 14, 0, Math.PI * 2);
          ctx.strokeStyle = colours.text;
          ctx.globalAlpha = 0.6 * (1 - pulse);
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.beginPath();
          ctx.arc(x, y, 6, 0, Math.PI * 2);
          ctx.fillStyle = colours.text;
          ctx.fill();
          ctx.font = FONT.body(width < 500 ? 12 : 13, 700);
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          const label = originLabel;
          const w = ctx.measureText(label).width;
          ctx.fillStyle = colours.night;
          ctx.globalAlpha = 0.75;
          ctx.fillRect(x - w / 2 - 5, y - 30, w + 10, 18);
          ctx.globalAlpha = 1;
          ctx.fillStyle = colours.text;
          ctx.fillText(label, x, y - 13);
        }

        // Year counter.
        const shown = Math.floor(year);
        const { first } = span();
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = colours.text;
        ctx.font = FONT.display(width < 500 ? 34 : 48, 800, true);
        ctx.fillText(String(Math.max(first, shown)), 16, width < 500 ? 46 : 62);
        ctx.font = FONT.mono(11, 500);
        ctx.fillStyle = colours.muted;
        const reached = list.filter((r) => r.arrival_year <= shown).length;
        let sub = `${reached} of ${list.length} places`;
        if (context.born && shown >= context.born) sub += ` · you were ${shown - context.born}`;
        ctx.fillText(sub, 18, width < 500 ? 64 : 82);
      },
    });

    // Drag to spin, tap to pick a dot.
    const canvas = s.canvas;
    canvas.classList.add("cursor-grab");
    const onDown = (event: PointerEvent) => {
      dragFrom = { x: event.clientX, y: event.clientY, rot: [...rotation] as [number, number], moved: false };
    };
    const onMove = (event: PointerEvent) => {
      if (!dragFrom) return;
      const dx = event.clientX - dragFrom.x;
      const dy = event.clientY - dragFrom.y;
      if (!dragFrom.moved && Math.hypot(dx, dy) < 5) return;
      if (!dragFrom.moved) canvas.setPointerCapture(event.pointerId);
      dragFrom.moved = true;
      dragging = true;
      const k = 120 / Math.max(120, s.width * 0.44);
      rotation = [dragFrom.rot[0] + dx * k * 0.5, clamp(dragFrom.rot[1] - dy * k * 0.5, -70, 70)];
      target = [...rotation] as [number, number];
      home = [...rotation] as [number, number];
    };
    const onUp = (event: PointerEvent) => {
      if (dragFrom && !dragFrom.moved) {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        let best: (typeof hits)[number] | null = null;
        let bestD = 26;
        for (const hit of hits) {
          const d = Math.hypot(hit.x - x, hit.y - y);
          if (d < bestD) (best = hit), (bestD = d);
        }
        selected = best?.row ?? null;
        context.setParam("place", selected ? slug(selected.place) : null);
        renderCard();
      }
      if (dragFrom?.moved) lastDrag = performance.now();
      dragFrom = null;
      dragging = false;
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    zoomButton.addEventListener("click", () => {
      zoomTarget = zoomTarget > 1 ? 1 : 1.9;
      renderZoom();
    });
    replay.addEventListener("click", () => {
      selected = null;
      playStart = performance.now();
      centreOn();
      renderCard();
    });

    renderChips();
    renderCard();
    let alive = true;
    loadArrivals()
      .then((data) => {
        if (!alive) return;
        rows = data;
        centreOn();
        rotation = [...target] as [number, number];
        playStart = performance.now();
        const place = context.params.place;
        if (place) selected = mapped().find((r) => slug(r.place) === place) ?? null;
        renderChips();
        renderCard();
      })
      .catch(() => {
        card.textContent = "Couldn't load the arrivals data. Try a refresh.";
      });

    return {
      destroy() {
        alive = false;
        s.destroy();
        root.replaceChildren();
      },
      update(params) {
        const next = TRENDS.find((t) => slug(t.term) === params.trend)?.term;
        if (next && next !== term) choose(next);
      },
    };
  },
};

export default view;
