<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import BrowsePanel, { type Floated } from "./BrowsePanel.vue";
import DayBox from "./DayBox.vue";
import DayTile from "./DayTile.vue";
import ProblemsPool, { type PoolTile } from "./ProblemsPool.vue";
import {
  BUILD_MS,
  DEFAULT_AMOUNT,
  buildBoard,
  countdown,
  dayDate,
  dayStart,
  pad,
  raised,
  statusLabel,
  tones,
  type Entry,
  type Idea,
  type ShippedIdea,
  type Sponsor,
} from "../data/days";
import { TOTAL_DAYS, money } from "../data/site";
import { poolConfig } from "../pool/config";
import { loadIdeas } from "../pool/data";
import { DEV_FEWER, JOIN_CLOSE, SENT, boxOf, fold, lob, pop, settle, shift, type Box, type SentProblem } from "../pool/flight";
import { createSearch, type Match, type Ranking } from "../pool/search";
import { excerpt } from "../../worker/problems";

const props = defineProps<{ history: Record<number, ShippedIdea>; builtAt: number }>();

const now = ref(props.builtAt);
const ideas = ref<Idea[]>([]);
const loading = ref(true);
const history = ref<Record<number, ShippedIdea>>(
  Object.fromEntries(Object.entries(props.history).map(([day, idea]) => [day, { ...idea, sponsors: [...idea.sponsors] }])),
);
const guestSponsors = ref<Record<number, Sponsor[]>>({});
const picked = ref<string | null>(null);
const backed = ref<string | null>(null);
const amount = ref(DEFAULT_AMOUNT);
const devCounts = ref<{ grid?: number; pool?: number }>({});

// Dev only: ?grid=12 keeps the 12 best-funded ideas and ?pool=5 keeps 5 at $0, topped up from the funded ones it dropped.
// The tweak bar's minus buttons count them down. Problems sent from this page always stay.
const sentHere = (idea: Idea) => idea.id.startsWith("sent-");
const submitted = computed(() => {
  const { grid, pool } = devCounts.value;
  if (grid === undefined && pool === undefined) return ideas.value;
  const loaded = ideas.value.filter((i) => !sentHere(i));
  const funded = loaded.filter((i) => raised(i) > 0);
  const unfunded = loaded.filter((i) => !raised(i));
  const spare = [...unfunded, ...funded.slice(grid ?? funded.length).map((i) => ({ ...i, sponsors: [] }))];
  return [...funded.slice(0, grid), ...spare.slice(0, pool ?? unfunded.length), ...ideas.value.filter(sentHere)];
});

function fewer(event: Event) {
  const param = (event as CustomEvent<"grid" | "pool">).detail;
  const shown =
    param === "grid" ? board.value.days.filter((d) => d.status === "queued" && !sentHere(d.idea!)).length : ideas.value.filter((i) => !sentHere(i) && !raised(i)).length;
  devCounts.value = { ...devCounts.value, [param]: Math.max(0, (devCounts.value[param] ?? shown) - 1) };
}
const board = computed(() => buildBoard(submitted.value, history.value, now.value, guestSponsors.value));
const pool = computed<Entry[]>(() => board.value.pool.map(({ key, idea }) => ({ key, idea, status: "pool" })));
const nextDay = computed(() => {
  const { today, phase } = board.value;
  if (phase === "before") return today;
  return phase === "after" && today < TOTAL_DAYS ? today + 1 : undefined;
});
const selected = computed<Entry>(
  () => [...board.value.days, ...pool.value].find((e) => e.key === picked.value) ?? board.value.days[(nextDay.value ?? board.value.today) - 1],
);

const shippedCount = computed(() => board.value.days.filter((d) => d.status === "shipped").length);
const upcoming = computed(() => board.value.days.filter((d) => d.status === "queued").length);

const kicker = computed(() => {
  const { today, phase, isToday } = board.value;
  if (phase === "live") {
    const left = countdown(dayStart(today) + BUILD_MS - now.value);
    return { tone: "text-live", dot: "bg-live motion-safe:animate-pulse", text: `Live now · ${left} left` };
  }
  if (phase === "before") {
    return { tone: "text-night-muted", dot: "bg-queued", text: `Up next · 9:00 UK${isToday ? "" : `, ${dayDate(today)}`}` };
  }
  if (today < TOTAL_DAYS) {
    return { tone: "text-night-muted", dot: "bg-shipped", text: `Day ${today} shipped · Up next 9:00 UK, ${dayDate(today + 1)}` };
  }
  return { tone: "text-night-muted", dot: "bg-shipped", text: "That’s 40. What a ride." };
});

