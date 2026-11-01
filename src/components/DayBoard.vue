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
  type EntryStatus,
  type Idea,
  type ShippedIdea,
  type Sponsor,
} from "../data/days";
import { TOTAL_DAYS, money, sponsorUs } from "../data/site";
import { poolConfig } from "../pool/config";
import { loadIdeas } from "../pool/data";
import { DEV_FEWER, DEV_SEND, JOIN_CLOSE, SENT, boxOf, fold, lob, pop, settle, shift, SHIFT_MS, type Box, type SentProblem } from "../pool/flight";
import { createSearch, type Match, type Ranking } from "../pool/search";
import { excerpt } from "../../worker/problems";
import { confirmReturn, pay, startCheckout } from "./forms/checkout";

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

// A test send to the days is raised to the least any queued day has, so it always lands on one.
function sendToDays(event: Event) {
  const detail = (event as CustomEvent<{ amount: number }>).detail;
  if (!detail.amount) return;
  const days = board.value.days;
  const floor = days.some((d) => d.status === "open") ? 1 : Math.min(...days.filter((d) => d.status === "queued").map((d) => raised(d.idea!)));
  if (Number.isFinite(floor)) detail.amount = Math.max(detail.amount, floor);
}
const board = computed(() => buildBoard(submitted.value, history.value, now.value, guestSponsors.value));
const pool = computed<Entry[]>(() => board.value.pool.map(({ key, idea }) => ({ key, idea, status: "pool" })));
const nextDay = computed(() => {
  const { today, phase } = board.value;
  if (phase === "before") return today;
  return phase === "after" && today < TOTAL_DAYS ? today + 1 : undefined;
});
// The disco ball in the pool, for sponsoring the whole thing rather than one idea.
const us = ref<Idea>({ id: "us", title: sponsorUs.title, problem: sponsorUs.tagline, sponsors: [] });
const usEntry = computed<Entry>(() => ({ key: "us", status: "us", idea: us.value }));
const selected = computed<Entry>(
  () => [...board.value.days, ...pool.value, usEntry.value].find((e) => e.key === picked.value) ?? board.value.days[(nextDay.value ?? board.value.today) - 1],
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
    return { tone: "text-night-muted", dot: "bg-queued", text: `Up next · 10:00 UK${isToday ? "" : `, ${dayDate(today)}`}` };
  }
  if (today < TOTAL_DAYS) {
    return { tone: "text-night-muted", dot: "bg-shipped", text: `Day ${today} shipped · Up next 10:00 UK, ${dayDate(today + 1)}` };
  }
  return { tone: "text-night-muted", dot: "bg-shipped", text: "That’s 40. What a ride." };
});

const legend = [
  { label: "shipped", dot: tones.shipped.dot },
  { label: "live", dot: tones.live.dot },
  { label: "upcoming", dot: tones.queued.dot },
  { label: "guest day", dot: tones.guest.dot },
];

let timer: ReturnType<typeof setInterval> | undefined;
const loader = new AbortController();
onMounted(() => {
  gridless.value = gridQuery().matches;
  gridQuery().addEventListener("change", onGridChange);
  const params = new URLSearchParams(location.search);
  const override = Date.parse(params.get("now") ?? "");
  if (import.meta.env.DEV) {
    const count = (name: string) => (params.has(name) ? Number(params.get(name)) : undefined);
    devCounts.value = { grid: count("grid"), pool: count("pool") };
    addEventListener(DEV_FEWER, fewer);
    addEventListener(DEV_SEND, sendToDays, true);
  }
  const offset = Number.isNaN(override) ? 0 : override - Date.now();
  now.value = Date.now() + offset;
  timer = setInterval(() => (now.value = Date.now() + offset), 1000);
  addEventListener(SENT, arrive);
  addEventListener("click", browseClicked);
  document.addEventListener("input", typed);
  if (location.hash === "#browse") openBrowse();
  confirmReturn()
    .catch(() => {})
    .then(load);
  fetch("/api/days")
    .then((response) => (response.ok ? response.json() : null))
    .then((days: { sponsors: Record<number, Sponsor[]> } | null) => {
      if (days) guestSponsors.value = days.sponsors;
    })
    .catch(() => {});
});

