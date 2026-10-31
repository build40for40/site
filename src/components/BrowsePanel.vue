<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { OTHER, categories } from "../data/categories";
import type { Idea } from "../data/days";
import { poolConfig } from "../pool/config";
import { createSearch, retrieveCandidates, tokenize, type Match, type Ranking } from "../pool/search";

export interface Floated {
  matches: Match[];
  ranking?: Ranking;
}

const props = defineProps<{ ideas: Idea[] }>();
const emit = defineEmits<{ float: [floated: Floated | null]; close: [] }>();

const topicList = [...categories, OTHER];
const inTopic = (key: string | null) => (idea: Idea) => !key || !!idea.categories?.includes(key);

const topic = ref<string | null>(null);
const query = ref("");
const found = ref<{ ranking: Ranking; matches: Match[] } | null>(null);
const input = ref<HTMLInputElement>();

const topics = computed(() => topicList.map((t) => ({ ...t, count: props.ideas.filter(inTopic(t.key)).length })).filter((t) => t.key === topic.value || t.count));
// Until anything's been sorted into a category, there's nothing to pick from.
const sorted = computed(() => props.ideas.some((i) => i.categories));

// Results only show by floating up out of the pool: a topic on its own floats all of its problems the same height, and
// a search floats its matches by how well they fit.
const floated = computed<Floated | null>(() => {
  if (!found.value && !topic.value) return null;
  const allowed = new Set(props.ideas.filter(inTopic(topic.value)).map((i) => i.id));
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
      <!-- On phones the keyboard would cover the pool, so browsing there is by topic only. -->
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
      <div v-if="sorted" role="group" aria-label="Topic" class="flex min-w-0 flex-1 flex-wrap gap-2 sm:order-last sm:basis-full sm:pt-1">
        <button
          v-for="t in topics"
          :key="t.key"
          type="button"
          :aria-pressed="topic === t.key"
          class="shrink-0 cursor-pointer rounded-full border px-3 py-1 font-mono text-xs focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-lime"
          :class="topic === t.key ? 'border-brand-lime bg-brand-lime text-brand-lime-ink' : 'border-night-edge bg-transparent text-night-sub hover:border-night-text hover:text-night-text'"
          @click="topic = topic === t.key ? null : t.key"
        >
          {{ t.label }} <span :class="topic === t.key ? 'opacity-70' : 'text-night-muted'">{{ t.count }}</span>
        </button>
      </div>
      <button
        type="button"
        class="ml-auto shrink-0 cursor-pointer rounded-full border border-night-edge bg-transparent px-3 py-2 font-mono text-xs text-night-sub hover:border-night-text hover:text-night-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-lime"
        @click="emit('close')"
      >Close</button>
    </div>

    <p role="status" aria-live="polite" class="m-0 font-mono text-xs text-night-sub empty:hidden">
      <template v-if="count">{{ count }} {{ count === 1 ? "problem floats" : "problems float" }} up ↓</template>
      <template v-else-if="floated">
        Nothing in the pool like that yet. <a href="#join" class="text-night-text underline underline-offset-3 hover:text-brand-lime">Send it in</a>
      </template>
    </p>
  </section>
</template>