const legend = [
  { label: "shipped", dot: tones.shipped.dot },
  { label: "live", dot: tones.live.dot },
  { label: "upcoming", dot: tones.queued.dot },
  { label: "guest day", dot: tones.guest.dot },
  { label: "needs a problem", dot: tones.open.dot },
];

let timer: ReturnType<typeof setInterval> | undefined;
const loader = new AbortController();
onMounted(() => {
  const params = new URLSearchParams(location.search);
  const override = Date.parse(params.get("now") ?? "");
  if (import.meta.env.DEV) {
    const count = (name: string) => (params.has(name) ? Number(params.get(name)) : undefined);
    devCounts.value = { grid: count("grid"), pool: count("pool") };
    addEventListener(DEV_FEWER, fewer);
  }
  const offset = Number.isNaN(override) ? 0 : override - Date.now();
  now.value = Date.now() + offset;
  timer = setInterval(() => (now.value = Date.now() + offset), 1000);
  addEventListener(SENT, arrive);
  addEventListener("click", browseClicked);
  document.addEventListener("input", typed);
  if (location.hash === "#browse") openBrowse();
  openShared();
  loadIdeas({
    signal: loader.signal,
    onPage(page) {
      const known = new Set(ideas.value.map((i) => i.id));
      ideas.value.push(...page.filter((i) => !known.has(i.id)));
      loading.value = false;
      if (!shared) openShared();
    },
  })
    .catch(() => {})
    .finally(() => (loading.value = false));
});

// Shared links open the board on that idea: ?idea=12 for ideas still moving in the queue, ?day=5 otherwise. Ideas
// arrive a page at a time, so an idea link waits for the page it's on.
let shared = false;
function openShared() {
  const params = new URLSearchParams(location.search);
  const idea = params.get("idea");
  const day = Number(params.get("day"));
  const key = idea
    ? [...board.value.days, ...pool.value].find((e) => e.idea?.id === idea)?.key
    : day >= 1 && day <= TOTAL_DAYS ? `day-${day}` : undefined;
  if (!key) return;
  shared = true;
  picked.value = key;
  // Scrolling before load is undone when the browser restores the page's scroll position.
  const scroll = () => document.getElementById("day-box")?.scrollIntoView({ block: "start", behavior: "instant" });
  if (document.readyState === "complete") nextTick(scroll);
  else addEventListener("load", () => setTimeout(scroll), { once: true });
}
onBeforeUnmount(() => {
  clearInterval(timer);
  loader.abort();
  removeEventListener(SENT, arrive);
  removeEventListener(DEV_FEWER, fewer);
  removeEventListener("click", browseClicked);
  document.removeEventListener("input", typed);
  clearTimeout(typing);
  search.cancel();
});

// The Browse link sits in the page's static markup, so the board picks up its clicks and keeps its state in sync.
// Browsing folds the day box away, throws the 40 days out of the grid into the pool, and leaves the pool filling the
// screen under the title. Closing puts the days back in their slots, then unfolds the day box.
const browsing = ref(false);
const folded = ref(false);
const hero = ref<HTMLElement>();
const browsed = ref<Floated | null>(null);
const browseLinks = () => document.querySelectorAll<HTMLAnchorElement>('a[href="#browse"]');
const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
let moving = false;

// Days still up for grabs have nothing to show, so they stay out of the pool.
const thrown = computed(() => board.value.days.filter((d) => d.status !== "open"));
const dayIdeas = computed(() => board.value.days.flatMap((d) => (d.idea ? [d.idea] : [])));
const browsable = computed(() => [...pool.value.map((p) => p.idea!), ...dayIdeas.value]);
const dayOf = computed(() => new Map(board.value.days.flatMap((d) => (d.idea ? [[d.idea.id, d.key] as const] : []))));

