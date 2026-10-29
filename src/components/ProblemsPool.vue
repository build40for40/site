<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type ComponentPublicInstance } from "vue";
import { createVisualIdentity } from "../pool/artwork";
import { poolConfig } from "../pool/config";
import { afterLoad } from "../pool/data";
import type { Match } from "../pool/search";
import type { PhysicsController } from "../pool/physics";
import type { createLift } from "../pool/effects";

export interface PoolTile {
  key: string;
  id: string;
  title: string;
  problem: string;
  seed?: string;
  label: string;
}

const props = defineProps<{ tiles: PoolTile[]; matches?: Match[] | null }>();

const MOTION_KEY = "pool-motion";
const remember = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {}
};
const recall = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const list = ref<HTMLElement>();
const elements = new Map<string, HTMLElement>();
const setTile = (id: string, element: Element | ComponentPublicInstance | null) => {
  if (element instanceof HTMLElement) elements.set(id, element);
  else elements.delete(id);
};

// These start as the server renders them, and the real values arrive once mounted.
const reduced = ref(false);
const tall = ref(true);
const motionOn = ref(true);
const failed = ref(false);
const active = ref(false);
const wide = ref(false);
const size = ref({ width: 0, height: 0 });

const canMove = computed(() => poolConfig.physics.enabled && !reduced.value && tall.value);
const physical = computed(() => canMove.value && motionOn.value && !failed.value);
const tile = computed(() => (wide.value ? 32 : 28));

const artwork = computed(() => new Map(props.tiles.map((t) => [t.id, createVisualIdentity(t).svg])));

const scored = computed(() => (props.matches ?? []).filter((m) => m.score >= poolConfig.search.minRelevance));
const percents = computed(() => new Map(scored.value.map((m) => [m.id, Math.round(m.score * 100)])));
const announcement = computed(() => {
  if (!props.matches) return "";
  const count = scored.value.length;
  return count ? `${count} unfunded ${count === 1 ? "problem looks" : "problems look"} like yours` : "Nothing in the pool looks like yours yet";
});

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
  if (controller || starting || !physical.value || !list.value) return;
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
  controller = initializePhysics(list.value);
  lift = createLift(controller, () => ({ height: size.value.height, tile: tile.value }));
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
    if (element) controller?.registerBody(id, element, { shape: "circle", delayMs: i * poolConfig.physics.rainStaggerMs });
  });
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

watch(scored, (matches) => lift?.apply(matches));
watch(() => size.value.height, () => lift?.apply(scored.value));
watch(physical, (on) => {
  document.documentElement.toggleAttribute("data-pool-stacked", !on);
  if (on) start();
  else stop();
});

function toggleMotion() {
  motionOn.value = !motionOn.value;
  failed.value = false;
  remember(MOTION_KEY, motionOn.value ? "on" : "off");
}

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
  const circle = open.value ? elements.get(open.value)?.querySelector("button") : undefined;
  if (!circle || !tip.value) return;
  const rect = circle.getBoundingClientRect();
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

// Keyboard clicks have no detail and only ever open, since focus has already opened the tooltip.
function clicked(id: string, event: MouseEvent) {
  open.value = event.detail === 0 || open.value !== id ? id : null;
}

function focused(id: string, event: FocusEvent) {
  try {
    if ((event.target as Element).matches(":focus-visible")) open.value = id;
  } catch {}
}

function blurred(id: string, event: FocusEvent) {
  const next = event.relatedTarget as Element | null;
  if (open.value === id && !next?.closest?.("[data-pool-circle]")) close();
}

