import { CATEGORIES_VERSION, categories, categoriesOf, categoryConfig } from "../src/data/categories";
import { classifyIdea, type Classifier, type Question } from "./classifier";

// One yes or no per category, so a problem can land in several, plus one to tell junk from problems that fit nothing.
export const questions: Record<string, Question> = {
  ...Object.fromEntries(
    categories.map((c) => [
      c.key,
      {
        type: "noul" as const,
        instructions: `Is \`idea\` about ${c.label.toLowerCase()}?`,
        criteria: {
          true: `The problem is about ${c.covers}, even if it's about other things too.`,
          false: `The problem is about other things, and ${c.label.toLowerCase()} comes up only in passing or not at all.`,
        },
      },
    ]),
  ),
  sincere: {
    type: "noul",
    instructions: "Is `idea` a sincere description of a problem someone has?",
    criteria: {
      true: "Someone describes something that bothers them or others, or a tool they wish existed, however briefly or oddly they put it.",
      false: "It's a joke, a test message, random characters or an insult.",
    },
  },
};

export interface Sorted {
  model: string;
  scores: Record<string, number>;
  sincere: number;
}

export async function categorise(problem: { title: string | null; problem: string }, classifier: Classifier, signal?: AbortSignal): Promise<Sorted> {
  const { classifierVersion, answers } = await classifyIdea(problem, questions, classifier, signal);
  const noul = (key: string) => {
    const answer = answers[key];
    if (answer?.type !== "noul") throw new Error(`No answer for ${key}`);
    return answer.noul;
  };
  return { model: classifierVersion, scores: Object.fromEntries(categories.map((c) => [c.key, noul(c.key)])), sincere: noul("sincere") };
}

export function save(db: D1Database, id: string, { model, scores, sincere }: Sorted) {
  return db.batch([
    db.prepare("DELETE FROM problem_categories WHERE problem_id = ?1").bind(id),
    ...Object.entries(scores).map(([category, score]) =>
      db.prepare("INSERT INTO problem_categories (problem_id, category, score) VALUES (?1, ?2, ?3)").bind(id, category, score),
    ),
    db
      .prepare("UPDATE problems SET categorised_by = ?2, categories_version = ?3, sincere = ?4 WHERE id = ?1")
      .bind(id, model, CATEGORIES_VERSION, sincere),
  ]);
}

// Where the problem stands for the team: sorted into categories, worth a look, or fitting none of them.
export function verdict({ scores, sincere }: Pick<Sorted, "scores" | "sincere">) {
  const best = Math.max(...Object.values(scores));
  const fitting = categoriesOf(scores)!;
  return {
    categories: fitting,
    fit: best >= categoryConfig.fits ? "fits" : best >= categoryConfig.unsure ? "unsure" : "none",
    best: Number(best.toFixed(2)),
    sincere: Number(sincere.toFixed(2)),
  };
}

type Report = (id: string, sorted: Sorted) => void;

// Problems the team sorted by hand stay as they are.
export async function categoriseProblem(db: D1Database, classifier: Classifier, id: string, report?: Report) {
  const row = await db
    .prepare("SELECT title, problem FROM problems WHERE id = ?1 AND coalesce(categorised_by, '') != 'team'")
    .bind(id)
    .first<{ title: string | null; problem: string }>();
  if (!row) return;
  const sorted = await categorise(row, classifier);
  await save(db, id, sorted);
  report?.(id, sorted);
}

// Problems that were never sorted, or were sorted against an older list.
export async function categoriseBacklog(db: D1Database, classifier: Classifier, { limit = 25, report }: { limit?: number; report?: Report } = {}) {
  const { results } = await db
    .prepare(
      `SELECT id FROM problems
       WHERE categorised_by IS NULL OR (categorised_by != 'team' AND coalesce(categories_version, 0) < ?1)
       ORDER BY created_at
       LIMIT ?2`,
    )
    .bind(CATEGORIES_VERSION, limit)
    .all<{ id: string }>();
  let sorted = 0;
  for (const { id } of results) {
    try {
      await categoriseProblem(db, classifier, id, report);
      sorted++;
    } catch {}
  }
  return { sorted, tried: results.length };
}
