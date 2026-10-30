// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import BrowsePanel from "./BrowsePanel.vue";
import type { Entry } from "../data/days";

const idea = (id: string, title: string, amount = 0) => ({ id, title, problem: title, sponsors: amount ? [{ name: "Anonymous", amount }] : [] });
const entries: Entry[] = [
  { key: "day-1", day: 1, status: "shipped", idea: idea("a", "Splitting rent fairly", 110) },
  { key: "day-2", day: 2, status: "queued", idea: idea("b", "Dog walking swaps", 40) },
  { key: "pool-c", status: "pool", idea: idea("c", "Pet medication reminders") },
  { key: "pool-d", status: "pool", idea: idea("d", "Noisy group chats") },
];

let wrapper: VueWrapper | undefined;
let ranking = "classifier";

beforeEach(() => {
  ranking = "classifier";
  vi.stubGlobal("fetch", async () => Response.json({ ranking, matches: [{ id: "c", score: 0.9 }, { id: "b", score: 0.6 }, { id: "d", score: 0.1 }] }));
});

afterEach(() => {
  wrapper?.unmount();
  vi.unstubAllGlobals();
});

const titles = () => wrapper!.findAll("ul button").map((b) => b.text());
const chip = (label: string) => wrapper!.findAll("[role=group] button").find((b) => b.text().startsWith(label))!;

test("the chips show each kind of idea with its count, and hide kinds with none", async () => {
  wrapper = mount(BrowsePanel, { props: { entries: entries.filter((e) => e.status !== "shipped"), selected: "day-2" } });
  expect(wrapper.findAll("[role=group] button").map((b) => b.text())).toEqual(["Everything 3", "Coming up 1", "Simmering 2", "Needs a sponsor 2"]);
  await chip("Simmering").trigger("click");
  expect(titles().map((t) => t.match(/Pet|Noisy/)![0])).toEqual(["Pet", "Noisy"]);
});

test("searching shows word matches straight away, then the classifier's ranking with how well each one fits", async () => {
  wrapper = mount(BrowsePanel, { props: { entries, selected: "day-1" } });
  await wrapper.find("input").setValue("dog walks");
  expect(titles()).toHaveLength(1);
  expect(titles()[0]).toContain("Dog walking swaps");

  await vi.waitFor(() => expect(titles()).toHaveLength(2), { timeout: 2000 });
  expect(titles()[0]).toContain("Pet medication reminders");
  expect(titles()[0]).toContain("90%");
});

test("the lexical fallback keeps every match and shows no percentages", async () => {
  ranking = "lexical";
  wrapper = mount(BrowsePanel, { props: { entries, selected: "day-1" } });
  await wrapper.find("input").setValue("dog walks");
  await vi.waitFor(() => expect(titles()).toHaveLength(3), { timeout: 2000 });
  expect(titles().join()).not.toContain("%");
});

test("picking a problem selects it, and Escape clears the search before closing", async () => {
  wrapper = mount(BrowsePanel, { props: { entries, selected: "day-1" } });
  await wrapper.findAll("ul button")[2].trigger("click");
  expect(wrapper.emitted("select")).toEqual([["pool-c"]]);

  await wrapper.find("input").setValue("rent");
  await wrapper.find("input").trigger("keydown", { key: "Escape" });
  expect((wrapper.find("input").element as HTMLInputElement).value).toBe("");
  expect(wrapper.emitted("close")).toBeUndefined();
  await wrapper.find("input").trigger("keydown", { key: "Escape" });
  await flushPromises();
  expect(wrapper.emitted("close")).toHaveLength(1);
});
