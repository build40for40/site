<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { START, TOTAL_DAYS, UK_TZ } from "../data/site";

const DAY_MS = 86_400_000;
const BUILD_MS = 8 * 3_600_000;
const start = Date.parse(START);
const end = start + (TOTAL_DAYS - 1) * DAY_MS + BUILD_MS;

const now = ref<number | null>(null);
let timer: ReturnType<typeof setInterval> | undefined;

onMounted(() => {
  now.value = Date.now();
  timer = setInterval(() => (now.value = Date.now()), 1000);
});
onBeforeUnmount(() => clearInterval(timer));

const pad = (n: number) => String(n).padStart(2, "0");
const split = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return { d: Math.floor(s / 86_400), h: Math.floor(s / 3600) % 24, m: Math.floor(s / 60) % 60, s: s % 60 };
};

const phase = computed(() => {
  if (now.value === null || now.value < start) return "before";
  return now.value < end ? "running" : "done";
});

const dayNumber = computed(() => (now.value === null ? 1 : Math.floor((now.value - start) / DAY_MS) + 1));

const units = computed(() => {
  if (now.value === null) return [["--", "d"], ["--", "h"], ["--", "m"], ["--", "s"]];
  if (phase.value === "before") {
    const t = split(start - now.value);
    return [[pad(t.d), "d"], [pad(t.h), "h"], [pad(t.m), "m"], [pad(t.s), "s"]];
  }
  const t = split((now.value - start) % DAY_MS);
  return [[pad(t.h), "h"], [pad(t.m), "m"], [pad(t.s), "s"]];
});

const ukTime = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: UK_TZ }).format(start);

const localTime = computed(() => {
  if (now.value === null) return "";
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const sameAsUk = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", timeZone: zone }).format(start) ===
    new Intl.DateTimeFormat("en-GB", { hour: "2-digit", timeZone: UK_TZ }).format(start);
  if (sameAsUk) return "";
  const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(start);
  return `${time} your time (${zone.split("/").pop()?.replaceAll("_", " ")})`;
});
</script>

<template>
  <div class="flex flex-col gap-2" role="timer" aria-live="off">
    <div class="font-mono text-xs font-medium tracking-wide text-muted">
      <template v-if="phase === 'before'">DAY 01 UNLOCKS IN</template>
      <template v-else-if="phase === 'running'">DAY {{ pad(dayNumber) }} · TIME SINCE THE 9AM DROP</template>
      <template v-else>THAT'S A WRAP</template>
    </div>
    <div v-if="phase !== 'done'" class="flex items-baseline gap-3 font-mono text-3xl font-medium tabular-nums md:text-4xl">
      <span v-for="[value, unit] in units" :key="unit">{{ value }}<span class="text-base text-muted">{{ unit }}</span></span>
    </div>
    <div v-else class="text-3xl font-bold tracking-tight">40 days. 40 apps.</div>
    <div v-if="phase === 'before'" class="font-mono text-xs text-muted">
      {{ ukTime }} UK<template v-if="localTime"> · {{ localTime }}</template>
    </div>
  </div>
</template>
