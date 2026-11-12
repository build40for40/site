<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { Nerds } from "./data";
import { EXAMPLES, renderSpec, type Spec } from "./drawSpec";
import { useRoute } from "./route";

const props = defineProps<{ nerds: Nerds }>();

const MAX = 300;
const question = ref("");
const busy = ref(false);
const error = ref("");
const spec = ref<Spec>(EXAMPLES[0].spec);
const asked = ref(EXAMPLES[0].question);
const svg = computed(() => renderSpec(props.nerds, spec.value));

const ideas = [
  "What would my nan have worn to a party in 1958?",
  "Show me every hat trend as a glowing clock",
  "Did punk or goth last longer?",
  "When did make-up trends go wild?",
  "Which shoes keep coming back?",
];

async function draw(text = question.value) {
  const q = text.trim();
  if (!q) return;
  question.value = q;
  busy.value = true;
  error.value = "";
  try {
    const response = await fetch("/api/nerds-of-fashion/draw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q }),
    });
    const body = (await response.json().catch(() => ({}))) as { spec?: Spec; error?: string };
    if (!response.ok || !body.spec) throw new Error(body.error || "Claude dropped the pencil. Try again.");
    spec.value = body.spec;
    asked.value = q;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    busy.value = false;
  }
}

const { params } = useRoute();
watch(
  () => params.value.q,
  (q) => {
    if (q && q !== asked.value) draw(q);
  },
  { immediate: true },
);

function example(i: number) {
  spec.value = EXAMPLES[i].spec;
  asked.value = EXAMPLES[i].question;
  error.value = "";
}

function download() {
  const blob = new Blob([svg.value], { type: "image/svg+xml" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `nerds-of-fashion-${spec.value.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.svg`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
</script>

<template>
  <section class="mx-auto grid max-w-6xl gap-8 px-4 pt-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
    <div>
      <p class="font-mono text-xs uppercase tracking-[0.2em] text-nof-pink">Ask Claude</p>
      <h1 class="mt-2 font-nof-display text-5xl leading-[0.95] font-black sm:text-6xl">Draw your own infographic</h1>
      <p class="mt-4 text-nof-sub">Ask anything about a hundred years of fashion. Claude picks the trends and the chart, then we draw it from the real data, so it can't make numbers up.</p>

      <form class="mt-6" @submit.prevent="draw()">
        <label for="ask" class="sr-only">Your question</label>
        <textarea
          id="ask"
          v-model="question"
          :maxlength="MAX"
          rows="3"
          placeholder="When did trainers stop being for sport?"
          class="w-full resize-none rounded-2xl border border-nof-line bg-nof-panel p-4 text-lg text-nof-text placeholder:text-nof-muted"
          @keydown.enter.exact.prevent="draw()"
        />
        <div class="mt-2 flex items-center justify-between gap-3">
          <span class="font-mono text-xs text-nof-muted">{{ question.length }} / {{ MAX }}</span>
          <button type="submit" :disabled="busy || !question.trim()" class="rounded-xl bg-nof-pink px-5 py-3 font-bold text-nof-pink-ink disabled:opacity-50">
            {{ busy ? "Sketching…" : "Draw it" }}
          </button>
        </div>
        <p v-if="error" class="mt-3 text-sm text-nof-gold" role="alert">{{ error }}</p>
      </form>

      <p class="mt-8 text-sm font-semibold">Need a nudge?</p>
      <ul class="mt-2 flex flex-wrap gap-2">
        <li v-for="idea in ideas" :key="idea">
          <button type="button" class="rounded-full border border-nof-line px-3 py-1.5 text-left text-sm text-nof-sub hover:border-nof-muted hover:text-nof-text" :disabled="busy" @click="draw(idea)">{{ idea }}</button>
        </li>
      </ul>

      <p class="mt-8 text-sm font-semibold">Or flick through some we made earlier</p>
      <ul class="mt-2 space-y-2">
        <li v-for="(e, i) in EXAMPLES" :key="e.question">
          <button type="button" class="w-full rounded-xl border px-4 py-3 text-left text-sm transition" :class="asked === e.question ? 'border-nof-pink bg-nof-raised' : 'border-nof-line bg-nof-panel hover:border-nof-muted'" @click="example(i)">
            “{{ e.question }}”
          </button>
        </li>
      </ul>
    </div>

    <div class="lg:sticky lg:top-20 lg:self-start">
      <p class="mb-2 text-sm text-nof-muted">You asked: <span class="text-nof-sub">“{{ asked }}”</span></p>
      <div class="overflow-hidden rounded-2xl border border-nof-line transition" :class="busy ? 'opacity-40 blur-[2px]' : ''" aria-live="polite" v-html="svg" />
      <div class="mt-3 flex flex-wrap gap-2 text-sm">
        <button type="button" class="rounded-full bg-nof-text px-4 py-2 font-semibold text-nof-night" @click="download">Download it</button>
        <span class="self-center text-nof-muted">Portrait, made for your story.</span>
      </div>
    </div>
  </section>
</template>
