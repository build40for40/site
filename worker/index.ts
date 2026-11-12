import { GUEST_DAYS } from "../src/data/days";
import { TOTAL_DAYS, backings, helpTypes, involvement, isSponsorCents, SPONSOR_MIN, SPONSOR_MAX, money } from "../src/data/site";
import { categoriseProblem, verdict, type Sorted } from "./categories";
import { StripeError, openCheckout, readCheckout, recordPayment, statusOf, summary, type CheckoutSession, type Sponsoring } from "./checkout";
import { jevClassifier } from "./classifier";
import { intentRoute } from "./intent";
import { MAX_PROMPT, allowed, anthropicDrawer, trendIndex } from "./nerds";
import { listProblems } from "./problems";
import { searchIdeas } from "./search";
import { fetchFeed, listShorts, syncShorts } from "./shorts";
import { publicSponsors, sponsorGroup, type SponsorPayment } from "./sponsors";
import { anthropicTitler, titleProblem } from "./titles";

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
const newsletter: Field = { name: "newsletter", options: ["yes"] };
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
    { name: "sponsor" },
    { name: "contact", options: ["yes"] },
    newsletter,
  ],
  help: [
    name,
    email,
    { name: "company", max: 200 },
    { name: "type", required: true, options: helpTypes.map((type) => type.value) },
    { name: "note", max: 1000 },
    newsletter,
  ],
  guest: [
    name,
    email,
    { name: "role", required: true, max: 200 },
    { name: "nominated_by", max: 200 },
    { name: "bring", required: true, max: 1000 },
    { name: "availability", options: weeks, multiple: true },
    newsletter,
  ],
  access: [
    name,
    email,
    { name: "firm", max: 200 },
    { name: "app", required: true, options: ["synergy", "sous"] },
    { name: "note", max: 1000 },
    newsletter,
  ],
  problem: [
    name,
    email,
    { name: "problem", required: true, max: 500 },
    { name: "affects", required: true, max: 200 },
    newsletter,
  ],
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const amountError = `Pick a whole USD amount from ${money(SPONSOR_MIN)} to ${money(SPONSOR_MAX)}.`;

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
  newsletter: boolean;
  now: string;
}

// A later form fills in or changes answers but never clears one it left out. Newsletter consent keeps its first time.
const upsertPerson = (db: D1Database, { email, name, involved, helpNote, guestNote, newsletter, now }: Person) =>
  db
    .prepare(
      `INSERT INTO people (email, name, involved, help_note, guest_note, newsletter_at, joined_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)
       ON CONFLICT (email) DO UPDATE SET
         name = coalesce(excluded.name, name),
         involved = coalesce(excluded.involved, involved),
         help_note = coalesce(excluded.help_note, help_note),
         guest_note = coalesce(excluded.guest_note, guest_note),
         newsletter_at = coalesce(newsletter_at, excluded.newsletter_at),
         updated_at = excluded.updated_at`,
    )
    .bind(email, name, involved, helpNote, guestNote, newsletter ? now : null, now);

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
  data: { object: CheckoutSession };
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

  if (await recordPayment(env.DB, session, new Date(event.created * 1000).toISOString())) paymentCompleted(env, ctx, session);
  return text("Saved.", 200);
}

// Stripe calls from its own servers, so this can't be tied to the visitor's cookieless id.
const paymentCompleted = (env: Env, ctx: ExecutionContext, session: CheckoutSession) =>
  ctx.waitUntil(capture(env, "payment_completed", session.id, { amount: session.amount_total ?? 0, currency: session.currency, livemode: session.livemode }));

// Checkout on the page tells it when a payment goes through, and the page asks here. Stripe is asked directly rather
// than waiting on the webhook.
async function checkoutStatus(env: Env, ctx: ExecutionContext, id: string) {
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(id)) return text("Not found.", 404);
  let session: CheckoutSession;
  try {
    session = await readCheckout(env, id);
  } catch (error) {
    return text(error instanceof StripeError ? error.message : "Couldn’t reach Stripe.", 502);
  }
  if (statusOf(session) === "paid" && (await recordPayment(env.DB, session, new Date().toISOString()))) paymentCompleted(env, ctx, session);
  const payment = summary(session);
  const group = await sponsorGroup(payment.name, session.customer_details?.email ?? null, env.STRIPE_SECRET_KEY);
  return json({ ...payment, ...(group ? { group } : {}) });
}

const isGuestDay = (day: unknown): day is number => typeof day === "number" && GUEST_DAYS.has(day);

