import { expect, test, vi } from "vitest";
import { boxGrowth, createLift, liftHeight } from "./effects";

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

test("funded boxes grow a pixel a dollar, up to a limit", () => {
  expect(boxGrowth(0)).toBe(0);
  expect(boxGrowth(0.4)).toBe(0.4);
  expect(boxGrowth(4)).toBe(4);
  expect(boxGrowth(40)).toBe(40);
  expect(boxGrowth(400)).toBe(72);
});
