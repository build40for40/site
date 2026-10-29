<script setup lang="ts">
import { computed, ref } from "vue";
import StreamEmbed from "./StreamEmbed.vue";
import {
  BUILD_MS,
  SPONSOR_AMOUNTS,
  countdownParts,
  dayStart,
  hms,
  listOf,
  mergedSponsors,
  pad,
  raised,
  sponsorCount,
  statusLabel,
  tones,
  type Day,
  type Entry,
  type ShippedIdea,
} from "../data/days";
import { links, money } from "../data/site";

const props = defineProps<{
  entry: Entry;
  days: Day[];
  pool: Entry[];
  today: number;
  isToday: boolean;
  now: number;
  amount: number;
}>();
const emit = defineEmits<{ sponsor: [amount: number, anonymous: boolean]; pick: [key: string, amount: number] }>();

const amount = ref(props.amount);
const anonymous = ref(false);
const showAll = ref(false);

const idea = computed(() => props.entry.idea);
const shippedIdea = computed(() => props.entry.idea as ShippedIdea);
const total = computed(() => (idea.value ? raised(idea.value) : 0));
const isTodayEntry = computed(() => props.entry.day === props.today);
const label = computed(() => statusLabel(props.entry, props.today));
const glyph = computed(() => ({ live: "● ", shipped: "✓ " })[props.entry.status as "live" | "shipped"] ?? "");
const where = computed(() => {
  const { day, date, status } = props.entry;
  if (status === "pool") return "No day yet";
  return `Day ${day} · ${date}${isTodayEntry.value && props.isToday ? " · Today" : ""}`;
});

const start = computed(() => dayStart(props.entry.day ?? 1));
const isUpFirst = computed(() => props.entry.status === "queued" && isTodayEntry.value);
const sponsorable = computed(() => props.entry.status === "queued" || props.entry.status === "pool");

const rows = computed(() => mergedSponsors(idea.value?.sponsors ?? []));
const shownRows = computed(() => (showAll.value ? rows.value : rows.value.slice(0, 3)));
const count = computed(() => sponsorCount(idea.value?.sponsors ?? []));

const credit = computed(() => {
  const names = rows.value.map((r) => r.name);
  if (!names.length) return "";
  return names.length > 3 ? `${names[0]}, ${names[1]} and ${names.length - 2} others` : listOf(names);
});

const upNext = computed(() => {
  if (props.entry.status !== "shipped" || !isTodayEntry.value) return null;
  const next = props.days[props.today];
  if (!next) return null;
  const title = next.idea?.title ?? (next.status === "guest" ? "Guest day" : "Up for grabs");
  return { title, day: next.day, starts: hms(dayStart(next.day) - props.now) };
});

const lastQueued = computed(() => props.days.findLast((d) => d.status === "queued"));

const line = computed(() => {
  const { status, rank, date } = props.entry;
  if (status === "pool") {
    const last = lastQueued.value;
    if (!last?.idea) return "";
    const bar = raised(last.idea);
    return bar
      ? `Sponsor it past ${money(bar)} and it takes day ${last.day} from ${last.idea.title}.`
      : `Sponsor it and it takes day ${last.day} from ${last.idea.title}.`;
  }
  if (status !== "queued") return "";
  if (isUpFirst.value) return `Up first. Clock starts 9:00 on ${date}: 4 hours 40 minutes to ship.`;
  if (!total.value) return `#${rank} in the queue, pencilled in for ${date}. If it’s still at £0 by 9:00 that day, the day stays locked.`;
  if (rank === 1) return `Top of the queue. If nothing outfunds it by 9:00 on ${date}, we build it.`;
  return `#${rank} in the queue. Outfund the ones above it to move up.`;
});

const unsponsored = computed(() =>
  [...props.days, ...props.pool].filter((e) => (e.status === "queued" || e.status === "pool") && e.idea && !raised(e.idea)).slice(0, 3),
);

const panel = "flex min-w-0 flex-col gap-2.5 rounded-md bg-night-panel p-4";
const kicker = "font-mono text-[11px] leading-snug font-medium tracking-wider text-night-muted uppercase";
const mainButton =
  "block cursor-pointer rounded-full border-0 bg-night-text px-4 py-3 text-center text-[15px] font-semibold text-night no-underline hover:bg-night-sub focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-night-text";
const smallLink = "self-center font-mono text-xs font-medium text-night-sub underline-offset-3 hover:text-night-text";
const pill = "cursor-pointer rounded-full border border-night-edge bg-transparent font-mono text-xs font-medium text-night-text hover:border-night-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-night-text";
</script>

