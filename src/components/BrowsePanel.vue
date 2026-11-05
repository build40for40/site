<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { OTHER, categories, categoryLabel } from "../data/categories";
import { mergedSponsors, pad, raised, type EntryStatus, type Idea } from "../data/days";
import { UK_TZ, money } from "../data/site";
import { createVisualIdentity } from "../pool/artwork";
import { poolConfig } from "../pool/config";
import { boxGrowth } from "../pool/effects";
import { createSearch, retrieveCandidates, tokenize, type Match, type Ranking } from "../pool/search";
import ShareButton from "./ShareButton.vue";

export interface Result {
  idea: Idea;
  score?: number;
}

// Statuses are by idea id: "pool" for the ones without a day. Days are the day number of each idea that has one.
// Docking says whether the balls can fly up to the list. Without it, each row draws its own.
const props = defineProps<{ ideas: Idea[]; statuses: Record<string, EntryStatus>; days?: Record<string, number>; open?: string | null; docking?: boolean }>();
const emit = defineEmits<{ dock: [ids: string[] | null]; "update:open": [id: string | null]; pick: [id: string]; close: [] }>();

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
const panel = ref<HTMLElement>();
const heading = ref<HTMLElement>();

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

// Newest first, or best match first while searching. Problems with no date sink to the end.
const sent = (idea: Idea) => Date.parse(idea.submittedAt ?? "") || 0;
const results = computed<Result[]>(() => {
  const allowed = props.ideas.filter(inTopic(topic.value)).filter(inStage(stage.value));
  if (!found.value) return allowed.toSorted((a, b) => sent(b) - sent(a)).map((idea) => ({ idea }));
  const byId = new Map(allowed.map((i) => [i.id, i]));
  return found.value.matches.flatMap((m) => {
    const idea = byId.get(m.id);
    return idea && m.score >= poolConfig.search.minRelevance ? [{ idea, score: m.score }] : [];
  });
});
const filtering = computed(() => !!(found.value || stage.value || topic.value));
const count = computed(() => results.value.length);

const { pageSize } = poolConfig.browse;
const page = ref(0);
const pages = computed(() => Math.max(1, Math.ceil(count.value / pageSize)));
const shown = computed(() => results.value.slice(page.value * pageSize, (page.value + 1) * pageSize));
watch([query, stage, topic], () => (page.value = 0));
watch(pages, (n) => (page.value = Math.min(page.value, n - 1)));

const list = ref<HTMLElement>();
function turn(by: number) {
  page.value = Math.min(Math.max(0, page.value + by), pages.value - 1);
  const top = list.value?.getBoundingClientRect().top ?? 0;
  if (top < 0) list.value?.scrollIntoView({ block: "start" });
}

const search = createSearch({ ideas: () => props.ideas });
let debounce: ReturnType<typeof setTimeout> | undefined;

// Words that appear in a problem list it straight away, then the classifier reranks them by what was meant.
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

// The problem open in full, in place of the list.
const opened = computed(() => (props.open ? props.ideas.find((i) => i.id === props.open) : undefined));
let back: string | null = null;

function show(id: string) {
  emit("update:open", id);
}

function close() {
  back = opened.value?.id ?? null;
  emit("update:open", null);
}

watch(opened, async (idea) => {
  await nextTick();
  if (idea) {
    if ((panel.value?.getBoundingClientRect().top ?? 0) < 0) panel.value?.scrollIntoView({ block: "start" });
    heading.value?.focus({ preventScroll: true });
  } else if (back) {
    document.querySelector<HTMLElement>(`#browse [data-row="${back}"]`)?.focus({ preventScroll: true });
    back = null;
  }
});

function keyed(event: KeyboardEvent) {
  if (event.key !== "Escape") return;
  event.preventDefault();
  if (opened.value) close();
  else if (query.value) clear();
  else emit("close");
}

// The balls fly up to whatever's showing: the open problem, or this page of the list.
const docks = computed(() => (opened.value ? [opened.value.id] : shown.value.map((r) => r.idea.id)));
const dock = () => emit("dock", docks.value);
watch(docks, dock, { flush: "post" });

// What each problem looks like as a ball, so its slot is the same size. Days are boxes.
const isDay = (idea: Idea) => props.statuses[idea.id] !== "pool";
const grow = (idea: Idea) => (isDay(idea) ? 0 : boxGrowth(raised(idea)));
const slot = (idea: Idea) =>
  isDay(idea) ? "size-7 rounded sm:size-8" : "aspect-square w-[calc(1.25rem+var(--grow))] rounded-full sm:w-[calc(1.5rem+var(--grow))]";
// The column fits the biggest ball on the page, so the titles all line up.
const column = computed(() => Math.max(0, ...shown.value.map((r) => grow(r.idea))));
const art = (idea: Idea) => createVisualIdentity(idea).svg;

const ukDay = (ms: number, year = false) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: UK_TZ, day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}) }).format(ms);