function load() {
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
}

// Shared links open the board on that idea: ?idea=12 for ideas still moving in the queue, ?day=5 otherwise. Ideas
// arrive a page at a time, so an idea link waits for the page it's on.
let shared = false;
function openShared() {
  const params = new URLSearchParams(location.search);
  const idea = params.get("idea");
  const day = Number(params.get("day"));
  const key = idea
    ? [...board.value.days, ...pool.value, usEntry.value].find((e) => e.idea?.id === idea)?.key
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
  gridQuery().removeEventListener("change", onGridChange);
  clearInterval(timer);
  loader.abort();
  removeEventListener(SENT, arrive);
  removeEventListener(DEV_FEWER, fewer);
  removeEventListener(DEV_SEND, sendToDays, true);
  removeEventListener("click", browseClicked);
  document.removeEventListener("input", typed);
  clearTimeout(typing);
  search.cancel();
});

// The Browse link sits in the page's static markup, so the board picks up its clicks and keeps its state in sync.
// Browsing folds the day box away, throws the days with a problem out of the grid into the pool, and leaves the pool filling the
// screen under the title. Phones have no grid, so the days fly out of the progress bar and it folds away too. Closing
// puts the days back in their slots, then unfolds the day box.
const browsing = ref(false);
const folded = ref(false);
const tucked = ref(false);
const hero = ref<HTMLElement>();
const counter = ref<HTMLElement>();
const gridless = ref(false);
const gridQuery = () => matchMedia("(width < 64rem)");
const onGridChange = (e: MediaQueryListEvent) => (gridless.value = e.matches);
const browsed = ref<Floated | null>(null);
const browseLinks = () => document.querySelectorAll<HTMLAnchorElement>('a[href="#browse"]');
const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
let moving = false;

// Open and guest days have no problem to search, so they stay out of the pool.
const thrown = computed(() => board.value.days.filter((d) => d.idea));
const dayIdeas = computed(() => board.value.days.flatMap((d) => (d.idea ? [d.idea] : [])));
// The clock rebuilds the board every second, so these keep their last value until something in them changes. A fresh
// one each tick re-renders the browse panel, which closes and reopens an open category picker in Firefox.
const browsable = computed<Idea[]>((last) => {
  const ideas = [...pool.value.map((p) => p.idea!), ...dayIdeas.value];
  return last?.length === ideas.length && ideas.every((idea, i) => idea === last[i]) ? last : ideas;
});
const browseStatuses = computed<Record<string, EntryStatus>>((last) => {
  const statuses = Object.fromEntries([...pool.value, ...board.value.days].flatMap((e) => (e.idea ? [[e.idea.id, e.status]] : [])));
  const ids = Object.keys(statuses);
  return last && ids.length === Object.keys(last).length && ids.every((id) => statuses[id] === last[id]) ? last : statuses;
});
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
  const burst = problems.value?.burst(pieces);
  if (gridless.value) await tuck(false);
  moving = false;
  await burst;
}

async function tuck(open: boolean) {
  if (open) {
    tucked.value = false;
    await nextTick();
  }
  if (counter.value && !still()) await fold(counter.value, open);
  if (!open) tucked.value = true;
}

