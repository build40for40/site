<script setup lang="ts">
import { pad, tones, type EntryStatus } from "../data/days";

defineProps<{
  status: EntryStatus;
  label: string;
  selected: boolean;
  number?: number;
  title?: string;
  sub?: string;
  today?: boolean;
  compact?: boolean;
  sponsorLabel?: string;
}>();
defineEmits<{ select: []; sponsor: [] }>();
</script>

<template>
  <li class="relative">
    <button
      type="button"
      :aria-label="label"
      :aria-pressed="selected"
      class="absolute inset-0 flex cursor-pointer flex-col gap-1.5 overflow-hidden rounded-lg border-0 bg-night-tile bg-linear-155 p-2 text-left text-night-text hover:brightness-115 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-night-text sm:gap-2 sm:px-4 sm:py-3.5"
      :class="[
        tones[status].glow,
        status === 'open' && 'border-[1.5px] border-dashed border-night-line bg-transparent hover:border-night-edge',
        status === 'pool' && 'bg-night-panel ring-1 ring-night-line ring-inset',
        today && ['ring-2', tones[status].ring],
        selected && 'outline-2 outline-offset-2 outline-night-text',
      ]"
      @click="$emit('select')"
    >
      <span v-if="number" class="font-mono text-xs font-medium" :class="status === 'open' ? 'text-night-muted' : 'text-night-sub'">{{ pad(number) }}</span>
      <span
        v-if="title"
        class="line-clamp-2 text-[13px] leading-[1.15] font-semibold text-balance sm:text-[15px]"
        :class="[compact && 'hidden sm:block', sponsorLabel && !number && 'pr-8']"
      >{{ title }}</span>
      <span v-if="sub" class="mt-auto font-mono text-[11px] font-medium text-night-sub" :class="compact && 'hidden sm:block'">{{ sub }}</span>
      <svg
        v-if="status === 'guest'"
        aria-hidden="true"
        viewBox="0 0 24 24"
        class="absolute right-3.5 bottom-3.5 size-4 fill-none stroke-current stroke-2 opacity-70"
        :class="compact && 'hidden sm:block'"
      >
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
    </button>
    <button
      v-if="sponsorLabel"
      type="button"
      :aria-label="sponsorLabel"
      class="absolute top-2 right-2 z-1 size-6.5 cursor-pointer place-items-center rounded-full border border-night-text/30 bg-night/40 p-0 font-mono text-[13px] text-night-text hover:border-night-text hover:bg-night-text hover:text-night focus-visible:border-night-text focus-visible:bg-night-text focus-visible:text-night focus-visible:outline-none sm:top-3 sm:right-3"
      :class="compact ? 'hidden sm:grid' : 'grid'"
      @click="$emit('sponsor')"
    >↑</button>
  </li>
</template>
