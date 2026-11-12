<script setup lang="ts">
import { computed, onMounted, onUnmounted, provide, ref, shallowRef } from "vue";
import { loadNerds, type Nerds } from "./data";
import Home from "./Home.vue";
import Explore from "./Explore.vue";
import Draw from "./Draw.vue";
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

const nav: { id: Route; label: string }[] = [
  { id: "home", label: "You" },
  { id: "explore", label: "Explore" },
  { id: "draw", label: "Draw your own" },
];

function open(id: Route) {
  go({ tab: id === "home" ? null : id, view: null }, true);
  scrollTo({ top: 0 });
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
  <header class="sticky top-0 z-30 border-b border-nof-line/70 bg-nof-night/85 backdrop-blur">
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
          <span v-if="item.id === 'draw'" class="hidden sm:inline">{{ item.label }}</span>
          <span v-if="item.id === 'draw'" class="sm:hidden">Draw</span>
          <span v-else>{{ item.label }}</span>
        </button>
      </nav>
    </div>
  </header>

  <main class="min-h-[70dvh]">
    <p v-if="failed" class="mx-auto max-w-xl px-4 py-24 text-center text-nof-sub">The wardrobe's stuck shut. Try a refresh. <span class="block pt-2 font-mono text-xs text-nof-muted">{{ failed }}</span></p>
    <p v-else-if="!nerds" class="py-32 text-center font-nof-display text-2xl italic text-nof-muted">Unpacking a hundred years of wardrobes…</p>
    <template v-else>
      <Home v-if="tab === 'home'" :nerds="nerds" />
      <Explore v-else-if="tab === 'explore'" :nerds="nerds" />
      <Draw v-else :nerds="nerds" />
    </template>
  </main>

  <footer class="mt-20 border-t border-nof-line px-4 py-10 text-sm text-nof-muted">
    <div class="mx-auto max-w-6xl space-y-2">
      <p>
        Built live on <a class="underline hover:text-nof-text" href="/">40 for 40</a>, day 9. Data from Wikipedia (CC BY-SA 4.0), Google Books Ngram (CC BY 3.0), the V&amp;A, the Met (CC0), Vogue Runway tag counts and Pantone.
        <button type="button" class="underline hover:text-nof-text" @click="go({ tab: 'explore', view: 'methods' })">How we got the numbers</button>
      </p>
      <p>Mostly high fashion as written about and kept in museums, not what everyone wore. Your birth year never leaves your browser.</p>
    </div>
  </footer>
</template>
