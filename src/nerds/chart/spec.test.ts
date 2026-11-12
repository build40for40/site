import { expect, test } from "vitest";
import { cleanSpec } from "./spec";

const known = { ids: new Set(["punk", "grunge"]), categories: new Set(["subculture", "garment"]), years: { from: 1920, to: 2026 } };
const raw = { answerable: true, chart: "timeline", title: "Punk and grunge", note: "", trends: ["punk", "grunge", "punk", "nope"], source: "books_uk", countBy: "decade", category: "hats", from: 1900, to: 2040 };

test("cleanSpec drops unknown trends and categories, and clamps years to the dataset", () => {
  expect(cleanSpec(raw, known)).toMatchObject({ trends: ["punk", "grunge"], category: "", from: 1920, to: 2026 });
});

test("cleanSpec keeps a runway chart inside the years the catwalk data covers", () => {
  expect(cleanSpec({ ...raw, chart: "popularity", source: "runway", from: 1950, to: 2026 }, known)).toMatchObject({ from: 1988, to: 2024 });
});

test("cleanSpec refuses an unknown chart, a missing title, or a count chart's stray trends", () => {
  expect(cleanSpec({ ...raw, chart: "pie" }, known)).toBeNull();
  expect(cleanSpec({ ...raw, title: " " }, known)).toBeNull();
  expect(cleanSpec({ ...raw, chart: "count" }, known)?.trends).toEqual([]);
});
