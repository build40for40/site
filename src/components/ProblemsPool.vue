<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type ComponentPublicInstance } from "vue";
import { createVisualIdentity } from "../pool/artwork";
import { poolConfig } from "../pool/config";
import { afterLoad } from "../pool/data";
import { boxGrowth } from "../pool/effects";
import { boxOf, fall, lob } from "../pool/flight";
import type { Match } from "../pool/search";
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
}

const props = defineProps<{ tiles: PoolTile[]; matches?: Match[] | null }>();

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

const artwork = computed(() => new Map(props.tiles.map((t) => [t.id, createVisualIdentity(t).svg])));

const scored = computed(() => (props.matches ?? []).filter((m) => m.score >= poolConfig.search.minRelevance));
const percents = computed(() => new Map(scored.value.map((m) => [m.id, Math.round(m.score * 100)])));
const announcement = computed(() => {
  if (!props.matches) return "";
  const count = scored.value.length;
  return count ? `${count} unfunded ${count === 1 ? "problem looks" : "problems look"} like yours` : "Nothing in the pool looks like yours yet";
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
  lift = createLift({ setBodyHover: (id, y) => controller?.setBodyHover(id, y === null ? null : y + entry()) }, () => ({ height: size.value.height - entry(), tile: tile.value }));
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
  ids.forEach((id, i) => {
    const element = elements.get(id);
    if (element) controller?.registerBody(id, element, { shape: "circle", delayMs: held.value.has(id) ? Infinity : i * poolConfig.physics.rainStaggerMs });
  });
}

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
  floor.value?.scrollIntoView({ block: "nearest" });
  const box = list.value && boxOf(list.value);
  if (controller && element && box) {
    const { offsetWidth: width, offsetHeight: height } = element;
    const from = boxOf(ghost);
    const x = Math.min(Math.max(from.left + from.width / 2 - box.left, width / 2), box.width - width / 2);
    const spin = (Math.random() - 0.5) * 1.2;
    const y = entry() + height / 2 + 1;
    await fall(ghost, from, { left: box.left + x - width / 2, top: box.top + y - height / 2, width, height }, spin);
    controller.drop(id, { x, y }, { x: 0, y: poolConfig.physics.drop.speed }, spin);
  } else if (element) {
    element.scrollIntoView({ block: "nearest" });
    await lob(ghost, boxOf(ghost), boxOf(element));
  }
  held.value.delete(id);
}

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

// Keyboard clicks have no detail and only ever open, since focus has already opened the tooltip. The click that ends a
// drag isn't a tap.
function clicked(id: string, event: MouseEvent) {
  if (thrown) {
    thrown = false;
    return;
  }
  open.value = event.detail === 0 || open.value !== id ? id : null;
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
    if ((event.target as Element).matches(":focus-visible")) open.value = id;
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

defineExpose({ nudge: () => controller?.nudge(), hold, receive });

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
  <div ref="floor" :class="[!tiles.length && 'hidden', !shown && 'invisible', physical ? 'h-[clamp(12rem,30dvh,17rem)] overflow-hidden' : lava]">
    <section
      ref="band"
      aria-labelledby="pool-title"
      class="relative flex flex-col text-night-text transition-transform duration-700 ease-out"
      :class="physical && ['h-full', lava, !shown && 'translate-y-full']"
    >
      <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 pt-3 pb-2 lg:px-12">
        <div class="flex items-baseline gap-3">
          <h2 id="pool-title" class="m-0 text-xl font-semibold tracking-tight sm:text-2xl">Unfunded problems</h2>
          <span v-if="tiles.length" class="hidden font-mono text-xs text-night-muted sm:inline">{{ tiles.length }} simmering</span>
        </div>
      </div>
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
        <p class="m-0 text-[15px] leading-snug font-semibold">{{ openTile.title }}</p>
        <p v-if="blurb" class="m-0 mt-1 text-sm leading-snug text-night-panel">{{ blurb }}</p>
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
        class="group aspect-square w-[calc(1.25rem+var(--grow))] rounded-full sm:w-[calc(1.5rem+var(--grow))]"
        :style="{ '--grow': `${boxGrowth(t.raised)}px` }"
        :class="[
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
          class="absolute inset-0 cursor-pointer overflow-hidden rounded-full border-0 bg-night-panel p-0 select-none after:pointer-events-none after:absolute after:inset-0 after:rounded-full after:bg-linear-135 after:from-night-text/60 after:via-night-text/5 after:via-45% after:to-transparent after:ring-1 after:ring-night-text/30 after:ring-inset hover:brightness-115 active:cursor-grabbing [&>svg]:size-full motion-safe:hover:animate-wiggle motion-safe:aria-expanded:animate-pop focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-night-text aria-expanded:outline-2 aria-expanded:outline-offset-2 aria-expanded:outline-night-text"
          :class="physical && 'touch-none'"
          @click="clicked(t.id, $event)"
          @pointerdown="pressed(t.id, $event)"
          @pointermove="moved"
          @pointerup="lifted"
          @pointercancel="lifted"
          @focus="focused(t.id, $event)"
          @blur="blurred(t.id, $event)"
          v-html="artwork.get(t.id)"
        ></button>
        <span
          v-if="physical && percents.has(t.id)"
          aria-hidden="true"
          class="pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2 rounded-full bg-night-text px-1.5 font-mono text-[10px] leading-4 font-medium text-night opacity-0 transition-opacity duration-300 group-data-arrived:animate-pop group-data-arrived:opacity-100"
          >{{ percents.get(t.id) }}%</span
        >
      </li>
    </ul>
  </div>
</template>
