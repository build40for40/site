import { expect, test } from "vitest";
import { buildBoard, type Idea } from "./days";

const idea = (id: string, amount: number): Idea => ({ id, title: id, problem: id, sponsors: amount ? [{ name: "Anonymous", amount }] : [] });
const beforeDayOne = Date.parse("2026-10-29T12:00:00Z");

test("£0 problems go to the pool even while days are free, and funded ones fill the days by amount", () => {
  const board = buildBoard([idea("free", 0), idea("small", 10), idea("big", 50)], {}, beforeDayOne);
  expect(board.days.filter((d) => d.idea).map((d) => d.idea!.id)).toEqual(["big", "small"]);
  expect(board.days.filter((d) => d.status === "open").length).toBeGreaterThan(0);
  expect(board.pool.map((p) => p.idea.id)).toEqual(["free"]);
});

test("a problem sent in by someone sponsoring it holds the next free day while the payment catches up", () => {
  const board = buildBoard([idea("free", 0), { ...idea("mine", 0), pledged: true }, idea("big", 50)], {}, beforeDayOne);
  expect(board.days.filter((d) => d.idea).map((d) => d.idea!.id)).toEqual(["big", "mine"]);
  expect(board.pool.map((p) => p.idea.id)).toEqual(["free"]);
});

test("when the days are full, a problem sent in by someone sponsoring it takes the last one and bumps the lowest funded into the pool", () => {
  const funded = Array.from({ length: 40 }, (_, i) => idea(`funded-${i}`, 100 - i));
  const board = buildBoard([...funded, { ...idea("mine", 0), pledged: true }], {}, beforeDayOne);
  const taken = board.days.filter((d) => d.idea).map((d) => d.idea!.id);
  expect(taken).toHaveLength(34);
  expect(taken.at(-1)).toBe("mine");
  expect(board.pool[0].idea.id).toBe("funded-33");
});
