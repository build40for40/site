<script setup lang="ts">
import { useId } from "vue";

defineProps<{ label: string; button: string }>();

const id = useId();
</script>

<template>
  <form
    method="post"
    action="/api/forms/subscribe"
    data-sent-message="You’re on the list. Speak soon."
    class="flex min-w-0 flex-col gap-2 data-sent:*:not-[[role=status]]:hidden"
  >
    <input type="hidden" name="next" value="thanks" />
    <input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" class="hidden" />
    <label :for="id" class="text-[15px] leading-snug font-semibold text-night-text">{{ label }}</label>
    <div class="flex gap-1.5">
      <input
        :id="id"
        name="email"
        type="email"
        required
        maxlength="254"
        autocomplete="email"
        placeholder="you@example.com"
        class="min-w-0 flex-1 rounded-full border border-night-edge bg-night px-4 py-2.5 text-[15px] text-night-text placeholder:text-night-muted focus-visible:border-night-text focus-visible:outline-none"
      />
      <button
        type="submit"
        :aria-label="button"
        :title="button"
        class="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-night-text text-night hover:bg-night-sub focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-night-text"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" class="size-5 fill-none stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round]">
          <path d="M22 2 11 13" />
          <path d="M22 2 15 22l-4-9-9-4 20-7z" />
        </svg>
      </button>
    </div>
    <p role="status" class="m-0 text-[15px] leading-snug text-night-text empty:hidden"></p>
  </form>
</template>
