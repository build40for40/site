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
  return { send, newsletterAt };
}

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
