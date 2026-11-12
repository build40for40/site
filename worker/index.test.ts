import { describe, expect, test } from "vitest";
import worker from "./index";
import { testDb } from "./test-db";

function setup() {
  const { db, sqlite } = testDb();
  const env = { DB: db } as Env;
  const ctx = { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext;
  const send = (form: string, fields: Record<string, string>) => {
    const body = new FormData();
    for (const [key, value] of Object.entries(fields)) body.append(key, value);
    return worker.fetch(new Request(`https://build40for40.com/api/forms/${form}`, { method: "POST", body }) as never, env, ctx);
  };
  const newsletterAt = (email: string) => (sqlite.prepare("SELECT newsletter_at FROM people WHERE email = ?").get(email) as { newsletter_at: string | null }).newsletter_at;
  return { send, newsletterAt, sqlite };
}

describe("access requests", () => {
  test("saves the request against the app and sends the visitor back to its page", async () => {
    const { send, sqlite } = setup();
    const response = await send("access", { name: "Ada", email: "ada@example.com", firm: "Example Capital", app: "synergy" });

    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("https://build40for40.com/synergy/#requested");
    expect(sqlite.prepare("SELECT app, firm FROM access_requests WHERE email = ?").get("ada@example.com")).toEqual({ app: "synergy", firm: "Example Capital" });
  });

  test("takes Sous beta requests with the cook's phone as the note", async () => {
    const { send, sqlite } = setup();
    const response = await send("access", { name: "Mac", email: "mac@example.com", app: "sous", note: "iPhone" });

    expect(response.headers.get("Location")).toBe("https://build40for40.com/sous/#requested");
    expect(sqlite.prepare("SELECT app, note FROM access_requests WHERE email = ?").get("mac@example.com")).toEqual({ app: "sous", note: "iPhone" });
  });

  test("rejects an app that isn't taking requests", async () => {
    const { send } = setup();
    const response = await send("access", { name: "Ada", email: "ada@example.com", app: "elsewhere" });

    expect(response.status).toBe(400);
  });
});

describe("newsletter consent", () => {
  test("is recorded only when the box is ticked", async () => {
    const { send, newsletterAt } = setup();
    await send("join", { email: "ticked@example.com", newsletter: "yes" });
    await send("join", { email: "unticked@example.com" });

    expect(newsletterAt("ticked@example.com")).toMatch(/^\d{4}-\d\d-\d\dT/);
    expect(newsletterAt("unticked@example.com")).toBeNull();
  });

  test("keeps the first opt-in when a later form leaves the box unticked or ticks it again", async () => {
    const { send, newsletterAt } = setup();
    await send("join", { email: "a@example.com", newsletter: "yes" });
    const first = newsletterAt("a@example.com");
    await send("join", { email: "a@example.com" });
    await send("help", { name: "Ada", email: "a@example.com", type: "office", newsletter: "yes" });

    expect(newsletterAt("a@example.com")).toBe(first);
  });

  test("opts in someone who already gave their email without ticking it", async () => {
    const { send, newsletterAt } = setup();
    await send("join", { email: "later@example.com" });
    await send("join", { email: "later@example.com", newsletter: "yes" });

    expect(newsletterAt("later@example.com")).not.toBeNull();
  });

  test("rejects anything but yes", async () => {
    const { send } = setup();
    const response = await send("join", { email: "a@example.com", newsletter: "please" });

    expect(response.status).toBe(400);
  });
});
