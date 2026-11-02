import { expect, test } from "vitest";
import { publicSponsors, sponsorGroup } from "./sponsors";
import { listProblems } from "./problems";
import { testDb, addProblem } from "./test-db";
import worker from "./index";

test("groups named payments by normalised email, keeping different people with the same name apart", async () => {
  const sponsors = await publicSponsors([
    { name: "Ada", email: "Ada@example.com", amount: 400 },
    { name: "Ada Company", email: " ADA@example.com ", amount: 4000 },
    { name: "Ada", email: "another@example.com", amount: 8000 },
  ], "secret");
  expect(sponsors).toHaveLength(2);
  expect(sponsors.map(({ name, amount }) => ({ name, amount }))).toEqual([{ name: "Ada", amount: 44 }, { name: "Ada", amount: 80 }]);
  expect(sponsors[0].group).toBe(await sponsorGroup("Ada Company", "ada@example.com", "secret"));
  expect(sponsors[0].group).not.toBe(sponsors[1].group);
  expect(JSON.stringify(sponsors)).not.toContain("@");
});

test("never combines anonymous payments, even with the same email as a named sponsor", async () => {
  const sponsors = await publicSponsors([
    { name: null, email: "ada@example.com", amount: 400 },
    { name: "Anonymous", email: "ada@example.com", amount: 4000 },
    { name: "Ada", email: "ada@example.com", amount: 8000 },
    { name: "Ada", email: null, amount: 14000 },
    { name: "Ada", email: null, amount: 400 },
  ], "secret");
  expect(sponsors).toHaveLength(5);
  expect(sponsors.slice(0, 2)).toEqual([{ name: "Anonymous", amount: 4 }, { name: "Anonymous", amount: 40 }]);
  expect(sponsors[2].group).toBeDefined();
  expect(sponsors[3].group).toBeUndefined();
  expect(sponsors[4].group).toBeUndefined();
});

test("problem and guest-day APIs apply email grouping without exposing emails", async () => {
  const { db, sqlite } = testDb();
  const id = addProblem(sqlite);
  for (const [i, name, email, amount] of [
    [1, "Ada", "ada@example.com", 400],
    [2, "Ada", "ADA@example.com", 4000],
    [3, "Ada", "other@example.com", 8000],
    [4, null, "ada@example.com", 14000],
    [5, null, "ada@example.com", 400],
  ] as const) sqlite.prepare("INSERT INTO payments (id, problem_id, day, name, email, amount, currency, livemode, paid_at) VALUES (?, ?, 10, ?, ?, ?, 'usd', 0, 't')").run(`cs_${i}`, id, name, email, amount);
  const problem = (await listProblems(db, { offset: 0, limit: 1, sponsorSecret: "secret" })).ideas[0];
  const response = await worker.fetch(new Request("https://example.com/api/days"), { DB: db, STRIPE_SECRET_KEY: "secret" } as Env, {} as ExecutionContext);
  const days = await response.json() as { sponsors: Record<number, unknown[]> };
  expect(problem.sponsors).toHaveLength(4);
  expect(days.sponsors[10]).toEqual(problem.sponsors);
  expect(JSON.stringify(problem)).not.toContain("@");
  expect(JSON.stringify(days)).not.toContain("@");
});
