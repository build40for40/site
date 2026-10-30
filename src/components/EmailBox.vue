<script setup lang="ts">
import { useId } from "vue";

// Saves the email and carries it into the join form.
defineProps<{ label: string; button: string }>();

const id = useId();
</script>

<template>
  <form method="post" action="/api/forms/subscribe" data-opens-join class="flex min-w-0 flex-col gap-2">
    <input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" class="hidden" />
    <label :for="id" class="text-[15px] leading-snug font-semibold text-night-text">{{ label }}</label>
    <div class="flex gap-1.5">
      <input
        :id="id"
        name="email"
        type="email"
        maxlength="254"
        autocomplete="email"
        placeholder="you@example.com"
        class="min-w-0 flex-1 rounded-full border border-night-edge bg-night px-4 py-2.5 text-[15px] text-night-text placeholder:text-night-muted focus-visible:border-night-text focus-visible:outline-none"
      />
      <button
        type="submit"
        class="shrink-0 cursor-pointer rounded-full border-0 bg-brand-lime text-brand-lime-ink hover:bg-brand-lime-hover px-5 text-[15px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-lime"
      >
        {{ button }}
      </button>
    </div>
  </form>
</template>