function stageOf(idea: Idea) {
  const day = props.days?.[idea.id];
  const sum = raised(idea);
  const label: string | undefined = ({ shipped: "Shipped", live: "Live now", queued: "Scheduled" } as Record<string, string>)[props.statuses[idea.id]];
  const parts = day ? [`Day ${pad(day)}`, label] : [sum ? "Sponsored" : "Needs a sponsor"];
  if (sum) parts.push(`${money(sum)} raised`);
  return parts.filter(Boolean).join(" · ");
}

function sentBy(idea: Idea, year = false) {
  const when = sent(idea);
  if (!when && !idea.owner) return "";
  return ["Sent in", idea.owner && `by ${idea.owner}`, when && `on ${ukDay(when, year)}`].filter(Boolean).join(" ");
}

// Untitled problems use their opening words as the title. A row doesn't repeat them, but the full problem does when
// there's more to it.
const plain = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
const blurb = (idea: Idea) => !plain(idea.problem).startsWith(plain(idea.title));
const more = (idea: Idea) => plain(idea.problem) !== plain(idea.title);

const sponsors = computed(() => (opened.value ? mergedSponsors(opened.value.sponsors) : []));
const backable = computed(() => opened.value && ["pool", "queued"].includes(props.statuses[opened.value.id]));
const share = computed(() => {
  const idea = opened.value;
  if (!idea) return null;
  return { text: `Help get “${idea.title}” built live on 40 for 40.`, url: `${import.meta.env.SITE ?? ""}/?idea=${encodeURIComponent(idea.id)}` };
});

onMounted(() => {
  input.value?.focus({ preventScroll: true });
  dock();
});

onBeforeUnmount(() => {
  clearTimeout(debounce);
  search.cancel();
  emit("dock", null);
});

const chip = "shrink-0 cursor-pointer rounded-full border px-3 py-1 font-mono text-xs focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-lime";
const round =
  "grid size-10 shrink-0 cursor-pointer place-items-center rounded-full border border-night-edge bg-transparent text-night-text hover:border-night-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-lime";
</script>

