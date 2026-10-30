// @vitest-environment happy-dom
import { mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import ProblemsPool from "./ProblemsPool.vue";

const held = vi.hoisted(() => ({ grabbed: [] as string[], released: 0 }));
vi.mock("../pool/physics", () => ({
  initializePhysics: () => ({
    registerBody() {},
    unregisterBody() {},
    setBodyHover() {},
    nudge() {},
    refit() {},
    grab: (id: string) => held.grabbed.push(id) > 0,
    drag() {},
    release: () => held.released++,
    destroy() {},
  }),
}));

const tiles = ["a", "b"].map((id) => ({ key: id, id, title: `Idea ${id}`, problem: `The problem behind ${id}`, label: `Unfunded: Idea ${id}`, raised: 0 }));

let wrapper: VueWrapper | undefined;
beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  held.grabbed.length = 0;
  held.released = 0;
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  wrapper = mount(ProblemsPool, { props: { tiles }, attachTo: document.body });
});

afterEach(() => {
  wrapper?.unmount();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

const ball = (id: string) => wrapper!.find(`[data-pool-ball='${id}']`);
const tip = () => document.querySelector("#pool-tip");
const tap = async (id: string) => {
  ball(id).element.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
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
  expect(ball("a").attributes("aria-describedby")).toBe("pool-tip");

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
  ball("a").element.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 }));
  await wrapper!.vm.$nextTick();
  expect(tip()?.textContent).toContain("Idea a");
});

test("stays shut while there's nothing in the pool, and opens once ideas arrive", async () => {
  wrapper!.unmount();
  wrapper = mount(ProblemsPool, { props: { tiles: [] }, attachTo: document.body });
  expect(wrapper.classes()).toContain("hidden");
  await wrapper.setProps({ tiles });
  expect(wrapper.classes()).not.toContain("hidden");
  await vi.waitFor(() => expect(wrapper!.find("section").classes()).not.toContain("invisible"));
});

test("click and hold picks an idea up to throw, and the click that lets go of it isn't a tap", async () => {
  await vi.waitFor(() => expect(wrapper!.find("li").classes()).not.toContain("opacity-0"));
  const pointer = (type: string, clientX: number) => ball("a").element.dispatchEvent(new PointerEvent(type, { bubbles: true, button: 0, pointerId: 1, clientX, clientY: 10 }));
  pointer("pointerdown", 10);
  pointer("pointermove", 40);
  expect(held.grabbed).toEqual(["a"]);
  pointer("pointerup", 40);
  expect(held.released).toBe(1);

  await tap("a");
  expect(tip()).toBeNull();
  await tap("a");
  expect(tip()?.textContent).toContain("Idea a");
});
