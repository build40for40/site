<script setup lang="ts">
import { computed } from "vue";
import type { Nerds } from "./data";
import { PLANNED, VIEWS, viewById, viewsIn } from "./registry";
import { useRoute } from "./route";
import { TABS, type Tab } from "./view";
import ViewHost from "./ViewHost.vue";

const props = defineProps<{ nerds: Nerds }>();
const { params, go, born } = useRoute();

const RESERVED = new Set(["tab", "set", "view", "born"]);
const methods = computed(() => params.value.view === "methods");
const current = computed(() => viewById(params.value.view ?? ""));
const set = computed<Tab>(() => current.value?.tab ?? (TABS.find((t) => t.id === params.value.set)?.id || "trends"));
const live = computed(() => viewsIn(set.value));
const view = computed(() => (methods.value ? undefined : (current.value ?? live.value[0])));
const planned = computed(() => PLANNED.filter((p) => p.tab === set.value));
const viewParams = computed(() => Object.fromEntries(Object.entries(params.value).filter(([key]) => !RESERVED.has(key))));
const counts = computed(() => Object.fromEntries(TABS.map((t) => [t.id, viewsIn(t.id).length])));
const sources = computed(() => props.nerds.data.meta.sources.filter((s) => view.value?.sources.includes(s.id)));

function pickSet(id: Tab) {
  const first = viewsIn(id)[0];
  go({ tab: "explore", set: id, view: first?.id ?? null, ...clearView() });
}
function pickView(id: string) {
  go({ tab: "explore", view: id, ...clearView() });
}
/** Drop the old view's own params when switching views. */
function clearView() {
  return Object.fromEntries(Object.keys(viewParams.value).map((key) => [key, null]));
}
const setParam = (key: string, value: string | null) => go({ [key]: value }, false);
</script>

<template>
  <section class="mx-auto max-w-6xl px-4 pt-6">
    <p class="font-mono text-xs uppercase tracking-[0.2em] text-nof-muted">{{ VIEWS.length }} ways in · {{ PLANNED.length }} more on the rail</p>
    <h1 class="mt-2 font-nof-display text-4xl leading-none font-black sm:text-6xl">Explore the archive</h1>

    <div class="-mx-4 mt-6 overflow-x-auto px-4 [scrollbar-width:none]">
      <div role="tablist" aria-label="Datasets" class="flex w-max gap-2">
        <button
          v-for="t in TABS"
          :key="t.id"
          type="button"
          role="tab"
          :aria-selected="set === t.id && !methods"
          class="rounded-full border px-4 py-2 text-sm font-semibold whitespace-nowrap transition"
          :class="set === t.id && !methods ? 'border-nof-text bg-nof-text text-nof-night' : 'border-nof-line text-nof-sub hover:border-nof-muted'"
          @click="pickSet(t.id)"
        >
          {{ t.label }} <span class="font-mono text-xs opacity-70">{{ counts[t.id] }}</span>
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="methods"
          class="rounded-full border px-4 py-2 text-sm font-semibold whitespace-nowrap transition"
          :class="methods ? 'border-nof-text bg-nof-text text-nof-night' : 'border-nof-line text-nof-sub hover:border-nof-muted'"
          @click="go({ tab: 'explore', view: 'methods', set: null })"
        >
          Methods
        </button>
      </div>
    </div>

    <template v-if="!methods">
      <p class="mt-4 text-nof-sub">{{ TABS.find((t) => t.id === set)?.blurb }}</p>
      <div class="mt-4 flex flex-wrap gap-2" aria-label="Visualisations">
        <button
          v-for="v in live"
          :key="v.id"
          type="button"
          class="rounded-lg border px-3 py-1.5 text-sm transition"
          :class="view?.id === v.id ? 'border-nof-pink bg-nof-pink text-nof-pink-ink font-semibold' : 'border-nof-line bg-nof-panel text-nof-text hover:border-nof-muted'"
          :aria-pressed="view?.id === v.id"
          @click="pickView(v.id)"
        >
          {{ v.title }}
        </button>
        <span v-for="p in planned" :key="p.id" class="cursor-help rounded-lg border border-dashed border-nof-line px-3 py-1.5 text-sm text-nof-muted" :title="p.blurb">{{ p.title }} · soon</span>
      </div>
    </template>
  </section>

  <section v-if="view" :key="view.id" class="mx-auto mt-8 max-w-6xl px-4">
    <h2 class="font-nof-display text-3xl leading-tight font-bold italic sm:text-4xl">{{ view.title }}</h2>
    <p class="mt-1 max-w-2xl text-nof-sub">{{ view.blurb }}</p>
    <div class="mt-5 overflow-hidden rounded-2xl border border-nof-line bg-nof-panel">
      <ViewHost :nerds="nerds" :view="view" :born="born" :params="viewParams" @param="setParam" />
    </div>
    <p v-if="view.how" class="mt-3 text-sm text-nof-sub"><span class="font-semibold text-nof-text">Play:</span> {{ view.how }}</p>
    <p v-if="sources.length" class="mt-1 text-xs text-nof-muted">Data: <template v-for="(s, i) in sources" :key="s.id"><a :href="s.url" class="underline hover:text-nof-text" target="_blank" rel="noopener">{{ s.name }}</a> ({{ s.licence }})<template v-if="i < sources.length - 1">, </template></template></p>
  </section>
  <section v-else-if="!methods" class="mx-auto mt-8 max-w-6xl px-4 text-nof-sub">Nothing on this rail yet. Coming soon, darling.</section>

  <section v-if="methods" class="mx-auto mt-8 max-w-3xl px-4">
    <h2 class="font-nof-display text-3xl font-bold italic">How we got the numbers</h2>
    <p class="mt-3 text-nof-sub">Every number here comes from public sources we're allowed to use, and every trend links back to the sentence it came from. Generated {{ nerds.data.meta.generated }}.</p>
    <ul class="mt-6 space-y-4">
      <li v-for="s in nerds.data.meta.sources" :key="s.id" class="rounded-xl border border-nof-line bg-nof-panel p-4">
        <a :href="s.url" target="_blank" rel="noopener" class="font-semibold underline">{{ s.name }}</a>
        <span class="ml-2 font-mono text-xs text-nof-muted">{{ s.licence }}</span>
        <p class="mt-1 text-sm text-nof-sub">{{ s.covers }}</p>
        <p class="mt-1 text-xs text-nof-muted">Credit: {{ s.credit }}</p>
      </li>
    </ul>
    <h3 class="mt-10 font-nof-display text-2xl font-bold italic">Things to argue with us about</h3>
    <ul class="mt-3 list-disc space-y-2 pl-5 text-nof-sub">
      <li v-for="c in nerds.data.meta.caveats" :key="c">{{ c }}</li>
      <li>Year colours before 2000 are the colour word each decade's V&amp;A descriptions use more than the century average, blended between decades. From 2000 they're Pantone's Colour of the Year, which is marketing, not measurement.</li>
      <li>The silhouette figure is our own reading of each decade's typical women's daywear shape, not a measurement.</li>
    </ul>
  </section>
</template>
