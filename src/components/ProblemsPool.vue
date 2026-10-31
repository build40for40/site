<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type ComponentPublicInstance } from "vue";
import { pad, tones, type EntryStatus } from "../data/days";
import { createVisualIdentity } from "../pool/artwork";
import { poolConfig } from "../pool/config";
import { afterLoad } from "../pool/data";
import { boxGrowth } from "../pool/effects";
import { CURL_TURN, boxOf, curl, lob, type Box } from "../pool/flight";
import type { Match, Ranking } from "../pool/search";
import type { PhysicsController, Vector } from "../pool/physics";
import type { createLift } from "../pool/effects";

export interface PoolTile {
  key: string;
  id: string;
  title: string;
  problem: string;
  seed?: string;
  label: string;
  raised: number;
  // Days thrown into the pool from the grid while browsing.
  day?: number;
  status?: EntryStatus;
  kicker?: string;
}

const props = defineProps<{ tiles: PoolTile[]; matches?: Match[] | null; ranking?: Ranking; quiet?: boolean; tall?: boolean }>();
const emit = defineEmits<{ pick: [key: string] }>();

const list = ref<HTMLElement>();
const elements = new Map<string, HTMLElement>();
const setTile = (id: string, element: Element | ComponentPublicInstance | null) => {
  if (element instanceof HTMLElement) elements.set(id, element);
  else elements.delete(id);
};

// These start as the server renders them, and the real values arrive once mounted.
const reduced = ref(false);
const failed = ref(false);
const active = ref(false);
const wide = ref(false);
const size = ref({ width: 0, height: 0 });

const physical = computed(() => poolConfig.physics.enabled && !reduced.value && !failed.value);
const tile = computed(() => (wide.value ? 24 : 20));

// Spread out without randomness, so the server and the browser draw the same bubbles.
const bubbles = Array.from({ length: 9 }, (_, i) => ({
  left: `${(i * 37 + 11) % 96}%`,
  width: `${4 + ((i * 5) % 7)}px`,
  height: `${4 + ((i * 5) % 7)}px`,
  "--bubble-time": `${5 + ((i * 3) % 5)}s`,
  "--bubble-delay": `${-((i * 1.7) % 6).toFixed(1)}s`,
  "--bubble-rise": `${120 + ((i * 41) % 100)}px`,
  "--bubble-sway": `${i % 2 ? -8 : 8}px`,
}));

const artwork = computed(() => new Map(props.tiles.flatMap((t) => (t.day ? [] : [[t.id, createVisualIdentity(t).svg] as const]))));

const scored = computed(() => (props.matches ?? []).filter((m) => m.score >= poolConfig.search.minRelevance));
const percents = computed(() => new Map(scored.value.map((m) => [m.id, Math.round(m.score * 100)])));
const announcement = computed(() => {
  if (!props.matches || props.quiet) return "";
  const count = scored.value.length;
  if (!count) return "Nothing in the pool looks like yours yet";
  if (props.ranking === "lexical") return `${count} unfunded ${count === 1 ? "problem shares" : "problems share"} words with yours`;
  return `${count} unfunded ${count === 1 ? "problem looks" : "problems look"} like yours`;
});

// The band stays shut until there's something to show, then the lava slides up from the floor and the ideas rain in
// once it's up. Sliding rather than growing keeps everything else on the page still.
const floor = ref<HTMLElement>();
const lava = "bg-linear-to-b from-night from-15% via-lava-deep to-lava";
const band = ref<HTMLElement>();
const shown = ref(false);
let loaded = false;
let risen = false;
let rising = false;

async function reveal() {
  if (!props.tiles.length) {
    stop();
    risen = false;
    return;
  }
  if (risen || rising) return;
  rising = true;
  await nextTick();
  await new Promise(requestAnimationFrame);
  shown.value = true;
  await nextTick();
  await Promise.allSettled((band.value?.getAnimations?.() ?? []).map((a) => a.finished));
  rising = false;
  risen = true;
  start();
}

let controller: PhysicsController | undefined;
let lift: ReturnType<typeof createLift> | undefined;
let starting = false;
let engine: Promise<[typeof import("../pool/physics"), typeof import("../pool/effects")]> | undefined;

function preload() {
  engine ??= Promise.all([import("../pool/physics"), import("../pool/effects")]).catch((error) => {
    engine = undefined;
    throw error;
  });
  return engine;
}

function loadEngine() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => (timer = setTimeout(() => reject(new Error("Physics took too long")), poolConfig.physics.loadTimeoutMs)));
  return Promise.race([preload(), timeout]).finally(() => clearTimeout(timer));
}

