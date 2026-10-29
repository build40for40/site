import { afterEach, describe, expect, test, vi } from "vitest";
import { createSearchEffects, slotPositions } from "./effects";

const layout = () => ({ width: 400, tile: { width: 100, height: 60 } });
const fake = () => ({ applyImpulse: vi.fn(), wake: vi.fn(), setBodyTarget: vi.fn(), setBodyGravityScale: vi.fn(), setBodyScale: vi.fn() });
afterEach(() => vi.useRealTimers());
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
  test("spring grows matches and pulls them to slots in rank order, under room for their label", () => {
    const controller = fake();
    const small = () => ({ width: 400, tile: { width: 30, height: 30 } });
    createSearchEffects(controller, small, "spring").apply(matches);
    expect(controller.setBodyTarget.mock.calls.map(([id, at, o]) => [id, at, o.mode])).toEqual([
      ["a", { x: 38, y: 56 }, "spring"],
      ["b", { x: 106, y: 56 }, "spring"],
    ]);
    expect(controller.setBodyScale.mock.calls).toEqual([["a", 2], ["b", 2]]);
  });

  test("spring sends matches off in waves, best first, and only as many as fit", () => {
    vi.useFakeTimers();
    const controller = fake();
    const many = Array.from({ length: 30 }, (_, i) => ({ id: `m${i}`, score: 1 - i / 30 }));
    createSearchEffects(controller, () => ({ width: 400, tile: { width: 30, height: 30 } }), "spring").apply(many);
    expect(controller.setBodyTarget.mock.calls.map(([id]) => id)).toEqual(["m0", "m1", "m2"]);
    vi.advanceTimersByTime(70);
    expect(controller.setBodyTarget).toHaveBeenCalledTimes(6);
    vi.runAllTimers();
    expect(controller.setBodyTarget).toHaveBeenCalledTimes(10);
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
    expect(controller.setBodyScale).toHaveBeenCalledWith("c", 1);
  });
});
