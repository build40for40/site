import { afterEach, expect, test, vi } from "vitest";
import worker from "./index";
import { SPONSOR_MAX } from "../src/data/site";
import { testDb } from "./test-db";

afterEach(() => vi.unstubAllGlobals());

const ctx = { waitUntil: vi.fn() } as unknown as ExecutionContext;

function setup() {
  const { db, sqlite } = testDb();
  const sent: URLSearchParams[] = [];
  vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
    sent.push(init.body as URLSearchParams);
    return Response.json({ id: "cs_test_custom", client_secret: "secret" });
  });
  return { env: { DB: db, STRIPE_SECRET_KEY: "sk_test_fake", STRIPE_PUBLISHABLE_KEY: "pk_test_fake" } as Env, sqlite, sent };
}

function request(route: "checkout" | "join", cents: unknown) {
  if (route === "checkout") return new Request("https://example.com/api/checkout", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: cents }),
  });
  const body = new FormData();
  for (const [key, value] of Object.entries({ email: "ada@example.com", problem: "Too much laundry", backing: "sponsor", sponsor: String(cents) })) body.set(key, value);
  return new Request("https://example.com/api/forms/join", { method: "POST", body });
}

for (const route of ["checkout", "join"] as const) {
  test.each([400, 7500, SPONSOR_MAX * 100])(`${route} sends a valid custom amount of %s cents to Stripe`, async (cents) => {
    const { env, sqlite, sent } = setup();
    const response = await worker.fetch(request(route, cents), env, ctx);
    expect(response.status).toBe(200);
    expect(sent[0].get("line_items[0][price_data][unit_amount]")).toBe(String(cents));
    if (route === "join") expect(sqlite.prepare("SELECT pledge, awaiting_payment FROM problems").get()).toEqual({ pledge: cents, awaiting_payment: 1 });
  });

  test.each([0, -400, 300, 7501, 7500.5, (SPONSOR_MAX + 1) * 100, "nope"])(`${route} rejects invalid amount %s before creating a session or saving a problem`, async (cents) => {
    const { env, sqlite, sent } = setup();
    const response = await worker.fetch(request(route, cents), env, ctx);
    expect(response.status).toBe(400);
    expect(sent).toHaveLength(0);
    expect(sqlite.prepare("SELECT count(*) AS n FROM problems").get()).toEqual({ n: 0 });
  });
}

test("checkout rejects numeric strings and missing amounts", async () => {
  const { env, sent } = setup();
  for (const cents of ["7500", null, undefined]) expect((await worker.fetch(request("checkout", cents), env, ctx)).status).toBe(400);
  expect(sent).toHaveLength(0);
});
