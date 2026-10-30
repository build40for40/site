<script setup lang="ts">
import { computed, ref } from "vue";

const props = defineProps<{ label: string; text: string; url: string; expanded?: boolean }>();

const open = ref(props.expanded);
const copied = ref(false);

const targets = computed(() => {
  const url = encodeURIComponent(props.url);
  const text = encodeURIComponent(props.text);
  return [
    { label: "WhatsApp", href: `https://wa.me/?text=${text}%20${url}` },
    { label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${url}` },
    { label: "X", href: `https://x.com/intent/post?text=${text}&url=${url}` },
  ];
});

const track = (via: string) => window.posthog?.capture("idea_shared", { via });

// Phones get their own share sheet; everywhere else gets the links.
async function share() {
  if (navigator.share && matchMedia("(pointer: coarse)").matches) {
    await navigator.share({ text: props.text, url: props.url }).catch(() => {});
    track("native");
    return;
  }
  open.value = !open.value;
}

async function copy() {
  await navigator.clipboard.writeText(props.url);
  copied.value = true;
  track("copy");
  setTimeout(() => (copied.value = false), 2000);
}

const pill =
  "cursor-pointer rounded-full border border-night-edge bg-night/60 px-3 py-1.5 font-mono text-xs font-medium text-night-text no-underline hover:border-night-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action";
</script>

<template>
  <div class="flex flex-wrap items-center gap-1.5">
    <button type="button" :aria-expanded="open" :class="pill" @click="share">↗ {{ label }}</button>
    <template v-if="open">
      <button type="button" :class="pill" @click="copy">{{ copied ? "Copied" : "Copy link" }}</button>
      <a
        v-for="t in targets"
        :key="t.label"
        :href="t.href"
        target="_blank"
        rel="noopener"
        :class="pill"
        @click="track(t.label)"
      >{{ t.label }}</a>
    </template>
  </div>
</template>
