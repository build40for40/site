// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from "vitest";
import { initializePhysics, type PhysicsController } from "./physics";

const W = 400;
const H = 400;
const TILE = { width: 100, height: 60 };

let controller: PhysicsController | undefined;
afterEach(() => {
  controller?.destroy();
  controller = undefined;
  document.body.innerHTML = "";
});

function setup(width = W, height = H) {
  const container = document.createElement("ul");
  const size = { width, height };
  Object.defineProperty(container, "clientWidth", { get: () => size.width });
  Object.defineProperty(container, "clientHeight", { get: () => size.height });
  container.getBoundingClientRect = () => ({ left: 0, top: 0, right: size.width, bottom: size.height, width: size.width, height: size.height, x: 0, y: 0, toJSON() {} });
  document.body.append(container);
  controller = initializePhysics(container, { autoStart: false, autoPause: false });
  const add = (id: string, spawn: { x: number; y: number }) => {
    const element = document.createElement("li");
    element.innerHTML = `<button type="button">${id}</button>`;
    container.append(element);
    controller!.registerBody(id, element, { ...TILE, spawn });
    return element;
  };
  return { container, add, size, controller };
}

const pointer = (target: EventTarget, type: string, pointerType: string, clientX: number, clientY: number) =>
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType, pointerId: pointerType === "mouse" ? 1 : 2, clientX, clientY, button: 0 }));