async function start() {
  if (controller || starting || !loaded || !risen || !physical.value || !list.value) return;
  starting = true;
  let modules;
  try {
    modules = await loadEngine();
    await nextTick();
  } catch {
    failed.value = true;
    return;
  } finally {
    starting = false;
  }
  const [{ initializePhysics }, { createLift }] = modules;
  if (!physical.value || !list.value) return;
  controller = initializePhysics(list.value, { entry });
  lift = createLift(
    { setBodyHover: (id, y) => controller?.setBodyHover(id, y === null ? null : y + entry() + overhang(id)) },
    () => ({ height: size.value.height - entry(), tile: tile.value }),
  );
  register(props.tiles.map((t) => t.id));
  active.value = true;
  lift.apply(scored.value);
}

function stop() {
  controller?.destroy();
  controller = undefined;
  lift = undefined;
  active.value = false;
}

function register(ids: string[]) {
  const days = new Set(props.tiles.filter((t) => t.day).map((t) => t.id));
  ids.forEach((id, i) => {
    const element = elements.get(id);
    const shape = days.has(id) ? "box" : "circle";
    if (element) controller?.registerBody(id, element, { shape, delayMs: held.value.has(id) ? Infinity : i * poolConfig.physics.rainStaggerMs });
  });
}

// Anything bigger than a plain ball floats a little lower, so it doesn't poke out of the top of the pool.
const overhang = (id: string) => Math.max(0, (elements.get(id)?.offsetHeight ?? 0) - tile.value) / 2;

// A problem sent from the join form is held back from raining in, so it can fall in from wherever its box is.
const held = ref(new Set<string>());
const hold = (id: string) => held.value.add(id);

function settled() {
  const ready = () => shown.value && (active.value || !physical.value);
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, poolConfig.physics.loadTimeoutMs);
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    if (ready()) return done();
    const stop = watch(ready, (ok) => {
      if (!ok) return;
      stop();
      done();
    });
  });
}

// The balls fly over the whole board, but they rain in and rest in the pool at the bottom of it.
function entry() {
  return floor.value && list.value ? floor.value.getBoundingClientRect().top - list.value.getBoundingClientRect().top : 0;
}

async function receive(id: string, ghost: HTMLElement) {
  await settled();
  await nextTick();
  const element = elements.get(id);
  if (controller && element && list.value) {
    const art = document.createElement("span");
    art.className = "absolute inset-0 [&>svg]:size-full";
    art.innerHTML = artwork.value.get(id) ?? "";
    const ball = await curl(ghost, boxOf(ghost), element.offsetWidth, art);
    const box = boxOf(list.value);
    const r = ball.width / 2;
    const x = Math.min(Math.max(ball.left + r - box.left, r), box.width - r);
    controller.drop(id, { x, y: ball.top + r - box.top }, { x: 0, y: 0 }, { angle: CURL_TURN });
  } else if (element) {
    await lob(ghost, boxOf(ghost), boxOf(element));
  }
  held.value.delete(id);
}

// Days burst out of their slots in the grid, up and away from its middle, and fall into the pool one after another.
async function burst(pieces: { id: string; from: Box }[]) {
  const box = list.value && boxOf(list.value);
  const middle = pieces.reduce((sum, p) => sum + p.from.left + p.from.width / 2, 0) / pieces.length;
  const starts = pieces.map(({ id, from }) => ({ id, x: from.left + from.width / 2, y: from.top + from.height / 2 }));
  await settled();
  await nextTick();
  const { speed, spread, spin, staggerMs, ghostMs } = poolConfig.physics.burst;
  const between = ([low, high]: readonly number[]) => low + Math.random() * (high - low);
  await Promise.all(
    starts.map(
      ({ id, x, y }, i) =>
        new Promise<void>((resolve) =>
          setTimeout(() => {
            if (controller && box) {
              const r = (elements.get(id)?.offsetWidth ?? 0) / 2;
              const at = { x: Math.min(Math.max(x - box.left, r), box.width - r), y: Math.max(y - box.top, r) };
              const velocity = { x: (x - middle) * spread + between([-60, 60]), y: -between(speed) };
              controller.drop(id, at, velocity, { angle: between([-0.3, 0.3]), spin: between([-spin, spin]), ghostMs });
            }
            held.value.delete(id);
            resolve();
          }, controller ? i * staggerMs : 0),
        ),
    ),
  );
}

