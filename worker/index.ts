import { SPONSOR_AMOUNTS, TOTAL_DAYS, backings, helpTypes, involvement } from "../src/data/site";
import { categoriseBacklog, categoriseProblem, verdict, type Sorted } from "./categories";
import { jevClassifier } from "./classifier";
import { listProblems } from "./problems";
import { searchIdeas } from "./search";

interface Field {
  name: string;
  required?: boolean;
  max?: number;
  email?: boolean;
  options?: readonly string[];
  multiple?: boolean;
}

const name: Field = { name: "name", required: true, max: 200 };
const email: Field = { name: "email", required: true, max: 254, email: true };
const weeks = Array.from({ length: Math.ceil(TOTAL_DAYS / 7) }, (_, w) => `week-${w + 1}`);

const forms: Record<string, Field[]> = {
  subscribe: [{ ...email, required: false }],
  join: [
    { name: "name", max: 200 },
    email,
    { name: "problem", max: 1000 },
    { name: "involved", options: involvement.map((option) => option.value), multiple: true },
    ...involvement.map((option) => ({ name: option.note, max: 200 })),
    { name: "backing", options: backings },
    { name: "sponsor", options: SPONSOR_AMOUNTS.map((amount) => String(amount * 100)) },
    { name: "contact", options: ["yes"] },
  ],
  help: [
    name,
    email,
    { name: "company", max: 200 },
    { name: "type", required: true, options: helpTypes.map((type) => type.value) },
    { name: "note", max: 1000 },
  ],
  guest: [
    name,
    email,
    { name: "role", required: true, max: 200 },
    { name: "nominated_by", max: 200 },
    { name: "bring", required: true, max: 1000 },
    { name: "availability", options: weeks, multiple: true },
  ],
  problem: [
    name,
    email,
    { name: "problem", required: true, max: 500 },
    { name: "affects", required: true, max: 200 },
  ],
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const text = (body: string, status: number) => new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

function parse(fields: Field[], data: FormData) {
  const values: Record<string, string | string[]> = {};
  for (const field of fields) {
    const raw = data
      .getAll(field.name)
      .filter((value) => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean);
    if (field.required && !raw.length) return `Missing ${field.name}.`;
    if (!field.multiple && raw.length > 1) return `Only one ${field.name}, please.`;
    if (raw.some((value) => value.length > (field.max ?? 200))) return `That ${field.name} is too long.`;
    if (field.email && raw.some((value) => !EMAIL.test(value))) return "That email doesn't look right.";
    if (field.options && raw.some((value) => !field.options?.includes(value))) return `That ${field.name} isn't one of the options.`;
    if (raw.length) values[field.name] = field.multiple ? raw : field.email ? raw[0].toLowerCase() : raw[0];
  }
  return values;
}

interface Person {
  email: string;
  name: string | null;
  involved: string | null;
  helpNote: string | null;
  guestNote: string | null;
  now: string;
}

// A later form fills in or changes answers but never clears one it left out.
const upsertPerson = (db: D1Database, { email, name, involved, helpNote, guestNote, now }: Person) =>
  db
    .prepare(
      `INSERT INTO people (email, name, involved, help_note, guest_note, joined_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)
       ON CONFLICT (email) DO UPDATE SET
         name = coalesce(excluded.name, name),
         involved = coalesce(excluded.involved, involved),
         help_note = coalesce(excluded.help_note, help_note),
         guest_note = coalesce(excluded.guest_note, guest_note),
         updated_at = excluded.updated_at`,
    )
    .bind(email, name, involved, helpNote, guestNote, now);

async function capture(env: Env, event: string, distinctId: string, properties: Record<string, unknown>) {
  if (!env.PUBLIC_POSTHOG_PROJECT_TOKEN) return;
  await fetch(new URL("/i/v0/e/", env.PUBLIC_POSTHOG_HOST), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: env.PUBLIC_POSTHOG_PROJECT_TOKEN,
      event,
      distinct_id: distinctId,
      properties: { $process_person_profile: false, ...properties },
      timestamp: new Date().toISOString(),
    }),
  });
}

// PostHog hashes these into the same daily visitor id as the browser's cookieless events.
const cookieless = (request: Request) => ({
  $cookieless_mode: true,
  $ip: request.headers.get("CF-Connecting-IP"),
  $raw_user_agent: request.headers.get("User-Agent"),
  $host: new URL(request.url).host,
  $timezone: request.cf?.timezone,
});

const encoder = new TextEncoder();

