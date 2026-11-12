import { describe, expect, test, vi } from "vitest";
import { anthropicChartPlanner, answerWithChart, cleanQuestion, type ChartPlanner } from "./nerds-chart";

const reply = (overrides: Record<string, unknown> = {}) => ({
  answerable: true,
  chart: "popularity",
  title: "Miniskirts in British books",
  note: "Higher means more mentions.",
  trends: ["miniskirt", "made-up-trend"],
  source: "books_uk",
  countBy: "decade",
  category: "",
  from: 1950,
  to: 2022,
  ...overrides,
});

const fakeClient = (body: unknown, stop_reason = "end_turn") => {
  const create = vi.fn(async () => ({ stop_reason, content: [{ type: "text", text: JSON.stringify(body) }] }));
  return { create, client: { beta: { messages: { create } } } as unknown as NonNullable<Parameters<typeof anthropicChartPlanner>[0]["client"]> };
};

describe("anthropicChartPlanner", () => {
  test("sends the question in tags with the trend list and keeps only real trends", async () => {
    const { create, client } = fakeClient(reply());
    const spec = await anthropicChartPlanner({ apiKey: "key", client }).plan("how popular were miniskirts?");
    expect(spec).toMatchObject({ chart: "popularity", trends: ["miniskirt"], source: "books_uk", from: 1950, to: 2022 });
    const request = create.mock.calls[0][0] as { system: { text: string }[]; messages: unknown[] };
    expect(request.messages).toEqual([{ role: "user", content: "<question>\nhow popular were miniskirts?\n</question>" }]);
    expect(request.system[0].text).toContain("miniskirt | Miniskirt and minidress | garment");
  });

  test("has no chart when the model says it can't answer, names no real trend, or refuses", async () => {
    const plan = (body: unknown, stop?: string) => anthropicChartPlanner({ apiKey: "key", client: fakeClient(body, stop).client }).plan("x");
    await expect(plan(reply({ answerable: false }))).resolves.toBeNull();
    await expect(plan(reply({ trends: ["made-up-trend"] }))).resolves.toBeNull();
    await expect(plan(reply(), "refusal")).resolves.toBeNull();
    await expect(plan(reply(), "max_tokens")).rejects.toThrow("max_tokens");
  });
});

describe("answerWithChart", () => {
  const planner = (plan: ChartPlanner["plan"]): ChartPlanner => ({ model: "fake", plan: vi.fn(plan) });

  test("says it's unavailable without a planner or when the planner fails", async () => {
    await expect(answerWithChart("q", {})).resolves.toMatchObject({ spec: null, reason: "unavailable" });
    const failing = planner(async () => {
      throw new Error("down");
    });
    await expect(answerWithChart("q", { planner: failing })).resolves.toMatchObject({ spec: null, reason: "unavailable" });
  });

  test("marks a question the data can't answer", async () => {
    await expect(answerWithChart("q", { planner: planner(async () => null) })).resolves.toMatchObject({ spec: null, reason: "unanswerable", model: "fake" });
  });
});

test("cleanQuestion trims, flattens and caps the question", () => {
  expect(cleanQuestion("  are\n flares   back? ")).toBe("are flares back?");
  expect(cleanQuestion("x".repeat(500))).toHaveLength(200);
  expect(cleanQuestion(42)).toBe("");
});