async function openBrowse() {
  if (browsing.value || moving) return;
  moving = true;
  dispatchEvent(new Event(JOIN_CLOSE));
  browseLinks().forEach((link) => link.setAttribute("aria-expanded", "true"));
  window.posthog?.capture("browse_opened");
  scrollTo({ top: 0, behavior: still() ? "instant" : "smooth" });
  if (hero.value && !still()) await fold(hero.value, false);
  folded.value = true;
  await nextTick();
  const pieces = thrown.value.flatMap((d) => {
    const slot = slotOf(d.key);
    return slot ? [{ id: d.key, from: boxOf(slot) }] : [];
  });
  pieces.forEach((p) => problems.value?.hold(p.id));
  browsing.value = true;
  moving = false;
  await problems.value?.burst(pieces);
}

// Picking something while browsing closes it and opens that in the day box.
async function closeBrowse(key?: string) {
  if (!browsing.value || moving) return;
  moving = true;
  const from = problems.value?.boxes(thrown.value.map((d) => d.key)) ?? new Map();
  browsing.value = false;
  browsed.value = null;
  if (key) {
    backed.value = null;
    amount.value = DEFAULT_AMOUNT;
    picked.value = key;
  }
  browseLinks().forEach((link) => link.setAttribute("aria-expanded", "false"));
  await nextTick();
  if (!still()) {
    await Promise.all(
      board.value.days.flatMap((d, i) => {
        const slot = slotOf(d.key);
        const box = from.get(d.key);
        return slot && box ? [settle(slot, box, i * 12)] : [];
      }),
    );
  }
  folded.value = false;
  await nextTick();
  if (hero.value && !still()) await fold(hero.value, true);
  moving = false;
  if (key) document.getElementById("day-box")?.focus({ preventScroll: true });
  else if (!document.body.hasAttribute("data-joining")) browseLinks()[0]?.focus({ preventScroll: true });
}

function browseClicked(event: MouseEvent) {
  const link = event.target instanceof Element && event.target.closest('a[href="#browse"], a[href="#join"]');
  if (!link) return;
  if (link.getAttribute("href") === "#join") {
    if (browsing.value) closeBrowse();
    return;
  }
  event.preventDefault();
  if (browsing.value) closeBrowse();
  else openBrowse();
}

// A problem sent from the join form lands on the board straight away: on a day by how much they're sponsoring it,
// otherwise in the pool. When the form folded into a box, the box lobs onto its day while the days after it shift
// along one, or curls into a ball and drops from where it is. Whatever the day box was showing stays put.
const problems = ref<InstanceType<typeof ProblemsPool>>();
const flight = ref<{ title: string; from: Box } | null>(null);
const ghost = ref<HTMLElement>();
const incoming = ref<string | null>(null);
const landed = ref<string | null>(null);
const evicted = ref<{ idea: Idea; from: Box } | null>(null);
const evictedGhost = ref<HTMLElement>();

async function arrive(event: Event) {
  const { problem, name, amount, from, test } = (event as CustomEvent<SentProblem>).detail;
  search.cancel();
  similar.value = null;
  const owner = name.split(/\s+/)[0] || undefined;
  const sponsors = amount ? [{ name: owner ?? "Anonymous", amount }] : [];
  // Test sends from the tweak bar count as the oldest, so they win ties.
  const submittedAt = new Date(test ? 0 : Date.now()).toISOString();
  const idea: Idea = { id: `sent-${crypto.randomUUID()}`, title: excerpt(problem), problem, owner, sponsors, submittedAt };
  const placed = new Map(board.value.days.flatMap((d) => (d.idea ? [[d.idea.id, d.key] as const] : [])));
  if (from) {
    flight.value = { title: idea.title, from };
    problems.value?.hold(idea.id);
  }
  ideas.value.push(idea);
  if (!from) return;
  const day = board.value.days.find((d) => d.idea?.id === idea.id);
  const slot = day && slotOf(day.key);
  slot?.scrollIntoView({ block: "nearest", behavior: "instant" });
  const moves = board.value.days.flatMap((d) => {
    const was = d.idea && placed.get(d.idea.id);
    const old = was && was !== d.key ? slotOf(was) : undefined;
    const element = old && slotOf(d.key);
    return old && element ? [{ element, from: boxOf(old) }] : [];
  });
  // The idea pushed off the last day slides into a box past the end of the grid, then gets spat out of it.
  const out = slot && board.value.pool.find((p) => placed.has(p.idea.id))?.idea;
  const outSlot = out && slotOf(placed.get(out.id)!);
  if (out && outSlot) {
    problems.value?.hold(out.id);
    evicted.value = { idea: out, from: beyond() };
  }
  if (day) incoming.value = day.key;
  await nextTick();
  if (evictedGhost.value && outSlot) moves.push({ element: evictedGhost.value, from: boxOf(outSlot) });
  const shifted = Promise.all(moves.map(({ element, from }) => shift(element, from)));
  if (ghost.value) {
    ghost.value.animate([{ scale: 1 }, { scale: 1.12 }, { scale: 1 }], { duration: 260, easing: "ease-out" });
    if (slot) await lob(ghost.value, boxOf(ghost.value), boxOf(slot));
    else if (!day) await problems.value?.receive(idea.id, ghost.value);
  }
  flight.value = null;
  incoming.value = null;
  if (day) {
    landed.value = day.key;
    setTimeout(() => (landed.value = null), 400);
  }
  await shifted;
  if (out && evictedGhost.value) {
    await pop(evictedGhost.value, boxOf(evictedGhost.value));
    await problems.value?.receive(out.id, evictedGhost.value);
  }
  evicted.value = null;
}

