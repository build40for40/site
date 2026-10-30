import { expect, test, vi } from "vitest";
import { boxScale, createLift, liftHeight } from "./effects";

const band = { height: 300, tile: 30 };

test("a score maps to a height between the floor and the top, and weak matches stay in the pile", () => {
  const options = { label: 20, minRelevance: 0.34 };
  expect(liftHeight(1, band, options)).toBe(35);
  expect(liftHeight(0.5, band, options)).toBe(160);
  expect(liftHeight(0.34, band, options)).toBeCloseTo(200);
  expect(liftHeight(0.33, band, options)).toBeNull();
  expect(liftHeight(0, band, options)).toBeNull();
});

test("lifting new matches drops the ones that no longer match", () => {
  const controller = { setBodyHover: vi.fn() };
  const lift = createLift(controller, () => band);
  lift.apply([
    { id: "a", score: 1 },
    { id: "b", score: 0.6 },
    { id: "c", score: 0.1 },
  ]);
  expect(controller.setBodyHover.mock.calls.map(([id]) => id)).toEqual(["a", "b"]);
  controller.setBodyHover.mockClear();
  lift.apply([{ id: "b", score: 0.9 }]);
  expect(controller.setBodyHover.mock.calls).toEqual([
    ["b", expect.any(Number)],
    ["a", null],
  ]);
  controller.setBodyHover.mockClear();
  lift.clear();
  expect(controller.setBodyHover.mock.calls).toEqual([["b", null]]);
});

test("funded boxes grow with the money behind them, up to twice as wide at £400", () => {
  expect(boxScale(0)).toBe(1);
  expect(boxScale(40)).toBe(1.32);
  expect(boxScale(100)).toBe(1.5);
  expect(boxScale(400)).toBe(2);
  expect(boxScale(1000)).toBe(2);
});
