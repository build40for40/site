<script setup lang="ts">
import { computed, ref, watch } from "vue";
import DayArt from "./DayArt.vue";
import { dayLabel, formatDayDate, formatUkDate, isLive, isRevealed, statusMeta, type Day } from "../data/days";
import { links, money, payOptions, type PayKind } from "../data/site";

const props = defineProps<{ day: Day }>();
defineEmits<{ close: [] }>();

const verbs: Record<PayKind, string> = { unlock: "Unlock", sponsor: "Sponsor", presale: "Pre-order" };
const credits = ["Name", "Company", "Anonymous"] as const;

const date = computed(() => formatDayDate(props.day.day));
const revealed = computed(() => isRevealed(props.day.status));
const isToday = computed(() => date.value === formatUkDate(new Date()));

const kinds = computed<PayKind[]>(() => {
  if (props.day.status === "shipped") return [];
  return props.day.status === "locked" && isToday.value ? ["unlock", "sponsor", "presale"] : ["sponsor", "presale"];
});

const kind = ref<PayKind>(kinds.value[0] ?? "sponsor");
const credit = ref<(typeof credits)[number]>("Name");
watch(kinds, (list) => (kind.value = list[0] ?? "sponsor"));

const blurb = computed(() => {
  const { status, description, note } = props.day;
  if (status === "paused") return note ?? "Paused for now. Back soon.";
  if (revealed.value) return description;
  if (status === "sponsored") return `Backed and in the queue. The problem gets revealed at 9am on ${date.value}.`;
  return "Locked. This one doesn't get built until somebody backs it. Back it now and your name goes on the day.";
});

const artLabel = computed(() => {
  if (props.day.image && revealed.value) return "";
  if (props.day.status === "shipped") return "screenshot coming soon";
  if (revealed.value) return "being built right now";
  return `locked until 9am, ${date.value}`;
});

const checkoutUrl = computed(() => {
  const { link } = payOptions[kind.value];
  if (!link.startsWith("https://")) return link;
  const url = new URL(link);
  url.searchParams.set("client_reference_id", `day-${props.day.day}_${kind.value}_${credit.value.toLowerCase()}`);
  return url.href;
});

const payLabel = computed(() => `${verbs[kind.value]} day ${props.day.day} for ${money(payOptions[kind.value].amount)} →`);
</script>

<template>
  <div class="flex min-h-full flex-col gap-4.5 px-7 pt-6 pb-7">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2.5 font-mono text-[11px] font-medium tracking-wide">
        <span>DAY {{ dayLabel(day.day) }}</span>
        <span class="flex items-center gap-1.5 rounded-full border border-line bg-white px-2 py-0.5">
          <span class="size-[7px] rounded-full" :class="statusMeta[day.status].dot"></span>{{ statusMeta[day.status].label }}
        </span>
      </div>
      <button
        type="button"
        aria-label="Close"
        autofocus
        class="cursor-pointer border-0 bg-transparent px-1.5 py-1 text-[22px] leading-none text-muted hover:text-ink"
        @click="$emit('close')"
      >×</button>
    </div>

    <div class="relative aspect-16/10 overflow-hidden rounded-lg bg-[#ddd]">
      <DayArt :day="day" />
      <span v-if="artLabel" class="absolute bottom-2.5 left-2.5 rounded-[3px] bg-white/90 px-1.5 py-0.5 font-mono text-[10px]">{{ artLabel }}</span>
    </div>

    <div class="flex flex-col gap-1.5">
      <div class="font-mono text-[11px] text-muted">{{ date.toUpperCase() }} · 9AM TO 5PM UK</div>
      <h3 class="m-0 text-3xl leading-[1.02] font-semibold tracking-tight text-balance">{{ day.title ?? "Still under wraps" }}</h3>
    </div>
    <p class="m-0 text-[15px] leading-[1.45] text-body text-pretty">{{ blurb }}</p>

    <div v-if="day.status === 'shipped'" class="flex gap-2 font-mono text-xs font-medium">
      <a :href="day.appUrl" rel="noopener" class="flex-1 rounded-full bg-ink p-2.5 text-center text-white no-underline hover:bg-accent-deep">Try the app ↗</a>
      <a :href="day.recordingUrl" rel="noopener" class="flex-1 rounded-full border border-ink p-2.5 text-center text-ink no-underline hover:text-accent-deep">Watch the demo ↗</a>
    </div>
    <a
      v-else-if="isLive(day.status)"
      :href="links.twitch"
      rel="noopener"
      class="rounded-full bg-ink p-2.5 text-center font-mono text-xs font-medium text-white no-underline hover:bg-accent-deep"
    >Watch it live on Twitch ↗</a>

    <div class="flex flex-col gap-2 border-t border-line pt-4">
      <div class="font-mono text-[11px] font-medium tracking-wide text-muted">BACKERS</div>
      <div v-for="(backer, i) in day.backers" :key="i" class="flex justify-between gap-4 text-sm">
        <span>
          {{ backer.name }}
          <span v-if="i === 0 && revealed" class="ml-1 font-mono text-[10px] text-muted">UNLOCKED IT</span>
        </span>
        <span class="font-mono text-xs font-medium">{{ money(backer.amount) }}</span>
      </div>
      <div v-if="!day.backers.length" class="text-sm text-faint">Nobody yet. Be the reason this gets built.</div>
    </div>

    <div v-if="kinds.length" class="flex flex-col gap-2.5 border-t border-line pt-4">
      <fieldset class="m-0 flex flex-col gap-1.5 border-0 p-0">
        <legend class="mb-2.5 p-0 font-mono text-[11px] font-medium tracking-wide text-muted">
          {{ day.backers.length ? `BACK DAY ${day.day} TOO` : `BACK DAY ${day.day}` }}
        </legend>
        <label
          v-for="k in kinds"
          :key="k"
          class="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-line bg-white px-3.5 py-2.5 has-checked:border-ink has-checked:bg-ink has-checked:text-white has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink"
        >
          <input v-model="kind" type="radio" name="kind" :value="k" class="sr-only" />
          <span class="flex flex-col">
            <span class="text-sm font-semibold">{{ payOptions[k].label }}</span>
            <span class="text-xs opacity-75">{{ payOptions[k].blurb }}</span>
          </span>
          <span class="font-mono text-xs font-medium">{{ money(payOptions[k].amount) }}</span>
        </label>
      </fieldset>

      <fieldset class="m-0 border-0 p-0">
        <legend class="mb-2 p-0 font-mono text-[11px] font-medium tracking-wide text-muted">CREDIT ME AS</legend>
        <div class="grid grid-cols-3 gap-1.5">
          <label
            v-for="c in credits"
            :key="c"
            class="cursor-pointer rounded-full border border-line bg-white px-1 py-1.5 text-center font-mono text-[11.5px] font-medium whitespace-nowrap has-checked:border-ink has-checked:bg-ink has-checked:text-white has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink"
          >
            <input v-model="credit" type="radio" name="credit" :value="c" class="sr-only" />{{ c }}
          </label>
        </div>
      </fieldset>

      <a :href="checkoutUrl" class="mt-1 rounded-full bg-accent p-3 text-center text-sm font-semibold text-white no-underline hover:bg-accent-deep">{{ payLabel }}</a>
      <p class="m-0 text-center font-mono text-[11px] text-muted">Secure checkout by Stripe. No account needed.</p>
    </div>
  </div>
</template>