// A day's tile in the grid, or its notch in the progress bar on phones, where the grid is hidden.
const slotOf = (key: string) => [...document.querySelectorAll(`[data-day-slot="${key}"]`)].findLast((slot) => slot.getClientRects().length);

// Where the grid would put one more day.
function beyond(): Box {
  const slots = board.value.days.flatMap((d) => slotOf(d.key) ?? []).map(boxOf);
  const last = slots.at(-1)!;
  const columns = slots.findIndex((s) => s.top !== slots[0].top);
  if (columns === -1 || slots.length % columns) return { ...last, left: last.left + slots[1].left - slots[0].left };
  return { ...last, left: slots[0].left, top: last.top + slots[columns].top - slots[0].top };
}

function swap(change: () => void, focusId: string) {
  const apply = async () => {
    dispatchEvent(new Event(JOIN_CLOSE));
    change();
    await nextTick();
    const box = document.getElementById("day-box");
    const rect = box?.getBoundingClientRect();
    if (rect && (rect.bottom < 160 || rect.top > innerHeight * 0.6)) box?.scrollIntoView({ block: "start" });
    document.getElementById(focusId)?.focus({ preventScroll: true });
  };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!document.startViewTransition || reduced || document.visibilityState !== "visible") return apply();
  document.startViewTransition(apply).ready.catch(() => {});
}

function select(key: string, focusId = "day-box") {
  swap(() => {
    backed.value = null;
    amount.value = DEFAULT_AMOUNT;
    picked.value = key;
  }, focusId);
}

function pick(key: string, preset: number) {
  swap(() => {
    backed.value = null;
    amount.value = preset;
    picked.value = key;
  }, "sponsor-button");
}

function sponsorLocally(paid: number, anonymous: boolean) {
  const sponsor = { name: anonymous ? "Anonymous" : "You", amount: paid };
  const { day, status, idea: entryIdea } = selected.value;
  if (status === "guest" && day) {
    return swap(() => {
      (guestSponsors.value[day] ??= []).push(sponsor);
      backed.value = selected.value.key;
    }, "day-box");
  }
  const id = entryIdea?.id;
  const idea = ideas.value.find((i) => i.id === id) ?? Object.values(history.value).find((i) => i.id === id);
  if (!idea) return;
  swap(() => {
    idea.sponsors.push(sponsor);
    picked.value = [...board.value.days, ...pool.value].find((e) => e.idea?.id === id)?.key ?? null;
    backed.value = selected.value.key;
  }, "day-box");
}

const tileLabel = (e: Entry) => {
  const head = e.day ? `Day ${e.day}, ${e.date}` : "In the pool";
  const title = e.status === "guest" || e.status === "open" ? "" : `: ${e.idea?.title}`;
  const sum = e.status === "queued" || e.status === "pool" ? `, ${money(raised(e.idea!))}` : "";
  return `${head}, ${statusLabel(e, board.value.today).toLowerCase()}${title}${sum}`;
};

