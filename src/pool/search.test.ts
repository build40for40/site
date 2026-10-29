import { describe, expect, test, vi } from "vitest";
import { createSearch, retrieveCandidates, searchIdeas, tokenize } from "./search";

const ideas = [
  { id: "parking", title: "Parking ticket dread", problem: "Is this sign a yes or a no?" },
  { id: "bins", title: "Bin day confusion", problem: "Which bin goes out, and where do I park the car?" },
  { id: "keys", title: "Lost keys", problem: "A cheap tag and a map." },
];

test("tokenize keeps words only", () => {
  expect(tokenize('  Café  "parking" OR park! ')).toEqual(["cafe", "parking", "or", "park"]);
});

describe("retrieveCandidates", () => {
  test("ranks title matches above problem matches", () => {
    expect(retrieveCandidates("park", { ideas })).toEqual([
      { id: "parking", score: 1 },
      { id: "bins", score: 1 / 3 },
    ]);
  });

  test("an empty query matches nothing", () => {
    expect(retrieveCandidates(" ?! ", { ideas })).toEqual([]);
  });
});

describe("searchIdeas", () => {
  test("uses the Worker's ranking and ignores ideas this page doesn't have", async () => {
    const fetcher = vi.fn(async () => Response.json({ ranking: "classifier", matches: [{ id: "bins", score: 1 }, { id: "elsewhere", score: 0.9 }] }));
    const result = await searchIdeas("bins", { ideas, fetcher });
    expect(result).toEqual({ query: "bins", ranking: "classifier", matches: [{ id: "bins", score: 1 }] });
    expect(String(fetcher.mock.calls[0][0])).toBe("/api/pool/search?q=bins");
  });

  test("falls back to lexical search when the Worker fails", async () => {
    const result = await searchIdeas("park", { ideas, fetcher: async () => new Response("", { status: 500 }) });
    expect(result.ranking).toBe("lexical");
    expect(result.matches[0].id).toBe("parking");
  });

  test("falls back when the network is down or too slow", async () => {
    const down = await searchIdeas("park", { ideas, fetcher: () => Promise.reject(new TypeError("offline")) });
    expect(down.ranking).toBe("lexical");
    const hang = (_: unknown, init?: RequestInit) => new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal!.reason)));
    const slow = await searchIdeas("park", { ideas, fetcher: hang as typeof fetch, timeoutMs: 20 });
    expect(slow.ranking).toBe("lexical");
  });
});

test("createSearch drops stale results", async () => {
  const resolvers: ((r: Response) => void)[] = [];
  const fetcher = (_: unknown, init?: RequestInit) =>
    new Promise<Response>((resolve, reject) => {
      resolvers.push(resolve);
      init?.signal?.addEventListener("abort", () => reject(init.signal!.reason));
    });
  const search = createSearch({ ideas: () => ideas, fetcher: fetcher as typeof fetch });

  const first = search.run("park");
  const second = search.run("bins");
  resolvers[1](Response.json({ ranking: "lexical", matches: [{ id: "bins", score: 1 }] }));

  expect(await first).toBeNull();
  expect((await second)?.matches).toEqual([{ id: "bins", score: 1 }]);
});
