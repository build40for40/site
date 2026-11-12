<script setup lang="ts">
import { onBeforeUnmount, ref, useId } from "vue";
import { createIntentResolver, pickComponents } from "./client";
import { clean } from "./query";
import { MAX_QUERY, type IntentResult } from "./registry";
import { intentEvents } from "./track";

const props = withDefaults(defineProps<{ label?: string; examples?: string[]; endpoint?: string }>(), {
  label: "Ask a century of fashion anything",
  examples: () => ["Where did punk start?", "Are flares coming back?", "What was in during the 60s?", "When were shoulder pads a thing?"],
});
const emit = defineEmits<{ resolved: [result: IntentResult]; cleared: [] }>();

const id = useId();
const query = ref("");
const state = ref<"idle" | "loading" | "error">("idle");
const input = ref<HTMLInputElement>();
const resolver = createIntentResolver({ endpoint: props.endpoint });

async function ask(example = false) {
  const q = clean(query.value);
  if (!q) return clear();
  state.value = "loading";
  intentEvents.submitted(q, example);
  const started = performance.now();
  try {
    const result = await resolver.run(q);
    if (!result) return;
    state.value = "idle";
    intentEvents.resolved(result, Math.round(performance.now() - started));
    for (const c of pickComponents(result).show) intentEvents.shown(c.id, result);
    emit("resolved", result);
  } catch (error) {
    state.value = "error";
    intentEvents.failed(error instanceof Error ? error.message : String(error), q.length);
  }
}

function tryExample(example: string) {
  query.value = example;
  ask(true);
}

function clear() {
  resolver.cancel();
  query.value = "";
  state.value = "idle";
  emit("cleared");
  input.value?.focus();
}

onBeforeUnmount(() => resolver.cancel());
</script>

<template>
  <form role="search" class="flex min-w-0 flex-col gap-3 text-nof-text" :aria-busy="state === 'loading'" @submit.prevent="ask()">
    <label :for="id" class="text-[15px] leading-snug font-semibold">{{ label }}</label>
    <div class="flex gap-1.5">
      <div class="relative min-w-0 flex-1">
        <input
          :id="id"
          ref="input"
          v-model="query"
          type="search"
          name="q"
          enterkeyhint="search"
          autocomplete="off"
          :maxlength="MAX_QUERY"
          placeholder="Where did punk start?"
          class="w-full appearance-none rounded-full border border-nof-line bg-nof-night py-2.5 pr-11 pl-4 text-base text-nof-text placeholder:text-nof-muted focus-visible:border-nof-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nof-pink [&::-webkit-search-cancel-button]:hidden"
        />
        <button
          v-if="query"
          type="button"
          aria-label="Clear the search"
          class="absolute top-1/2 right-1 grid size-9 -translate-y-1/2 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 text-nof-sub hover:text-nof-text focus-visible:outline-2 focus-visible:outline-nof-pink"
          @click="clear"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" class="size-4 fill-none stroke-current stroke-2 [stroke-linecap:round]"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>
      <button
        type="submit"
        :disabled="state === 'loading'"
        class="shrink-0 cursor-pointer rounded-full border-0 bg-nof-pink px-5 text-[15px] font-semibold text-nof-pink-ink hover:bg-nof-pink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nof-pink disabled:cursor-wait disabled:opacity-70"
      >
        Ask
      </button>
    </div>

    <ul v-if="examples.length" aria-label="Try one of these" class="m-0 flex list-none flex-wrap gap-1.5 p-0">
      <li v-for="example in examples" :key="example">
        <button
          type="button"
          data-example
          class="cursor-pointer rounded-full border border-nof-line bg-transparent px-3 py-2 text-left text-sm text-nof-sub hover:border-nof-text hover:text-nof-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nof-pink"
          @click="tryExample(example)"
        >
          {{ example }}
        </button>
      </li>
    </ul>

    <p role="status" class="m-0 min-h-5 text-sm text-nof-sub">
      <template v-if="state === 'loading'">Rummaging through 100 years of wardrobes…</template>
      <template v-else-if="state === 'error'">That one tripped over its own flares. Give it another go?</template>
    </p>
  </form>
</template>
