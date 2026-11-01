import type { Idea } from "../data/days";

export interface Page {
  ideas: Idea[];
  next: number | null;
}

interface LoadOptions {
  first?: number;
  page?: number;
  endpoint?: string;
  fetcher?: typeof fetch;
  signal?: AbortSignal;
  idle?: () => Promise<void>;
  onPage: (ideas: Idea[], done: boolean) => void;
}

export async function fetchIdeas(offset: number, limit: number, { endpoint = "/api/problems", fetcher = fetch, signal }: Pick<LoadOptions, "endpoint" | "fetcher" | "signal"> = {}): Promise<Page> {
  const response = await fetcher(`${endpoint}?offset=${offset}&limit=${limit}`, { signal, headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Problems answered ${response.status}`);
  return response.json();
}

export function afterLoad() {
  return new Promise<void>((resolve) => {
    const idle = () => ("requestIdleCallback" in window ? requestIdleCallback(() => resolve(), { timeout: 1500 }) : setTimeout(resolve, 200));
    if (document.readyState === "complete") idle();
    else addEventListener("load", idle, { once: true });
  });
}

// The first page fills the 40 days. The rest is the pool, fetched a page at a time once the page has loaded.
export async function loadIdeas({ first = 40, page = 24, idle = afterLoad, onPage, ...request }: LoadOptions) {
  let { ideas, next } = await fetchIdeas(0, first, request);
  onPage(ideas, next === null);
  if (next !== null) await idle();
  while (next !== null && !request.signal?.aborted) {
    ({ ideas, next } = await fetchIdeas(next, page, request));
    onPage(ideas, next === null);
  }
}
