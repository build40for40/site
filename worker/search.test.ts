import { describe, expect, test, vi } from "vitest";
import type { Classifier } from "./classifier";
import { ftsQuery, rankCandidates, retrieveCandidates, searchIdeas, type Candidate } from "./search";
import { addProblem, testDb } from "./test-db";

function seeded() {
  const { db, sqlite } = testDb();
  const parking = addProblem(sqlite, { title: "Parking ticket dread", problem: "Photograph a parking sign and get a plain yes or no." });
  const bins = addProblem(sqlite, { title: "Bin day confusion", problem: "Which bin goes out tonight? Avoid a parking fine for the bin lorry." });
  addProblem(sqlite, { title: "Lost keys", problem: "A cheap tag and a map." });
  return { db, parking, bins };
}

const fakeClassifier = (scores: Record<string, number>, onAsk = vi.fn()): Classifier => ({
  version: "test-1",
  async ask(state, questions) {
    onAsk(state, questions);
    const ideas = (state as { ideas: Record<string, { title: string }> }).ideas;
    return {
      model: "test-1",
      answers: Object.fromEntries(Object.entries(ideas).map(([key, idea]) => [key, { type: "score" as const, score: scores[idea.title] ?? 0, confidence: 0.9 }])),
    };
  },
});

describe("ftsQuery", () => {
  test("quotes every word so typed text can't use FTS5 syntax", () => {
    expect(ftsQuery('park" OR NEAR(xy) *')).toBe('"park"* OR "near"* OR "xy"*');
    expect(ftsQuery("  !!! ")).toBeNull();
  });
});

describe("retrieveCandidates", () => {
  test("finds lexical matches with title hits first", async () => {
    const { db, parking, bins } = seeded();
    const candidates = await retrieveCandidates("parking", { db });
    expect(candidates.map((c) => c.id)).toEqual([parking, bins]);
    expect(candidates[0].score).toBe(1);
  });

  test("ignores hostile input", async () => {
    const { db } = seeded();
    await expect(retrieveCandidates('")) NOT 1=1 --', { db })).resolves.toEqual([]);
  });
});

describe("rankCandidates", () => {
  const candidates = [
    { id: "a", title: "Alpha", problem: "First", score: 1, email: "leak@example.com", owner: "Ada", sponsors: [{ name: "Bo", amount: 5 }] },
    { id: "b", title: "Beta", problem: "Second", score: 0.5 },
  ] as Candidate[];

  test("reorders by classifier relevance and drops weak matches", async () => {
    const matches = await rankCandidates("query", candidates, { classifier: fakeClassifier({ Alpha: 0.3, Beta: 3 }) });
    expect(matches).toEqual([{ id: "b", score: 1 }]);
  });

  test("sends only the search and each idea's title and problem", async () => {
    const onAsk = vi.fn();
    await rankCandidates("query", candidates, { classifier: fakeClassifier({}, onAsk) });
    const [state] = onAsk.mock.calls[0];
    expect(state).toEqual({ search: "query", ideas: { idea_0: { title: "Alpha", problem: "First" }, idea_1: { title: "Beta", problem: "Second" } } });
  });
});

describe("searchIdeas", () => {
  test("ranks with the classifier when it's there", async () => {
    const { db, parking, bins } = seeded();
    const result = await searchIdeas("parking", { db, classifier: fakeClassifier({ "Bin day confusion": 3, "Parking ticket dread": 2 }) });
    expect(result).toEqual({ ranking: "classifier", matches: [{ id: bins, score: 1 }, { id: parking, score: 2 / 3 }] });
  });

  test("falls back to the lexical ranking when the classifier is down", async () => {
    const { db, parking, bins } = seeded();
    const down: Classifier = { version: "x", ask: () => Promise.reject(new Error("503")) };
    const result = await searchIdeas("parking", { db, classifier: down });
    expect(result.ranking).toBe("lexical");
    expect(result.matches.map((m) => m.id)).toEqual([parking, bins]);
  });

  test("works without a classifier at all", async () => {
    const { db, parking } = seeded();
    expect((await searchIdeas("ticket", { db })).matches).toEqual([{ id: parking, score: 1 }]);
  });

  test("reuses cached classifier results", async () => {
    const { db } = seeded();
    const store = new Map<string, Response>();
    const cache = {
      match: async (r: Request) => store.get(r.url)?.clone(),
      put: async (r: Request, res: Response) => void store.set(r.url, res),
    } as unknown as Cache;
    const onAsk = vi.fn();
    const classifier = fakeClassifier({ "Parking ticket dread": 3 }, onAsk);
    const first = await searchIdeas("parking", { db, classifier, cache });
    const second = await searchIdeas("Parking!", { db, classifier, cache });
    expect(second).toEqual(first);
    expect(onAsk).toHaveBeenCalledTimes(1);
  });
});