// https://docs.stripe.com/webhooks#verify-manually
async function verifyStripe(body: string, header: string | null, secret: string) {
  const parts = (header ?? "").split(",").map((part) => part.split("="));
  const timestamp = Number(parts.find(([key]) => key === "t")?.[1]);
  const signatures = parts.filter(([key, value]) => key === "v1" && /^[0-9a-f]{64}$/.test(value ?? "")).map(([, value]) => value);
  if (!signatures.length || !(Math.abs(Date.now() / 1000 - timestamp) <= 300)) return false;

  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  for (const signature of signatures) {
    const bytes = new Uint8Array(signature.match(/../g)!.map((byte) => parseInt(byte, 16)));
    if (await crypto.subtle.verify("HMAC", key, bytes, encoder.encode(`${timestamp}.${body}`))) return true;
  }
  return false;
}

interface CheckoutSessionEvent {
  type: string;
  created: number;
  livemode: boolean;
  data: {
    object: {
      id: string;
      payment_status: string;
      amount_total: number | null;
      currency: string | null;
      client_reference_id: string | null;
      customer_details: { email: string | null } | null;
    };
  };
}

async function stripeWebhook(request: Request, env: Env, ctx: ExecutionContext) {
  if (request.method !== "POST") return new Response("Method not allowed.", { status: 405, headers: { Allow: "POST" } });
  if (!env.STRIPE_WEBHOOK_SECRET) return text("Webhook secret isn't set.", 500);

  const body = await request.text();
  if (!(await verifyStripe(body, request.headers.get("Stripe-Signature"), env.STRIPE_WEBHOOK_SECRET))) return text("Bad signature.", 400);

  const event = JSON.parse(body) as CheckoutSessionEvent;
  const session = event.data.object;
  // Bank-style payments complete unpaid and confirm later with async_payment_succeeded.
  const paid =
    event.type === "checkout.session.async_payment_succeeded" ||
    (event.type === "checkout.session.completed" && session.payment_status === "paid");
  if (!paid) return text("Ignored.", 200);

  // Stripe retries and can send an event twice, so a repeat is a no-op. A problem id from another database becomes null.
  const { meta } = await env.DB.prepare(
    `INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at)
     VALUES (?1, ?2, (SELECT id FROM problems WHERE id = ?3), ?4, ?5, ?6, ?7)
     ON CONFLICT (id) DO NOTHING`,
  )
    .bind(
      session.id,
      session.customer_details?.email?.toLowerCase() ?? null,
      session.client_reference_id,
      session.amount_total ?? 0,
      session.currency ?? "",
      event.livemode ? 1 : 0,
      new Date(event.created * 1000).toISOString(),
    )
    .run();
  // Stripe calls from its own servers, so this can't be tied to the visitor's cookieless id.
  if (meta.changes) {
    ctx.waitUntil(
      capture(env, "payment_completed", session.id, { amount: session.amount_total ?? 0, currency: session.currency, livemode: event.livemode }),
    );
  }
  return text("Saved.", 200);
}

const CATEGORISE_TIMEOUT_MS = 8000;

const json = (body: unknown, cacheControl = "no-store") => Response.json(body, { headers: { "Cache-Control": cacheControl } });

async function problems(request: Request, env: Env) {
  const url = new URL(request.url);
  const seedSecret = (env.ARTWORK_SUBMITTER_SEEDS as string) === "on" ? env.ARTWORK_SEED_SECRET : undefined;
  return json(
    await listProblems(env.DB, {
      offset: Number(url.searchParams.get("offset") ?? 0),
      limit: Number(url.searchParams.get("limit") ?? 40),
      seedSecret: seedSecret || undefined,
    }),
  );
}

const classifierFor = (env: Env, timeoutMs?: number) =>
  env.TYPESAFE_API_KEY ? jevClassifier({ apiKey: env.TYPESAFE_API_KEY, baseUrl: env.TYPESAFE_API_URL || undefined, timeoutMs }) : undefined;

// Lets the team find problems that fit no category, or might be junk, without the problem's text leaving the Worker.
const reportSorted = (env: Env, ctx: ExecutionContext, via: string) => (id: string, sorted: Sorted) =>
  ctx.waitUntil(capture(env, "problem_categorised", id, { problem_id: id, via, model: sorted.model, ...verdict(sorted) }).catch(() => {}));