// Where each of these is on screen, tilted however it landed.
function boxes(ids: string[]) {
  const found = new Map<string, Box & { angle: number }>();
  for (const id of ids) {
    const element = elements.get(id);
    const state = controller?.bodyState(id);
    if (!element || (controller && !state?.shown)) continue;
    const { left, top, width, height } = boxOf(element);
    const [w, h] = [element.offsetWidth, element.offsetHeight];
    found.set(id, { left: left + (width - w) / 2, top: top + (height - h) / 2, width: w, height: h, angle: state?.angle ?? 0 });
  }
  return found;
}

// Browsing makes the pool fill the screen. It grows or shrinks from where it was rather than jumping.
watch(
  () => props.tall,
  async () => {
    const element = floor.value;
    if (!element || reduced.value) return;
    const before = element.getBoundingClientRect();
    await nextTick();
    const after = element.getBoundingClientRect();
    element.animate(
      [
        { height: `${before.height}px`, marginTop: `${before.top - after.top}px` },
        { height: `${after.height}px`, marginTop: "0px" },
      ],
      { duration: 480, easing: "cubic-bezier(.65,0,.35,1)" },
    );
  },
);

watch(
  () => props.tiles.map((t) => t.id),
  async (ids, before = []) => {
    if (!controller) return;
    await nextTick();
    const now = new Set(ids);
    for (const id of before) if (!now.has(id)) controller.unregisterBody(id);
    const old = new Set(before);
    register(ids.filter((id) => !old.has(id)));
    lift?.apply(scored.value);
  },
);

watch(() => props.tiles.length > 0, reveal);
watch(
  () => props.tiles.map((t) => boxGrowth(t.raised)).join(),
  async () => {
    await nextTick();
    controller?.refit();
  },
);
watch(scored, (matches) => lift?.apply(matches));
watch(() => size.value.height, () => lift?.apply(scored.value));
watch(physical, (on) => (on ? start() : stop()));

const open = ref<string | null>(null);
const tip = ref<HTMLElement>();
const place = ref({ left: 0, top: 0 });
const openTile = computed(() => props.tiles.find((t) => t.id === open.value));
const plain = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
const blurb = computed(() => {
  const text = openTile.value?.problem ?? "";
  if (plain(text) === plain(openTile.value?.title ?? "")) return "";
  return text.length > 180 ? `${text.slice(0, 180).replace(/\s+\S*$/, "")}…` : text;
});
let placing = 0;
// Read when the tooltip opens, since `touch` itself isn't reactive.
const touchHint = ref(false);
watch(open, () => (touchHint.value = touch));

function follow() {
  placing = 0;
  const button = open.value ? elements.get(open.value)?.querySelector("button") : undefined;
  if (!button || !tip.value) return;
  const rect = button.getBoundingClientRect();
  const margin = 8;
  const { offsetWidth: w, offsetHeight: h } = tip.value;
  const left = Math.min(Math.max(margin, rect.left + rect.width / 2 - w / 2), Math.max(margin, innerWidth - w - margin));
  const above = rect.top - h - margin;
  const top = above >= margin ? above : Math.min(rect.bottom + margin, innerHeight - h - margin);
  if (left !== place.value.left || top !== place.value.top) place.value = { left, top };
  placing = requestAnimationFrame(follow);
}

watch(open, async (id) => {
  cancelAnimationFrame(placing);
  placing = 0;
  if (!id) return;
  await nextTick();
  follow();
});

const close = () => (open.value = null);

// A mouse shows an idea's details on hover and opens it in the day box on click. Touch has no hover, so the first tap
// shows the details and a second opens it. Keyboard focus shows them and Enter opens it. The click that ends a drag
// isn't a tap.
let touch = false;

function hovered(id: string, event: PointerEvent) {
  if (event.pointerType !== "mouse" || press?.holding) return;
  touch = false;
  open.value = id;
}

function unhovered(id: string, event: PointerEvent) {
  if (event.pointerType === "mouse" && open.value === id && !press?.holding) close();
}

function clicked(id: string, event: MouseEvent) {
  if (thrown) {
    thrown = false;
    return;
  }
  if (touch && event.detail !== 0 && open.value !== id) {
    open.value = id;
    return;
  }
  close();
  const key = props.tiles.find((t) => t.id === id)?.key;
  if (key) emit("pick", key);
}

// Click and hold picks an idea up, and moving while it's held drags it. Letting go throws it.
let press: { id: string; pointer: number; start: Vector; at: Vector; timer: ReturnType<typeof setTimeout>; holding: boolean } | undefined;
let thrown = false;

function local(event: PointerEvent): Vector {
  const box = list.value!.getBoundingClientRect();
  return { x: event.clientX - box.left, y: event.clientY - box.top };
}

