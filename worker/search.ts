import { poolConfig } from "../src/pool/config";
import { MAX_QUERY, tokenize, type Match, type Ranking } from "../src/pool/search";
import { ideaState, type Classifier } from "./classifier";

export interface Candidate {
  id: string;
  title: string | null;
  problem: string;
  score: number;
}

// Every word becomes a quoted prefix term, so nothing typed can reach FTS5's query syntax.
export function ftsQuery(query: string) {
  const tokens = tokenize(query);
  return tokens.length ? tokens.map((t) => `"${t}"*`).join(" OR ") : null;
}

export async function retrieveCandidates(query: string, { db, limit = poolConfig.search.shortlist }: { db: D1Database; limit?: number }) {
  const match = ftsQuery(query);
  if (!match) return [];
  const { results } = await db
    .prepare(
      `SELECT p.id, p.title, p.problem, -bm25(problems_fts, 0, 5, 1) AS rank
       FROM problems_fts JOIN problems p ON p.id = problems_fts.id
       WHERE problems_fts MATCH ?1
       ORDER BY rank DESC
       LIMIT ?2`,
    )
    .bind(match, limit)
    .all<{ id: string; title: string | null; problem: string; rank: number }>();
  const top = Math.max(...results.map((r) => r.rank), Number.EPSILON);
  return results.map((r): Candidate => ({ id: r.id, title: r.title, problem: r.problem, score: r.rank / top }));
}

interface RankOptions {
  classifier: Classifier;
  levels?: string[];
  minRelevance?: number;
  signal?: AbortSignal;
}

export async function rankCandidates(
  query: string,
  candidates: Candidate[],
  { classifier, levels = poolConfig.search.relevanceLevels, minRelevance = poolConfig.search.minRelevance, signal }: RankOptions,
): Promise<Match[]> {
  if (!candidates.length) return [];
  // The search is shared, and each idea goes in its own question rather than a list the model would look up by id.
  const key = (i: number) => `idea_${i}`;
  const questions = Object.fromEntries(
    candidates.map((c, i) => [
      key(i),
      {
        type: "score" as const,
        instructions: { idea: ideaState(c), question: "How well does `idea` match what the person typed in `search`?" },
        criteria: levels,
      },
    ]),
  );
  const { answers } = await classifier.ask({ search: query.slice(0, MAX_QUERY) }, questions, signal);
  return candidates
    .map((c, i) => {
      const answer = answers[key(i)];
      const relevance = answer?.type === "score" ? answer.score / (levels.length - 1) : 0;
      return { id: c.id, score: relevance, lexical: c.score };
    })
    .filter((m) => m.score >= minRelevance)
    .toSorted((a, b) => b.score - a.score || b.lexical - a.lexical)
    .map(({ id, score }) => ({ id, score }));
}

interface SearchOptions {
  db: D1Database;
  classifier?: Classifier;
  cache?: Cache;
}

export async function searchIdeas(query: string, { db, classifier, cache }: SearchOptions): Promise<{ ranking: Ranking; matches: Match[] }> {
  const candidates = await retrieveCandidates(query, { db });
  const lexical = { ranking: "lexical" as const, matches: candidates.map(({ id, score }) => ({ id, score })) };
  if (!classifier || candidates.length < 2) return lexical;

  const cacheKey = new Request(`https://pool-search.cache/${encodeURIComponent(classifier.version)}?q=${encodeURIComponent(tokenize(query).join(" "))}`);
  const hit = await cache?.match(cacheKey).catch(() => undefined);
  if (hit) return hit.json();

  try {
    const result = { ranking: "classifier" as const, matches: await rankCandidates(query, candidates, { classifier }) };
    const response = Response.json(result, { headers: { "Cache-Control": `max-age=${poolConfig.search.cacheSeconds}` } });
    await cache?.put(cacheKey, response).catch(() => {});
    return result;
  } catch {
    return lexical;
  }
}
