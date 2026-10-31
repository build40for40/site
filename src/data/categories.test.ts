import { expect, test } from "vitest";
import { categoriesOf } from "./categories";

test("a problem is in every category it fits, best first, up to three", () => {
  expect(categoriesOf({ fun: 0.75, kids: 0.98, learning: 0.9, food: 0.71, health: 0.69 })).toEqual(["kids", "learning", "fun"]);
});

test("a sorted problem that fits nothing is other, and an unsorted one has no categories yet", () => {
  expect(categoriesOf({ health: 0.69 })).toEqual(["other"]);
  expect(categoriesOf({})).toEqual(["other"]);
  expect(categoriesOf(null)).toBeUndefined();
});

test("scores for categories that are no longer on the list don't count", () => {
  expect(categoriesOf({ pets: 0.99 })).toEqual(["other"]);
});
