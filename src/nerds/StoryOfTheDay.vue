<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { ukToday, type Nerds } from "./data";
import { viewById } from "./registry";
import { useRoute } from "./route";
import { STORIES, storyFor } from "./stories";
import ViewHost from "./ViewHost.vue";

const props = defineProps<{ nerds: Nerds }>();
const { born, go, params } = useRoute();

const story = computed(() => STORIES.find((s) => s.id === params.value.story) ?? storyFor(ukToday()));
const view = computed(() => viewById(story.value.view));
const active = ref(0);
const stepEls = ref<HTMLElement[]>([]);
const stepParams = computed(() => Object.fromEntries(Object.entries(story.value.steps[active.value]?.params ?? {}).filter(([, v]) => v !== "")));
const others = computed(() => STORIES.filter((s) => s.id !== story.value.id));
const date = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "long", day: "numeric", month: "long" }).format(new Date());

let watcher: IntersectionObserver | undefined;
onMounted(() => {
  watcher = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) if (entry.isIntersecting) active.value = Number((entry.target as HTMLElement).dataset.step);
    },
    { rootMargin: "-45% 0px -45% 0px" },
  );
  stepEls.value.forEach((el) => watcher!.observe(el));
});
onBeforeUnmount(() => watcher?.disconnect());

function read(id: string) {
  go({ story: id }, false);
  active.value = 0;
  setTimeout(() => {
    watcher?.disconnect();
    stepEls.value.forEach((el) => watcher!.observe(el));
    document.getElementById("story")?.scrollIntoView({ behavior: "smooth" });
  });
}
</script>

<template>
  <section id="story" class="mx-auto max-w-6xl px-4 pt-20">
    <p class="font-mono text-xs uppercase tracking-[0.2em] text-nof-pink">Story of the day · {{ date }}</p>
    <h2 class="mt-3 max-w-3xl font-nof-display text-4xl leading-[1.02] font-black sm:text-6xl">{{ story.title }}</h2>
    <p class="mt-3 max-w-2xl text-lg text-nof-sub">{{ story.dek }}</p>

    <div class="mt-8 grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div class="sticky top-16 z-10 overflow-hidden rounded-2xl border border-nof-line bg-nof-panel lg:order-2 lg:self-start">
        <ViewHost v-if="view" :nerds="props.nerds" :view="view" :born="born" :params="stepParams" compact />
        <p v-else class="p-10 text-center text-nof-muted">This story's chart is still getting dressed.</p>
      </div>
      <ol class="relative z-20 space-y-[40vh] pb-[20vh] lg:order-1 lg:space-y-[55vh] lg:pt-[10vh]">
        <li
          v-for="(step, i) in story.steps"
          :key="story.id + i"
          ref="stepEls"
          :data-step="i"
          class="rounded-2xl border p-5 text-lg leading-relaxed shadow-2xl transition"
          :class="active === i ? 'border-nof-pink bg-nof-raised text-nof-text' : 'border-nof-line bg-nof-panel/95 text-nof-sub'"
        >
          {{ step.text }}
        </li>
      </ol>
    </div>

    <div class="flex flex-wrap items-center gap-3 border-t border-nof-line pt-6 text-sm">
      <span class="text-nof-muted">More stories:</span>
      <button v-for="s in others" :key="s.id" type="button" class="rounded-full border border-nof-line px-3 py-1.5 text-nof-sub hover:border-nof-muted hover:text-nof-text" @click="read(s.id)">{{ s.title }}</button>
      <button v-if="view" type="button" class="ml-auto rounded-full bg-nof-text px-4 py-2 font-semibold text-nof-night" @click="go({ tab: 'explore', view: story.view, story: null })">Open {{ view.title }} →</button>
    </div>
  </section>
</template>
