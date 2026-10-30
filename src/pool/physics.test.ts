// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from "vitest";
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

function setup(width = W, height = H, boiling = false) {
  const container = document.createElement("ul");
  const size = { width, height };
  Object.defineProperty(container, "clientWidth", { get: () => size.width });
  Object.defineProperty(container, "clientHeight", { get: () => size.height });
  container.getBoundingClientRect = () => ({ left: 0, top: 0, right: size.width, bottom: size.height, width: size.width, height: size.height, x: 0, y: 0, toJSON() {} });
  document.body.append(container);
  controller = initializePhysics(container, { autoStart: false, autoPause: false, boiling });
  const add = (id: string, spawn: { x: number; y: number }) => {
    const element = document.createElement("li");
    element.innerHTML = `<button type="button">${id}</button>`;
    container.append(element);
    controller!.registerBody(id, element, { ...TILE, spawn });
    return element;
  };
  return { container, add, size, controller };
}

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

  test("hover at a height, turn upright, and drop back when it's cleared", () => {
    const { add, controller } = setup();
    const element = add("a", { x: 200, y: H - 30 });
    controller.advance(1);
    controller.setBodyHover("a", 100);
    controller.advance(3);
    const held = controller.bodyState("a")!;
    expect(held.y).toBeCloseTo(100, -1);
    expect(Math.abs(held.angle)).toBeLessThan(0.01);
    expect(element.dataset.arrived).toBe("");
    controller.setBodyHover("a", null);
    controller.advance(3);
    expect(controller.bodyState("a")!.y).toBeGreaterThan(H - TILE.height);
    expect(element.dataset.arrived).toBeUndefined();
  });

  test("stay inside when the pool shrinks, hovering or not", () => {
    const { add, size, controller } = setup();
    add("a", { x: 350, y: H - 30 });
    add("b", { x: 100, y: H - 30 });
    controller.advance(1);
    controller.setBodyHover("b", 40);
    controller.advance(2);
    size.width = 200;
    size.height = 150;
    controller.resize();
    controller.advance(2);
    for (const id of ["a", "b"]) {
      const { x, y } = controller.bodyState(id)!;
      expect(x).toBeLessThanOrEqual(200 - TILE.width / 2 + 1);
      expect(y).toBeLessThanOrEqual(150 - TILE.height / 2 + 1);
      expect(y).toBeGreaterThanOrEqual(TILE.height / 2 - 1);
    }
  });
});

describe("lively", () => {
  const pile = (controller: PhysicsController, add: (id: string, at: { x: number; y: number }) => HTMLElement) => {
    for (let i = 0; i < 8; i++) add(`p${i}`, { x: 50 + (i % 4) * 100, y: H - 30 - Math.floor(i / 4) * 62 });
    controller.advance(3);
    return () => Array.from({ length: 8 }, (_, i) => controller.bodyState(`p${i}`)!).filter((b) => b.vy < -50).length;
  };

  test("the lava burps a resting idea out of the pile every so often", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const { add, controller } = setup(W, H, true);
    let burps = 0;
    const rising = pile(controller, add);
    for (let i = 0; i < 300; i++) {
      controller.advance(1 / 60);
      burps += rising() ? 1 : 0;
    }
    vi.restoreAllMocks();
    expect(burps).toBeGreaterThan(0);
  });

  test("a nudge twitches one idea, and back to back nudges don't add up", () => {
    const { add, controller } = setup();
    const rising = pile(controller, add);
    expect(rising()).toBe(0);
    controller.nudge();
    controller.nudge();
    expect(rising()).toBe(1);
  });

  test("a held idea waits until it's dropped in, then splashes the ones it lands near", () => {
    const { container, add, controller } = setup();
    const rising = pile(controller, add);
    const element = document.createElement("li");
    container.append(element);
    controller.registerBody("sent", element, { ...TILE, delayMs: Infinity });
    controller.advance(1);
    expect(controller.bodyState("sent")!.shown).toBe(false);

    controller.drop("sent", { x: 150, y: 40 }, { x: 0, y: 520 });
    expect(element.style.opacity).toBe("");
    let splashed = 0;
    for (let i = 0; i < 60 && !splashed; i++) {
      controller.advance(1 / 60);
      splashed = rising();
    }
    expect(splashed).toBeGreaterThan(1);
  });
});

test("destroy cleans up every idea and listener", () => {
  const { container, add, controller } = setup();
  const element = add("a", { x: 100, y: 100 });
  controller.advance(0.2);
  controller.destroy();
  expect(element.style.transform).toBe("");
  expect(element.dataset.bodyId).toBeUndefined();
  expect(() => container.dispatchEvent(new FocusEvent("focusin"))).not.toThrow();
  controller.destroy();
});
