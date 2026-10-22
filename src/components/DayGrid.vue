<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import DayDrawer from "./DayDrawer.vue";
import DayArt from "./DayArt.vue";
import { dayLabel, formatDayDate, isRevealed, legend, statusMeta, topBackers, type Day } from "../data/days";
import { money } from "../data/site";

const props = defineProps<{ days: Day[] }>();

const dialog = ref<HTMLDialogElement>();
const selected = ref<Day | null>(null);

const shippedCount = computed(() => props.days.filter((d) => d.status === "shipped").length);
const topBacker = computed(() => topBackers(props.days, 1)[0]);

async function open(day: Day) {
  selected.value = day;
  await nextTick();
  dialog.value?.showModal();
}

function onBackdrop(event: MouseEvent) {
  if (event.target === dialog.value) dialog.value?.close();
}
</script>

<template>
  <div class="flex flex-col gap-8 md:flex-row md:items-end md:justify-between md:gap-10">
    <div class="flex flex-col gap-3">
      <div class="font-mono text-xs font-medium tracking-wider text-night-muted">THE 40 DAYS</div>
      <h1 class="m-0 text-4xl leading-[0.95] font-bold tracking-tight md:text-[56px]">40 apps. 40 days.<br />No unlock, no build.</h1>
    </div>
    <div class="flex flex-col gap-3 md:items-end">
      <div class="text-5xl leading-none font-bold tracking-tight md:text-[64px]">
        {{ dayLabel(shippedCount) }}<span class="text-night-dim">/{{ days.length }}</span>
        <span class="sr-only">shipped</span>
      </div>
      <ul class="m-0 flex list-none flex-wrap gap-4 p-0 font-mono text-[11px] text-night-muted">
        <li v-for="item in legend" :key="item.label" class="flex items-center gap-1.5">
          <span class="size-[7px] rounded-full" :class="item.dot"></span>{{ item.label }}
        </li>
      </ul>
    </div>
  </div>

  <ul class="m-0 mt-8 grid list-none grid-cols-3 gap-2.5 p-0 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-8">
    <li v-for="d in days" :key="d.day">
      <button
        type="button"
        class="relative block aspect-square w-full cursor-pointer overflow-hidden rounded-md border-0 bg-night-tile p-0 text-left text-night-text outline-offset-2 hover:outline-2 hover:outline-night-text focus-visible:outline-2 focus-visible:outline-night-text"
        :class="selected?.day === d.day && 'outline-2 outline-night-text'"
        :aria-label="`Day ${d.day}, ${statusMeta[d.status].label.toLowerCase()}: ${d.title ?? formatDayDate(d.day)}`"
        aria-haspopup="dialog"
        @click="open(d)"
      >
        <DayArt :day="d" dim />
        <span class="absolute inset-0 bg-linear-to-t from-night/90 via-night/55 via-45% to-night/0 to-75%"></span>
        <span class="absolute inset-x-2 top-2 flex items-center justify-between font-mono text-[10px] font-medium">
          <span class="rounded-xs bg-night px-1.5 py-0.5">{{ dayLabel(d.day) }}</span>
          <span class="size-2 rounded-full ring-2 ring-night" :class="statusMeta[d.status].dot"></span>
        </span>
        <span class="absolute inset-x-2.5 bottom-2.5 flex flex-col gap-1">
          <span class="text-xs leading-[1.1] font-semibold text-balance sm:text-sm">{{ d.title ?? formatDayDate(d.day) }}</span>
          <span v-if="isRevealed(d.status)" class="hidden text-[11px] leading-[1.3] text-night-sub sm:line-clamp-2">{{ d.description }}</span>
          <span v-else class="truncate font-mono text-[10px] text-night-muted">{{ d.backers.length ? `♥ ${d.backers[0].name}` : "+ sponsor" }}</span>
        </span>
      </button>
    </li>
  </ul>

  <div class="-mx-4 mt-10 flex flex-col gap-3 border-t border-night-line px-4 pt-5 font-mono text-xs text-night-muted sm:flex-row sm:items-center sm:justify-between md:-mx-12 md:px-12">
    <span v-if="topBacker">Top backer: {{ topBacker.name }} · {{ money(topBacker.total) }} across {{ topBacker.days }} {{ topBacker.days === 1 ? "day" : "days" }}</span>
    <a href="/help/offer?type=sponsor" class="text-night-text hover:text-live">Sponsor a day →</a>
  </div>

  <dialog
    ref="dialog"
    aria-label="Day details"
    class="fixed inset-x-0 top-auto bottom-0 m-0 max-h-[88dvh] w-full max-w-none overflow-y-auto overscroll-contain rounded-t-2xl border-0 bg-sheet p-0 text-ink shadow-[-20px_0_50px_rgba(0,0,0,.14)] transition-transform duration-200 backdrop:bg-ink/25 motion-reduce:transition-none starting:open:translate-y-full md:inset-y-0 md:right-0 md:left-auto md:h-full md:max-h-none md:w-[400px] md:rounded-none md:border-l md:border-line md:starting:open:translate-x-full md:starting:open:translate-y-0"
    @click="onBackdrop"
    @close="selected = null"
  >
    <DayDrawer v-if="selected" :day="selected" @close="dialog?.close()" />
  </dialog>
</template>