// Picking something while browsing closes it and opens that in the day box.
async function closeBrowse(key?: string) {
  if (!browsing.value || moving) return;
  moving = true;
  if (tucked.value) await tuck(true);
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
  const { id, problem, name, amount, from, test } = (event as CustomEvent<SentProblem>).detail;
  search.cancel();
  similar.value = null;
  const owner = name.split(/\s+/)[0] || undefined;
  const sponsors = amount ? [{ name: owner ?? "Anonymous", amount }] : [];
  // Test sends from the tweak bar count as the oldest, so they win ties.
  const submittedAt = new Date(test ? 0 : Date.now()).toISOString();
  const idea: Idea = { id: id ?? `sent-${crypto.randomUUID()}`, title: excerpt(problem), problem, owner, sponsors, submittedAt };
  const placed = new Map(board.value.days.flatMap((d) => (d.idea ? [[d.idea.id, d.key] as const] : [])));
  if (from) {
    flight.value = { title: idea.title, from };
    problems.value?.hold(idea.id);
  }
  ideas.value.push(idea);
  if (!from) return;
  const day = board.value.days.find((d) => d.idea?.id === idea.id);
  const out = day && board.value.pool.find((p) => placed.has(p.idea.id))?.idea;
  if (out) problems.value?.hold(out.id);
  if (day) incoming.value = day.key;
  // Measure once the form has closed, or everything lands where the days were before the board moved up.
  await nextTick();
  const slot = day && slotOf(day.key);
  slot?.scrollIntoView({ block: "nearest", behavior: "instant" });
  const moves = board.value.days.flatMap((d) => {
    const was = d.idea && placed.get(d.idea.id);
    const old = was && was !== d.key ? slotOf(was) : undefined;
    const element = old && slotOf(d.key);
    return old && element ? [{ element, from: boxOf(old) }] : [];
  });
  // The idea pushed off the last day waits in its cell until the last domino squeezes it out.
  const outSlot = out && slotOf(placed.get(out.id)!);
  // It's pinned to the screen, so it's put back over its cell whenever the page scrolls. The cell is measured from
  // the grid, since the day sliding into it moves its box.
  const grid = outSlot?.parentElement;
  const cell = outSlot && grid && { box: boxOf(outSlot), grid: boxOf(grid) };
  const pin = () => {
    if (!evicted.value || !cell || !grid) return;
    const now = boxOf(grid);
    evicted.value.from = { ...cell.box, left: cell.box.left + now.left - cell.grid.left, top: cell.box.top + now.top - cell.grid.top };
  };
  if (out && cell) evicted.value = { idea: out, from: cell.box };
  addEventListener("scroll", pin, { passive: true });
  await nextTick();
  // They go one after another like dominoes, the last one squeezing the idea out of the end.
  const step = Math.min(90, 1400 / moves.length);
  moves.forEach(({ element, from }, i) => shift(element, from, i * step));
  const squeezed = new Promise((resolve) => setTimeout(resolve, Math.max(0, moves.length - 1) * step + SHIFT_MS * 0.6));
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
  // Follow the dominoes down to the last day, so the squeeze is on screen.
  const below = evicted.value ? evicted.value.from.top + evicted.value.from.height + 24 - innerHeight : 0;
  if (below > 0) scrollBy({ top: below, behavior: "smooth" });
  if (out && evictedGhost.value) {
    await squeezed;
    pin();
    await nextTick();
    await pop(evictedGhost.value, boxOf(evictedGhost.value));
    await problems.value?.receive(out.id, evictedGhost.value);
  }
  removeEventListener("scroll", pin);
  evicted.value = null;
}

// A day's tile in the grid, or its notch in the progress bar on phones, where the grid is hidden.
const slotOf = (key: string) => [...document.querySelectorAll(`[data-day-slot="${key}"]`)].findLast((slot) => slot.getClientRects().length);


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

function select(key: string) {
  swap(() => {
    backed.value = null;
    amount.value = DEFAULT_AMOUNT;
    picked.value = key;
  }, "day-box");
}

function pick(key: string, preset: number) {
  swap(() => {
    backed.value = null;
    amount.value = preset;
    picked.value = key;
  }, "sponsor-button");
}

async function sponsor(amount: number, anonymous: boolean) {
  const entry = selected.value;
  const target = entry.status === "guest" ? { day: entry.day } : entry.status === "us" ? {} : { problem: entry.idea?.id };
  const outcome = await pay(() => startCheckout({ amount: amount * 100, anonymous, ...target }), `Sponsor ${money(amount)}`);
  if (outcome.status === "paid") credit(entry, { name: outcome.name ?? "Anonymous", amount: outcome.amount });
}