const poolTiles = computed<PoolTile[]>(() =>
  pool.value.map((p) => ({
    key: p.key,
    id: p.idea!.id,
    title: p.idea!.title,
    problem: p.idea!.problem,
    seed: p.idea!.seed,
    label: tileLabel(p),
    raised: raised(p.idea!),
  })),
);

// Writing a problem in the join form floats similar unfunded ones up out of the pool. Only the classifier's scores say
// how alike two problems are. When it's down, word matches only rank, so just the best few float up, without a
// percentage.
const similar = ref<{ ranking: Ranking; matches: Match[] } | null>(null);
// While someone's writing a problem, its matches float up rather than Browse's. A match on a day's idea floats the day.
const lifted = computed(() => {
  if (similar.value || !browsed.value) return similar.value;
  return { ...browsed.value, matches: browsed.value.matches.map((m) => ({ ...m, id: dayOf.value.get(m.id) ?? m.id })) };
});
const search = createSearch({ ideas: () => poolTiles.value });
let typing: ReturnType<typeof setTimeout> | undefined;

function typed(event: Event) {
  if (!(event.target instanceof HTMLTextAreaElement) || event.target.id !== "join-problem") return;
  problems.value?.nudge();
  clearTimeout(typing);
  const text = event.target.value.trim();
  if (text.length < poolConfig.search.minLength) {
    search.cancel();
    similar.value = null;
    return;
  }
  typing = setTimeout(async () => {
    const found = await search.run(text);
    if (!found) return;
    const matches = found.ranking === "classifier" ? found.matches : found.matches.slice(0, poolConfig.search.lexicalMost);
    similar.value = { ranking: found.ranking, matches };
  }, poolConfig.search.debounceMs);
}

const dayTiles = computed<PoolTile[]>(() =>
  thrown.value.map((d) => {
    const label = statusLabel(d, board.value.today);
    return {
      key: d.key,
      id: d.key,
      day: d.day,
      status: d.status,
      title: d.status === "guest" || !d.idea ? label : d.idea.title,
      problem: d.status === "guest" ? "" : (d.idea?.problem ?? ""),
      kicker: [`Day ${pad(d.day!)}`, d.date, d.idea && d.status !== "guest" && label].filter(Boolean).join(" · "),
      label: tileLabel(d),
      raised: 0,
    };
  }),
);
const tiles = computed(() => (browsing.value ? [...poolTiles.value, ...dayTiles.value] : poolTiles.value));

const tileSub = (e: Entry) => {
  if (e.status === "live") return "Live now";
  if (e.status !== "queued" && e.status !== "pool") return "";
  const sum = raised(e.idea!);
  return sum || e.status === "pool" ? money(sum) : "Needs a sponsor";
};
</script>

