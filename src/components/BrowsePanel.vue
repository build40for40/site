<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { OTHER, categories } from "../data/categories";
import { raised, type EntryStatus, type Idea } from "../data/days";
import { poolConfig } from "../pool/config";
import { createSearch, retrieveCandidates, tokenize, type Match, type Ranking } from "../pool/search";

export interface Floated {
  matches: Match[];
  ranking?: Ranking;
}

// Statuses are by idea id: "pool" for the ones without a day.
const props = defineProps<{ ideas: Idea[]; statuses: Record<string, EntryStatus> }>();
const emit = defineEmits<{ float: [floated: Floated | null]; close: [] }>();

const stageList: { key: string; label: string; keep: (idea: Idea, status: EntryStatus | undefined) => boolean }[] = [
  { key: "unfunded", label: "Unfunded", keep: (idea) => !raised(idea) },
  { key: "sponsored", label: "Sponsored", keep: (idea) => raised(idea) > 0 },
  { key: "scheduled", label: "Scheduled", keep: (_, status) => status === "queued" || status === "live" },
  { key: "shipped", label: "Shipped", keep: (_, status) => status === "shipped" },
];
const inStage = (key: string | null) => (idea: Idea) => !key || stageList.find((s) => s.key === key)!.keep(idea, props.statuses[idea.id]);

const topicList = [...categories, OTHER];
const inTopic = (key: string | null) => (idea: Idea) => !key || !!idea.categories?.includes(key);

const stage = ref<string | null>(null);
const topic = ref<string | null>(null);
const query = ref("");
const found = ref<{ ranking: Ranking; matches: Match[] } | null>(null);
const input = ref<HTMLInputElement>();

// Each count is within whatever the other filter has picked.
const stages = computed(() => {
  const ideas = props.ideas.filter(inTopic(topic.value));
  return stageList.map((s) => ({ ...s, count: ideas.filter(inStage(s.key)).length })).filter((s) => s.key === stage.value || s.count);
});
const topics = computed(() => {
  const ideas = props.ideas.filter(inStage(stage.value));
  return topicList.map((t) => ({ ...t, count: ideas.filter(inTopic(t.key)).length })).filter((t) => t.key === topic.value || t.count);
});
// Until anything's been sorted into a category, there's nothing to pick from.
const sorted = computed(() => props.ideas.some((i) => i.categories));

// Results only show by floating up out of the pool: a filter on its own floats all of its problems the same height, and
// a search floats its matches by how well they fit.
const floated = computed<Floated | null>(() => {
  if (!found.value && !topic.value && !stage.value) return null;
  const allowed = new Set(props.ideas.filter(inTopic(topic.value)).filter(inStage(stage.value)).map((i) => i.id));
  if (!found.value) return { matches: [...allowed].map((id) => ({ id, score: 1 })) };
  return { ranking: found.value.ranking, matches: found.value.matches.filter((m) => allowed.has(m.id) && m.score >= poolConfig.search.minRelevance) };
});
watch(floated, (f) => emit("float", f));

const count = computed(() => floated.value?.matches.length ?? 0);

const search = createSearch({ ideas: () => props.ideas });
let debounce: ReturnType<typeof setTimeout> | undefined;

// Words that appear in a problem float it straight away, then the classifier reranks them by what was meant.
function typed() {
  clearTimeout(debounce);
  const text = query.value.trim();
  if (text.length < poolConfig.search.browseMinLength || !tokenize(text).length) {
    search.cancel();
    found.value = null;
    return;
  }
  found.value = { ranking: "lexical", matches: retrieveCandidates(text, { ideas: props.ideas, limit: Infinity }) };
  debounce = setTimeout(async () => {
    const result = await search.run(text);
    if (result) found.value = { ranking: result.ranking, matches: result.matches };
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

onMounted(() => input.value?.focus({ preventScroll: true }));

onBeforeUnmount(() => {
  clearTimeout(debounce);
  search.cancel();
  emit("float", null);
});
</script>

<template>
  <section id="browse" aria-labelledby="browse-title" class="flex flex-col gap-3 rounded-lg bg-night-panel p-3 text-night-text ring-1 ring-night-line ring-inset sm:p-4" @keydown="keyed">
    <h2 id="browse-title" class="sr-only">Browse the pool</h2>
    <div class="flex items-center gap-2 max-sm:items-start sm:flex-wrap">
      <label for="browse-search" class="sr-only">Search the pool</label>
      <!-- On phones the keyboard would cover the pool, so browsing there is by filter only. -->
      <div class="relative min-w-0 flex-1 max-sm:hidden">
        <input
          id="browse-search"
          ref="input"
          v-model="query"
          type="search"
          autocomplete="off"
          enterkeyhint="search"
          placeholder="Search the pool"
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
      <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:order-last sm:basis-full sm:pt-1">
        <div role="group" aria-label="Show" class="contents">
          <button
            v-for="s in stages"
            :key="s.key"
            type="button"
            :aria-pressed="stage === s.key"
            class="shrink-0 cursor-pointer rounded-full border px-3 py-1 font-mono text-xs focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-lime"
            :class="stage === s.key ? 'border-brand-lime bg-brand-lime text-brand-lime-ink' : 'border-night-edge bg-transparent text-night-sub hover:border-night-text hover:text-night-text'"
            @click="stage = stage === s.key ? null : s.key"
          >
            {{ s.label }} <span :class="stage === s.key ? 'opacity-70' : 'text-night-muted'">{{ s.count }}</span>
          </button>
        </div>
        <div v-if="sorted" class="relative shrink-0">
          <label for="browse-category" class="sr-only">Category</label>
          <select
            id="browse-category"
            v-model="topic"
            class="cursor-pointer appearance-none rounded-full border bg-night py-1 pr-7 pl-3 font-mono text-xs focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-lime"
            :class="topic ? 'border-brand-lime text-night-text' : 'border-night-edge text-night-sub hover:border-night-text hover:text-night-text'"
          >
            <option :value="null">All categories</option>
            <option v-for="t in topics" :key="t.key" :value="t.key">{{ t.label }} ({{ t.count }})</option>
          </select>
          <span aria-hidden="true" class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[10px] text-night-muted">▾</span>
        </div>
      </div>
      <button
        type="button"
        aria-label="Close"
        class="ml-auto grid size-10 shrink-0 cursor-pointer place-items-center rounded-full border border-night-edge bg-transparent text-night-text hover:border-night-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-lime"
        @click="emit('close')"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" class="size-5 fill-none stroke-current stroke-2 [stroke-linecap:round]">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </div>

    <p role="status" aria-live="polite" class="m-0 font-mono text-xs text-night-sub empty:hidden" :class="count && 'sr-only'">
      <template v-if="count">{{ count }} {{ count === 1 ? "problem floats" : "problems float" }} up</template>
      <template v-else-if="floated">
        Nothing in the pool like that yet. <a href="#join" class="text-night-text underline underline-offset-3 hover:text-brand-lime">Send it in</a>
      </template>
    </p>
  </section>
</template>
