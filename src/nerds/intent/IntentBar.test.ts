// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import IntentBar from "./IntentBar.vue";
import type { IntentResult } from "./registry";

const result: IntentResult = {
  q: "where did punk start?",
  components: [
    { id: "globe", score: 0.8, available: true },
    { id: "timeline", score: 0.75, available: false },
    { id: "forecast", score: 0.02, available: false },
    { id: "trend-card", score: 0.07, available: false },
  ],
  trend: { id: "punk", name: "Punk", score: 1 },
  year: null,
  decade: null,
  ms: 140,
  fallback: false,
};

let wrapper: VueWrapper | undefined;
const capture = vi.fn();
const fetcher = vi.fn();
const events = () => capture.mock.calls.map(([event]) => event);
const status = () => wrapper!.find("[role=status]").text();

beforeEach(() => {
  capture.mockClear();
  fetcher.mockReset().mockImplementation(async () => Response.json(result));
  vi.stubGlobal("fetch", fetcher);
  window.posthog = { capture };
});

afterEach(() => {
  wrapper?.unmount();
  vi.unstubAllGlobals();
  delete window.posthog;
});

test("labels the input and submits what was typed", async () => {
  wrapper = mount(IntentBar);
  const input = wrapper.find("input");
  expect(wrapper.find(`label[for="${input.attributes("id")}"]`).exists()).toBe(true);

  await input.setValue("  where did punk start? ");
  await wrapper.find("form").trigger("submit");
  expect(status()).toContain("Rummaging");
  await flushPromises();

  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ q: "where did punk start?" });
  expect(wrapper.emitted("resolved")).toEqual([[result]]);
  expect(status()).toBe("");
  expect(events()).toEqual(["fashion_search_submitted", "fashion_intent_resolved", "fashion_component_wanted", "fashion_component_shown"]);
  expect(capture.mock.calls[0][1]).toMatchObject({ example: false });
});

test("a tapped example fills the input and asks straight away", async () => {
  wrapper = mount(IntentBar, { props: { examples: ["Are flares coming back?"] } });
  await wrapper.find("[data-example]").trigger("click");
  await flushPromises();

  expect(wrapper.find("input").element.value).toBe("Are flares coming back?");
  expect(wrapper.emitted("resolved")).toHaveLength(1);
  expect(capture.mock.calls[0]).toEqual(["fashion_search_submitted", { query: "Are flares coming back?", query_length: 23, example: true }]);
});

test("says so when it fails, and emits nothing", async () => {
  fetcher.mockImplementation(async () => new Response("", { status: 502 }));
  wrapper = mount(IntentBar);
  await wrapper.find("input").setValue("punk");
  await wrapper.find("form").trigger("submit");
  await flushPromises();

  expect(status()).toContain("another go");
  expect(wrapper.emitted("resolved")).toBeUndefined();
  expect(events()).toEqual(["fashion_search_submitted", "fashion_intent_failed"]);
});

test("clearing empties the input and tells the page", async () => {
  wrapper = mount(IntentBar);
  await wrapper.find("input").setValue("punk");
  await wrapper.find("[aria-label='Clear the search']").trigger("click");

  expect(wrapper.find("input").element.value).toBe("");
  expect(wrapper.emitted("cleared")).toHaveLength(1);
  expect(fetcher).not.toHaveBeenCalled();
});
