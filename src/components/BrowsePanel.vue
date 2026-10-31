<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { OTHER, categories } from "../data/categories";
import { pad, raised, tones, type Entry } from "../data/days";
import { money } from "../data/site";
import { poolConfig } from "../pool/config";
import { createSearch, retrieveCandidates, tokenize, type Match, type Ranking } from "../pool/search";

const props = defineProps<{ entries: Entry[]; selected: string }>();
const emit = defineEmits<{ select: [key: string]; close: [] }>();

const filters: { key: string; label: string; keep: (e: Entry) => boolean }[] = [
  { key: "all", label: "Everything", keep: () => true },
  { key: "next", label: "Coming up", keep: (e) => e.status === "queued" || e.status === "live" },
  { key: "pool", label: "Simmering", keep: (e) => e.status === "pool" },
  { key: "unbacked", label: "Needs a sponsor", keep: (e) => !raised(e.idea!) },
  { key: "shipped", label: "Shipped", keep: (e) => e.status === "shipped" },
];

const topicList = [...categories, OTHER];
const inTopic = (key: string | null) => (e: Entry) => !key || !!e.idea!.categories?.includes(key);

const filter = ref("all");
const topic = ref<string | null>(null);
const query = ref("");
const found = ref<{ ranking: Ranking; matches: Match[] } | null>(null);
const input = ref<HTMLInputElement>();

const keep = computed(() => filters.find((f) => f.key === filter.value)!.keep);

// Each row's counts take the other row's pick into account.
const chips = computed(() => {
  const inPick = props.entries.filter(inTopic(topic.value));
  return filters.map((f) => ({ ...f, count: inPick.filter(f.keep).length })).filter((f) => f.key === "all" || f.key === filter.value || f.count);
});
const topics = computed(() => {
  const inPick = props.entries.filter(keep.value);
  return topicList.map((t) => ({ ...t, count: inPick.filter(inTopic(t.key)).length })).filter((t) => t.key === topic.value || t.count);
});
// Until anything's been sorted into a category, there's nothing to pick from.
const sorted = computed(() => props.entries.some((e) => e.idea!.categories));

const kept = computed(() => props.entries.filter(keep.value).filter(inTopic(topic.value)));

const results = computed(() => {
  if (!found.value) return kept.value.map((entry) => ({ entry, percent: undefined }));
  const byId = new Map(kept.value.map((e) => [e.idea!.id, e]));
  const classified = found.value.ranking === "classifier";
  return found.value.matches.flatMap((m) => {
    const entry = byId.get(m.id);
    return entry ? [{ entry, percent: classified ? Math.round(m.score * 100) : undefined }] : [];
  });
});

const announcement = computed(() => {
  const count = results.value.length;
  return count ? `${count} ${count === 1 ? "problem" : "problems"}` : "Nothing like that yet";
});

const ideas = () => props.entries.map((e) => e.idea!);
const search = createSearch({ ideas });
let debounce: ReturnType<typeof setTimeout> | undefined;

// Words that appear in a problem show straight away, then the classifier reranks them by what was meant.
function typed() {
  clearTimeout(debounce);
  const text = query.value.trim();
  if (text.length < poolConfig.search.browseMinLength || !tokenize(text).length) {
    search.cancel();
    found.value = null;
    return;
  }
  found.value = { ranking: "lexical", matches: retrieveCandidates(text, { ideas: ideas(), limit: Infinity }) };
  debounce = setTimeout(async () => {
    const result = await search.run(text);
    if (!result) return;
    const matches = result.ranking === "classifier" ? result.matches.filter((m) => m.score >= poolConfig.search.minRelevance) : result.matches;
    found.value = { ranking: result.ranking, matches };
  }, poolConfig.search.debounceMs);
}

function clear() {
  query.value = "";
  typed();
  input.value?.focus();
}

function keyed(event: KeyboardEvent) {
  if (event.key !== "Escape") return;
  event.preventDefault();
  if (query.value) clear();
  else emit("close");
}

const where = (e: Entry) => (e.day ? `Day ${pad(e.day)}` : "Pool");

onMounted(() => input.value?.focus({ preventScroll: true }));

onBeforeUnmount(() => {
  clearTimeout(debounce);
  search.cancel();
});
</script>