async function poolSearch(request: Request, env: Env) {
  const query = new URL(request.url).searchParams.get("q") ?? "";
  const classifier = classifierFor(env);
  const cache = typeof caches === "undefined" ? undefined : (caches as unknown as { default: Cache }).default;
  return json({ query, ...(await searchIdeas(query, { db: env.DB, classifier, cache })) });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (/^\/api\/stripe\/webhook\/?$/.test(url.pathname)) return stripeWebhook(request, env, ctx);

    const read = { "/api/problems": problems, "/api/pool/search": poolSearch }[url.pathname.replace(/\/$/, "")];
    if (read) {
      if (request.method !== "GET") return new Response("Method not allowed.", { status: 405, headers: { Allow: "GET" } });
      return read(request, env);
    }

    const form = url.pathname.match(/^\/api\/forms\/([a-z]+)\/?$/)?.[1];
    const fields = form && Object.hasOwn(forms, form) ? forms[form] : undefined;
    if (!form || !fields) return text("Not found.", 404);
    if (request.method !== "POST") return new Response("Method not allowed.", { status: 405, headers: { Allow: "POST" } });

    const origin = request.headers.get("Origin");
    if (origin && origin !== url.origin) return text("Forbidden.", 403);

    const home = Response.redirect(new URL("/", url).href, 303);
    let data: FormData;
    try {
      data = await request.formData();
    } catch {
      return text("Bad request.", 400);
    }
    // Honeypot: bots fill in every field, people never see this one.
    if (data.get("website")) return home;

    const values = parse(fields, data);
    const now = new Date().toISOString();
    const track = (event: string, properties: Record<string, unknown>) =>
      ctx.waitUntil(capture(env, event, "$posthog_cookieless", { ...cookieless(request), ...properties }));

    // Join works with or without an email: save valid ones, then carry whatever was typed to the full form.
    if (form === "subscribe") {
      if (typeof values !== "string" && values.email) {
        await env.DB.prepare("INSERT INTO people (email, joined_at, updated_at) VALUES (?1, ?2, ?2) ON CONFLICT DO NOTHING")
          .bind(values.email, now)
          .run();
        track("form_saved", { form_type: form });
      }
      const typed = String(data.get("email") ?? "").trim();
      return Response.redirect(new URL(typed ? `/#join&email=${encodeURIComponent(typed)}` : "/#join", url).href, 303);
    }

    if (typeof values === "string") return text(values, 400);
    if (form === "join" && values.problem && !values.backing) return text("Promise to share it or sponsor it, please.", 400);
    if (values.backing === "sponsor" && !values.sponsor) return text("Pick how much you’re sponsoring.", 400);

    const id = crypto.randomUUID();
    const problemId = values.problem ? id : undefined;
    const json = (value: string | string[] | undefined) => (value ? JSON.stringify(value) : null);
    // A note only counts while its box is ticked, since unticking hides the note but keeps what was typed.
    const note = (value: string, field: string) => ([values.involved ?? []].flat().includes(value) && values[field] ? String(values[field]) : null);

    const record =
      form === "help"
        ? env.DB.prepare("INSERT INTO help_offers (id, email, company, type, note, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)").bind(
            id,
            values.email,
            values.company ?? null,
            values.type,
            values.note ?? null,
            now,
          )
        : form === "guest"
          ? env.DB.prepare(
              "INSERT INTO guest_applications (id, email, role, nominated_by, bring, availability, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            ).bind(id, values.email, values.role, values.nominated_by ?? null, values.bring, json(values.availability), now)
          : problemId
            ? env.DB.prepare("INSERT INTO problems (id, email, problem, affects, backing, pledge, contact, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)").bind(
                problemId,
                values.email,
                values.problem,
                values.affects ?? null,
                values.backing ?? null,
                values.backing === "sponsor" ? Number(values.sponsor) : null,
                form === "join" ? Number(values.contact === "yes") : null,
                now,
              )
            : undefined;

    await env.DB.batch([
      upsertPerson(env.DB, {
        email: String(values.email),
        name: values.name ? String(values.name) : null,
        involved: json(values.involved),
        helpNote: note("kind", "help_note"),
        guestNote: note("guest", "guest_note"),
        now,
      }),
      ...(record ? [record] : []),
    ]);
    track("form_saved", { form_type: form, involvement: values.involved, backing: values.backing });

    const classifier = problemId && classifierFor(env, CATEGORISE_TIMEOUT_MS);
    if (problemId && classifier) ctx.waitUntil(categoriseProblem(env.DB, classifier, problemId, reportSorted(env, ctx, "submit")).catch(() => {}));

    return home;
  },

  // Catches problems the submit missed, and sorts everything again when the category list changes.
  async scheduled(_controller, env, ctx) {
    const classifier = classifierFor(env, CATEGORISE_TIMEOUT_MS);
    if (classifier) await categoriseBacklog(env.DB, classifier, { report: reportSorted(env, ctx, "backlog") });
  },
} satisfies ExportedHandler<Env>;