<template>
  <div class="relative" :class="browsing && 'flex min-h-dvh flex-col'">
    <div class="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-4 pt-7 pb-8 lg:px-12">
      <div class="flex flex-wrap items-end justify-between gap-x-12 gap-y-4">
        <div class="flex flex-col gap-3">
          <slot name="title" />
          <slot name="links" />
        </div>
        <div aria-label="Progress" class="flex w-full min-w-0 flex-col gap-2 md:w-auto md:max-w-[40rem] md:flex-1">
          <div class="flex flex-wrap justify-between gap-x-3 gap-y-1 font-mono text-xs font-medium">
            <span>{{ String(shippedCount).padStart(2, "0") }} / 40 SHIPPED</span>
            <span class="text-night-muted">{{ upcoming }} upcoming<template v-if="pool.length"> · {{ pool.length }} {{ pool.length === 1 ? "problem" : "problems" }} simmering</template></span>
          </div>
          <div class="flex gap-[3px]" aria-hidden="true">
            <span
              v-for="d in board.days"
              :key="d.key"
              :data-day-slot="d.key"
              class="h-2.5 flex-1 rounded-xs"
              :class="[
                tones[d.status].dot,
                d.status === 'live' && 'motion-safe:animate-pulse',
                incoming === d.key && 'invisible',
                browsing && d.status !== 'open' && 'max-sm:invisible',
                landed === d.key && 'animate-pop',
              ]"
            ></span>
          </div>
          <ul class="m-0 flex list-none flex-wrap gap-x-4 gap-y-1.5 p-0 font-mono text-[11px] text-night-muted">
            <li v-for="item in legend" :key="item.label" class="flex items-center gap-1.5"><span class="size-[7px] rounded-full" :class="item.dot"></span>{{ item.label }}</li>
          </ul>
        </div>
      </div>
      <div class="flex flex-col gap-4">
        <div v-show="!folded" ref="hero">
          <div class="hidden in-data-joining:block"><slot name="join" /></div>
          <DayBox
            :key="selected.key"
            class="in-data-joining:hidden"
            :aria-busy="loading"
            :class="loading && 'opacity-60 motion-safe:animate-pulse'"
            :entry="selected"
            :days="board.days"
            :pool="pool"
            :today="board.today"
            :is-today="board.isToday"
            :now="now"
            :amount="amount"
            :backed="backed === selected.key"
            :headline="kicker"
            :next-day="nextDay"
            @sponsor="sponsorLocally"
            @again="backed = null"
            @pick="pick"
          />
        </div>

        <ul
          v-show="!browsing"
          aria-label="The 40 days"
          :aria-busy="loading"
          class="m-0 hidden list-none grid-cols-[repeat(auto-fill,minmax(5rem,5.5rem))] justify-between gap-2 p-0 sm:grid"
        >
          <DayTile
            v-for="d in board.days"
            :key="d.key"
            class="h-18"
            :class="[loading && 'opacity-60 motion-safe:animate-pulse', incoming === d.key && 'invisible', landed === d.key && 'animate-pop']"
            :data-day-slot="d.key"
            :status="d.status"
            :label="tileLabel(d)"
            :selected="d.key === selected.key"
            :today="d.day === board.today"
            :number="d.day"
            :title="d.status === 'guest' ? 'Guest day' : d.idea?.title"
            :sub="tileSub(d)"
            :sponsor-label="d.status === 'queued' ? `Sponsor ${d.idea?.title}` : undefined"
            @select="select(d.key)"
            @sponsor="select(d.key, 'sponsor-button')"
          />
        </ul>

        <BrowsePanel v-if="browsing" :ideas="browsable" @float="browsed = $event" @close="closeBrowse()" />

      </div>
    </div>

    <ProblemsPool
      ref="problems"
      :tiles="tiles"
      :matches="lifted?.matches ?? null"
      :ranking="lifted?.ranking"
      :quiet="!similar && !!browsed"
      :tall="browsing"
      @pick="(key) => (browsing ? closeBrowse(key) : select(key))"
    />

    <div
      v-if="evicted"
      ref="evictedGhost"
      aria-hidden="true"
      class="pointer-events-none fixed z-40 flex flex-col gap-0.5 overflow-hidden rounded-md text-night-text"
      :class="evicted.from.height < 24 ? tones.queued.dot : 'bg-night-tile px-2 pt-2 pb-1.5 shadow-lg'"
      :style="{ left: `${evicted.from.left}px`, top: `${evicted.from.top}px`, width: `${evicted.from.width}px`, height: `${evicted.from.height}px` }"
    >
      <template v-if="evicted.from.height >= 24">
        <span class="absolute inset-x-0 top-0 h-[3px]" :class="tones.queued.dot"></span>
        <span class="line-clamp-2 text-xs leading-[1.15] font-semibold wrap-break-word">{{ evicted.idea.title }}</span>
        <span class="mt-auto truncate font-mono text-[11px] leading-none font-medium text-night-sub">{{ money(raised(evicted.idea)) }}</span>
      </template>
    </div>

    <div
      v-if="flight"
      ref="ghost"
      aria-hidden="true"
      class="pointer-events-none fixed z-50 flex flex-col gap-0.5 overflow-hidden rounded-md bg-night-tile bg-linear-155 from-night-text/10 to-transparent px-2 py-1.5 text-night-text shadow-lg ring-1 ring-night-edge ring-inset"
      :style="{ left: `${flight.from.left}px`, top: `${flight.from.top}px`, width: `${flight.from.width}px`, height: `${flight.from.height}px` }"
    >
      <span class="font-mono text-[11px] font-medium text-night-sub">Yours</span>
      <span class="line-clamp-2 text-xs leading-[1.15] font-semibold">{{ flight.title }}</span>
    </div>
  </div>
</template>
