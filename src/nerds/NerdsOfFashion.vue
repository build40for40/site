<script setup lang="ts">
import { ref, shallowRef } from "vue";
import AnswerChart from "./chart/AnswerChart.vue";
import { askForChart } from "./chart/client";
import type { ChartSpec } from "./chart/spec";
import TrendGlobe from "./globe/TrendGlobe.vue";
import { pickComponents } from "./intent/client";
import IntentBar from "./intent/IntentBar.vue";
import { components, type IntentResult } from "./intent/registry";

type ChartData = InstanceType<typeof AnswerChart>["$props"]["data"];

const focusTrend = ref<string | null>(null);
const focusYear = ref<number | null>(null);
const chart = shallowRef<{ spec: ChartSpec; data: ChartData } | null>(null);
const note = ref("");
let asked: AbortController | undefined;

const labelOf = (id: string) => components.find((c) => c.id === id)?.label.toLowerCase() ?? id;

function reset() {
  asked?.abort();
  chart.value = null;
  note.value = "";
}

async function resolved(result: IntentResult) {
  reset();
  const { show, comingSoon } = pickComponents(result);
  const when = result.year ?? (result.decade == null ? null : result.decade + 5);
  if (show.some((c) => c.id === "globe") || (comingSoon.length && (result.trend || when))) {
    focusTrend.value = result.trend?.id ?? null;
    focusYear.value = when;
    if (comingSoon.length) note.value = `That really wants ${labelOf(comingSoon[0].id)}, which we haven't built yet. Here it is on the globe for now.`;
    return;
  }
  asked = new AbortController();
  note.value = "Nothing ready-made for that. Drawing you a chart instead…";
  try {
    const [answer, data] = await Promise.all([askForChart(result.q, asked.signal), fetch("/nerds-of-fashion/fashion.json", { signal: asked.signal }).then((r) => r.json())]);
    if (answer.spec) {
      chart.value = { spec: answer.spec, data };
      note.value = "";
    } else note.value = answer.reason === "unanswerable" ? "Can't answer that one from this data. Try a garment, a look, a place or a decade." : "";
  } catch {
    if (!asked.signal.aborted) note.value = "";
  }
}
</script>

<template>
  <div class="flex h-full flex-col bg-night text-night-text">
    <div class="border-b border-night-line px-4 py-3">
      <div class="mx-auto max-w-3xl">
        <IntentBar label="Ask the wardrobe of history anything" @resolved="resolved" @cleared="reset" />
        <p v-if="note" role="status" class="m-0 mt-2 text-xs text-brand-yellow">{{ note }}</p>
      </div>
    </div>
    <div v-if="chart" class="min-h-0 flex-1 overflow-y-auto px-4 py-6">
      <div class="mx-auto max-w-3xl">
        <AnswerChart :spec="chart.spec" :data="chart.data" />
        <button type="button" class="mt-6 cursor-pointer rounded-full border border-night-edge bg-night-panel px-4 py-2 text-sm text-night-text hover:border-brand-lime" @click="reset">← Back to the globe</button>
      </div>
    </div>
    <div v-else class="min-h-0 flex-1">
      <TrendGlobe :focus-trend="focusTrend" :focus-year="focusYear" />
    </div>
  </div>
</template>
