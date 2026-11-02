import { expect, test } from "vitest";
import { buildBoard, mergedSponsors, sponsorCount, type Idea } from "./days";

const idea = (id: string, amount: number): Idea => ({ id, title: id, problem: id, sponsors: amount ? [{ name: "Anonymous", amount }] : [] });
const beforeDayOne = Date.parse("2026-10-29T12:00:00Z");

test("only merges the same named email identity, and counts anonymous payments separately", () => {
  const sponsors = [
    { name: "Ada", amount: 4, group: "email-one" },
    { name: "Ada Company", amount: 40, group: "email-one" },
    { name: "Ada", amount: 80, group: "email-two" },
    { name: "Anonymous", amount: 140, group: "email-one" },
    { name: "Anonymous", amount: 4, group: "email-one" },
    { name: "Ada", amount: 4 },
  ];
  expect(mergedSponsors(sponsors).map(({ name, amount }) => ({ name, amount }))).toEqual([
    { name: "Anonymous", amount: 140 }, { name: "Ada", amount: 80 },
    { name: "Ada", amount: 44 }, { name: "Anonymous", amount: 4 }, { name: "Ada", amount: 4 },
  ]);
  expect(sponsorCount(sponsors)).toBe(5);
  expect(sponsors[0].amount).toBe(4);
});

test("$0 problems go to the pool even while days are free, and funded ones fill the days by amount", () => {
  const board = buildBoard([idea("free", 0), idea("small", 10), idea("big", 50)], {}, beforeDayOne);
  expect(board.days.filter((d) => d.idea).map((d) => d.idea!.id)).toEqual(["big", "small"]);
  expect(board.days.filter((d) => d.status === "open").length).toBeGreaterThan(0);
  expect(board.pool.map((p) => p.idea.id)).toEqual(["free"]);
});


test("on a tie, the idea sent in first gets the earlier day", () => {
  const sent = (id: string, submittedAt: string) => ({ ...idea(id, 10), submittedAt });
  const board = buildBoard([sent("later", "2026-10-02T09:00:00.000Z"), sent("first", "2026-10-01T09:00:00.000Z")], {}, beforeDayOne);
  expect(board.days.filter((d) => d.idea).map((d) => d.idea!.id)).toEqual(["first", "later"]);
});
