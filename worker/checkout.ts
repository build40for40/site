import { GUEST_DAYS } from "../src/data/days";
import { SPONSOR_AMOUNTS } from "../src/data/site";

// Pinned to the release Stripe.js is on (@stripe/stripe-js v10 is "endive"), so the session and the page agree.
const STRIPE_VERSION = "2026-10-28.endive";
const NAME_MAX = 50;

// The checkout dialog's night-panel and brand-lime tokens from src/styles/global.css. Inconsolata is Stripe's closest
// font to JetBrains Mono.
const BRANDING ={ background_color: "#10224a", button_color: "#a6e22e", border_style: "rounded", font_family: "inconsolata" };

export const SPONSOR_CENTS = SPONSOR_AMOUNTS.map((amount) => amount * 100);

export interface CheckoutSession {
  id: string;
  status: "open" | "complete" | "expired";
  payment_status: "paid" | "unpaid" | "no_payment_required";
  amount_total: number | null;
  currency: string | null;
  livemode: boolean;
  client_secret?: string | null;
  client_reference_id: string | null;
  metadata: Record<string, string> | null;
  customer_details: { email: string | null } | null;
  custom_fields?: { key: string; text?: { value: string | null } | null }[];
}

export interface Sponsoring {
  cents: number;
  problemId?: string;
  day?: number;
  email?: string;
  // Sent with the join form, where they've already said who they are. Otherwise Checkout asks.
  name?: string | null;
  anonymous?: boolean;
  origin: string;
}

type Params = { [key: string]: string | number | boolean | undefined | null | Params | Params[] };

function encode(params: Params, prefix = "", body = new URLSearchParams()) {
  for (const [key, value] of Object.entries(params)) {
    const name = prefix ? `${prefix}[${key}]` : key;
    if (value === undefined || value === null) continue;
    if (typeof value === "object") encode(value as Params, name, body);
    else body.append(name, String(value));
  }
  return body;
}

export class StripeError extends Error {}

async function stripe<T>(env: Env, path: string, params?: Params): Promise<T> {
  if (!env.STRIPE_SECRET_KEY) throw new StripeError("Payments aren’t set up here yet.");
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: params ? "POST" : "GET",
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "Stripe-Version": STRIPE_VERSION },
    body: params ? encode(params) : undefined,
  });
  const body = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok) throw new StripeError(body.error?.message ?? `Stripe answered ${response.status}.`);
  return body;
}

export async function openCheckout(env: Env, { cents, problemId, day, email, name, anonymous, origin }: Sponsoring) {
  const askName = name === undefined && !anonymous;
  const session = await stripe<CheckoutSession>(env, "checkout/sessions", {
    ui_mode: "embedded_page",
    mode: "payment",
    branding_settings: BRANDING,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: cents,
          ...(env.STRIPE_SPONSOR_PRODUCT ? { product: env.STRIPE_SPONSOR_PRODUCT } : { product_data: { name: "Sponsor 40 for 40" } }),
        },
      },
    ],
    client_reference_id: problemId,
    customer_email: email,
    metadata: { day, name: anonymous ? undefined : name || undefined },
    custom_fields: askName
      ? [{ key: "credit", label: { type: "custom", custom: "Name on the site (optional)" }, type: "text", optional: true, text: { maximum_length: NAME_MAX } }]
      : undefined,
    redirect_on_completion: "if_required",
    return_url: `${origin}/?checkout={CHECKOUT_SESSION_ID}`,
    expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
  });
  return { id: session.id, clientSecret: session.client_secret!, publishableKey: env.STRIPE_PUBLISHABLE_KEY };
}

export const readCheckout = (env: Env, id: string) => stripe<CheckoutSession>(env, `checkout/sessions/${encodeURIComponent(id)}`);

const creditOf = (session: CheckoutSession) => {
  const typed = session.custom_fields?.find((field) => field.key === "credit")?.text?.value;
  return (typed || session.metadata?.name)?.trim().slice(0, NAME_MAX) || null;
};

export const dayOf = (session: CheckoutSession) => {
  const day = Number(session.metadata?.day);
  return GUEST_DAYS.has(day) ? day : null;
};

// Stripe retries and can send an event twice, and the page asks too, so a repeat is a no-op. A problem id from another
// database becomes null. A paid problem comes out of hiding.
export async function recordPayment(db: D1Database, session: CheckoutSession, paidAt: string) {
  const [saved] = await db.batch([
    db
      .prepare(
        `INSERT INTO payments (id, email, problem_id, day, name, amount, currency, livemode, paid_at)
         VALUES (?1, ?2, (SELECT id FROM problems WHERE id = ?3), ?4, ?5, ?6, ?7, ?8, ?9)
         ON CONFLICT (id) DO NOTHING`,
      )
      .bind(
        session.id,
        session.customer_details?.email?.toLowerCase() ?? null,
        session.client_reference_id,
        dayOf(session),
        creditOf(session),
        session.amount_total ?? 0,
        session.currency ?? "",
        session.livemode ? 1 : 0,
        paidAt,
      ),
    db.prepare("UPDATE problems SET awaiting_payment = 0 WHERE id = ?1").bind(session.client_reference_id),
  ]);
  return Boolean(saved.meta.changes);
}

export type CheckoutStatus = "paid" | "processing" | "open" | "expired";

export const statusOf = (session: CheckoutSession): CheckoutStatus =>
  session.status === "complete" ? (session.payment_status === "unpaid" ? "processing" : "paid") : session.status;

export const summary = (session: CheckoutSession) => ({
  status: statusOf(session),
  amount: (session.amount_total ?? 0) / 100,
  name: creditOf(session),
  problem: session.client_reference_id,
  day: dayOf(session),
});
