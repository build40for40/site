<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { FAMILIES, FIRST_YEAR, NOW_YEAR, familyOf, type Nerds, type Trend } from "./data";
import { useRoute, validBorn } from "./route";
import StoryOfTheDay from "./StoryOfTheDay.vue";
import { tunnel } from "./tunnel";

const props = defineProps<{ nerds: Nerds }>();
const { born, setBorn, go } = useRoute();

const hero = ref<HTMLElement>();
const typed = ref("");
const error = ref("");
const flying = ref(false);
const arrived = ref(false);
let machine: ReturnType<typeof tunnel> | undefined;

const milestones = computed(() => (born.value ? props.nerds.milestones(born.value) : []));
const due = computed(() => (born.value ? props.nerds.dueForYou(born.value, 3) : []));
const tooLate = computed(() => {
  if (!born.value) return [];
  const b = born.value;
  return props.nerds.trends
    .filter((t) => {
      let last = 0;
      for (let y = FIRST_YEAR; y < b; y++) if (props.nerds.presence(t, y) > 0.6) last = y;
      let after = 0;
      for (let y = b; y <= NOW_YEAR; y++) after = Math.max(after, props.nerds.presence(t, y));
      return last && b - last <= 25 && b - last >= 3 && after < 0.4;
    })
    .sort((a, b2) => props.nerds.fame(b2) - props.nerds.fame(a))
    .slice(0, 6);
});

const famColour = (t: Trend) => `var(${FAMILIES[familyOf(t.category)].token})`;
const example = (year: number, trends: Trend[]) => {
  for (const t of trends) {
    const near = t.examples.filter((e) => Math.abs(e.year - year) <= 4).sort((a, b) => Math.abs(a.year - year) - Math.abs(b.year - year))[0];
    if (near) return { ...near, trend: t.name };
  }
  return undefined;
};
const cards = computed(() =>
  milestones.value.map((m) => {
    const trends = props.nerds.top(m.year, 5, (t) => t.gender !== "men");
    return { ...m, colour: props.nerds.colour(m.year), trends, example: example(m.year, trends), pantone: props.nerds.pantone(m.year)[0], decade: props.nerds.decadeColours.get(Math.floor(m.year / 10) * 10) };
  }),
);

function signs(year: number) {
  return props.nerds.milestones(year).filter((m) => m.age > 0).map((m) => ({ year: m.year, text: m.label }));
}

async function submit() {
  const year = validBorn(typed.value.trim());
  if (!year) {
    error.value = `A year between ${FIRST_YEAR} and ${NOW_YEAR}, please. We don't judge, we just can't count that far.`;
    return;
  }
  error.value = "";
  flying.value = true;
  arrived.value = false;
  hero.value?.scrollIntoView({ behavior: "smooth" });
  machine?.fly(year, signs(year), async () => {
    setBorn(year);
    flying.value = false;
    arrived.value = true;
    await nextTick();
    setTimeout(() => document.getElementById("timeline")?.scrollIntoView({ behavior: "smooth" }), 700);
  });
}

function forget() {
  setBorn(null);
  arrived.value = false;
  typed.value = "";
  machine?.destroy();
  machine = hero.value ? tunnel(hero.value, props.nerds, { height: "min(78dvh, 720px)", label: "A tunnel of years from now back to 1920" }) : undefined;
}

onMounted(() => {
  if (!hero.value) return;
  machine = tunnel(hero.value, props.nerds, { height: "min(78dvh, 720px)", label: "A tunnel of years from now back to 1920, each ring a year in its colour, lit by that year's top trends" });
  if (born.value) machine.park(born.value);
});
onBeforeUnmount(() => machine?.destroy());
watch(born, (year) => {
  if (year && !flying.value) machine?.park(year);
});

const pct = (value: number) => `${Math.round(value * 100)}%`;
</script>

