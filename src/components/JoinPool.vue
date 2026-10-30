<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import ProblemsPool, { type PoolTile } from "./ProblemsPool.vue";
import { buildBoard, history, raised, type Idea } from "../data/days";
import { poolConfig } from "../pool/config";
import { loadIdeas } from "../pool/data";
import { createSearch, type Match } from "../pool/search";

const props = defineProps<{ field: string }>();

const ideas = ref<Idea[]>([]);
const matches = ref<Match[] | null>(null);
const pool = ref<InstanceType<typeof ProblemsPool>>();

const tiles = computed<PoolTile[]>(() =>
  buildBoard(ideas.value, history, Date.now()).pool.map(({ key, idea }) => ({
    key,
    id: idea!.id,
    title: idea!.title,
    problem: idea!.problem,
    seed: idea!.seed,
    label: `Unfunded: ${idea!.title}`,
    raised: raised(idea!),
  })),
);

// Only the classifier's scores say how alike two problems are. The lexical fallback's are just relative.
const search = createSearch({ ideas: () => tiles.value });
let debounce: ReturnType<typeof setTimeout> | undefined;
let input: HTMLInputElement | HTMLTextAreaElement | null = null;

function typed() {
  pool.value?.nudge();
  clearTimeout(debounce);
  const text = input?.value.trim() ?? "";
  if (text.length < poolConfig.search.minLength) {
    search.cancel();
    matches.value = null;
    return;
  }
  debounce = setTimeout(async () => {
    const found = await search.run(text);
    if (found) matches.value = found.ranking === "classifier" ? found.matches : [];
  }, poolConfig.search.debounceMs);
}

const loader = new AbortController();
onMounted(() => {
  input = document.getElementById(props.field) as typeof input;
  input?.addEventListener("input", typed);
  loadIdeas({
    signal: loader.signal,
    onPage(page) {
      const known = new Set(ideas.value.map((i) => i.id));
      ideas.value.push(...page.filter((i) => !known.has(i.id)));
    },
  }).catch(() => {});
});

onBeforeUnmount(() => {
  clearTimeout(debounce);
  search.cancel();
  loader.abort();
  input?.removeEventListener("input", typed);
});
</script>

<template>
  <ProblemsPool ref="pool" :tiles="tiles" :matches="matches" />
</template>
