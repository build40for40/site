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
      :title="title"
      class="absolute inset-0 flex cursor-pointer flex-col gap-0.5 overflow-hidden rounded-md border-0 bg-night-tile px-2 pt-2 pb-1.5 text-left text-night-text hover:brightness-115 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
      :class="[
        status === 'open' && 'border-[1.5px] border-dashed border-night-line bg-transparent hover:border-night-edge',
        status === 'pool' && 'bg-night-panel ring-1 ring-night-line ring-inset',
        today && ['ring-2', tones[status].ring],
        selected && 'outline-2 outline-offset-2 outline-action',
      ]"
      @click="$emit('select')"
    >
      <span v-if="status !== 'open' && status !== 'pool'" aria-hidden="true" class="absolute inset-x-0 top-0 h-[3px]" :class="tones[status].dot"></span>
      <span v-if="number" class="font-mono text-[11px] font-medium" :class="status === 'open' ? 'text-night-muted' : 'text-night-sub'">{{ pad(number) }}</span>
      <span v-if="title" class="line-clamp-2 text-xs leading-[1.15] font-semibold">{{ title }}</span>
      <span v-if="sub" class="mt-auto truncate font-mono text-[11px] font-medium text-night-sub">{{ sub }}</span>
      <svg v-if="status === 'guest'" aria-hidden="true" viewBox="0 0 24 24" class="absolute right-2 bottom-2 size-3.5 fill-none stroke-current stroke-2 opacity-70">
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
    </button>
    <button
      v-if="sponsorLabel"
      type="button"
      :aria-label="sponsorLabel"
      class="absolute top-1 right-1 z-1 grid size-5 cursor-pointer place-items-center rounded-full border border-night-text/30 bg-night/40 p-0 font-mono text-[11px] text-night-text hover:border-night-text hover:bg-night-text hover:text-night focus-visible:border-night-text focus-visible:bg-night-text focus-visible:text-night focus-visible:outline-none"
      @click="$emit('sponsor')"
    >↑</button>
  </li>
</template>