<template>
  <section id="browse" aria-labelledby="browse-title" class="flex flex-col gap-3 rounded-lg bg-night-panel p-3 text-night-text ring-1 ring-night-line ring-inset sm:p-4" @keydown="keyed">
    <h2 id="browse-title" class="sr-only">Browse the problems</h2>
    <div class="flex items-center gap-2">
      <label for="browse-search" class="sr-only">Search the problems</label>
      <div class="relative min-w-0 flex-1">
        <input
          id="browse-search"
          ref="input"
          v-model="query"
          type="search"
          autocomplete="off"
          enterkeyhint="search"
          placeholder="Search problems, like “rent” or “my plants keep dying”"
          class="w-full appearance-none rounded-full border border-night-edge bg-night py-2 pr-9 pl-4 text-sm text-night-text placeholder:text-night-muted focus-visible:border-night-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-lime [&::-webkit-search-cancel-button]:hidden"
          @input="typed"
        />
        <button
          v-if="query"
          type="button"
          aria-label="Clear the search"
          class="absolute top-1/2 right-1.5 grid size-7 -translate-y-1/2 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 text-night-muted hover:text-night-text focus-visible:outline-2 focus-visible:outline-brand-lime"
          @click="clear"
        >✕</button>
      </div>
      <button
        type="button"
        class="shrink-0 cursor-pointer rounded-full border border-night-edge bg-transparent px-3 py-2 font-mono text-xs text-night-sub hover:border-night-text hover:text-night-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-lime"
        @click="emit('close')"
      >Close</button>
    </div>

    <div role="group" aria-label="Show" class="flex flex-wrap gap-2">
      <button
        v-for="chip in chips"
        :key="chip.key"
        type="button"
        :aria-pressed="filter === chip.key"
        class="cursor-pointer rounded-full border px-3 py-1 font-mono text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-lime"
        :class="filter === chip.key ? 'border-brand-lime bg-brand-lime text-brand-lime-ink' : 'border-night-edge bg-transparent text-night-sub hover:border-night-text hover:text-night-text'"
        @click="filter = chip.key"
      >
        {{ chip.label }} <span :class="filter === chip.key ? 'opacity-70' : 'text-night-muted'">{{ chip.count }}</span>
      </button>
    </div>

    <div v-if="sorted" role="group" aria-label="Topic" class="-mx-3 flex gap-2 overflow-x-auto px-3 sm:mx-0 sm:flex-wrap sm:px-0">
      <button
        v-for="t in topics"
        :key="t.key"
        type="button"
        :aria-pressed="topic === t.key"
        class="shrink-0 cursor-pointer rounded-full border px-3 py-1 font-mono text-xs focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-lime"
        :class="topic === t.key ? 'border-night-text bg-night-text text-night' : 'border-night-line bg-night text-night-sub hover:border-night-text hover:text-night-text'"
        @click="topic = topic === t.key ? null : t.key"
      >
        {{ t.label }} <span :class="topic === t.key ? 'opacity-70' : 'text-night-muted'">{{ t.count }}</span>
      </button>
    </div>

    <p class="sr-only" role="status" aria-live="polite">{{ announcement }}</p>

    <ul v-if="results.length" aria-label="Problems" class="m-0 flex max-h-[min(22rem,45dvh)] list-none flex-col gap-1 overflow-y-auto p-0">
      <li v-for="{ entry, percent } in results" :key="entry.key">
        <button
          type="button"
          :aria-pressed="entry.key === selected"
          class="flex w-full cursor-pointer items-center gap-3 rounded-md border-0 bg-transparent px-2 py-2 text-left text-night-text hover:bg-night-tile focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-lime aria-pressed:bg-night-tile"
          @click="emit('select', entry.key)"
        >
          <span aria-hidden="true" class="size-2 shrink-0 rounded-full" :class="tones[entry.status].dot"></span>
          <span class="w-14 shrink-0 font-mono text-[11px] text-night-sub">{{ where(entry) }}</span>
          <span class="min-w-0 flex-1 truncate text-sm font-semibold">{{ entry.idea!.title }}</span>
          <span v-if="percent !== undefined" class="shrink-0 rounded-full bg-night-text px-1.5 font-mono text-[10px] leading-4 font-medium text-night">{{ percent }}%</span>
          <span class="min-w-12 shrink-0 text-right font-mono text-[11px] text-night-sub">{{ money(raised(entry.idea!)) }}</span>
        </button>
      </li>
    </ul>
    <p v-else class="m-0 px-2 py-3 text-sm text-night-sub">
      Nothing like that yet. <a href="#join" class="text-night-text underline underline-offset-3 hover:text-brand-lime">Send it in</a> and it could be one of the 40.
    </p>
  </section>
</template>