async function startCheckout(request: Request, env: Env) {
  const input = (await request.json().catch(() => null)) as { amount?: unknown; problem?: unknown; day?: unknown; anonymous?: unknown } | null;
  if (!input || !isSponsorCents(input.amount)) return text(amountError, 400);
  const day = isGuestDay(input.day) ? input.day : undefined;
  const problemId = typeof input.problem === "string" ? input.problem : undefined;
  const whole = input.day === undefined && input.problem === undefined;
  if (!whole && Boolean(day) === Boolean(problemId)) return text("Sponsor a problem, a guest day or the whole thing.", 400);
  if (problemId && !(await env.DB.prepare("SELECT 1 FROM problems WHERE id = ?1 AND awaiting_payment = 0").bind(problemId).first())) {
    return text("That problem isn’t up for sponsoring.", 404);
  }
  return openCheckoutResponse(env, { cents: input.amount, problemId, day, anonymous: input.anonymous === true, origin: new URL(request.url).origin });
}

async function openCheckoutResponse(env: Env, sponsoring: Sponsoring, extra: Record<string, unknown> = {}) {
  if (!env.STRIPE_SECRET_KEY) return text("Payments aren’t set up here yet.", 503);
  try {
    return json({ ...extra, checkout: await openCheckout(env, sponsoring) });
  } catch (error) {
    return text(error instanceof StripeError ? `Stripe said no: ${error.message}` : "Couldn’t reach Stripe. Mind trying again?", 502);
  }
}

async function guestDays(_request: Request, env: Env) {
  const { results } = await env.DB.prepare("SELECT day, name, email, amount FROM payments WHERE day IS NOT NULL ORDER BY paid_at").all<SponsorPayment & { day: number }>();
  const payments: Record<number, SponsorPayment[]> = {};
  for (const payment of results) (payments[payment.day] ??= []).push(payment);
  const sponsors = Object.fromEntries(await Promise.all(Object.entries(payments).map(async ([day, rows]) => [day, await publicSponsors(rows, env.STRIPE_SECRET_KEY)])));
  return json({ sponsors, shorts: await listShorts(env.DB) });
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
      sponsorSecret: env.STRIPE_SECRET_KEY,
    }),
  );
}

const classifierFor = (env: Env, timeoutMs?: number) =>
  env.TYPESAFE_API_KEY ? jevClassifier({ apiKey: env.TYPESAFE_API_KEY, baseUrl: env.TYPESAFE_API_URL || undefined, timeoutMs }) : undefined;

const titlerFor = (env: Env) => (env.ANTHROPIC_API_KEY ? anthropicTitler({ apiKey: env.ANTHROPIC_API_KEY }) : undefined);

// Lets the team find problems that fit no category, or might be junk, without the problem's text leaving the Worker.
const reportSorted = (env: Env, ctx: ExecutionContext, via: string) => (id: string, sorted: Sorted) =>
  ctx.waitUntil(capture(env, "problem_categorised", id, { problem_id: id, via, model: sorted.model, ...verdict(sorted) }).catch(() => {}));

const edgeCache = () => (typeof caches === "undefined" ? undefined : (caches as unknown as { default: Cache }).default);

async function poolSearch(request: Request, env: Env) {
  const query = new URL(request.url).searchParams.get("q") ?? "";
  const classifier = classifierFor(env);
  const cache = edgeCache();
  return json({ query, ...(await searchIdeas(query, { db: env.DB, classifier, cache })) });
}

const problem = (error: string, status: number) => Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

