<script setup lang="ts">
import { computed, onMounted, onUnmounted, provide, ref, shallowRef } from "vue";
import { loadNerds, type Nerds } from "./data";
import Exhibition from "./Exhibition.vue";
import Explore from "./Explore.vue";
import Draw from "./Draw.vue";
import { pickComponents } from "./intent/client";
import IntentBar from "./intent/IntentBar.vue";
import { components, type IntentResult } from "./intent/registry";
import { viewById } from "./registry";
import { BORN_KEY, readBorn, routeKey, type Route } from "./route";

const nerds = shallowRef<Nerds>();
const failed = ref("");
const params = ref<Record<string, string>>({});
const born = ref<number | null>(null);

const read = () => {
  params.value = Object.fromEntries(new URLSearchParams(location.search));
};

const tab = computed<Route>(() => {
  const value = params.value.tab;
  return value === "explore" || value === "draw" ? value : "home";
});

/** Change the URL. `push` adds a history entry for real navigation; filters just replace. */
function go(next: Record<string, string | null>, push = true) {
  const search = new URLSearchParams(location.search);
  for (const [key, value] of Object.entries(next)) value === null ? search.delete(key) : search.set(key, value);
  const url = `${location.pathname}${search.size ? `?${search}` : ""}`;
  push ? history.pushState(null, "", url) : history.replaceState(null, "", url);
  read();
}

function setBorn(year: number | null) {
  born.value = year;
  try {
    year === null ? localStorage.removeItem(BORN_KEY) : localStorage.setItem(BORN_KEY, String(year));
  } catch {
    // Private mode: keep it for this visit only.
  }
}

provide(routeKey, { params, go, born, setBorn });

// The archive and Draw pages still work at their links; they're just off the menu for now.
const nav: { id: Route; label: string }[] = [
  { id: "home", label: "The exhibition" },
  { id: "explore", label: "Archive" },
  { id: "draw", label: "Draw" },
];

function open(id: Route) {
  go({ tab: id === "home" ? null : id, view: null }, true);
  scrollTo({ top: 0 });
}

const note = ref("");
const also = ref<string[]>([]);
const VIEW_PARAMS = ["trend", "trends", "year", "decade", "place", "family", "corpus", "forecast", "story", "set"];

/** A search either opens the view Jev picked, or has a chart drawn in place of whatever is showing. */
function searched(result: IntentResult) {
  const { show, comingSoon } = pickComponents(result);
  const cleared = Object.fromEntries(VIEW_PARAMS.map((key) => [key, null]));
  also.value = show.slice(1, 4).map((c) => c.id);
  scrollTo({ top: 0 });
  if (!show.length) {
    const wanted = components.find((c) => c.id === comingSoon[0]?.id)?.label;
    note.value = wanted ? `That wants ${wanted}, which we haven't built yet, so here's a chart drawn for you.` : "Nothing on the rails for that, so here's a chart drawn for you.";
    go({ ...cleared, tab: "draw", view: null, q: result.q });
    return;
  }
  note.value = "";
  const year = result.year ?? (result.decade === null ? null : result.decade + 5);
  go({
    ...cleared,
    tab: "explore",
    view: show[0].id,
    q: null,
    trend: result.trend?.id ?? null,
    trends: result.trend?.id ?? null,
    year: year === null ? null : String(year),
    decade: result.decade === null ? null : String(result.decade),
  });
}

function cleared() {
  note.value = "";
  also.value = [];
}

onMounted(async () => {
  read();
  born.value = readBorn();
  addEventListener("popstate", read);
  try {
    nerds.value = await loadNerds();
  } catch (error) {
    failed.value = String(error);
  }
});
onUnmounted(() => removeEventListener("popstate", read));
</script>

<template>
  <header v-if="tab !== 'home'" class="sticky top-0 z-30 border-b border-nof-line/70 bg-nof-night/85 backdrop-blur">
    <div class="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
      <button type="button" class="flex items-baseline gap-2 text-left" @click="open('home')">
        <span class="font-nof-display text-2xl leading-none font-black italic tracking-tight sm:text-3xl">Nerds <span class="text-nof-pink">of</span> Fashion</span>
      </button>
      <nav aria-label="Nerds of Fashion" class="flex gap-1 text-sm font-semibold">
        <button
          v-for="item in nav"
          :key="item.id"
          type="button"
          class="rounded-full px-3 py-1.5 transition"
          :class="tab === item.id ? 'bg-nof-text text-nof-night' : 'text-nof-sub hover:bg-nof-raised'"
          :aria-current="tab === item.id ? 'page' : undefined"
          @click="open(item.id)"
        >
          {{ item.label }}
        </button>
      </nav>
    </div>
  </header>

  <section class="border-b border-nof-line/70 px-4 py-4" aria-label="Ask a question">
    <div class="mx-auto max-w-3xl">
      <IntentBar label="Ask a hundred years of wardrobes anything" @resolved="searched" @cleared="cleared" />
      <p v-if="note" role="status" class="mt-2 text-sm text-nof-gold">{{ note }}</p>
      <p v-if="also.length" class="mt-2 flex flex-wrap items-center gap-2 text-sm text-nof-muted">
        Also fits:
        <button v-for="id in also" :key="id" type="button" class="rounded-full border border-nof-line px-3 py-1 text-nof-sub hover:border-nof-muted hover:text-nof-text" @click="go({ tab: 'explore', view: id })">{{ viewById(id)?.title ?? id }}</button>
      </p>
    </div>
  </section>

  <main class="min-h-[70dvh]">
    <p v-if="failed" class="mx-auto max-w-xl px-4 py-24 text-center text-nof-sub">The wardrobe's stuck shut. Try a refresh. <span class="block pt-2 font-mono text-xs text-nof-muted">{{ failed }}</span></p>
    <p v-else-if="!nerds" class="py-32 text-center font-nof-display text-2xl italic text-nof-muted">Unpacking a hundred years of wardrobes…</p>
    <template v-else>
      <Exhibition v-if="tab === 'home'" :nerds="nerds" />
      <Explore v-else-if="tab === 'explore'" :nerds="nerds" />
      <Draw v-else :nerds="nerds" />
    </template>
  </main>

  <footer class="mx-auto mt-20 grid max-w-[1280px] gap-2 px-4 pt-16 pb-12 text-sm text-nof-muted">
    <p class="font-nof-display text-[clamp(28px,4vw,44px)] leading-[1.1] text-nof-text italic">Nerds of Fashion</p>
    <p>
      Built live on <a class="underline hover:text-nof-text" href="/">40 for 40</a>, day 9. Data from <b class="font-medium text-nof-sub">Wikipedia</b> (CC BY-SA 4.0), <b class="font-medium text-nof-sub">Google Books Ngram</b> (CC BY 3.0), the <b class="font-medium text-nof-sub">V&amp;A</b>, <b class="font-medium text-nof-sub">the Met</b> (CC0), Vogue Runway tag counts and Pantone.
      <button type="button" class="underline hover:text-nof-text" @click="go({ tab: 'explore', view: 'methods' })">How we got the numbers</button>
    </p>
    <p>Mostly high fashion as written about and kept in museums, not what everyone wore. Year colours before 2000 are the colour each decade's museum pieces lean towards, then Pantone's pick.</p>
    <p><a href="#top" class="underline hover:text-nof-text">Back to the curtain ↑</a></p>
  </footer>
</template>
