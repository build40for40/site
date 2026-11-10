import { categoriesOf } from "../src/data/categories";
import type { Idea } from "../src/data/days";
import { publicSponsors, type SponsorPayment } from "./sponsors";

export const MAX_PAGE = 60;

interface Row {
  id: string;
  title: string | null;
  problem: string;
  name: string | null;
  email: string;
  created_at: string;
  sponsors: string;
  paid: string;
  categorised_by: string | null;
  scores: string;
}

const firstName = (name: string | null) => name?.trim().split(/\s+/)[0] || undefined;

export function excerpt(text: string, max = 48) {
  const flat = text.replace(/\s+/g, " ").trim();
  const sentence = flat.split(/(?<=[.!?])\s/)[0];
  if (sentence.length <= max) return sentence.replace(/[.!?]$/, "");
  const cut = sentence.slice(0, max + 1);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 0 ? cut.lastIndexOf(" ") : max).replace(/[,;:]$/, "")}…`;
}

const encoder = new TextEncoder();

async function hmac(secret: string, message: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// The family part is keyed by email so one person's ideas look related, but the email itself never leaves the Worker.
export async function submitterSeed(email: string, ideaId: string, secret: string) {
  const family = (await hmac(secret, `family:${email.trim().toLowerCase()}`)).slice(0, 16);
  const own = (await hmac(secret, `idea:${family}:${ideaId}`)).slice(0, 16);
  return `${family}:${own}`;
}

export interface ListOptions {
  offset: number;
  limit: number;
  seedSecret?: string;
  sponsorSecret?: string;
}

export async function listProblems(db: D1Database, { offset, limit, seedSecret, sponsorSecret }: ListOptions) {
  const size = Math.min(Math.max(1, Math.floor(limit) || 1), MAX_PAGE);
  const start = Math.max(0, Math.floor(offset) || 0);
  const { results } = await db
    .prepare(
      `SELECT p.id, p.title, p.problem, people.name, p.email, p.created_at, p.categorised_by,
         coalesce(json_group_array(json_object('name', pay.name, 'email', pay.email, 'amount', pay.amount)) FILTER (WHERE pay.id IS NOT NULL), '[]') AS sponsors,
         coalesce(json_group_array(json_object('at', pay.paid_at, 'amount', pay.amount)) FILTER (WHERE pay.id IS NOT NULL), '[]') AS paid,
         (SELECT json_group_object(c.category, c.score) FROM problem_categories c WHERE c.problem_id = p.id) AS scores
       FROM problems p
       LEFT JOIN people ON people.email = p.email
       LEFT JOIN payments pay ON pay.problem_id = p.id
       WHERE p.awaiting_payment = 0
       GROUP BY p.id
       ORDER BY coalesce(sum(pay.amount), 0) DESC, p.created_at, p.id
       LIMIT ?1 OFFSET ?2`,
    )
    .bind(size + 1, start)
    .all<Row>();

  const ideas: Idea[] = await Promise.all(
    results.slice(0, size).map(async (row) => ({
      id: row.id,
      title: row.title?.trim() || excerpt(row.problem),
      problem: row.problem,
      owner: firstName(row.name),
      submittedAt: row.created_at,
      sponsors: await publicSponsors(JSON.parse(row.sponsors) as SponsorPayment[], sponsorSecret),
      paid: (JSON.parse(row.paid) as { at: string; amount: number }[]).map(({ at, amount }) => ({ at, amount: amount / 100 })),
      ...(row.categorised_by ? { categories: categoriesOf(JSON.parse(row.scores)) } : {}),
      ...(seedSecret ? { seed: await submitterSeed(row.email, row.id, seedSecret) } : {}),
    })),
  );
  return { ideas, next: results.length > size ? start + size : null };
}
