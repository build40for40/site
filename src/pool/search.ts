import { poolConfig } from "./config";

export interface SearchableIdea {
  id: string;
  title: string;
  problem: string;
}

export interface Match {
  id: string;
  score: number;
}

export type Ranking = "classifier" | "lexical";

export interface SearchResult {
  query: string;
  ranking: Ranking;
  matches: Match[];
}

export const MAX_QUERY = 80;

const words = (text: string) => text.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").match(/[\p{L}\p{N}]+/gu) ?? [];

export const tokenize = (query: string) => [...new Set(words(query.slice(0, MAX_QUERY)))].slice(0, 8);

export function retrieveCandidates(query: string, { ideas, limit = 30 }: { ideas: SearchableIdea[]; limit?: number }): Match[] {
  const tokens = tokenize(query);
  if (!tokens.length) return [];
  const scored = ideas.map((idea) => {
    const title = words(idea.title);
    const problem = words(idea.problem);
    const score = tokens.reduce(
      (sum, token) => sum + (title.some((w) => w.startsWith(token)) ? 3 : 0) + (problem.some((w) => w.startsWith(token)) ? 1 : 0),
      0,
    );
    return { id: idea.id, score };
  });
  const top = Math.max(...scored.map((s) => s.score));
  return scored
    .filter((s) => s.score > 0)
    .toSorted((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => ({ id: s.id, score: s.score / top }));
}

interface SearchOptions {
  ideas: SearchableIdea[];
  endpoint?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
  fetcher?: typeof fetch;
}

export async function searchIdeas(query: string, { ideas, endpoint = "/api/pool/search", timeoutMs = poolConfig.search.timeoutMs, signal, fetcher = fetch }: SearchOptions): Promise<SearchResult> {
  const known = new Set(ideas.map((i) => i.id));
  const lexical = (): SearchResult => ({ query, ranking: "lexical", matches: retrieveCandidates(query, { ideas }) });
  if (tokenize(query).length === 0) return { query, ranking: "lexical", matches: [] };

  const timeout = AbortSignal.timeout(timeoutMs);
  try {
    const response = await fetcher(`${endpoint}?q=${encodeURIComponent(query.slice(0, MAX_QUERY))}`, {
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return lexical();
    const body = (await response.json()) as { ranking: Ranking; matches: Match[] };
    return { query, ranking: body.ranking, matches: body.matches.filter((m) => known.has(m.id)) };
  } catch (error) {
    if (signal?.aborted) throw error;
    return lexical();
  }
}

// Only the latest query's result is ever delivered. Older ones are cancelled and resolve to null.
export function createSearch(options: Omit<SearchOptions, "signal" | "ideas"> & { ideas: () => SearchableIdea[] }) {
  let current: AbortController | undefined;
  return {
    async run(query: string): Promise<SearchResult | null> {
      current?.abort();
      const controller = new AbortController();
      current = controller;
      try {
        const result = await searchIdeas(query, { ...options, ideas: options.ideas(), signal: controller.signal });
        return controller.signal.aborted ? null : result;
      } catch {
        return null;
      }
    },
    cancel() {
      current?.abort();
    },
  };
}
