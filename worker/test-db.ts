import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

// A D1-shaped wrapper over an in-memory SQLite with every migration applied, for Worker tests.
export function testDb() {
  const sqlite = new DatabaseSync(":memory:");
  const dir = new URL("./migrations/", import.meta.url);
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) sqlite.exec(readFileSync(new URL(file, dir), "utf8"));

  const db = {
    prepare(sql: string) {
      let args: unknown[] = [];
      const statement = {
        bind(...values: unknown[]) {
          args = values;
          return statement;
        },
        async all() {
          return { results: sqlite.prepare(sql).all(...(args as never[])) };
        },
        async first() {
          return sqlite.prepare(sql).get(...(args as never[])) ?? null;
        },
        async run() {
          return { meta: sqlite.prepare(sql).run(...(args as never[])) };
        },
      };
      return statement;
    },
    async batch(statements: { run(): Promise<unknown> }[]) {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      return results;
    },
  };
  return { db: db as unknown as D1Database, sqlite };
}

let n = 0;

export function addProblem(sqlite: DatabaseSync, { title = null as string | null, problem = "A problem.", name = null as string | null, email = `person${++n}@example.com`, paid = [] as number[] } = {}) {
  const id = `problem-${++n}`;
  const at = new Date(Date.UTC(2026, 9, 1, 9, n)).toISOString();
  sqlite.prepare("INSERT INTO people (email, name, joined_at, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING").run(email, name, at, at);
  sqlite.prepare("INSERT INTO problems (id, email, problem, title, created_at) VALUES (?, ?, ?, ?, ?)").run(id, email, problem, title, at);
  paid.forEach((cents, i) =>
    sqlite.prepare("INSERT INTO payments (id, problem_id, amount, currency, livemode, paid_at) VALUES (?, ?, ?, 'usd', 0, ?)").run(`cs_test_${id}_${i}`, id, cents, at),
  );
  return id;
}