describe("bodies", () => {
  test("fall under gravity and rest on the floor", () => {
    const { add, controller } = setup();
    const element = add("a", { x: 200, y: 40 });
    controller.advance(3);
    const state = controller.bodyState("a")!;
    expect(state.y).toBeCloseTo(H - TILE.height / 2, -1);
    expect(element.style.transform).toMatch(/^translate3d\(/);
  });

  test("collide instead of overlapping", () => {
    const { add, controller } = setup();
    add("low", { x: 200, y: 200 });
    add("high", { x: 200, y: 100 });
    controller.advance(4);
    const low = controller.bodyState("low")!;
    const high = controller.bodyState("high")!;
    expect(Math.abs(low.y - high.y) + Math.abs(low.x - high.x)).toBeGreaterThan(TILE.height * 0.8);
  });

  test("slide sideways when gravity tilts", () => {
    const { add, controller } = setup();
    add("a", { x: 100, y: 300 });
    controller.setGravity({ x: 20, y: 5 });
    controller.advance(3);
    expect(controller.bodyState("a")!.x).toBeGreaterThan(W - TILE.width);
  });

  test("roll when they're circles", () => {
    const { container, controller } = setup();
    const element = document.createElement("li");
    container.append(element);
    controller.registerBody("ball", element, { shape: "circle", width: 60, height: 60, spawn: { x: 60, y: H - 30 } });
    controller.setGravity({ x: 20, y: 20 });
    let turned = 0;
    for (let i = 0; i < 60; i++) {
      const before = controller.bodyState("ball")!.angle;
      controller.advance(1 / 60);
      turned += Math.atan2(Math.sin(controller.bodyState("ball")!.angle - before), Math.cos(controller.bodyState("ball")!.angle - before));
    }
    expect(controller.bodyState("ball")!.y).toBeCloseTo(H - 30, -1);
    expect(Math.abs(turned)).toBeGreaterThan(Math.PI);
  });

  test("never go faster than the cap", () => {
    const { add, controller } = setup();
    add("a", { x: 200, y: 200 });
    controller.advance(0.1);
    controller.applyImpulse("a", { x: 500, y: 0 });
    controller.advance(1 / 60);
    const { vx, vy } = controller.bodyState("a")!;
    expect(Math.hypot(vx, vy)).toBeLessThanOrEqual(30 * 50 + 1);
  });

  test("rain in one after another", () => {
    const { container, controller } = setup();
    const element = document.createElement("li");
    container.append(element);
    controller.registerBody("late", element, { ...TILE, delayMs: 500 });
    expect(element.style.opacity).toBe("0");
    controller.advance(0.2);
    expect(controller.bodyState("late")!.shown).toBe(false);
    controller.advance(0.4);
    expect(controller.bodyState("late")!.shown).toBe(true);
    expect(element.style.opacity).toBe("");
  });

  test("wait for a gap at the top before dropping in", () => {
    const { container, controller } = setup(120, 400);
    for (const id of ["one", "two"]) {
      const element = document.createElement("li");
      container.append(element);
      controller.registerBody(id, element, TILE);
    }
    expect(controller.bodyState("one")!.shown).toBe(true);
    expect(controller.bodyState("two")!.shown).toBe(false);
    controller.advance(2);
    expect(controller.bodyState("two")!.shown).toBe(true);
    expect(controller.bodyState("one")!.y - controller.bodyState("two")!.y).toBeGreaterThan(TILE.height * 0.9);
  });

  test("stay inside when the pool shrinks", () => {
    const { add, size, controller } = setup();
    add("a", { x: 350, y: 300 });
    controller.advance(1);
    size.width = 200;
    controller.resize();
    controller.advance(1);
    expect(controller.bodyState("a")!.x).toBeLessThanOrEqual(200 - TILE.width / 2 + 1);
  });

  test("spring towards a target and fall back when it's cleared", () => {
    const { add, controller } = setup();
    add("a", { x: 200, y: 340 });
    controller.advance(1);
    controller.setBodyTarget("a", { x: 100, y: 60 });
    controller.advance(3);
    const held = controller.bodyState("a")!;
    expect(Math.hypot(held.x - 100, held.y - 60)).toBeLessThan(5);
    controller.setBodyTarget("a", null);
    controller.advance(3);
    expect(controller.bodyState("a")!.y).toBeGreaterThan(H - TILE.height);
  });
});

describe("pointer", () => {
  test("the mouse passes over ideas without pushing them", () => {
    const { container, add, controller } = setup();
    add("a", { x: 200, y: H - 30 });
    controller.enablePointerInteraction(true);
    controller.advance(1);
    const before = controller.bodyState("a")!.x;
    for (let x = 60; x <= 340; x += 10) {
      pointer(container, "pointermove", "mouse", x, H - 30);
      controller.advance(1 / 30);
    }
    expect(controller.bodyState("a")!.x).toBeCloseTo(before, 0);
  });

  test("dragging moves an idea, and letting go throws it", () => {
    const { container, add, controller } = setup();
    const element = add("a", { x: 100, y: H - 30 });
    controller.enablePointerInteraction(true);
    controller.advance(1);
    const button = element.querySelector("button")!;
    pointer(button, "pointerdown", "mouse", 100, H - 30);
    for (let i = 1; i <= 10; i++) {
      pointer(container, "pointermove", "mouse", 100 + i * 20, H - 30 - i * 20);
      controller.advance(1 / 60);
    }
    expect(element.dataset.dragging).toBe("");
    controller.advance(0.3);
    const held = controller.bodyState("a")!;
    expect(held.y).toBeLessThan(H - 100);
    for (let i = 1; i <= 6; i++) {
      pointer(container, "pointermove", "mouse", 300 - i * 25, 170);
      controller.advance(1 / 60);
    }
    pointer(container, "pointerup", "mouse", 150, 170);
    expect(element.dataset.dragging).toBeUndefined();
    controller.advance(1 / 60);
    expect(controller.bodyState("a")!.vx).toBeLessThan(-100);
  });

  test("a drag doesn't count as a click, a tap does", () => {
    const { container, add, controller } = setup();
    const element = add("a", { x: 100, y: H - 30 });
    controller.enablePointerInteraction(true);
    const button = element.querySelector("button")!;
    let clicks = 0;
    button.addEventListener("click", () => clicks++);

    pointer(button, "pointerdown", "mouse", 100, H - 30);
    pointer(container, "pointermove", "mouse", 160, H - 60);
    pointer(container, "pointerup", "mouse", 160, H - 60);
    button.click();
    expect(clicks).toBe(0);

    pointer(button, "pointerdown", "mouse", 100, H - 30);
    pointer(button, "pointerup", "mouse", 101, H - 30);
    button.click();
    expect(clicks).toBe(1);
  });

  test("a vertical swipe on a phone is left to scroll the page", () => {
    const { container, add, controller } = setup();
    const element = add("a", { x: 100, y: H - 30 });
    controller.enablePointerInteraction(true);
    pointer(element.querySelector("button")!, "pointerdown", "touch", 100, H - 30);
    pointer(container, "pointermove", "touch", 102, H - 120);
    expect(element.dataset.dragging).toBeUndefined();
    pointer(container, "pointercancel", "touch", 102, H - 120);
  });

  test("a sideways swipe on a phone grabs the idea", () => {
    const { container, add, controller } = setup();
    const element = add("a", { x: 100, y: H - 30 });
    controller.enablePointerInteraction(true);
    pointer(element.querySelector("button")!, "pointerdown", "touch", 100, H - 30);
    pointer(container, "pointermove", "touch", 150, H - 34);
    expect(element.dataset.dragging).toBe("");
  });
});

test("destroy cleans up every idea and listener", () => {
  const { container, add, controller } = setup();
  const element = add("a", { x: 100, y: 100 });
  controller.advance(0.2);
  controller.destroy();
  expect(element.style.transform).toBe("");
  expect(element.dataset.bodyId).toBeUndefined();
  expect(() => pointer(container, "pointermove", "mouse", 10, 10)).not.toThrow();
  controller.destroy();
});