<template>
  <section id="browse" ref="panel" aria-labelledby="browse-title" class="flex scroll-mt-4 flex-col gap-3 rounded-lg bg-night-panel p-3 text-night-text ring-1 ring-night-line ring-inset sm:p-4" @keydown="keyed">
    <h2 id="browse-title" class="sr-only">Browse the pool</h2>

    <template v-if="opened">
      <div class="flex items-center gap-2">
        <button type="button" :class="[chip, 'border-night-edge bg-transparent py-2 text-night-text hover:border-night-text']" @click="close">← Back to the list</button>
        <button type="button" aria-label="Close" :class="[round, 'ml-auto']" @click="emit('close')">
          <svg aria-hidden="true" viewBox="0 0 24 24" class="size-5 fill-none stroke-current stroke-2 [stroke-linecap:round]"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>

      <article class="flex gap-4 max-sm:flex-col sm:gap-6" :style="{ '--grow': `${grow(opened)}px` }">
        <span class="grid shrink-0 place-items-center self-start sm:pt-1">
          <span :data-pool-dock="opened.id" class="relative overflow-hidden border border-dashed border-night-edge" :class="slot(opened)">
            <span v-if="!docking && !isDay(opened)" aria-hidden="true" class="absolute inset-0 [&>svg]:size-full" v-html="art(opened)"></span>
          </span>
        </span>
        <div class="flex max-w-2xl min-w-0 flex-1 flex-col gap-3">
          <p class="m-0 font-mono text-xs text-night-sub">{{ stageOf(opened) }}</p>
          <h3 ref="heading" tabindex="-1" class="m-0 text-xl leading-tight font-semibold wrap-break-word focus:outline-none sm:text-2xl">{{ opened.title }}</h3>
          <p v-if="more(opened)" class="m-0 leading-relaxed whitespace-pre-line text-night-sub wrap-break-word">{{ opened.problem }}</p>
          <p v-if="sentBy(opened)" class="m-0 font-mono text-xs text-night-muted">{{ sentBy(opened, true) }}</p>
          <ul v-if="opened.categories?.length" aria-label="Categories" class="m-0 flex list-none flex-wrap gap-1.5 p-0">
            <li v-for="c in opened.categories" :key="c" class="rounded-full border border-night-edge px-2.5 py-0.5 font-mono text-[11px] text-night-sub">{{ categoryLabel(c) }}</li>
          </ul>
          <div class="flex flex-col gap-1.5">
            <p class="m-0 text-sm font-semibold">
              <template v-if="sponsors.length">{{ money(raised(opened)) }} from {{ sponsors.length }} {{ sponsors.length === 1 ? "sponsor" : "sponsors" }}</template>
              <template v-else>No sponsors yet. Could be you.</template>
            </p>
            <ul v-if="sponsors.length" class="m-0 flex list-none flex-col gap-1 p-0 text-sm text-night-sub">
              <li v-for="(s, i) in sponsors" :key="i" class="flex justify-between gap-3 border-b border-night-line pb-1 last:border-b-0">
                <span class="min-w-0 truncate">{{ s.name }}<template v-if="s.group"> · {{ s.group }}</template></span>
                <span class="font-mono">{{ money(s.amount) }}</span>
              </li>
            </ul>
          </div>
          <div class="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              class="cursor-pointer rounded-full border-0 bg-brand-lime px-4 py-2 text-sm font-semibold text-brand-lime-ink hover:bg-brand-lime-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-lime"
              @click="emit('pick', opened.id)"
            >{{ backable ? "Sponsor it" : "Open it on the board" }}</button>
            <ShareButton v-if="share" label="Share" v-bind="share" />
          </div>
        </div>
      </article>
    </template>

    <template v-else>
      <div class="flex items-center gap-2 max-sm:items-start sm:flex-wrap">
        <label for="browse-search" class="sr-only">Search the pool</label>
        <!-- On phones the keyboard would cover the list, so browsing there is by filter only. -->
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
              :class="[chip, stage === s.key ? 'border-brand-lime bg-brand-lime text-brand-lime-ink' : 'border-night-edge bg-transparent text-night-sub hover:border-night-text hover:text-night-text']"
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
        <button type="button" aria-label="Close" :class="[round, 'ml-auto']" @click="emit('close')">
          <svg aria-hidden="true" viewBox="0 0 24 24" class="size-5 fill-none stroke-current stroke-2 [stroke-linecap:round]"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>

      <p role="status" aria-live="polite" class="m-0 font-mono text-xs text-night-sub empty:hidden">
        <template v-if="count">
          {{ count }} {{ count === 1 ? "problem" : "problems" }}{{ found ? ", best match first" : ", newest first" }}
        </template>
        <template v-else-if="filtering">
          Nothing in the pool like that yet. <a href="#join" class="text-night-text underline underline-offset-3 hover:text-brand-lime">Send it in</a>
        </template>
      </p>

      <ol v-if="shown.length" ref="list" aria-label="Problems" class="m-0 flex scroll-mt-4 list-none flex-col p-0" :style="{ '--col': `${column}px` }">
        <li v-for="r in shown" :key="r.idea.id" class="border-t border-night-line first:border-t-0" :style="{ '--grow': `${grow(r.idea)}px` }">
          <button
            type="button"
            :data-row="r.idea.id"
            class="flex w-full cursor-pointer items-center gap-3 rounded-md border-0 bg-transparent px-1 py-2.5 text-left text-night-text hover:bg-night-tile focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-lime sm:gap-4 sm:px-2"
            @click="show(r.idea.id)"
          >
            <span aria-hidden="true" class="grid w-[max(1.75rem,calc(1.25rem+var(--col)))] shrink-0 place-items-center sm:w-[max(2rem,calc(1.5rem+var(--col)))]">
              <span :data-pool-dock="r.idea.id" class="relative overflow-hidden border border-dashed border-night-edge" :class="slot(r.idea)">
                <span v-if="!docking && !isDay(r.idea)" class="absolute inset-0 [&>svg]:size-full" v-html="art(r.idea)"></span>
                <span v-else-if="!docking" class="grid size-full place-items-center bg-night-tile font-mono text-[11px] font-semibold">{{ pad(days?.[r.idea.id] ?? 0) }}</span>
              </span>
            </span>
            <span class="flex min-w-0 flex-1 flex-col gap-0.5">
              <span class="leading-snug font-semibold wrap-break-word">{{ r.idea.title }}</span>
              <span v-if="blurb(r.idea)" class="line-clamp-2 text-sm leading-snug text-night-sub wrap-break-word">{{ r.idea.problem }}</span>
              <span class="font-mono text-[11px] text-night-muted">{{ [stageOf(r.idea), sentBy(r.idea)].filter(Boolean).join(" · ") }}</span>
            </span>
            <span v-if="r.score !== undefined && found?.ranking === 'classifier'" class="shrink-0 rounded-full bg-night-text px-1.5 font-mono text-[11px] leading-5 font-medium text-night">
              {{ Math.round(r.score * 100) }}%
            </span>
          </button>
        </li>
      </ol>

      <nav v-if="pages > 1" aria-label="Pages" class="flex items-center justify-between gap-2 font-mono text-xs text-night-sub">
        <button type="button" :disabled="page === 0" :class="[chip, 'border-night-edge bg-transparent text-night-text enabled:hover:border-night-text disabled:cursor-default disabled:opacity-40']" @click="turn(-1)">← Previous</button>
        <span>Page {{ page + 1 }} of {{ pages }}</span>
        <button type="button" :disabled="page === pages - 1" :class="[chip, 'border-night-edge bg-transparent text-night-text enabled:hover:border-night-text disabled:cursor-default disabled:opacity-40']" @click="turn(1)">Next →</button>
      </nav>
    </template>
  </section>
</template>