function pickUp() {
  if (!press || press.holding) return;
  clearTimeout(press.timer);
  press.holding = !!controller?.grab(press.id, press.at);
  if (press.holding) close();
}

function pressed(id: string, event: PointerEvent) {
  thrown = false;
  touch = event.pointerType !== "mouse";
  if (!controller || event.button !== 0) return;
  (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
  const at = local(event);
  press = { id, pointer: event.pointerId, start: at, at, holding: false, timer: setTimeout(pickUp, poolConfig.physics.drag.holdMs) };
}

function moved(event: PointerEvent) {
  if (event.pointerId !== press?.pointer) return;
  press.at = local(event);
  if (!press.holding && Math.hypot(press.at.x - press.start.x, press.at.y - press.start.y) > poolConfig.physics.drag.movePx) pickUp();
  if (press.holding) controller?.drag(press.at);
}

function lifted(event: PointerEvent) {
  if (event.pointerId !== press?.pointer) return;
  clearTimeout(press.timer);
  if (press.holding) {
    controller?.release();
    thrown = true;
  }
  press = undefined;
}

function focused(id: string, event: FocusEvent) {
  try {
    if (!(event.target as Element).matches(":focus-visible")) return;
    touch = false;
    open.value = id;
  } catch {}
}

function blurred(id: string, event: FocusEvent) {
  const next = event.relatedTarget as Element | null;
  if (open.value === id && !next?.closest?.("[data-pool-ball]")) close();
}

function onPointerDown(event: PointerEvent) {
  if (!open.value) return;
  const target = event.target as Element | null;
  const ball = target?.closest?.("[data-pool-ball]");
  if (ball?.getAttribute("data-pool-ball") === open.value || target?.closest?.("#pool-tip")) return;
  close();
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key !== "Escape" || !open.value) return;
  event.preventDefault();
  close();
}

defineExpose({ nudge: () => controller?.nudge(), hold, receive, burst, boxes });

let sizer: ResizeObserver | undefined;
const media: [MediaQueryList, () => void][] = [];

onMounted(() => {
  const watchMedia = (query: string, apply: (matches: boolean) => void) => {
    const list = matchMedia(query);
    const update = () => apply(list.matches);
    update();
    list.addEventListener("change", update);
    media.push([list, update]);
  };
  watchMedia("(prefers-reduced-motion: reduce)", (matches) => (reduced.value = matches));
  watchMedia("(min-width: 640px)", (matches) => (wide.value = matches));

  if (list.value) size.value = { width: list.value.clientWidth, height: list.value.clientHeight };
  sizer = new ResizeObserver(([entry]) => (size.value = { width: entry.contentRect.width, height: entry.contentRect.height }));
  if (list.value) sizer.observe(list.value);

  addEventListener("pointerdown", onPointerDown, true);
  addEventListener("keydown", onKeyDown, true);
  afterLoad().then(() => {
    loaded = true;
    start();
  });
  reveal();
});

onBeforeUnmount(() => {
  cancelAnimationFrame(placing);
  sizer?.disconnect();
  for (const [list, update] of media) list.removeEventListener("change", update);
  removeEventListener("pointerdown", onPointerDown, true);
  removeEventListener("keydown", onKeyDown, true);
  if (press) clearTimeout(press.timer);
  stop();
});
</script>