function credit({ key, day, status, idea: entryIdea }: Entry, sponsor: Sponsor) {
  if (status === "us") {
    return swap(() => {
      us.value.sponsors.push(sponsor);
      backed.value = key;
    }, "day-box");
  }
  if (status === "guest" && day) {
    return swap(() => {
      (guestSponsors.value[day] ??= []).push(sponsor);
      backed.value = key;
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

const hint = ref<{ key: string; label: string; left: number; top: number; shift: number } | null>(null);
function showHint(target: EventTarget | null) {
  const slot = target instanceof HTMLElement ? target.closest<HTMLElement>("[data-day-slot]") : null;
  const day = slot && board.value.days.find((d) => d.key === slot.dataset.daySlot);
  if (!slot || !day) return;
  const left = slot.offsetLeft + slot.offsetWidth / 2;
  hint.value = { key: day.key, label: tileLabel(day), left, top: slot.offsetTop, shift: (left / slot.parentElement!.clientWidth) * 100 };
}

// A dock-style magnifier for the bar when it's one row: days near the mouse widen and the rest give up the room.
const LENS_RADIUS = 4;
const lens = ref<{ weights: number[]; grow: number; unit: number; gap: number; width: number } | null>(null);
let lensFrame = 0;

function lensWeights(at: number, count: number, grow: number) {
  return Array.from({ length: count }, (_, i) => {
    const distance = Math.abs(i + 0.5 - at);
    return 1 + (distance < LENS_RADIUS ? (grow * (1 + Math.cos((Math.PI * distance) / LENS_RADIUS))) / 2 : 0);
  });
}

// Finds where to centre the bump so the day under the mouse stays under it once its neighbours have moved.
function magnify(event: PointerEvent) {
  if (event.pointerType !== "mouse" || still() || !matchMedia("(width >= 48rem)").matches) return;
  const bar = event.currentTarget as HTMLElement;
  const cursor = event.clientX - bar.getBoundingClientRect().left;
  cancelAnimationFrame(lensFrame);
  lensFrame = requestAnimationFrame(() => {
    const count = board.value.days.length;
    const grow = gridless.value ? 2 : 4;
    const gap = parseFloat(getComputedStyle(bar).columnGap) || 0;
    const width = bar.clientWidth;
    const layout = (at: number) => {
      const weights = lensWeights(at, count, grow);
      return { weights, unit: (width - gap * (count - 1)) / weights.reduce((a, b) => a + b) };
    };
    const xOf = (at: number) => {
      const { weights, unit } = layout(at);
      const k = Math.min(Math.floor(at), count - 1);
      return (weights.slice(0, k).reduce((a, b) => a + b, 0) + (at - k) * weights[k]) * unit + k * gap;
    };
    let [lo, hi] = [0, count];
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2;
      if (xOf(mid) < cursor) lo = mid;
      else hi = mid;
    }
    lens.value = { ...layout(lo), grow, gap, width };
  });
}

function leaveBar(event: PointerEvent) {
  if (event.pointerType !== "mouse") return;
  cancelAnimationFrame(lensFrame);
  lens.value = null;
  hint.value = null;
}

const lensed = (i: number) => (lens.value ? (lens.value.weights[i] - 1) / lens.value.grow : 0);

const hintSpot = computed(() => {
  if (!hint.value) return null;
  const i = board.value.days.findIndex((d) => d.key === hint.value!.key);
  if (!lens.value || i < 0) return hint.value;
  const { weights, unit, gap, width } = lens.value;
  const left = (weights.slice(0, i).reduce((a, b) => a + b, 0) + weights[i] / 2) * unit + i * gap;
  return { ...hint.value, left, shift: (left / width) * 100 };
});

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
      title: d.idea!.title,
      problem: d.idea!.problem,
      kicker: [`Day ${pad(d.day!)}`, d.date, label].join(" · "),
      label: tileLabel(d),
      raised: 0,
    };
  }),
);
const disco: PoolTile = {
  key: "us",
  id: "us",
  disco: true,
  title: sponsorUs.title,
  problem: sponsorUs.tagline,
  kicker: "Sponsor us",
  label: `${sponsorUs.title}, sponsor us`,
  raised: 0,
};
const tiles = computed(() => [disco, ...(browsing.value ? [...poolTiles.value, ...dayTiles.value] : poolTiles.value)]);

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
        <div v-show="!tucked" ref="counter" aria-label="Progress" class="flex w-full min-w-0 flex-col gap-2 lg:w-auto lg:max-w-[40rem] lg:flex-1">
          <div class="flex flex-wrap justify-between gap-x-3 gap-y-1 font-mono text-xs font-medium">
            <span>{{ String(shippedCount).padStart(2, "0") }} / 40 SHIPPED</span>
            <span class="text-night-muted">{{ upcoming }} upcoming<template v-if="pool.length"> · {{ pool.length }} {{ pool.length === 1 ? "problem" : "problems" }} simmering</template></span>
          </div>
          <div
            role="group"
            aria-label="The 40 days"
            :aria-hidden="!gridless"
            class="relative grid grid-cols-20 gap-[3px] md:flex md:h-5 md:items-center lg:h-2.5"
            @pointerover="showHint($event.target)"
            @pointermove="magnify"
            @pointerleave="leaveBar"
            @focusin="showHint($event.target)"
            @focusout="hint = null"
          >
            <button
              v-for="(d, i) in board.days"
              :key="d.key"
              type="button"
              :data-day-slot="d.key"
              :aria-label="tileLabel(d)"
              :aria-pressed="d.key === selected.key"
              :tabindex="gridless ? undefined : -1"
              class="grid h-5 scroll-mt-8 cursor-pointer place-items-center rounded-xs p-0 font-mono text-[9px] leading-none font-medium ease-out focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-lime md:h-full md:min-w-0 md:flex-1 motion-safe:md:transition-[flex-grow,height] motion-safe:md:duration-100"
              :class="[
                tones[d.status].dot,
                d.idea || d.status === 'guest' ? 'text-night' : 'text-night-muted',
                d.status === 'live' && 'motion-safe:animate-pulse',
                incoming === d.key && 'invisible',
                browsing && d.idea && 'max-lg:invisible',
                landed === d.key && 'animate-pop',
                hint?.key === d.key && 'max-lg:ring-2 max-lg:ring-night-text',
                d.key === selected.key && 'max-lg:outline-2 max-lg:outline-offset-1 max-lg:outline-brand-lime',
              ]"
              :style="lens && { flexGrow: lens.weights[i], height: `calc(100% + ${lensed(i) * 10}px)` }"
              @click="select(d.key)"
            ><span aria-hidden="true" :class="lensed(i) < 0.5 && 'lg:hidden'">{{ pad(d.day!) }}</span></button>
            <span
              v-if="hintSpot"
              class="pointer-events-none absolute z-10 w-max max-w-[min(16rem,100%)] rounded bg-night-text px-2 py-1 font-mono text-[11px] leading-snug text-night lg:hidden"
              :style="{ left: `${hintSpot.left}px`, top: `${hintSpot.top - (lens ? 11 : 6)}px`, translate: `-${hintSpot.shift}% -100%` }"
            >{{ hintSpot.label }}</span>
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
            @sponsor="sponsor"
            @again="backed = null"
            @pick="pick"
          />
        </div>

        <ul
          v-show="!browsing"
          aria-label="The 40 days"
          :aria-busy="loading"
          class="m-0 hidden list-none grid-cols-[repeat(auto-fill,minmax(5rem,5.5rem))] justify-between gap-2 p-0 lg:grid"
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
            @select="select(d.key)"
          />
        </ul>

        <BrowsePanel v-if="browsing" :ideas="browsable" :statuses="browseStatuses" @float="browsed = $event" @close="closeBrowse()" />

      </div>
    </div>

    <div v-show="!browsing"><slot name="sponsors" /></div>

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
