import { expect, test } from "vitest";
import { draw, mergedSpans, niceTicks, type Dataset } from "./draw";
import type { ChartSpec } from "./spec";

const data: Dataset = {
  meta: { years: { from: 1920, to: 2026 } },
  series: { ngramYears: { from: 1920, to: 1924 } },
  trends: [
    { id: "punk", name: "Punk", category: "subculture", periods: [{ start: 1976, end: 1980, region: "UK" }, { start: 1979, end: 1984, region: "US" }, { start: 2012, end: 2014, region: "global" }], ngram: { "en-GB": [0, 0, 3, 3, 3] }, counts: { vam: { "1977": 2, "1979": 1 }, met: { "1981": 4 } } },
    { id: "cloche", name: "Cloche hat", category: "accessory", periods: [{ start: 1922, end: 1933, region: "FR" }], ngram: null, counts: {} },
  ],
};
const spec = (overrides: Partial<ChartSpec>): ChartSpec => ({ chart: "timeline", title: "t", note: "", trends: ["punk", "cloche"], source: "books_uk", countBy: "decade", category: "", from: 1920, to: 2026, ...overrides });

test("mergedSpans joins overlapping periods from different regions", () => {
  expect(mergedSpans(data.trends[0], 1920, 2026)).toEqual([[1976, 1984], [2012, 2014]]);
});

test("a popularity chart leaves out trends the source has nothing for", () => {
  const books = draw(spec({ chart: "popularity", to: 1924 }), data);
  expect(books).toMatchObject({ kind: "lines", series: [{ id: "punk" }], missing: ["Cloche hat"] });
  const museum = draw(spec({ chart: "popularity", source: "museum" }), data);
  expect(museum?.kind === "lines" && museum.series[0].points).toEqual([{ x: 1975, y: 3 }, { x: 1985, y: 4 }]);
});

test("a count chart counts the trends in fashion per decade or per category", () => {
  const decades = draw(spec({ chart: "count", from: 1970, to: 1989 }), data);
  expect(decades).toMatchObject({ kind: "bars", bars: [{ label: "1970s", value: 1 }, { label: "1980s", value: 1 }] });
  expect(draw(spec({ chart: "count", countBy: "category", from: 1920, to: 1930 }), data)).toMatchObject({ bars: [{ label: "accessory", value: 1 }] });
});

test("niceTicks ends on a round number at or above the maximum", () => {
  expect(niceTicks(7.3)).toEqual([0, 2, 4, 6, 8]);
  expect(niceTicks(0)).toEqual([0]);
});
