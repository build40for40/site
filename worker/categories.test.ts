import { describe, expect, test, vi } from "vitest";
import { CATEGORIES_VERSION, categories } from "../src/data/categories";
import { categoriseBacklog, categoriseProblem, verdict } from "./categories";
import type { Classifier } from "./classifier";
import { listProblems } from "./problems";
import { addProblem, testDb } from "./test-db";

const fakeClassifier = (scores: Record<string, number>, ask = vi.fn()): Classifier => ({
  version: "test-1",
  async ask(state, questions) {
    ask(state, questions);
    return { model: "jev-test", answers: Object.fromEntries(Object.keys(questions).map((key) => [key, { type: "noul" as const, noul: scores[key] ?? 0.05 }])) };
  },
});

const categoriesOf = async (db: D1Database, id: string) => (await listProblems(db, { offset: 0, limit: 60 })).ideas.find((i) => i.id === id)?.categories;

describe("categoriseProblem", () => {
  test("asks one yes or no per category, plus whether it's sincere, about the title and problem only", async () => {
    const { db, sqlite } = testDb();
    const id = addProblem(sqlite, { problem: "Help my kid learn to type with cats.", email: "parent@example.com", name: "Ada Example" });
    const ask = vi.fn();
    await categoriseProblem(db, fakeClassifier({ kids: 0.95, learning: 0.8, sincere: 0.9 }, ask), id);

    const [state, questions] = ask.mock.calls[0];
    expect(Object.keys(questions)).toEqual([...categories.map((c) => c.key), "sincere"]);
    expect(Object.values(questions).every((q) => (q as { type: string }).type === "noul")).toBe(true);
    expect(JSON.stringify(state)).not.toMatch(/@|Ada/);
    expect(await categoriesOf(db, id)).toEqual(["kids", "learning"]);
    expect(sqlite.prepare("SELECT categorised_by, categories_version, sincere FROM problems WHERE id = ?").get(id)).toEqual({
      categorised_by: "jev-test",
      categories_version: CATEGORIES_VERSION,
      sincere: 0.9,
    });
  });

  test("puts problems that fit nothing in other", async () => {
    const { db, sqlite } = testDb();
    const id = addProblem(sqlite, { problem: "My nails are always chipped." });
    await categoriseProblem(db, fakeClassifier({ health: 0.25, sincere: 0.8 }), id);
    expect(await categoriesOf(db, id)).toEqual(["other"]);
  });

  test("leaves problems the team sorted by hand alone", async () => {
    const { db, sqlite } = testDb();
    const id = addProblem(sqlite);
    sqlite.prepare("UPDATE problems SET categorised_by = 'team' WHERE id = ?").run(id);
    const ask = vi.fn();
    await categoriseProblem(db, fakeClassifier({}, ask), id);
    expect(ask).not.toHaveBeenCalled();
    expect(await categoriesOf(db, id)).toEqual(["other"]);
  });
});

describe("categoriseBacklog", () => {
  test("sorts problems that were never sorted or were sorted against an older list, and carries on past failures", async () => {
    const { db, sqlite } = testDb();
    const fresh = addProblem(sqlite, { problem: "Fresh" });
    const stale = addProblem(sqlite, { problem: "Stale" });
    const broken = addProblem(sqlite, { problem: "Broken" });
    const current = addProblem(sqlite, { problem: "Current" });
    const team = addProblem(sqlite, { problem: "Team" });
    sqlite.prepare("UPDATE problems SET categorised_by = 'jev-old', categories_version = ? WHERE id = ?").run(CATEGORIES_VERSION - 1, stale);
    sqlite.prepare("UPDATE problems SET categorised_by = 'jev-test', categories_version = ? WHERE id = ?").run(CATEGORIES_VERSION, current);
    sqlite.prepare("UPDATE problems SET categorised_by = 'team' WHERE id = ?").run(team);

    const seen: string[] = [];
    const classifier = fakeClassifier({ food: 0.9 }, (state: { idea: { problem: string } }) => {
      seen.push(state.idea.problem);
      if (state.idea.problem === "Broken") throw new Error("timed out");
    });
    const report = vi.fn();

    expect(await categoriseBacklog(db, classifier, { report })).toEqual({ sorted: 2, tried: 3 });
    expect(seen).toEqual(["Fresh", "Stale", "Broken"]);
    expect(report.mock.calls.map(([id]) => id)).toEqual([fresh, stale]);
    expect(await categoriesOf(db, broken)).toBeUndefined();
  });
});

test("verdict says whether a problem fits, is worth a look, or fits nothing", () => {
  const scores = (best: number) => ({ ...Object.fromEntries(categories.map((c) => [c.key, 0.1])), food: best });
  expect(verdict({ scores: scores(0.9), sincere: 0.95 })).toEqual({ categories: ["food"], fit: "fits", best: 0.9, sincere: 0.95 });
  expect(verdict({ scores: scores(0.4), sincere: 0.9 })).toMatchObject({ categories: ["other"], fit: "unsure" });
  expect(verdict({ scores: scores(0.2), sincere: 0.1 })).toMatchObject({ categories: ["other"], fit: "none", sincere: 0.1 });
});