function onPointerDown(event: PointerEvent) {
  if (!open.value) return;
  const target = event.target as Element | null;
  const circle = target?.closest?.("[data-pool-circle]");
  if (circle?.getAttribute("data-pool-circle") === open.value || target?.closest?.("#pool-tip")) return;
  close();
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key !== "Escape" || !open.value) return;
  event.preventDefault();
  close();
}

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
  motionOn.value = recall(MOTION_KEY) !== "off";
  watchMedia("(prefers-reduced-motion: reduce)", (matches) => (reduced.value = matches));
  watchMedia("(min-height: 500px)", (matches) => (tall.value = matches));
  watchMedia("(min-width: 640px)", (matches) => (wide.value = matches));
  document.documentElement.toggleAttribute("data-pool-stacked", !physical.value);

  if (list.value) size.value = { width: list.value.clientWidth, height: list.value.clientHeight };
  sizer = new ResizeObserver(([entry]) => (size.value = { width: entry.contentRect.width, height: entry.contentRect.height }));
  if (list.value) sizer.observe(list.value);

  addEventListener("pointerdown", onPointerDown, true);
  addEventListener("keydown", onKeyDown, true);
  afterLoad().then(start);
});

onBeforeUnmount(() => {
  cancelAnimationFrame(placing);
  sizer?.disconnect();
  for (const [list, update] of media) list.removeEventListener("change", update);
  removeEventListener("pointerdown", onPointerDown, true);
  removeEventListener("keydown", onKeyDown, true);
  document.documentElement.removeAttribute("data-pool-stacked");
  stop();
});
</script>

<template>
  <section aria-labelledby="pool-title" class="flex flex-col bg-linear-to-b from-night from-15% via-lava-deep to-lava text-night-text floor:min-h-0">
    <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 pt-3 pb-2 lg:px-12">
      <h2 id="pool-title" class="m-0 text-xl font-semibold tracking-tight sm:text-2xl">Unfunded problems</h2>
      <button
        v-if="canMove"
        type="button"
        :aria-pressed="motionOn"
        class="cursor-pointer rounded-full border border-night-edge bg-transparent px-3 py-1 font-mono text-xs font-medium text-night-text hover:border-night-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-night-text aria-pressed:border-night-text"
        @click="toggleMotion"
      >
        Motion {{ motionOn ? "on" : "off" }}
      </button>
    </div>
    <p class="sr-only" role="status" aria-live="polite">{{ announcement }}</p>

    <ul ref="list" class="m-0 list-none p-0" :class="physical ? 'relative min-h-0 flex-1 overflow-clip' : 'flex flex-wrap gap-2 px-4 pt-1 pb-6 lg:px-12'">
      <li
        v-for="t in tiles"
        :key="t.key"
        :ref="(element) => setTile(t.id, element)"
        class="group size-7 rounded-full sm:size-8"
        :class="[
          physical ? 'absolute top-0 left-0 will-change-transform focus-within:z-10' : 'relative',
          physical && !active ? 'opacity-0 focus-within:opacity-100' : !physical && matches && !percents.has(t.id) && 'opacity-40',
        ]"
      >
        <button
          type="button"
          :data-pool-circle="t.id"
          :aria-label="t.label"
          :aria-expanded="open === t.id"
          :aria-describedby="open === t.id ? 'pool-tip' : undefined"
          class="absolute inset-0 cursor-pointer overflow-hidden rounded-full border-0 bg-night-panel p-0 after:pointer-events-none after:absolute after:inset-0 after:rounded-full after:bg-linear-135 after:from-night-text/60 after:via-night-text/5 after:via-45% after:to-transparent after:ring-1 after:ring-night-text/30 after:ring-inset hover:brightness-115 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-night-text aria-expanded:outline-2 aria-expanded:outline-offset-2 aria-expanded:outline-night-text [&>svg]:size-full"
          @click="clicked(t.id, $event)"
          @focus="focused(t.id, $event)"
          @blur="blurred(t.id, $event)"
          v-html="artwork.get(t.id)"
        ></button>
        <span
          v-if="physical && percents.has(t.id)"
          aria-hidden="true"
          class="pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2 rounded-full bg-night-text px-1.5 font-mono text-[10px] leading-4 font-medium text-night opacity-0 transition-opacity duration-300 group-data-arrived:opacity-100"
          >{{ percents.get(t.id) }}%</span
        >
      </li>
    </ul>

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
</template>
