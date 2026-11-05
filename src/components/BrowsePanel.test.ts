// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import BrowsePanel from "./BrowsePanel.vue";
import type { EntryStatus, Idea } from "../data/days";

const idea = (id: string, title: string, amount = 0, day = 1): Idea => ({
  id,
  title,
  problem: title,
  sponsors: amount ? [{ name: "Anonymous", amount }] : [],
  submittedAt: `2026-10-0${day}T09:00:00.000Z`,
});
const unsorted = [idea("a", "Splitting rent fairly", 0, 4), idea("b", "Dog walking swaps", 40, 2), idea("c", "Pet medication reminders", 25, 3), idea("d", "Noisy group chats", 0, 1)];
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

const docked = () => wrapper!.emitted<[string[] | null]>("dock")?.at(-1)?.[0];
const ids = () => wrapper!.findAll("[data-row]").map((row) => row.attributes("data-row"));
const category = () => wrapper!.find("select");
const categories = () => category().findAll("option").map((o) => o.text());
const stages = () => wrapper!.findAll("[aria-label=Show] button");

test("lists every problem newest first, and docks each one's ball beside its row", async () => {
  wrapper = mount(BrowsePanel, { props: { ideas: sorted, statuses } });
  await flushPromises();
  expect(ids()).toEqual(["a", "c", "b", "d"]);
  expect(docked()).toEqual(["a", "c", "b", "d"]);
  expect(wrapper.findAll("[data-pool-dock]").map((slot) => slot.attributes("data-pool-dock"))).toEqual(["a", "c", "b", "d"]);
  expect(wrapper.text()).toContain("4 problems, newest first");
});

test("pages through the list, docking only the page that's showing", async () => {
  const many = Array.from({ length: 19 }, (_, i) => ({ ...idea(`i${i}`, `Idea ${i}`), submittedAt: new Date(Date.UTC(2026, 9, 1, i)).toISOString() }));
  wrapper = mount(BrowsePanel, { props: { ideas: many, statuses: {} } });
  await flushPromises();
  expect(ids()).toHaveLength(8);
  expect(ids()[0]).toBe("i18");
  expect(wrapper.text()).toContain("Page 1 of 3");
  const [previous, next] = wrapper.findAll("[aria-label=Pages] button");
  expect(previous.attributes("disabled")).toBeDefined();
  await next.trigger("click");
  await next.trigger("click");
  await flushPromises();
  expect(ids()).toEqual(["i2", "i1", "i0"]);
  expect(docked()).toEqual(["i2", "i1", "i0"]);
  expect(next.attributes("disabled")).toBeDefined();
});

test("opening a problem replaces the list with it and docks just its ball, and Back or Escape goes back to the list", async () => {
  wrapper = mount(BrowsePanel, { props: { ideas: sorted, statuses, "onUpdate:open": (id: string | null) => wrapper!.setProps({ open: id }) } });
  await wrapper.find("[data-row=b]").trigger("click");
  await flushPromises();
  expect(wrapper.find("[aria-label=Problems]").exists()).toBe(false);
  expect(wrapper.find("h3").text()).toBe("Dog walking swaps");
  expect(wrapper.text()).toContain("$40 from 1 sponsor");
  expect(wrapper.text()).toContain("Sponsor it");
  expect(docked()).toEqual(["b"]);

  await wrapper.find("button").trigger("click");
  await flushPromises();
  expect(ids()).toEqual(["a", "c", "b", "d"]);
  expect(docked()).toEqual(["a", "c", "b", "d"]);

  await wrapper.setProps({ open: "c" });
  await wrapper.find("h3").trigger("keydown", { key: "Escape" });
  await flushPromises();
  expect(wrapper.props("open")).toBeNull();
  expect(wrapper.emitted("close")).toBeUndefined();

  await wrapper.setProps({ open: "a" });
  await wrapper.findAll("button").find((b) => b.text() === "Sponsor it")!.trigger("click");
  expect(wrapper.emitted("pick")).toEqual([["a"]]);
});

test("the category dropdown appears once problems are sorted, and picking one lists just its problems", async () => {
  wrapper = mount(BrowsePanel, { props: { ideas: unsorted, statuses } });
  expect(category().exists()).toBe(false);

  await wrapper.setProps({ ideas: sorted });
  expect(categories()).toEqual(["All categories", "Finance (1)", "Home (2)", "Friends & community (1)", "Other (1)"]);
  await category().setValue("home");
  expect(ids()).toEqual(["c", "b"]);
  expect(wrapper.text()).toContain("2 problems, newest first");

  await category().findAll("option")[0].setValue();
  expect(ids()).toHaveLength(4);
});

test("status chips list the problems at that stage, counted within the picked category", async () => {
  wrapper = mount(BrowsePanel, { props: { ideas: sorted, statuses } });
  expect(stages().map((b) => b.text())).toEqual(["Unfunded 2", "Sponsored 2", "Scheduled 1", "Shipped 1"]);
  await stages()[2].trigger("click");
  expect(ids()).toEqual(["b"]);
  expect(categories()).toEqual(["All categories", "Home (1)", "Friends & community (1)"]);

  await stages()[2].trigger("click");
  await category().setValue("finance");
  expect(stages().map((b) => b.text())).toEqual(["Unfunded 1"]);
});

test("searching lists word matches straight away, then the classifier's matches by how well they fit", async () => {
  wrapper = mount(BrowsePanel, { props: { ideas: sorted, statuses } });
  await wrapper.find("input").setValue("dog walks");
  expect(ids()).toEqual(["b"]);
  expect(wrapper.text()).not.toContain("%");

  await vi.waitFor(() => expect(ids()).toEqual(["c", "b"]), { timeout: 2000 });
  expect(wrapper.text()).toContain("best match first");
  expect(wrapper.find("[data-row=c]").text()).toContain("90%");
});

test("the lexical fallback lists the stronger word matches without a percentage", async () => {
  ranking = "lexical";
  wrapper = mount(BrowsePanel, { props: { ideas: sorted, statuses } });
  await wrapper.find("input").setValue("dog walks");
  await vi.waitFor(() => expect(ids()).toEqual(["c", "b"]), { timeout: 2000 });
  expect(wrapper.text()).not.toContain("%");
});

test("a category narrows a search, and a search of only filler words lists everything", async () => {
  wrapper = mount(BrowsePanel, { props: { ideas: sorted, statuses } });
  await wrapper.find("input").setValue("dog walks");
  await vi.waitFor(() => expect(ids()).toEqual(["c", "b"]), { timeout: 2000 });
  await category().setValue("finance");
  expect(ids()).toEqual([]);
  expect(wrapper.text()).toContain("Nothing in the pool like that yet");

  await category().findAll("option")[0].setValue();
  await wrapper.find("input").setValue("how do I");
  expect(ids()).toHaveLength(4);
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
