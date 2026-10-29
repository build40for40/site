<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import DayBox from "./DayBox.vue";
import DayTile from "./DayTile.vue";
import EmailBox from "./EmailBox.vue";
import {
  DEFAULT_AMOUNT,
  buildBoard,
  dayDate,
  raised,
  statusLabel,
  tones,
  type Entry,
  type Idea,
  type ShippedIdea,
  type Sponsor,
} from "../data/days";
import { TOTAL_DAYS, money } from "../data/site";

const props = defineProps<{ ideas: Idea[]; history: Record<number, ShippedIdea>; builtAt: number }>();

const now = ref(props.builtAt);
const ideas = ref(props.ideas.map((idea) => ({ ...idea, sponsors: [...idea.sponsors] })));
const history = ref<Record<number, ShippedIdea>>(
  Object.fromEntries(Object.entries(props.history).map(([day, idea]) => [day, { ...idea, sponsors: [...idea.sponsors] }])),
);
const guestSponsors = ref<Record<number, Sponsor[]>>({});
const picked = ref<string | null>(null);
const backed = ref<string | null>(null);
const amount = ref(DEFAULT_AMOUNT);

const board = computed(() => buildBoard(ideas.value, history.value, now.value, guestSponsors.value));
const pool = computed<Entry[]>(() => board.value.pool.map(({ key, idea }) => ({ key, idea, status: "pool" })));
const selected = computed<Entry>(
  () => [...board.value.days, ...pool.value].find((e) => e.key === picked.value) ?? board.value.days[board.value.today - 1],
);

const shippedCount = computed(() => board.value.days.filter((d) => d.status === "shipped").length);
const upcoming = computed(() => board.value.days.filter((d) => d.status === "queued").length);
const open = computed(() => board.value.days.filter((d) => d.status === "open").length);

const kicker = computed(() => {
  const { today, phase, isToday } = board.value;
  if (phase === "live") return { tone: "text-live", dot: "bg-live motion-safe:animate-pulse", text: `Live now · Day ${today} ships by 13:40 UK` };
  if (phase === "before") return { tone: "text-night-muted", dot: "bg-queued", text: `Day ${today} starts 9:00 UK${isToday ? "" : `, ${dayDate(today)}`}` };
  if (today < TOTAL_DAYS) return { tone: "text-night-muted", dot: "bg-shipped", text: `Day ${today} shipped · Day ${today + 1} starts 9:00 UK, ${dayDate(today + 1)}` };
  return { tone: "text-night-muted", dot: "bg-shipped", text: "That’s 40. What a ride." };
});

const submit = computed(() =>
  open.value
    ? { title: "Submit a problem", sub: `${open.value} more days need a problem to solve` }
    : {
        title: "Submit a new problem",
        sub: `All 40 days are spoken for${pool.value.length ? `, ${pool.value.length} more in the pool` : ""}. Outfund one to jump the queue.`,
      },
);

const legend = [
  { label: "shipped", dot: tones.shipped.dot },
  { label: "live", dot: tones.live.dot },
  { label: "upcoming", dot: tones.queued.dot },
  { label: "guest day", dot: tones.guest.dot },
  { label: "needs a problem", dot: tones.open.dot },
];

let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  const override = Date.parse(new URLSearchParams(location.search).get("now") ?? "");
  const offset = Number.isNaN(override) ? 0 : override - Date.now();
  now.value = Date.now() + offset;
  timer = setInterval(() => (now.value = Date.now() + offset), 1000);
  openShared();
});

// Shared links open the board on that idea: ?idea=12 for ideas still moving in the queue, ?day=5 otherwise.
function openShared() {
  const params = new URLSearchParams(location.search);
  const idea = Number(params.get("idea"));
  const day = Number(params.get("day"));
  const key = idea
    ? [...board.value.days, ...pool.value].find((e) => e.idea?.id === idea)?.key
    : day >= 1 && day <= TOTAL_DAYS ? `day-${day}` : undefined;
  if (!key) return;
  picked.value = key;
  // Scrolling before load is undone when the browser restores the page's scroll position.
  const scroll = () => document.getElementById("day-box")?.scrollIntoView({ block: "start", behavior: "instant" });
  if (document.readyState === "complete") nextTick(scroll);
  else addEventListener("load", () => setTimeout(scroll), { once: true });
}
onBeforeUnmount(() => clearInterval(timer));