<template>
  <section
    id="day-box"
    tabindex="-1"
    :aria-label="entry.day ? `Day ${entry.day}` : idea?.title"
    class="grid scroll-mt-4 gap-2 border-t-3 pt-2.5 outline-offset-4 [view-transition-name:day-box] focus-visible:outline-2 focus-visible:outline-night-text md:grid-cols-2 xl:grid-cols-[1.15fr_1fr_0.85fr]"
    :class="tones[entry.status].border"
  >
    <div class="col-span-full flex flex-wrap justify-between gap-x-3 gap-y-1" :class="kicker">
      <span>{{ where }}</span>
      <span :class="tones[entry.status].text">{{ glyph }}{{ label }}</span>
    </div>

    <div
      class="relative flex aspect-video flex-col items-center justify-center gap-2.5 overflow-hidden rounded-md bg-night-panel p-4 text-center md:row-span-2 md:aspect-auto md:min-h-70 xl:row-span-1"
      :class="entry.status === 'live' && 'bg-player'"
    >
      <template v-if="entry.status === 'live'">
        <StreamEmbed />
        <span class="absolute top-2.5 left-2.5 z-1 flex items-center gap-1.5 rounded-[3px] bg-live px-2 py-0.5 font-mono text-[10px] font-medium tracking-wider text-night">● LIVE</span>
      </template>
      <template v-else-if="isUpFirst">
        <span :class="kicker">Day {{ entry.day }} starts in</span>
        <div class="flex gap-[.35em] font-mono text-[clamp(28px,4.4vw,52px)] leading-none font-medium tabular-nums" role="timer">
          <span v-for="[value, unit] in countdownParts(start - now)" :key="unit">{{ pad(value) }}<small class="text-[.4em] text-night-muted">{{ unit }}</small></span>
        </div>
        <p class="m-0 font-mono text-xs leading-normal text-night-muted">9:00 {{ entry.date }} UK. Then the clock starts: 4:40:00.</p>
      </template>
      <template v-else-if="entry.status === 'shipped'">
        <span class="absolute bottom-3 left-3 flex flex-wrap gap-1.5 font-mono text-[11px]">
          <span class="rounded-[3px] bg-night px-2 py-0.5">App screenshot</span>
          <span class="rounded-[3px] bg-night px-2 py-0.5">Shipped in {{ shippedIdea.buildTime }}</span>
        </span>
      </template>
      <template v-else-if="sponsorable">
        <span :class="kicker">Raised so far</span>
        <div class="font-mono text-[clamp(28px,4.4vw,52px)] leading-none font-medium tabular-nums">{{ money(total) }}</div>
        <p class="m-0 font-mono text-xs text-night-muted">{{ entry.rank ? `#${entry.rank} in the queue · pencilled in for ${entry.date}` : "In the pool, no day yet" }}</p>
      </template>
      <template v-else-if="entry.status === 'guest'">
        <svg aria-hidden="true" viewBox="0 0 24 24" class="size-5.5 fill-none stroke-current stroke-2 opacity-75">
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
        <span :class="kicker">Top secret</span>
        <p class="m-0 font-mono text-xs text-night-muted">Revealed at 9:00 UK on {{ entry.date }}</p>
      </template>
      <template v-else>
        <span :class="kicker">Nothing booked yet</span>
        <p class="m-0 font-mono text-xs text-night-muted">{{ entry.date }} is up for grabs</p>
      </template>
    </div>

    <div :class="panel">
      <template v-if="entry.status === 'guest'">
        <h2 class="m-0 text-[26px] leading-[1.04] font-semibold tracking-tight text-balance md:text-3xl">Guest day</h2>
        <p class="m-0 text-[15px] leading-snug text-night-sub text-pretty">A special guest brings their own problem and builds it with us. It stays a secret until 9:00 on {{ entry.date }}.</p>
        <p class="m-0 text-[15px] leading-snug text-pretty">Same rules as every day: 4 hours 40 minutes on the clock, live on Twitch.</p>
      </template>
      <template v-else-if="entry.status === 'open'">
        <h2 class="m-0 text-[26px] leading-[1.04] font-semibold tracking-tight text-balance md:text-3xl">Sponsor this day</h2>
        <p class="m-0 text-[15px] leading-snug text-night-sub text-pretty">Nothing’s booked for {{ entry.date }} yet. Bring a problem and sponsor it, and the queue grows into this day.</p>
        <p class="m-0 text-[15px] leading-snug text-pretty">The idea with the most sponsorship goes first.</p>
        <a href="/join" :class="mainButton">Bring your own problem</a>
      </template>
      <template v-else-if="idea">
        <h2 class="m-0 text-[26px] leading-[1.04] font-semibold tracking-tight text-balance md:text-3xl">{{ idea.title }}</h2>
        <div v-if="(entry.status === 'live' || entry.status === 'shipped') && credit" :class="kicker">Sponsored by <span class="text-night-text">{{ credit }}</span></div>
        <p class="m-0 text-[15px] leading-snug text-night-sub text-pretty">“{{ idea.problem }}”</p>
        <div v-if="idea.owner" class="font-mono text-xs text-night-muted">From {{ idea.owner }}</div>
        <p v-if="line" class="m-0 text-[15px] leading-snug text-pretty">{{ line }}</p>
        <p v-if="upNext" class="m-0 text-[15px] leading-snug text-pretty">
          Up next: {{ upNext.title }}, Day {{ upNext.day }}, starts in <span class="font-mono tabular-nums">{{ upNext.starts }}</span>
        </p>
      </template>
    </div>

    <div v-if="entry.status !== 'open' || unsponsored.length" :class="panel">
      <template v-if="entry.status === 'live'">
        <div :class="kicker">Left to ship</div>
        <div class="font-mono text-4xl leading-none font-medium tabular-nums" role="timer">{{ hms(start + BUILD_MS - now) }}</div>
        <div class="font-mono text-xs text-night-muted">Started 9:00 · ships by 13:40 UK</div>
        <a :href="links.twitch" target="_blank" rel="noopener" class="mt-auto" :class="mainButton">Watch on Twitch ↗</a>
      </template>

      <template v-else-if="entry.status === 'shipped'">
        <div :class="kicker">It’s live</div>
        <a :href="shippedIdea.appUrl" rel="noopener" class="mt-auto" :class="mainButton">Try the app ↗</a>
        <a :href="shippedIdea.recordingUrl" rel="noopener" :class="smallLink">Watch the recording ↗</a>
      </template>

      <template v-else-if="entry.status === 'guest'">
        <div :class="kicker">Don’t miss it</div>
        <a href="/join" class="mt-auto" :class="mainButton">Remind me on {{ entry.date }}</a>
        <a href="/join" :class="smallLink">Suggest a guest</a>
      </template>

      <template v-else-if="entry.status === 'open'">
        <div :class="kicker">Or sponsor one of these</div>
        <ul class="m-0 list-none p-0">
          <li v-for="e in unsponsored" :key="e.key" class="flex items-center justify-between gap-2.5 border-t border-night-line py-2.5">
            <span class="min-w-0">
              <span class="block text-sm font-semibold">{{ e.idea!.title }}</span>
              <span v-if="e.idea!.owner" class="mt-0.5 block font-mono text-xs text-night-muted">{{ e.idea!.owner }}</span>
            </span>
            <button
              type="button"
              :aria-label="`Sponsor ${e.idea!.title} with ${money(SPONSOR_AMOUNTS[0])}`"
              class="shrink-0 px-2.5 py-1.5"
              :class="pill"
              @click="emit('pick', e.key, SPONSOR_AMOUNTS[0])"
            >+ {{ money(SPONSOR_AMOUNTS[0]) }}</button>
          </li>
        </ul>
      </template>

      <template v-else>
        <div :class="kicker">Sponsor this idea</div>
        <template v-if="rows.length">
          <div class="flex justify-between border-b border-night-line pb-1.5 font-mono text-xs font-medium text-night-sub">
            <span>{{ count }} {{ count === 1 ? "sponsor" : "sponsors" }}</span><span>{{ money(total) }}</span>
          </div>
          <ul class="m-0 flex list-none flex-col gap-1.5 p-0 text-sm">
            <li v-for="r in shownRows" :key="r.name" class="flex justify-between gap-3">
              <span>{{ r.name }}</span><span class="font-mono text-xs font-medium">{{ money(r.amount) }}</span>
            </li>
          </ul>
          <button
            v-if="rows.length > 3"
            type="button"
            :aria-expanded="showAll"
            class="cursor-pointer self-start border-0 bg-transparent p-0 font-mono text-xs font-medium text-night-sub underline underline-offset-3 hover:text-night-text"
            @click="showAll = !showAll"
          >{{ showAll ? "Show fewer" : `+ ${rows.length - 3} more` }}</button>
        </template>
        <p v-else class="m-0 text-sm text-night-sub">No sponsors yet. Be the first.</p>

        <div class="grid grid-cols-4 gap-1.5" role="group" aria-label="Amount">
          <button
            v-for="a in SPONSOR_AMOUNTS"
            :key="a"
            type="button"
            :aria-pressed="amount === a"
            class="px-1 py-2 aria-pressed:border-night-text aria-pressed:bg-night-text aria-pressed:text-night"
            :class="pill"
            @click="amount = a"
          >{{ money(a) }}</button>
        </div>
        <label class="flex cursor-pointer items-center gap-2 text-sm text-night-sub">
          <input v-model="anonymous" type="checkbox" class="m-0 size-4 accent-night-text" /> Keep me anonymous
        </label>
        <button id="sponsor-button" type="button" class="mt-auto" :class="mainButton" @click="emit('sponsor', amount, anonymous)">
          Sponsor with {{ money(amount) }}
        </button>
      </template>
    </div>
  </section>
</template>
