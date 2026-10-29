<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type ComponentPublicInstance } from "vue";
import { createVisualIdentity } from "../pool/artwork";
import { poolConfig } from "../pool/config";
import { afterLoad } from "../pool/data";
import { motionSupported, requestMotionPermission } from "../pool/motion";
import { createSearch, type SearchResult } from "../pool/search";
import type { PhysicsController } from "../pool/physics";
import type { createSearchEffects } from "../pool/effects";

export interface PoolTile {
  key: string;
  id: string;
  title: string;
  problem: string;
  seed?: string;
  label: string;
  selected: boolean;
}

const props = defineProps<{ tiles: PoolTile[] }>();
const emit = defineEmits<{ select: [key: string] }>();

const MOTION_KEY = "pool-motion";
const TILT_KEY = "pool-tilt";
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

const section = ref<HTMLElement>();
const list = ref<HTMLElement>();
const elements = new Map<string, HTMLElement>();
const setTile = (id: string, element: Element | ComponentPublicInstance | null) => {
  if (element instanceof HTMLElement) elements.set(id, element);
  else elements.delete(id);
};

const reduced = ref(typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);
const motionOn = ref(recall(MOTION_KEY) !== "off");
const failed = ref(false);
const active = ref(false);
const wide = ref(false);
const width = ref(0);
const tilt = ref<"off" | "on" | "denied" | "unsupported">("unsupported");

const canMove = computed(() => poolConfig.physics.enabled && !reduced.value);
const physical = computed(() => canMove.value && motionOn.value && !failed.value);
const tileSize = computed(() => (wide.value ? { width: 64, height: 64 } : { width: 56, height: 56 }));
const height = computed(() => {
  const { width: w, height: h } = tileSize.value;
  const perRow = Math.max(1, Math.floor(width.value / w));
  return Math.max(360, Math.ceil((props.tiles.length * 1.3) / perRow) * h + h * 2);
});

const artwork = computed(() => new Map(props.tiles.map((t) => [t.id, createVisualIdentity(t).svg])));

let controller: PhysicsController | undefined;
let effects: ReturnType<typeof createSearchEffects> | undefined;
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
  const [{ initializePhysics }, { createSearchEffects }] = modules;
  if (!physical.value || !list.value) return;
  controller = initializePhysics(list.value);
  controller.enablePointerInteraction(true);
  effects = createSearchEffects(controller, () => ({ width: width.value, tile: tileSize.value }));
  register(props.tiles.map((t) => t.id));
  active.value = true;
  if (tilt.value === "on") controller.enableDeviceMotion(true);
  if (result.value?.matches.length) effects.apply(result.value.matches);
}

function stop() {
  controller?.destroy();
  controller = undefined;
  effects = undefined;
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
  },
);

watch(reduced, (matches) => (matches ? stop() : start()));

const calibrate = () => controller?.calibrateDeviceMotion();

function toggleMotion() {
  motionOn.value = !motionOn.value;
  failed.value = false;
  remember(MOTION_KEY, motionOn.value ? "on" : "off");
  if (motionOn.value) start();
  else stop();
}

async function toggleTilt() {
  if (tilt.value === "on") {
    tilt.value = "off";
    remember(TILT_KEY, "off");
    controller?.enableDeviceMotion(false);
    return;
  }
  const permission = await requestMotionPermission();
  tilt.value = permission === "granted" ? "on" : permission;
  if (permission !== "granted") return;
  remember(TILT_KEY, "on");
  controller?.enableDeviceMotion(true);
}

const query = ref("");
const result = ref<SearchResult | null>(null);
const searching = computed(() => !!result.value && result.value.query.trim() !== "");
const matched = computed(() => new Set(result.value?.matches.map((m) => m.id)));
const announcement = computed(() => {
  if (!searching.value) return "";
  const count = result.value!.matches.length;
  return count ? `${count} ${count === 1 ? "idea matches" : "ideas match"} “${result.value!.query}”` : `Nothing in the pool matches “${result.value!.query}”`;
});

const search = createSearch({ ideas: () => props.tiles });
let debounce: ReturnType<typeof setTimeout> | undefined;
watch(query, (value) => {
  clearTimeout(debounce);
  if (value.trim().length < poolConfig.search.minQueryLength) {
    search.cancel();
    result.value = null;
    effects?.clear();
    return;
  }
  debounce = setTimeout(async () => {
    const found = await search.run(value.trim());
    if (!found) return;
    result.value = found;
    effects?.apply(found.matches);
  }, poolConfig.search.debounceMs);
});