// Nerds of Fashion: turn a question into a chart spec. See worker/nerds.ts.
async function nerdsDraw(request: Request, env: Env, ctx: ExecutionContext) {
  if (request.method !== "POST") return new Response("Method not allowed.", { status: 405, headers: { Allow: "POST" } });
  const url = new URL(request.url);
  const origin = request.headers.get("Origin");
  if (origin && origin !== url.origin) return text("Forbidden.", 403);
  if (!env.ANTHROPIC_API_KEY) return problem("Claude's off duty on this server.", 503);
  let question = "";
  try {
    question = String(((await request.json()) as { question?: unknown }).question ?? "").trim();
  } catch {
    return problem("That didn't look like a question.", 400);
  }
  if (!question) return problem("Ask us something first.", 400);
  if (question.length > MAX_PROMPT) return problem(`Keep it under ${MAX_PROMPT} characters, it's a chart not an essay.`, 400);
  const cache = edgeCache();
  const cacheKey = new Request(`https://nerds-draw.cache/?q=${encodeURIComponent(question.toLowerCase())}`);
  const hit = await cache?.match(cacheKey).catch(() => undefined);
  const report = (spec: { chart: string; trends: string[] }, ms: number, cached: boolean) => {
    const outcome = { question_length: question.length, chart: spec.chart, trends: spec.trends, ms, cached };
    console.log(JSON.stringify({ event: "nerds_draw", ...outcome }));
    ctx.waitUntil(capture(env, "nerds_chart_drawn", "$posthog_cookieless", { ...cookieless(request), ...outcome }).catch(() => {}));
  };
  if (hit) {
    const answer = (await hit.json()) as { spec: { chart: string; trends: string[] } };
    report(answer.spec, 0, true);
    return json(answer);
  }
  if (!allowed(request.headers.get("CF-Connecting-IP") ?? "local")) return problem("You've drawn a lot this hour. Have a breather and try again later.", 429);
  try {
    const dataset = new URL("/nerds-of-fashion/fashion.json", url);
    const index = await trendIndex(() => (env.ASSETS ? env.ASSETS.fetch(dataset) : fetch(dataset)));
    const started = Date.now();
    const spec = await anthropicDrawer({ apiKey: env.ANTHROPIC_API_KEY }).draw(question, index, request.signal);
    report(spec, Date.now() - started, false);
    if (cache) ctx.waitUntil(cache.put(cacheKey, Response.json({ spec }, { headers: { "Cache-Control": "max-age=86400" } })).catch(() => {}));
    return json({ spec });
  } catch (error) {
    console.error("nerds draw", error);
    return problem("Claude dropped the pencil. Try asking a different way.", 502);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (/^\/api\/stripe\/webhook\/?$/.test(url.pathname)) return stripeWebhook(request, env, ctx);
    if (/^\/api\/nerds-of-fashion\/intent\/?$/.test(url.pathname)) return intentRoute(request, { classifier: classifierFor(env), cache: edgeCache() });
    if (/^\/api\/nerds-of-fashion\/draw\/?$/.test(url.pathname)) return nerdsDraw(request, env, ctx);

    const read = { "/api/problems": problems, "/api/pool/search": poolSearch, "/api/days": guestDays }[url.pathname.replace(/\/$/, "")];
    const session = url.pathname.match(/^\/api\/checkout\/([^/]+)\/?$/)?.[1];
    if (read || session) {
      if (request.method !== "GET") return new Response("Method not allowed.", { status: 405, headers: { Allow: "GET" } });
      return session ? checkoutStatus(env, ctx, session) : read!(request, env);
    }

    const starting = /^\/api\/checkout\/?$/.test(url.pathname);
    const form = url.pathname.match(/^\/api\/forms\/([a-z]+)\/?$/)?.[1];
    const fields = form && Object.hasOwn(forms, form) ? forms[form] : undefined;
    if (!starting && (!form || !fields)) return text("Not found.", 404);
    if (request.method !== "POST") return new Response("Method not allowed.", { status: 405, headers: { Allow: "POST" } });

    const origin = request.headers.get("Origin");
    if (origin && origin !== url.origin) return text("Forbidden.", 403);
    if (starting || !form || !fields) return startCheckout(request, env);

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
    if (values.sponsor && !isSponsorCents(Number(values.sponsor))) return text(amountError, 400);
    if (values.backing === "sponsor" && values.problem && !env.STRIPE_SECRET_KEY) return text("Payments aren’t set up here yet.", 503);

    const id = crypto.randomUUID();
    const problemId = values.problem ? id : undefined;
    const sponsoring = Boolean(problemId) && values.backing === "sponsor";
    const json = (value: string | string[] | undefined) => (value ? JSON.stringify(value) : null);
    // A note only counts while its box is ticked, since unticking hides the note but keeps what was typed.
    const note = (value: string, field: string) => ([values.involved ?? []].flat().includes(value) && values[field] ? String(values[field]) : null);

    const record =
      form === "access"
        ? env.DB.prepare("INSERT INTO access_requests (id, email, app, firm, note, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)").bind(
            id,
            values.email,
            values.app,
            values.firm ?? null,
            values.note ?? null,
            now,
          )
        : form === "help"
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
            ? env.DB.prepare(
                "INSERT INTO problems (id, email, problem, affects, backing, pledge, contact, awaiting_payment, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
              ).bind(
                problemId,
                values.email,
                values.problem,
                values.affects ?? null,
                values.backing ?? null,
                values.backing === "sponsor" ? Number(values.sponsor) : null,
                form === "join" ? Number(values.contact === "yes") : null,
                Number(sponsoring),
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
        newsletter: values.newsletter === "yes",
        now,
      }),
      ...(record ? [record] : []),
    ]);
    track("form_saved", { form_type: form, involvement: values.involved, backing: values.backing, newsletter: values.newsletter === "yes" });

    const classifier = problemId && classifierFor(env, CATEGORISE_TIMEOUT_MS);
    if (problemId && classifier) ctx.waitUntil(categoriseProblem(env.DB, classifier, problemId, reportSorted(env, ctx, "submit")).catch(() => {}));
    const titler = problemId && titlerFor(env);
    if (problemId && titler) ctx.waitUntil(titleProblem(env.DB, titler, problemId).catch(() => {}));

    if (sponsoring) {
      const name = String(values.name ?? "").split(/\s+/)[0] || null;
      return openCheckoutResponse(env, { cents: Number(values.sponsor), problemId, email: String(values.email), name, origin: url.origin }, { problem: problemId });
    }
    if (request.headers.get("Accept")?.includes("application/json")) return Response.json({ problem: problemId ?? null });
    return form === "access" ? Response.redirect(new URL(`/${values.app}/#requested`, url).href, 303) : home;
  },

  // Every morning, pick up the short posted after the last build and file it under its day.
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(syncShorts(env.DB, fetchFeed));
  },
} satisfies ExportedHandler<Env>;