function swap(change: () => void, focusId: string) {
  const apply = async () => {
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

const tileSub = (e: Entry) => {
  if (e.status === "live") return "Live now";
  if (e.status !== "queued" && e.status !== "pool") return "";
  const sum = raised(e.idea!);
  return sum || e.status === "pool" ? money(sum) : "Needs a sponsor";
};
</script>

<template>
  <div class="flex flex-col gap-4 lg:gap-5">
    <div class="-mt-1 flex items-center gap-2 font-mono text-xs font-medium tracking-wider uppercase" :class="kicker.tone">
      <span class="size-[7px] shrink-0 rounded-full" :class="kicker.dot"></span>{{ kicker.text }}
    </div>

    <section aria-label="About" class="grid gap-4.5 rounded-lg border border-night-line bg-night-panel px-4.5 pt-4.5 pb-5 min-[900px]:grid-cols-[minmax(0,1.3fr)_minmax(320px,1fr)] min-[900px]:items-end min-[900px]:gap-12 min-[900px]:px-6 min-[900px]:pt-5.5 min-[900px]:pb-6">
      <slot />
      <div class="flex min-w-0 flex-col gap-2">
        <div class="flex flex-wrap justify-between gap-x-3 gap-y-1 font-mono text-xs font-medium">
          <span>{{ String(shippedCount).padStart(2, "0") }} / 40 SHIPPED</span>
          <span class="text-night-muted">{{ upcoming }} upcoming<template v-if="pool.length"> · {{ pool.length }} in the pool</template></span>
        </div>
        <div class="flex gap-[3px]" aria-hidden="true">
          <span v-for="d in board.days" :key="d.key" class="h-2.5 flex-1 rounded-xs" :class="[tones[d.status].dot, d.status === 'live' && 'motion-safe:animate-pulse']"></span>
        </div>
        <ul class="m-0 flex list-none flex-wrap gap-x-4 gap-y-1.5 p-0 font-mono text-[11px] text-night-muted">
          <li v-for="item in legend" :key="item.label" class="flex items-center gap-1.5"><span class="size-[7px] rounded-full" :class="item.dot"></span>{{ item.label }}</li>
        </ul>
      </div>
    </section>

    <DayBox
      :key="selected.key"
      :entry="selected"
      :days="board.days"
      :pool="pool"
      :today="board.today"
      :is-today="board.isToday"
      :now="now"
      :amount="amount"
      :backed="backed === selected.key"
      @sponsor="sponsorLocally"
      @again="backed = null"
      @pick="pick"
    />

    <ul aria-label="The 40 days" class="m-0 grid list-none grid-cols-5 gap-1.5 p-0 sm:gap-2.5">
      <DayTile
        v-for="d in board.days"
        :key="d.key"
        class="aspect-square sm:aspect-auto sm:h-30"
        compact
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
      <li class="col-span-full grid gap-3 rounded-lg border-[1.5px] border-dashed border-night-edge px-4 py-3.5 md:grid-cols-[1fr_minmax(320px,28rem)] md:items-end md:gap-12">
        <div class="flex flex-col gap-1">
          <span class="text-base font-semibold">{{ submit.title }}</span>
          <span class="font-mono text-[11px] leading-snug text-night-muted">{{ submit.sub }}</span>
        </div>
        <EmailBox intent="build" label="Want us to build your idea?" button="Let’s go" />
      </li>
    </ul>

    <section v-if="pool.length" aria-labelledby="pool-title" class="flex flex-col gap-3 pt-3">
      <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="pool-title" class="m-0 text-2xl font-semibold tracking-tight">Problems pool</h2>
        <p class="m-0 max-w-[60ch] font-mono text-xs leading-normal text-night-muted">{{ pool.length }} ideas that didn't make the 40 days. Sponsor one you like and it could bump one.</p>
      </div>
      <ul class="m-0 grid list-none grid-cols-2 gap-1.5 p-0 sm:grid-cols-3 sm:gap-2.5 lg:grid-cols-5">
        <DayTile
          v-for="p in pool"
          :key="p.key"
          class="h-24 sm:h-30"
          status="pool"
          :label="tileLabel(p)"
          :selected="p.key === selected.key"
          :title="p.idea?.title"
          :sub="tileSub(p)"
          :sponsor-label="`Sponsor ${p.idea?.title}`"
          @select="select(p.key)"
          @sponsor="select(p.key, 'sponsor-button')"
        />
      </ul>
    </section>
  </div>
</template>
