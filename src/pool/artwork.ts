import { poolConfig } from "./config";

export type Shape = "circle" | "ring" | "square" | "triangle" | "bar" | "dots";

export interface ArtworkOptions {
  shapes: Shape[];
  count: [number, number];
  placement: "edge" | "corner" | "scatter";
  rotation: number;
  density: number;
  symmetry: "none" | "mirror" | "auto";
  background: boolean;
  complexity: number;
}

export const defaultArtworkOptions: ArtworkOptions = {
  shapes: ["circle", "ring", "square", "triangle", "bar", "dots"],
  count: [3, 6],
  placement: "edge",
  rotation: 45,
  density: 0.5,
  symmetry: "auto",
  background: true,
  complexity: 0.5,
};

// Full class names so Tailwind finds them. Muted tones keep the tile's title at AA contrast.
const tones = ["fill-night-line", "fill-night-edge/50", "fill-night-tile"];
const strokes = ["stroke-night-edge/70", "stroke-night-line"];
const accents = [
  { fill: "fill-shipped/20", stroke: "stroke-shipped/35" },
  { fill: "fill-live/20", stroke: "stroke-live/35" },
  { fill: "fill-queued/25", stroke: "stroke-queued/40" },
  { fill: "fill-guest/20", stroke: "stroke-guest/35" },
];

// cyrb128 spreads any string over 128 bits, and sfc32 turns that into a stream of floats.
function cyrb128(text: string) {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0; i < text.length; i++) {
    const k = text.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
}

export function seededRandom(seed: string) {
  let [a, b, c, d] = cyrb128(seed);
  return () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

type Random = () => number;
const between = (r: Random, min: number, max: number) => min + r() * (max - min);
const pick = <T>(r: Random, list: T[]) => list[Math.floor(r() * list.length)];
const n = (value: number) => Math.round(value * 10) / 10;

const SIZE = 120;

function anchor(r: Random, placement: ArtworkOptions["placement"]) {
  // Titles sit top left, so shapes lean towards the right and bottom edges.
  if (placement === "corner") return { x: between(r, 70, 125), y: between(r, 70, 125) };
  if (placement === "scatter") return { x: between(r, 0, SIZE), y: between(r, 30, SIZE) };
  return r() < 0.5 ? { x: between(r, 80, 125), y: between(r, 10, 120) } : { x: between(r, 10, 120), y: between(r, 85, 125) };
}

function shape(r: Random, kind: Shape, x: number, y: number, size: number, angle: number, fill: string, stroke: string, density: number) {
  const turn = angle ? ` transform="rotate(${n(angle)} ${n(x)} ${n(y)})"` : "";
  switch (kind) {
    case "circle":
      return `<circle cx="${n(x)}" cy="${n(y)}" r="${n(size / 2)}" class="${fill}"/>`;
    case "ring":
      return `<circle cx="${n(x)}" cy="${n(y)}" r="${n(size / 2)}" class="fill-none ${stroke}" stroke-width="${n(between(r, 2, 5))}"/>`;
    case "square":
      return `<rect x="${n(x - size / 2)}" y="${n(y - size / 2)}" width="${n(size)}" height="${n(size)}" rx="${n(size * 0.12)}" class="${fill}"${turn}/>`;
    case "triangle": {
      const h = (size * Math.sqrt(3)) / 2;
      return `<polygon points="${n(x)},${n(y - h / 2)} ${n(x + size / 2)},${n(y + h / 2)} ${n(x - size / 2)},${n(y + h / 2)}" class="${fill}"${turn}/>`;
    }
    case "bar":
      return `<rect x="${n(x - size)}" y="${n(y - size / 8)}" width="${n(size * 2)}" height="${n(size / 4)}" rx="${n(size / 8)}" class="${fill}"${turn}/>`;
    case "dots": {
      const step = n(between(r, 7, 11) - density * 3);
      const cols = Math.max(2, Math.round(size / step));
      const dots = [];
      for (let i = 0; i < cols; i++) for (let j = 0; j < cols; j++) dots.push(`<circle cx="${n(x - size / 2 + i * step)}" cy="${n(y - size / 2 + j * step)}" r="1.2"/>`);
      return `<g class="${fill}"${turn}>${dots.join("")}</g>`;
    }
  }
}

function generateV1(seed: string, options: ArtworkOptions) {
  const [family, own] = seed.includes(":") ? seed.split(":", 2) : [seed, seed];
  const fr = seededRandom(`v1:family:${family}`);
  const r = seededRandom(`v1:idea:${own}`);

  const vocabulary = options.shapes.filter(() => fr() < 0.6);
  const kinds = vocabulary.length ? vocabulary : [pick(fr, options.shapes)];
  const accent = fr() < 0.55 ? pick(fr, accents) : undefined;
  const mirror = options.symmetry === "mirror" || (options.symmetry === "auto" && fr() < 0.3);
  const scale = 0.6 + options.complexity * 0.8;

  const [min, max] = options.count;
  const count = Math.round(between(r, min, max) * (0.6 + options.complexity * 0.8));
  const parts: string[] = [];
  if (options.background) parts.push(`<circle cx="${n(between(r, 90, 130))}" cy="${n(between(r, 90, 130))}" r="${n(between(r, 40, 70))}" class="fill-night-tile/60"/>`);

  for (let i = 0; i < count; i++) {
    const kind = pick(r, kinds);
    const { x, y } = anchor(r, options.placement);
    const size = between(r, 10, 34) * scale;
    const angle = options.rotation ? between(r, -options.rotation, options.rotation) : 0;
    const useAccent = accent && i === 0;
    const fill = useAccent ? accent.fill : pick(r, tones);
    const stroke = useAccent ? accent.stroke : pick(r, strokes);
    parts.push(shape(r, kind, x, y, size, angle, fill, stroke, options.density));
    if (mirror) parts.push(shape(r, kind, 180 - x, y, size, -angle, fill, stroke, options.density));
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" preserveAspectRatio="xMaxYMax slice" aria-hidden="true" focusable="false">${parts.join("")}</svg>`;
}

// Never change a published version. Add a new one and bump poolConfig.artwork.version instead.
const generators: Record<number, (seed: string, options: ArtworkOptions) => string> = { 1: generateV1 };

export const ARTWORK_VERSIONS = Object.keys(generators).map(Number);

export function generateArtwork(seed: string, options: Partial<ArtworkOptions> = {}, version = poolConfig.artwork.version) {
  const generate = generators[version];
  if (!generate) throw new Error(`No artwork version ${version}`);
  return generate(seed, { ...defaultArtworkOptions, ...options });
}

export interface VisualIdentity {
  id: string;
  seed: string;
  version: number;
  svg: string;
}

const cache = new Map<string, VisualIdentity>();

export function createVisualIdentity(idea: { id: string; seed?: string }, version = poolConfig.artwork.version): VisualIdentity {
  const seed = idea.seed ?? idea.id;
  const cached = cache.get(idea.id);
  if (cached && cached.seed === seed && cached.version === version) return cached;
  const identity = { id: idea.id, seed, version, svg: generateArtwork(seed, {}, version) };
  cache.set(idea.id, identity);
  return identity;
}

export const getArtwork = (id: string) => cache.get(id);

export function regenerateArtwork(id: string, version: number) {
  const current = cache.get(id);
  return current ? createVisualIdentity({ id, seed: current.seed }, version) : undefined;
}
