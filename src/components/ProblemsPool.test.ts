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
const click = async (id: string, detail = 1) => {
  ball(id).element.dispatchEvent(new MouseEvent("click", { bubbles: true, detail }));
  await wrapper!.vm.$nextTick();
};
const point = async (id: string, type: string, pointerType: string) => {
  ball(id).element.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType, pointerId: 1 }));
  await wrapper!.vm.$nextTick();
};
const tap = async (id: string) => {
  await point(id, "pointerdown", "touch");
  await click(id);
};
const press = async (key: string) => {
  dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  await wrapper!.vm.$nextTick();
};

test("hovering with a mouse shows an idea's title and blurb, leaving hides them, and a click opens it", async () => {
  await point("a", "pointerenter", "mouse");
  expect(tip()?.textContent).toContain("Idea a");
  expect(tip()?.textContent).toContain("The problem behind a");
  expect(tip()?.textContent).toContain("Click to open it");
  expect(ball("a").attributes("aria-describedby")).toBe("pool-tip");
  await point("a", "pointerleave", "mouse");
  expect(tip()).toBeNull();

  await point("b", "pointerenter", "mouse");
  await point("b", "pointerdown", "mouse");
  await click("b");
  expect(wrapper!.emitted("pick")).toEqual([["b"]]);
  expect(tip()).toBeNull();
});

test("on touch, the first tap shows the details and a second opens it, and Escape or a tap elsewhere hides them", async () => {
  await tap("a");
  expect(tip()?.textContent).toContain("Tap again to open it");
  expect(wrapper!.emitted("pick")).toBeUndefined();
  await tap("a");
  expect(wrapper!.emitted("pick")).toEqual([["a"]]);

  await tap("b");
  await press("Escape");
  expect(tip()).toBeNull();

  await tap("a");
  document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  await wrapper!.vm.$nextTick();
  expect(tip()).toBeNull();
});

test("Enter on an idea opens it", async () => {
  await click("a", 0);
  expect(wrapper!.emitted("pick")).toEqual([["a"]]);
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

  await click("a");
  expect(wrapper!.emitted("pick")).toBeUndefined();
  await tap("a");
  expect(tip()?.textContent).toContain("Idea a");
});
