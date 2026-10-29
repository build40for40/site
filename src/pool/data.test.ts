import { expect, test, vi } from "vitest";
import { loadIdeas } from "./data";

const idea = (id: string) => ({ id, title: id, problem: id, sponsors: [] });

test("loads the top ideas first, then the pool a page at a time after the page has loaded", async () => {
  const pages: Record<string, unknown> = {
    "0:3": { ideas: [idea("a"), idea("b"), idea("c")], next: 3 },
    "3:2": { ideas: [idea("d"), idea("e")], next: 5 },
    "5:2": { ideas: [idea("f")], next: null },
  };
  const fetcher = vi.fn(async (url: string) => {
    const params = new URL(url, "http://x").searchParams;
    return Response.json(pages[`${params.get("offset")}:${params.get("limit")}`]);
  });
  const order: string[] = [];
  const idle = vi.fn(async () => void order.push("idle"));
  const onPage = vi.fn((ideas: { id: string }[], done: boolean) => order.push(ideas.map((i) => i.id).join("") + (done ? "!" : "")));

  await loadIdeas({ first: 3, page: 2, fetcher: fetcher as unknown as typeof fetch, idle, onPage });

  expect(order).toEqual(["abc", "idle", "de", "f!"]);
});

test("stops when there's nothing past the first page", async () => {
  const idle = vi.fn(async () => {});
  const fetcher = vi.fn(async () => Response.json({ ideas: [idea("a")], next: null }));
  await loadIdeas({ fetcher: fetcher as unknown as typeof fetch, idle, onPage: () => {} });
  expect(idle).not.toHaveBeenCalled();
  expect(fetcher).toHaveBeenCalledOnce();
});
