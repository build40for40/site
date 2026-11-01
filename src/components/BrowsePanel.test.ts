// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import BrowsePanel, { type Floated } from "./BrowsePanel.vue";
import type { EntryStatus, Idea } from "../data/days";

const idea = (id: string, title: string, amount = 0): Idea => ({ id, title, problem: title, sponsors: amount ? [{ name: "Anonymous", amount }] : [] });
const unsorted = [idea("a", "Splitting rent fairly"), idea("b", "Dog walking swaps", 40), idea("c", "Pet medication reminders", 25), idea("d", "Noisy group chats")];
const sorted = unsorted.map((i, n) => ({ ...i, categories: [["finance"], ["community", "home"], ["home"], ["other"]][n] }));
const statuses: Record<string, EntryStatus> = { a: "pool", b: "queued", c: "shipped", d: "pool" };

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

const floated = () => wrapper!.emitted<[Floated | null]>("float")?.at(-1)?.[0];
const ids = () => floated()?.matches.map((m) => m.id);
const category = () => wrapper!.find("select");
const categories = () => category().findAll("option").map((o) => o.text());
const stages = () => wrapper!.findAll("[aria-label=Show] button");

test("the category dropdown appears once problems are sorted, and picking one floats all of its problems up", async () => {
  wrapper = mount(BrowsePanel, { props: { ideas: unsorted, statuses } });
  expect(category().exists()).toBe(false);

  await wrapper.setProps({ ideas: sorted });
  expect(categories()).toEqual(["All categories", "Finance (1)", "Home (2)", "Friends & community (1)", "Other (1)"]);
  await category().setValue("home");
  expect(floated()).toEqual({ matches: [{ id: "b", score: 1 }, { id: "c", score: 1 }] });
  expect(wrapper.find("[role=status]").classes()).toContain("sr-only");
  expect(wrapper.text()).toContain("2 problems float up");

  await category().findAll("option")[0].setValue();
  expect(floated()).toBeNull();
});

test("status chips float the problems at that stage, counted within the picked category", async () => {
  wrapper = mount(BrowsePanel, { props: { ideas: sorted, statuses } });
  expect(stages().map((b) => b.text())).toEqual(["Unfunded 2", "Sponsored 2", "Scheduled 1", "Shipped 1"]);
  await stages()[2].trigger("click");
  expect(floated()).toEqual({ matches: [{ id: "b", score: 1 }] });
  expect(categories()).toEqual(["All categories", "Home (1)", "Friends & community (1)"]);

  await stages()[2].trigger("click");
  await category().setValue("finance");
  expect(stages().map((b) => b.text())).toEqual(["Unfunded 1"]);
});

test("searching floats word matches straight away, then the classifier's matches by how well they fit", async () => {
  wrapper = mount(BrowsePanel, { props: { ideas: sorted, statuses } });
  await wrapper.find("input").setValue("dog walks");
  expect(floated()).toEqual({ ranking: "lexical", matches: [{ id: "b", score: 1 }] });

  await vi.waitFor(() => expect(floated()?.ranking).toBe("classifier"), { timeout: 2000 });
  expect(ids()).toEqual(["c", "b"]);
});

test("the lexical fallback floats the stronger word matches without the classifier's ranking", async () => {
  ranking = "lexical";
  wrapper = mount(BrowsePanel, { props: { ideas: sorted, statuses } });
  await wrapper.find("input").setValue("dog walks");
  await vi.waitFor(() => expect(ids()).toEqual(["c", "b"]), { timeout: 2000 });
  expect(floated()?.ranking).toBe("lexical");
});

test("a category narrows a search, and a search of only filler words floats nothing", async () => {
  wrapper = mount(BrowsePanel, { props: { ideas: sorted, statuses } });
  await wrapper.find("input").setValue("dog walks");
  await vi.waitFor(() => expect(floated()?.ranking).toBe("classifier"), { timeout: 2000 });
  await category().setValue("finance");
  expect(floated()?.matches).toEqual([]);
  expect(wrapper.text()).toContain("Nothing in the pool like that yet");

  await category().findAll("option")[0].setValue();
  await wrapper.find("input").setValue("how do I");
  expect(floated()).toBeNull();
});

test("Escape clears the search before closing", async () => {
  wrapper = mount(BrowsePanel, { props: { ideas: sorted, statuses } });
  await wrapper.find("input").setValue("rent");
  await wrapper.find("input").trigger("keydown", { key: "Escape" });
  expect((wrapper.find("input").element as HTMLInputElement).value).toBe("");
  expect(wrapper.emitted("close")).toBeUndefined();
  await wrapper.find("input").trigger("keydown", { key: "Escape" });
  await flushPromises();
  expect(wrapper.emitted("close")).toHaveLength(1);
});
