<script setup lang="ts">
import { computed, ref } from "vue";
import ShareButton from "./ShareButton.vue";
import StreamEmbed from "./StreamEmbed.vue";
import {
  SPONSOR_AMOUNTS,
  countdown,
  countdownParts,
  dayStart,
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
import { money } from "../data/site";

const props = defineProps<{
  entry: Entry;
  days: Day[];
  pool: Entry[];
  today: number;
  isToday: boolean;
  now: number;
  amount: number;
  backed: boolean;
  headline: { tone: string; dot: string; text: string };
  nextDay?: number;
}>();
const emit = defineEmits<{ sponsor: [amount: number, anonymous: boolean]; pick: [key: string, amount: number]; again: [] }>();

const amount = ref(props.amount);
const anonymous = ref(false);
const showAll = ref(false);
const video = ref<"recording" | "shorts">("shorts");
const sponsoring = ref(false);

const idea = computed(() => props.entry.idea);
const shippedIdea = computed(() => props.entry.idea as ShippedIdea);
const sponsors = computed(() => idea.value?.sponsors ?? props.entry.sponsors ?? []);
const total = computed(() => sponsors.value.reduce((sum, s) => sum + s.amount, 0));
const isTodayEntry = computed(() => props.entry.day === props.today);
const label = computed(() => statusLabel(props.entry, props.today));
const glyph = computed(() => ({ live: "● ", shipped: "✓ " })[props.entry.status as "live" | "shipped"] ?? "");
const start = computed(() => dayStart(props.entry.day ?? 1));
const dayPrefix = computed(() => (props.entry.day ? `Day ${props.entry.day}: ` : ""));
const isLive = computed(() => props.entry.status === "live");
const isNext = computed(() => props.entry.day === props.nextDay && (props.entry.status === "queued" || props.entry.status === "guest"));
const isShipped = computed(() => props.entry.status === "shipped");
const liveStyle = computed(() => isLive.value || isNext.value || isShipped.value);

function toggleSponsoring() {
  if (props.backed) emit("again");
  sponsoring.value = props.backed || !sponsoring.value;
}
const where = computed(() => {
  const { date, status } = props.entry;
  if (status === "pool") return "No day yet";
  const waiting = (status === "queued" || status === "guest") && start.value > props.now;
  return `${date}${waiting ? ` · starts in ${countdown(start.value - props.now)}` : ""}`;
});
const isUpFirst = computed(() => props.entry.status === "queued" && isTodayEntry.value);

const rows = computed(() => mergedSponsors(sponsors.value));
const count = computed(() => sponsorCount(sponsors.value));


const upNext = computed(() => {
  if (props.entry.status !== "shipped" || !isTodayEntry.value) return null;
  const next = props.days[props.today];
  if (!next) return null;
  const title = next.idea?.title ?? (next.status === "guest" ? "Guest day" : "Up for grabs");
  return { title, day: next.day };
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
  if (isUpFirst.value) return "Once the clock starts we get 4 hours 40 minutes to ship it.";
  if (!total.value) return `#${rank} in the queue, pencilled in for ${date}. If it’s still at $0 by 9:00 that day, the day stays locked.`;
  if (rank === 1) return `Top of the queue. If nothing outfunds it by 9:00 on ${date}, we build it.`;
  return `#${rank} in the queue. Outfund the ones above it to move up.`;
});

const sponsorNote = computed(
  () =>
    ({
      guest: "The problem’s a secret, but you can back the day now.",
      shipped: "Already shipped. Back it anyway and get your name in the production credits.",
    })[props.entry.status as "guest" | "shipped"] ?? "",
);

// Days that are fixed link by day; ideas still moving through the queue link by idea.
const shareUrl = computed(() => {
  const { status, day } = props.entry;
  const param = status === "shipped" || status === "live" || status === "guest" ? `day=${day}` : `idea=${idea.value?.id}`;
  return `${import.meta.env.SITE}/?${param}`;
});

const share = computed(() => {
  const title = idea.value?.title;
  const url = shareUrl.value;
  switch (props.entry.status) {
    case "queued":
    case "pool":
      return { label: "Share it, help it get funded", text: `Help get “${title}” built live on 40 for 40.`, url };
    case "live":
      return { label: "Share the stream", text: `We’re building “${title}” live right now on 40 for 40.`, url };
    case "shipped":
      return { label: "Share the app", text: `“${title}” got built live in ${shippedIdea.value.buildTime} on 40 for 40. Try it.`, url };
    case "guest":
      return { label: "Share the guest day", text: `Secret guest day on 40 for 40, ${props.entry.date}. Who could it be?`, url };
    default:
      return null;
  }
});

const thanks = computed(() => {
  const { status } = props.entry;
  const what = status === "guest" ? "a secret guest day" : `“${idea.value?.title}”`;
  const line =
    { guest: "Share it and get people guessing.", shipped: "Share it so more people try it." }[status as "guest" | "shipped"] ?? "Share it to get it over the line.";
  const ask = status === "queued" || status === "pool" ? " Help get it built." : "";
  return { line, text: `I just backed ${what} on 40 for 40.${ask}` };
});

const unsponsored = computed(() =>
  [...props.days, ...props.pool].filter((e) => (e.status === "queued" || e.status === "pool") && e.idea && !raised(e.idea)).slice(0, 3),
);

const panel = "flex min-w-0 flex-col gap-2.5 rounded-md bg-night-panel p-4";
const kicker = "font-mono text-[11px] leading-snug font-medium tracking-wider text-night-muted uppercase";
const mainButton =
  "block cursor-pointer rounded-full border-0 bg-brand-lime text-brand-lime-ink hover:bg-brand-lime-hover px-4 py-3 text-center text-[15px] font-semibold no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-lime";
const smallLink = "self-center font-mono text-xs font-medium text-night-sub underline-offset-3 hover:text-night-text";
const overlayPill =
  "cursor-pointer rounded-full border border-night-edge bg-night/60 px-3 py-1.5 font-mono text-xs font-medium text-night-text hover:border-night-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-lime";
const pill = "cursor-pointer rounded-full border border-night-edge bg-transparent font-mono text-xs font-medium text-night-text hover:border-night-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-lime";
</script>

<template>
  <section
    id="day-box"
    tabindex="-1"
    :aria-label="entry.day ? `Day ${entry.day}` : idea?.title"
    class="grid scroll-mt-4 gap-2 border-t-3 pt-2.5 outline-offset-4 [view-transition-name:day-box] focus-visible:outline-2 focus-visible:outline-brand-lime lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
    :class="tones[entry.status].border"
  >
    <div class="col-span-full flex flex-wrap justify-between gap-x-3 gap-y-1" :class="kicker">
      <span v-if="isTodayEntry || isNext" class="flex items-center gap-2" :class="headline.tone">
        <span class="size-[7px] shrink-0 rounded-full" :class="headline.dot"></span>{{ headline.text }}
      </span>
      <span v-else>{{ where }}</span>
      <span v-if="!isTodayEntry && !isNext" :class="tones[entry.status].text">{{ glyph }}{{ label }}</span>
    </div>

    <div class="relative flex min-w-0 flex-col self-start overflow-hidden rounded-md bg-night-panel">
      <div class="flex aspect-video flex-col bg-player lg:min-h-100">
        <div class="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-2.5 p-4 text-center">
          <template v-if="isShipped">
            <div v-if="video === 'shorts'" class="absolute inset-0 flex justify-center gap-2 px-3 pt-13 pb-3">
              <a
                v-for="short in shippedIdea.shorts"
                :key="short.title"
                :href="short.url"
                target="_blank"
                rel="noopener"
                class="flex aspect-[9/16] h-full min-w-0 flex-col justify-between rounded-md bg-night-tile p-2.5 text-left text-night-text no-underline ring-night-edge hover:ring-1 focus-visible:outline-2 focus-visible:outline-brand-lime"
              >
                <span class="font-mono text-[10px] tracking-wider text-night-muted uppercase">{{ short.platform }}</span>
                <span class="self-center text-2xl" aria-hidden="true">▶</span>
                <span class="text-xs leading-snug font-semibold text-pretty">{{ short.title }}</span>
              </a>
            </div>
            <template v-else>
              <img :src="shippedIdea.screenshot" alt="" class="absolute inset-0 size-full object-cover object-top opacity-35" />
              <a :href="shippedIdea.recordingUrl" target="_blank" rel="noopener" class="relative rounded-full bg-brand-lime text-brand-lime-ink hover:bg-brand-lime-hover px-5 py-3 text-[15px] font-semibold no-underline">▶ Watch the full build</a>
              <p class="relative m-0 font-mono text-xs text-night-sub">All {{ shippedIdea.buildTime }} of it, on Twitch.</p>
            </template>
            <div class="absolute top-2.5 left-2.5 z-1 flex gap-1.5" role="group" aria-label="Video">
              <button
                v-for="[value, text] in [['recording', 'Full build'], ['shorts', 'Shorts']]"
                :key="value"
                type="button"
                :aria-pressed="video === value"
                class="bg-night/60 px-3 py-1.5 aria-pressed:border-brand-lime aria-pressed:text-brand-lime"
                :class="pill"
                @click="video = value as 'recording' | 'shorts'"
              >{{ text }}</button>
            </div>
            <ShareButton v-if="share" class="absolute top-2.5 right-2.5 z-1 max-w-[calc(100%-11rem)] justify-end" v-bind="share" label="Share" />
          </template>

          <template v-else-if="isLive || isNext">
            <StreamEmbed v-if="isLive" />
            <template v-else>
              <span :class="kicker">Starts in</span>
              <div class="flex gap-[.35em] font-mono text-[clamp(28px,4.4vw,52px)] leading-none font-medium tabular-nums" role="timer">
                <span v-for="[value, unit] in countdownParts(start - now)" :key="unit">{{ pad(value) }}<small class="text-[.4em] text-night-muted">{{ unit }}</small></span>
              </div>
              <p class="m-0 font-mono text-xs leading-normal text-night-muted">9:00 {{ entry.date }} UK. Then the clock starts: 4:40:00.</p>
            </template>
            <span
              class="absolute top-2.5 left-2.5 z-1 flex items-center gap-1.5 rounded-[3px] px-2 py-0.5 font-mono text-[10px] font-medium tracking-wider text-night"
              :class="isLive ? 'bg-live' : 'bg-queued'"
            >{{ isLive ? "● LIVE" : "UP NEXT" }}</span>
            <div class="absolute top-2.5 right-2.5 z-1 flex max-w-[calc(100%-5.5rem)] flex-wrap justify-end gap-1.5">
              <button type="button" :aria-expanded="sponsoring" :class="overlayPill" @click="toggleSponsoring">Sponsor</button>
              <ShareButton v-if="share" class="justify-end" v-bind="share" label="Share" />
            </div>
          </template>

          <template v-else-if="entry.status === 'queued'">
            <span :class="kicker">Day {{ entry.day }} starts in</span>
            <div class="flex gap-[.35em] font-mono text-[clamp(28px,4.4vw,52px)] leading-none font-medium tabular-nums" role="timer">
              <span v-for="[value, unit] in countdownParts(start - now)" :key="unit">{{ pad(value) }}<small class="text-[.4em] text-night-muted">{{ unit }}</small></span>
            </div>
            <p class="m-0 font-mono text-xs leading-normal text-night-muted">9:00 {{ entry.date }} UK, if it’s still funded by then.</p>
          </template>

          <template v-else-if="entry.status === 'guest'">
            <svg aria-hidden="true" viewBox="0 0 24 24" class="size-5.5 fill-none stroke-current stroke-2 opacity-75">
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            <span :class="kicker">Top secret</span>
            <p class="m-0 font-mono text-xs text-night-muted">Revealed live at 9:00 UK on {{ entry.date }}</p>
          </template>

          <template v-else-if="entry.status === 'pool'">
            <span :class="kicker">No day, no stream yet</span>
            <p class="m-0 font-mono text-xs text-night-muted">Sponsor it onto the board and we build it live.</p>
          </template>

          <template v-else>
            <span :class="kicker">Nothing booked yet</span>
            <p class="m-0 font-mono text-xs text-night-muted">{{ entry.date }} is up for grabs</p>
          </template>
        </div>

        <div v-if="isLive || isNext" class="@container shrink-0 overflow-hidden border-t border-night-line py-2 font-mono text-xs text-night-sub motion-reduce:overflow-x-auto">
          <div v-if="rows.length" class="flex w-max motion-safe:animate-credits hover:[animation-play-state:paused]">
            <ul
              v-for="copy in 2"
              :key="copy"
              :aria-hidden="copy === 2"
              :aria-label="copy === 1 ? 'Backers' : undefined"
              class="m-0 flex min-w-[100cqw] shrink-0 list-none justify-around gap-8 p-0 px-4"
            >
              <li v-for="r in rows" :key="r.name" class="whitespace-nowrap">{{ r.name }} <span class="text-night-text">{{ money(r.amount) }}</span></li>
            </ul>
          </div>
          <p v-else class="m-0 px-4">No backers yet. Be the first.</p>
        </div>
      </div>

      <div v-if="(isLive || isNext) && (backed || sponsoring)" class="border-t border-night-line px-2.5 py-2 sm:absolute sm:top-12 sm:right-2.5 sm:z-1 sm:max-w-[calc(100%-1.25rem)] sm:border-0 sm:p-0">
        <p v-if="backed" class="m-0 py-1.5 font-mono text-xs text-night-text sm:rounded-full sm:bg-night/60 sm:px-3">You’re backer #{{ count }}. Thank you!</p>
        <div v-else class="flex flex-wrap gap-1.5 sm:justify-end" role="group" aria-label="Amount">
          <button
            v-for="a in SPONSOR_AMOUNTS"
            :key="a"
            type="button"
            :aria-label="`Sponsor with ${money(a)}`"
            class="px-2.5!"
            :class="overlayPill"
            @click="emit('sponsor', a, anonymous)"
          >{{ money(a) }}</button>
          <button
            type="button"
            :aria-pressed="anonymous"
            class="px-2.5! aria-pressed:border-brand-lime aria-pressed:text-brand-lime"
            :class="overlayPill"
            @click="anonymous = !anonymous"
          >Anonymous</button>
        </div>
      </div>

    </div>

    <div class="lg:h-0 lg:min-h-full lg:overflow-y-auto" :class="panel">
      <template v-if="entry.status === 'open'">
        <h2 class="m-0 text-[26px] leading-[1.04] font-semibold tracking-tight text-balance md:text-3xl">{{ dayPrefix }}Sponsor this day</h2>
        <p class="m-0 text-[15px] leading-snug text-night-sub text-pretty">Nothing’s booked for {{ entry.date }} yet. Bring a problem and sponsor it, and the queue grows into this day.</p>
        <p class="m-0 text-[15px] leading-snug text-pretty">The idea with the most sponsorship goes first.</p>
        <a href="#join" :class="mainButton">Bring your own problem</a>
        <div v-if="unsponsored.length" class="mt-auto border-t border-night-line pt-3">
          <div :class="kicker">Or sponsor one of these</div>
          <ul class="m-0 list-none p-0">
            <li v-for="e in unsponsored" :key="e.key" class="flex items-center justify-between gap-2.5 border-t border-night-line py-2.5 first:border-t-0">
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
        </div>
      </template>

      <template v-else>
        <template v-if="idea">
          <h2 class="m-0 text-[26px] leading-[1.04] font-semibold tracking-tight text-balance md:text-3xl">{{ dayPrefix }}{{ idea.title }}</h2>
          <p class="m-0 line-clamp-3 text-[15px] leading-snug text-night-sub text-pretty" :title="idea.problem"><span class="text-brand-yellow">(</span>{{ idea.problem }}<span class="text-brand-yellow">)</span></p>
        </template>
        <template v-else>
          <h2 class="m-0 text-[26px] leading-[1.04] font-semibold tracking-tight text-balance md:text-3xl">{{ dayPrefix }}Guest day</h2>
          <p class="m-0 text-[15px] leading-snug text-night-sub text-pretty">A special guest brings their own problem and builds it with us. It stays a secret until 9:00 on {{ entry.date }}.</p>
          <p class="m-0 text-[15px] leading-snug text-pretty">Same rules as every day: 4 hours 40 minutes on the clock, live on Twitch.</p>
        </template>
        <ShareButton v-if="share && !liveStyle" v-bind="share" />
        <p v-if="line" class="m-0 text-[15px] leading-snug text-pretty">{{ line }}</p>
        <p v-if="upNext" class="m-0 text-[15px] leading-snug text-pretty">Up next on Day {{ upNext.day }}: {{ upNext.title }}.</p>
        <div v-if="isShipped" class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <a :href="shippedIdea.appUrl" target="_blank" rel="noopener" class="min-w-56" :class="mainButton">Try this idea ↗</a>
          <span class="font-mono text-xs text-night-muted">Shipped in {{ shippedIdea.buildTime }}</span>
        </div>
        <a v-if="entry.status === 'guest'" href="#join" class="self-start" :class="smallLink">Suggest a guest</a>

        <div class="mt-auto flex flex-col gap-2.5 border-t border-night-line pt-3">
          <template v-if="backed">
            <div :class="kicker">Thank you</div>
            <p class="m-0 text-[22px] leading-tight font-semibold tracking-tight">You’re backer #{{ count }}.</p>
            <p class="m-0 text-[15px] leading-snug text-night-sub text-pretty">{{ thanks.line }}</p>
            <ShareButton label="Share" :text="thanks.text" :url="shareUrl" expanded />
            <button
              type="button"
              class="cursor-pointer self-start border-0 bg-transparent p-0 font-mono text-xs font-medium text-night-sub underline underline-offset-3 hover:text-night-text"
              @click="emit('again')"
            >Sponsor again</button>
          </template>

          <template v-else>
            <div class="relative flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <div :class="kicker">{{ entry.status === "guest" ? "Sponsor this day" : "Sponsor this idea" }}</div>
              <button
                v-if="rows.length"
                type="button"
                :aria-expanded="showAll"
                class="cursor-pointer border-0 bg-transparent p-0 font-mono text-xs font-medium text-night-sub underline-offset-3 hover:text-night-text hover:underline"
                @click="showAll = !showAll"
              >{{ count }} {{ count === 1 ? "backer" : "backers" }} · {{ money(total) }} {{ showAll ? "▴" : "▾" }}</button>
              <span v-else class="font-mono text-xs text-night-muted">No sponsors yet</span>
              <ul
                v-if="showAll"
                class="absolute inset-x-0 bottom-full z-10 m-0 mb-1.5 flex max-h-40 list-none flex-col gap-1.5 overflow-y-auto rounded-md border border-night-edge bg-night-tile p-2.5 text-sm shadow-xl"
              >
                <li v-for="r in rows" :key="r.name" class="flex justify-between gap-3">
                  <span>{{ r.name }}</span><span class="font-mono text-xs font-medium">{{ money(r.amount) }}</span>
                </li>
              </ul>
            </div>
            <p v-if="sponsorNote" class="m-0 text-sm text-night-sub text-pretty">{{ sponsorNote }}</p>

            <div class="@container flex flex-wrap gap-1.5">
              <div class="grid min-w-max flex-[2] grid-cols-[repeat(2,auto)] gap-1.5 @min-[18rem]:grid-cols-[repeat(4,auto)]" role="group" aria-label="Amount">
                <button
                  v-for="a in SPONSOR_AMOUNTS"
                  :key="a"
                  type="button"
                  :aria-pressed="amount === a"
                  class="px-1 py-2 aria-pressed:border-brand-lime aria-pressed:text-brand-lime"
                  :class="pill"
                  @click="amount = a"
                >{{ money(a) }}</button>
              </div>
              <button id="sponsor-button" type="button" class="flex-1 whitespace-nowrap" :class="mainButton" @click="emit('sponsor', amount, anonymous)">
                Sponsor {{ money(amount) }}
              </button>
            </div>
            <label class="flex cursor-pointer items-center gap-2 text-sm text-night-sub">
              <input v-model="anonymous" type="checkbox" class="m-0 size-4 accent-night-text" /> Keep me anonymous
            </label>
          </template>
        </div>
      </template>
    </div>
  </section>
</template>