<template>
  <div
    id="problems"
    ref="floor"
    :class="[
      !tiles.length && 'hidden',
      !shown && 'invisible',
      physical ? ['flex flex-col overflow-hidden', tall ? 'min-h-[24rem] flex-1' : 'h-[clamp(12rem,30dvh,17rem)]'] : [lava, tall && 'flex-1'],
    ]"
  >
    <section
      ref="band"
      aria-labelledby="pool-title"
      class="relative flex flex-col text-night-text transition-transform duration-700 ease-out"
      :class="physical && ['flex-1', lava, !shown && 'translate-y-full']"
    >
      <h2 id="pool-title" class="sr-only">Unfunded problems</h2>
      <p class="sr-only" role="status" aria-live="polite">{{ announcement }}</p>

      <div v-if="physical" aria-hidden="true" class="pointer-events-none absolute inset-0 overflow-hidden">
        <div class="absolute inset-x-0 bottom-0 h-2/3 animate-simmer bg-radial-[ellipse_at_50%_100%] from-pop-orange/30 via-pop-red/10 to-transparent to-70%"></div>
        <span
          v-for="(b, i) in bubbles"
          :key="i"
          class="absolute bottom-0 animate-bubble rounded-full border border-pop-orange/50 bg-pop-yellow/10"
          :style="b"
        ></span>
      </div>

      <div
        v-if="openTile"
        id="pool-tip"
        ref="tip"
        role="tooltip"
        class="fixed top-0 left-0 z-50 w-max max-w-[min(20rem,calc(100vw-16px))] rounded-lg bg-night-text px-3.5 py-3 text-night shadow-lg"
        :style="{ transform: `translate(${place.left}px, ${place.top}px)` }"
      >
        <p v-if="openTile.kicker" class="m-0 mb-1 font-mono text-[11px] text-night-panel/80">{{ openTile.kicker }}</p>
        <p class="m-0 text-[15px] leading-snug font-semibold">{{ openTile.title }}</p>
        <p v-if="blurb" class="m-0 mt-1 text-sm leading-snug text-night-panel">{{ blurb }}</p>
        <p class="m-0 mt-2 font-mono text-[11px] text-night-panel/80">{{ touchHint ? "Tap again to open it" : "Click to open it" }}</p>
      </div>
    </section>

    <!-- Outside the band so the balls can fly over the rest of the board. Only the balls take clicks. -->
    <ul
      ref="list"
      aria-labelledby="pool-title"
      class="m-0 list-none p-0"
      :class="physical ? 'pointer-events-none absolute inset-0 z-20 overflow-clip' : 'flex flex-wrap items-end gap-2 px-4 pt-1 pb-6 lg:px-12'"
    >
      <li
        v-for="t in tiles"
        :key="t.key"
        :ref="(element) => setTile(t.id, element)"
        class="group"
        :style="{ '--grow': `${boxGrowth(t.raised)}px` }"
        :class="[
          t.day ? 'size-9 rounded-md sm:size-11' : 'aspect-square w-[calc(1.25rem+var(--grow))] rounded-full sm:w-[calc(1.5rem+var(--grow))]',
          physical ? 'pointer-events-auto absolute top-0 left-0 will-change-transform focus-within:z-10' : 'relative',
          physical && !active ? 'opacity-0 focus-within:opacity-100' : !physical && matches && !percents.has(t.id) && 'opacity-40',
          !physical && held.has(t.id) && 'invisible',
        ]"
      >
        <button
          type="button"
          :data-pool-ball="t.id"
          :aria-label="t.label"
          :aria-expanded="open === t.id"
          :aria-describedby="open === t.id ? 'pool-tip' : undefined"
          class="absolute inset-0 cursor-pointer overflow-hidden border-0 p-0 select-none after:pointer-events-none after:absolute after:inset-0 after:bg-linear-135 after:from-night-text/60 after:via-night-text/5 after:via-45% after:to-transparent after:ring-1 after:ring-night-text/30 after:ring-inset hover:brightness-115 active:cursor-grabbing motion-safe:hover:animate-wiggle motion-safe:aria-expanded:animate-pop focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-lime aria-expanded:outline-2 aria-expanded:outline-offset-2 aria-expanded:outline-night-text"
          :class="[
            physical && 'touch-none',
            t.day
              ? ['grid place-items-center rounded-md text-night-text after:rounded-md', t.status === 'open' ? 'border-[1.5px] border-dashed border-night-edge bg-night-panel' : 'bg-night-tile']
              : 'rounded-full bg-night-panel after:rounded-full',
          ]"
          @click="clicked(t.id, $event)"
          @pointerenter="hovered(t.id, $event)"
          @pointerleave="unhovered(t.id, $event)"
          @pointerdown="pressed(t.id, $event)"
          @pointermove="moved"
          @pointerup="lifted"
          @pointercancel="lifted"
          @focus="focused(t.id, $event)"
          @blur="blurred(t.id, $event)"
        >
          <template v-if="t.day">
            <span v-if="t.status !== 'open'" aria-hidden="true" class="absolute inset-x-0 top-0 h-[3px]" :class="tones[t.status!].dot"></span>
            <span aria-hidden="true" class="font-mono text-sm leading-none font-semibold sm:text-base">{{ pad(t.day) }}</span>
          </template>
          <span v-else aria-hidden="true" class="absolute inset-0 [&>svg]:size-full" v-html="artwork.get(t.id)"></span>
        </button>
        <span
          v-if="physical && ranking === 'classifier' && percents.has(t.id)"
          aria-hidden="true"
          class="pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2 rounded-full bg-night-text px-1.5 font-mono text-[10px] leading-4 font-medium text-night opacity-0 transition-opacity duration-300 group-data-arrived:animate-pop group-data-arrived:opacity-100"
          >{{ percents.get(t.id) }}%</span
        >
      </li>
    </ul>
  </div>
</template>