<template>
  <section class="relative">
    <div ref="hero" class="relative" />
    <div class="pointer-events-none absolute inset-0 flex flex-col justify-center px-4">
      <div class="mx-auto w-full max-w-6xl">
        <form v-if="!born && !flying" class="pointer-events-auto max-w-xl rounded-3xl bg-nof-night/70 p-5 backdrop-blur-sm sm:p-7" @submit.prevent="submit">
          <p class="font-mono text-xs uppercase tracking-[0.2em] text-nof-pink">Sabermetrics for fashion</p>
          <h1 class="mt-3 font-nof-display text-5xl leading-[0.95] font-black sm:text-7xl">What year were you <em class="text-nof-pink">born?</em></h1>
          <p class="mt-4 text-nof-sub">We'll fly you back and show you what everyone was wearing at every big moment of your life. Only your browser keeps it.</p>
          <div class="mt-5 flex gap-2">
            <label class="sr-only" for="born">Year you were born</label>
            <input
              id="born"
              v-model="typed"
              inputmode="numeric"
              autocomplete="bday-year"
              maxlength="4"
              placeholder="1988"
              class="w-32 rounded-xl border border-nof-line bg-nof-panel px-4 py-3 font-nof-display text-3xl font-bold text-nof-text placeholder:text-nof-muted"
            />
            <button type="submit" class="rounded-xl bg-nof-pink px-5 py-3 text-lg font-bold text-nof-pink-ink">Take me back</button>
          </div>
          <p v-if="error" class="mt-3 text-sm text-nof-gold" role="alert">{{ error }}</p>
          <a href="#story" class="mt-4 inline-block text-sm text-nof-muted underline hover:text-nof-text">Skip it, just give me today's story</a>
        </form>
        <div v-else-if="born && !flying" class="pointer-events-auto max-w-xl rounded-3xl bg-nof-night/70 p-5 backdrop-blur-sm sm:p-7">
          <p class="font-mono text-xs uppercase tracking-[0.2em] text-nof-pink">{{ arrived ? "You've landed" : "Welcome back" }}</p>
          <h1 class="mt-3 font-nof-display text-5xl leading-[0.95] font-black sm:text-7xl">Class of {{ born }}</h1>
          <p class="mt-3 text-nof-sub">Your life in clothes is right below. Brace yourself for the photos.</p>
          <div class="mt-4 flex flex-wrap gap-3 text-sm">
            <a href="#timeline" class="rounded-full bg-nof-text px-4 py-2 font-semibold text-nof-night">See my timeline ↓</a>
            <button type="button" class="rounded-full border border-nof-line px-4 py-2 text-nof-sub hover:text-nof-text" @click="forget">Not my year</button>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section v-if="born && !flying" id="timeline" class="mx-auto max-w-6xl scroll-mt-16 px-4 pt-16">
    <p class="font-mono text-xs uppercase tracking-[0.2em] text-nof-muted">Your life in fashion</p>
    <h2 class="mt-2 font-nof-display text-4xl font-black sm:text-6xl">What you were wearing, probably</h2>
    <p class="mt-2 max-w-2xl text-nof-sub">The women's and unisex trends that defined each big year of yours, from {{ nerds.trends.length }} trends in the archive.</p>

    <ol class="mt-10 space-y-6">
      <li v-for="m in cards" :key="m.key" class="grid overflow-hidden rounded-3xl border border-nof-line bg-nof-panel sm:grid-cols-[10rem_minmax(0,1fr)_14rem]">
        <div class="flex min-h-28 flex-col justify-between p-4 sm:min-h-full" :style="{ backgroundColor: m.colour }">
          <span class="self-start rounded-full bg-nof-night/80 px-2 py-0.5 font-mono text-xs text-nof-text">age {{ m.age }}</span>
          <span class="self-start rounded-md bg-nof-night/80 px-2 font-nof-display text-4xl font-black text-nof-text">{{ m.year }}</span>
        </div>
        <div class="p-5">
          <h3 class="font-nof-display text-2xl font-bold italic">{{ m.label }}</h3>
          <p class="text-sm text-nof-muted">{{ m.line }}</p>
          <ul class="mt-4 flex flex-wrap gap-2">
            <li v-for="(t, i) in m.trends" :key="t.id" class="flex items-center gap-2 rounded-full border border-nof-line px-3 py-1 text-sm" :class="i === 0 ? 'bg-nof-raised font-semibold' : ''">
              <span class="size-2.5 rounded-full" :style="{ backgroundColor: famColour(t) }" aria-hidden="true" />{{ t.name }}
            </li>
          </ul>
          <p v-if="m.trends[0]" class="mt-3 text-sm text-nof-sub"><span class="font-semibold text-nof-text">{{ m.trends[0].name }}:</span> {{ m.trends[0].description }}</p>
          <p class="mt-3 text-xs text-nof-muted">
            Year colour:
            <template v-if="m.pantone">Pantone's {{ m.pantone.name }}</template>
            <template v-else-if="m.decade">the {{ Math.floor(m.year / 10) * 10 }}s museum pieces lean {{ m.decade.word }}</template>
            ·
            <button type="button" class="underline hover:text-nof-text" @click="go({ view: 'board', year: String(m.year) })">See {{ m.year }} on the Big Board</button>
          </p>
        </div>
        <figure v-if="m.example" class="border-t border-nof-line sm:border-t-0 sm:border-l">
          <a :href="m.example.url" target="_blank" rel="noopener" class="block">
            <img :src="m.example.image.replace('!800,', '!400,')" :alt="`${m.example.title}, ${m.example.year}${m.example.designer ? `, by ${m.example.designer}` : ''}`" loading="lazy" class="aspect-[4/5] w-full bg-nof-raised object-cover" />
          </a>
          <figcaption class="p-2 text-[11px] leading-tight text-nof-muted">{{ m.example.title }}, {{ m.example.year }}<template v-if="m.example.designer"> · {{ m.example.designer }}</template><br />© Victoria and Albert Museum, London</figcaption>
        </figure>
      </li>
    </ol>

    <div v-if="due.length" class="mt-16">
      <h2 class="font-nof-display text-4xl font-black sm:text-5xl">Coming back for you</h2>
      <p class="mt-2 max-w-2xl text-nof-sub">Trends from your teens, and the odds they're back in the next five years, from {{ nerds.gapStats().count }} real comebacks.</p>
      <ul class="mt-6 grid gap-4 sm:grid-cols-3">
        <li v-for="d in due" :key="d.trend.id" class="rounded-3xl border border-nof-line bg-nof-panel p-5">
          <p class="font-nof-display text-6xl font-black text-nof-pink">{{ pct(d.odds) }}</p>
          <p class="mt-1 text-xl font-semibold">{{ d.trend.name }}</p>
          <p class="mt-1 text-sm text-nof-muted">Last properly on in {{ d.last }}, {{ d.since }} years ago. You were {{ d.last - born! }}.</p>
        </li>
      </ul>
    </div>

    <div v-if="tooLate.length" class="mt-16">
      <h2 class="font-nof-display text-4xl font-black sm:text-5xl">Born too late</h2>
      <p class="mt-2 max-w-2xl text-nof-sub">Peaked just before you arrived and never came back. You've probably worn one ironically.</p>
      <ul class="mt-6 flex flex-wrap gap-2">
        <li v-for="t in tooLate" :key="t.id" class="rounded-full border border-nof-line bg-nof-panel px-4 py-2" :title="t.description">{{ t.name }}</li>
      </ul>
    </div>
  </section>

  <StoryOfTheDay :nerds="nerds" />
</template>
