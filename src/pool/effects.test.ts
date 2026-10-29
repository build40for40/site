import { describe, expect, test, vi } from "vitest";
import { createSearchEffects, slotPositions } from "./effects";

const layout = () => ({ width: 400, tile: { width: 100, height: 60 } });
const fake = () => ({ applyImpulse: vi.fn(), wake: vi.fn(), setBodyTarget: vi.fn(), setBodyGravityScale: vi.fn() });
const matches = [
  { id: "a", score: 1 },
  { id: "b", score: 0.5 },
];

test("slots fill rows left to right, top first", () => {
  expect(slotPositions(4, layout(), 10)).toEqual([
    { x: 60, y: 40 },
    { x: 170, y: 40 },
    { x: 280, y: 40 },
    { x: 60, y: 110 },
  ]);
});

describe("createSearchEffects", () => {
  test("spring pulls matches to slots in rank order", () => {
    const controller = fake();
    createSearchEffects(controller, layout, "spring").apply(matches);
    expect(controller.setBodyTarget.mock.calls.map(([id, at, o]) => [id, at, o.mode])).toEqual([
      ["a", { x: 58, y: 38 }, "spring"],
      ["b", { x: 166, y: 38 }, "spring"],
    ]);
  });

  test("impulse kicks matches upwards, harder for better matches", () => {
    const controller = fake();
    createSearchEffects(controller, layout, "impulse").apply(matches);
    const [[, first], [, second]] = controller.applyImpulse.mock.calls;
    expect(first.y).toBeLessThan(second.y);
    expect(second.y).toBeLessThan(0);
  });

  test("attract pulls matches towards the top centre for a while", () => {
    const controller = fake();
    createSearchEffects(controller, layout, "attract").apply(matches);
    expect(controller.setBodyTarget).toHaveBeenCalledWith("a", { x: 200, y: 30 }, expect.objectContaining({ mode: "force", durationMs: 2500 }));
  });

  test("gravity and wake only touch matches", () => {
    const gravity = fake();
    createSearchEffects(gravity, layout, "gravity").apply(matches);
    expect(gravity.setBodyGravityScale.mock.calls).toEqual([["a", -0.4], ["b", -0.4]]);
    const wake = fake();
    createSearchEffects(wake, layout, "wake").apply(matches);
    expect(wake.wake.mock.calls).toEqual([["a"], ["b"]]);
  });

  test("clearing lets everything fall back to normal physics", () => {
    const controller = fake();
    const effects = createSearchEffects(controller, layout, "spring");
    effects.apply(matches);
    effects.apply([{ id: "c", score: 1 }]);
    expect(controller.setBodyTarget).toHaveBeenCalledWith("a", null);
    effects.clear();
    expect(controller.setBodyTarget).toHaveBeenCalledWith("c", null);
    expect(controller.setBodyGravityScale).toHaveBeenCalledWith("c", 1);
  });
});
