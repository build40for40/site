<script setup lang="ts">
import { ref } from "vue";
import { links } from "../data/site";

const src = ref("");

function load() {
  const params = new URLSearchParams({ channel: links.twitchChannel, parent: location.hostname, muted: "true" });
  src.value = `https://player.twitch.tv/?${params}`;
}
</script>

<template>
  <div class="relative aspect-video overflow-hidden rounded-lg bg-night">
    <iframe v-if="src" :src="src" title="40 for 40 live on Twitch" allowfullscreen class="absolute inset-0 size-full border-0"></iframe>
    <div v-else class="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
      <button
        type="button"
        class="cursor-pointer rounded-full border-0 bg-accent px-5 py-3 text-[15px] font-semibold text-white hover:bg-accent-deep"
        @click="load"
      >▶ Load the stream</button>
      <p class="m-0 max-w-xs font-mono text-[11px] text-night-muted">Loads the Twitch player, which sets Twitch cookies.</p>
    </div>
  </div>
</template>
