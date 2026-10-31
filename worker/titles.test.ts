import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, test, vi } from "vitest";
import { addProblem, testDb } from "./test-db";
import { anthropicTitler, cleanTitle, titleProblem, type Titler } from "./titles";

const fakeClient = (title: string, stop_reason = "end_turn") => {
  const create = vi.fn(async () => ({ stop_reason, content: [{ type: "text", text: JSON.stringify({ title }) }] }));
  return { create, client: { messages: { create } } as unknown as Pick<Anthropic, "messages"> };
};

const titleOf = async (db: D1Database, id: string) => (await db.prepare("SELECT title FROM problems WHERE id = ?1").bind(id).first<{ title: string | null }>())?.title;

describe("anthropicTitler", () => {
  test("sends the problem in tags to Haiku and returns the cleaned title", async () => {
    const { create, client } = fakeClient('"Endless standups."\n');
    await expect(anthropicTitler({ apiKey: "key", client }).title("Fifteen people, one meeting")).resolves.toBe("Endless standups");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ model: "claude-haiku-5-5", messages: [{ role: "user", content: "<problem>\nFifteen people, one meeting\n</problem>" }] }),
      expect.anything(),
    );
  });

  test("rejects a refusal or a cut-off reply", async () => {
    await expect(anthropicTitler({ apiKey: "key", client: fakeClient("", "refusal").client }).title("x")).rejects.toThrow("refusal");
    await expect(anthropicTitler({ apiKey: "key", client: fakeClient("Endless", "max_tokens").client }).title("x")).rejects.toThrow("max_tokens");
  });
});

test("cleanTitle keeps an apostrophe but refuses an empty or rambling title", () => {
  expect(cleanTitle("Kids' screen time")).toBe("Kids' screen time");
  expect(() => cleanTitle("  ")).toThrow();
  expect(() => cleanTitle("Here is a title for this problem: it is about a lot of things")).toThrow();
});

describe("titleProblem", () => {
  const titler = (title: string): Titler => ({ model: "fake", title: vi.fn(async () => title) });

  test("titles a problem that has none", async () => {
    const { db, sqlite } = testDb();
    const id = addProblem(sqlite, { problem: "Fifteen people, one meeting" });
    await titleProblem(db, titler("Endless standups"), id);
    expect(await titleOf(db, id)).toBe("Endless standups");
  });

  test("leaves a title the team wrote", async () => {
    const { db, sqlite } = testDb();
    const id = addProblem(sqlite, { title: "Standup misery" });
    const fake = titler("Endless standups");
    await titleProblem(db, fake, id);
    expect(fake.title).not.toHaveBeenCalled();
    expect(await titleOf(db, id)).toBe("Standup misery");
  });
});
