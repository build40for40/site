// @vitest-environment happy-dom
import { mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import ProblemsPool from "./ProblemsPool.vue";

vi.mock("../pool/physics", () => ({ initializePhysics: () => ({ registerBody() {}, unregisterBody() {}, setBodyHover() {}, nudge() {}, destroy() {} }) }));

const tiles = ["a", "b"].map((id) => ({ key: id, id, title: `Idea ${id}`, problem: `The problem behind ${id}`, label: `Unfunded: Idea ${id}` }));

let wrapper: VueWrapper | undefined;
beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("min-height"), addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  wrapper = mount(ProblemsPool, { props: { tiles }, attachTo: document.body });
});

afterEach(() => {
  wrapper?.unmount();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

const circle = (id: string) => wrapper!.find(`[data-pool-circle='${id}']`);
const tip = () => document.querySelector("#pool-tip");
const tap = async (id: string) => {
  circle(id).element.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
  await wrapper!.vm.$nextTick();
};
const press = async (key: string) => {
  dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  await wrapper!.vm.$nextTick();
};

test("a tap shows the idea's title and blurb, and a second tap, Escape or a tap elsewhere hides it", async () => {
  await tap("a");
  expect(tip()?.textContent).toContain("Idea a");
  expect(tip()?.textContent).toContain("The problem behind a");
  expect(circle("a").attributes("aria-describedby")).toBe("pool-tip");

  await tap("a");
  expect(tip()).toBeNull();

  await tap("b");
  expect(tip()?.textContent).toContain("Idea b");
  await press("Escape");
  expect(tip()).toBeNull();

  await tap("a");
  document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  await wrapper!.vm.$nextTick();
  expect(tip()).toBeNull();
});

test("Enter on a focused idea opens its tooltip rather than closing it", async () => {
  await tap("a");
  circle("a").element.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 }));
  await wrapper!.vm.$nextTick();
  expect(tip()?.textContent).toContain("Idea a");
});