let observer: IntersectionObserver | undefined;
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
  if (physical.value) afterLoad().then(() => preload().catch(() => {}));
  if (motionSupported() && matchMedia("(pointer: coarse)").matches) {
    const iosStyle = typeof (DeviceOrientationEvent as unknown as { requestPermission?: unknown }).requestPermission === "function";
    tilt.value = recall(TILT_KEY) === "on" && !iosStyle ? "on" : "off";
  }

  width.value = section.value?.clientWidth ?? 0;
  sizer = new ResizeObserver(([entry]) => (width.value = entry.contentRect.width));
  if (section.value) sizer.observe(section.value);
  observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) start();
    },
    { rootMargin: "200px" },
  );
  if (section.value) observer.observe(section.value);
});

onBeforeUnmount(() => {
  clearTimeout(debounce);
  search.cancel();
  observer?.disconnect();
  sizer?.disconnect();
  for (const [list, update] of media) list.removeEventListener("change", update);
  stop();
});

const control =
  "cursor-pointer rounded-full border border-night-edge bg-transparent px-3 py-1.5 font-mono text-xs font-medium text-night-text hover:border-night-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-night-text aria-pressed:border-night-text";
</script>

<template>
  <section ref="section" aria-labelledby="pool-title" class="flex flex-col gap-3 pt-3">
    <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 id="pool-title" class="m-0 text-2xl font-semibold tracking-tight">Problems pool</h2>
      <p class="m-0 max-w-[60ch] font-mono text-xs leading-normal text-night-muted">{{ tiles.length }} ideas that didn't make the 40 days. Sponsor one you like and it could bump one.</p>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <label for="pool-search" class="sr-only">Search the pool</label>
      <input
        id="pool-search"
        v-model="query"
        type="search"
        maxlength="80"
        autocomplete="off"
        placeholder="Search the pool"
        class="min-w-0 flex-1 basis-56 rounded-full border border-night-edge bg-night-panel px-4 py-1.5 text-sm text-night-text placeholder:text-night-muted focus-visible:border-night-text focus-visible:outline-none"
      />
      <button v-if="canMove" type="button" :aria-pressed="motionOn" :class="control" @click="toggleMotion">Motion {{ motionOn ? "on" : "off" }}</button>
      <template v-if="canMove && motionOn && tilt !== 'unsupported'">
        <button type="button" :aria-pressed="tilt === 'on'" :class="control" @click="toggleTilt">{{ tilt === "denied" ? "No tilt, touch still works" : `Tilt ${tilt === "on" ? "on" : "off"}` }}</button>
        <button v-if="tilt === 'on'" type="button" :class="control" @click="calibrate">Level it</button>
      </template>
    </div>
    <p class="sr-only" role="status" aria-live="polite">{{ announcement }}</p>

    <ul
      ref="list"
      class="m-0 list-none p-0"
      :class="physical ? 'relative touch-pan-y overflow-clip rounded-lg border border-night-line' : 'flex flex-wrap gap-2'"
      :style="physical ? { height: `${height}px` } : undefined"
    >
      <li
        v-for="t in tiles"
        :key="t.key"
        :ref="(element) => setTile(t.id, element)"
        class="size-14 rounded-full sm:size-16"
        :class="[
          physical ? 'absolute top-0 left-0 touch-pan-y will-change-transform focus-within:z-10 data-dragging:z-20' : 'relative',
          physical && !active ? 'opacity-0 focus-within:opacity-100' : searching && !matched.has(t.id) && 'opacity-40',
        ]"
      >
        <button
          type="button"
          :aria-label="t.label"
          :aria-pressed="t.selected"
          :title="t.title"
          class="absolute inset-0 cursor-pointer overflow-hidden rounded-full border-0 bg-night-panel p-0 ring-1 ring-night-line ring-inset hover:brightness-115 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-night-text [&>svg]:size-full"
          :class="t.selected && 'outline-2 outline-offset-2 outline-night-text'"
          @click="emit('select', t.key)"
          v-html="artwork.get(t.id)"
        ></button>
      </li>
    </ul>
  </section>
</template>
