<script setup lang="ts">
import { computed } from "vue";
import { isRevealed, type Day } from "../data/days";

const props = defineProps<{ day: Day; dim?: boolean }>();
const revealed = computed(() => isRevealed(props.day.status));
</script>

<template>
  <img v-if="day.image && revealed" :src="day.image" alt="" loading="lazy" class="absolute inset-0 size-full object-cover" />
  <span
    v-else
    aria-hidden="true"
    class="absolute -inset-3.5 bg-[repeating-linear-gradient(135deg,oklch(0.84_0.06_var(--hue))_0_9px,oklch(0.9_0.04_var(--hue))_9px_18px)]"
    :class="!revealed && ['blur-[9px] saturate-60', dim && 'opacity-55']"
    :style="{ '--hue': (day.day * 47) % 360 }"
  ></span>
  <svg
    v-if="!revealed"
    aria-hidden="true"
    viewBox="0 0 24 24"
    class="absolute top-1/2 left-1/2 size-5 -translate-x-1/2 -translate-y-[85%] fill-none stroke-current stroke-2 opacity-70"
  >
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
</template>
