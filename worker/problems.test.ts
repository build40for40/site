import { describe, expect, test } from "vitest";
import { excerpt, listProblems, submitterSeed } from "./problems";
import { addProblem, testDb } from "./test-db";

describe("listProblems", () => {
  test("ranks by money raised, in pounds, with first names only and never an email", async () => {
    const { db, sqlite } = testDb();
    const low = addProblem(sqlite, { title: "Low", name: "Ada Example", paid: [500] });
    const high = addProblem(sqlite, { title: "High", name: "  Grace Hopper Example ", paid: [4000, 1000] });
    const none = addProblem(sqlite, { title: "None" });

    const { ideas, next } = await listProblems(db, { offset: 0, limit: 10 });

    expect(ideas.map((i) => i.id)).toEqual([high, low, none]);
    expect(ideas[0]).toMatchObject({ owner: "Grace", sponsors: [{ name: "Anonymous", amount: 40 }, { name: "Anonymous", amount: 10 }] });
    expect(ideas[2].owner).toBeUndefined();
    expect(JSON.stringify(ideas)).not.toContain("@");
    expect(next).toBeNull();
  });

  test("falls back to the start of the problem when there's no title", async () => {
    const { db, sqlite } = testDb();
    addProblem(sqlite, { problem: "My nails are always chipped. Every single week." });
    const { ideas } = await listProblems(db, { offset: 0, limit: 10 });
    expect(ideas[0].title).toBe("My nails are always chipped");
  });

  test("pages through the rest", async () => {
    const { db, sqlite } = testDb();
    for (let i = 0; i < 5; i++) addProblem(sqlite, { title: `P${i}`, paid: [100 * (5 - i)] });
    const first = await listProblems(db, { offset: 0, limit: 2 });
    const second = await listProblems(db, { offset: first.next!, limit: 2 });
    const last = await listProblems(db, { offset: second.next!, limit: 2 });
    expect([...first.ideas, ...second.ideas, ...last.ideas].map((i) => i.title)).toEqual(["P0", "P1", "P2", "P3", "P4"]);
    expect(last.next).toBeNull();
  });

  test("only adds artwork seeds when given a secret", async () => {
    const { db, sqlite } = testDb();
    addProblem(sqlite, { email: "seedy@example.com" });
    expect((await listProblems(db, { offset: 0, limit: 1 })).ideas[0].seed).toBeUndefined();
    const { ideas } = await listProblems(db, { offset: 0, limit: 1, seedSecret: "s3cret" });
    expect(ideas[0].seed).toMatch(/^[0-9a-f]{16}:[0-9a-f]{16}$/);
  });
});

describe("submitterSeed", () => {
  test("links one person's ideas without revealing the email", async () => {
    const a1 = await submitterSeed("ada@example.com", "one", "secret");
    const a2 = await submitterSeed("ADA@example.com ", "two", "secret");
    const b1 = await submitterSeed("bob@example.com", "one", "secret");
    const digest = Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("ada@example.com"))).toString("hex");

    expect(a1.split(":")[0]).toBe(a2.split(":")[0]);
    expect(a1).not.toBe(a2);
    expect(a1.split(":")[0]).not.toBe(b1.split(":")[0]);
    expect(a1).not.toContain("ada");
    expect(digest).not.toContain(a1.split(":")[0]);
    expect(await submitterSeed("ada@example.com", "one", "other secret")).not.toBe(a1);
  });
});

test("excerpt cuts long text at a word", () => {
  expect(excerpt("I have thousands of recipes saved on Instagram that I always want to try")).toBe("I have thousands of recipes saved on Instagram…");
});
