import { readFileSync } from "node:fs";
import { afterEach, describe, expect, test, vi } from "vitest";
import { StripeError, openCheckout, recordPayment, statusOf, type CheckoutSession } from "./checkout";
import { addProblem, testDb } from "./test-db";

const env = { STRIPE_SECRET_KEY: "sk_test_fake", STRIPE_PUBLISHABLE_KEY: "pk_test_fake", STRIPE_SPONSOR_PRODUCT: "prod_fake" } as Env;

const session = (overrides: Partial<CheckoutSession> = {}): CheckoutSession => ({
  id: "cs_test_1",
  status: "complete",
  payment_status: "paid",
  amount_total: 4000,
  currency: "usd",
  livemode: false,
  client_reference_id: null,
  metadata: {},
  customer_details: { email: "Payer@Example.com" },
  ...overrides,
});

afterEach(() => vi.unstubAllGlobals());

function stubStripe() {
  const sent: URLSearchParams[] = [];
  vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
    sent.push(init.body as URLSearchParams);
    return Response.json({ id: "cs_test_new", client_secret: "cs_test_new_secret" });
  });
  return sent;
}

describe("openCheckout", () => {
  test("opens an embedded session for the amount on the Sponsor product, tied to the problem", async () => {
    const sent = stubStripe();
    const opened = await openCheckout(env, { cents: 4000, problemId: "p1", email: "a@example.com", name: "Ada", origin: "https://build40for40.com" });

    expect(opened).toEqual({ id: "cs_test_new", clientSecret: "cs_test_new_secret", publishableKey: "pk_test_fake" });
    const body = Object.fromEntries(sent[0]);
    expect(body).toMatchObject({
      ui_mode: "embedded_page",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": "4000",
      "line_items[0][price_data][product]": "prod_fake",
      client_reference_id: "p1",
      customer_email: "a@example.com",
      "metadata[name]": "Ada",
      redirect_on_completion: "if_required",
      return_url: "https://build40for40.com/?checkout={CHECKOUT_SESSION_ID}",
    });
    expect(Object.keys(body).some((key) => key.startsWith("custom_fields"))).toBe(false);
  });

  test("brands the session in the dialog's night panel and lime from the theme", async () => {
    const sent = stubStripe();
    await openCheckout(env, { cents: 400, day: 11, origin: "http://localhost:4321" });

    const theme = readFileSync(new URL("../src/styles/global.css", import.meta.url), "utf8");
    const token = (name: string) => theme.match(new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6})`))?.[1];
    expect(Object.fromEntries([...sent[0]].filter(([key]) => key.startsWith("branding_settings")))).toEqual({
      "branding_settings[background_color]": token("night-panel"),
      "branding_settings[button_color]": token("brand-lime"),
      "branding_settings[border_style]": "rounded",
      "branding_settings[font_family]": "inconsolata",
    });
  });

  test("asks for a name on the site unless they'd rather stay anonymous", async () => {
    const sent = stubStripe();
    await openCheckout(env, { cents: 400, day: 11, origin: "http://localhost:4321" });
    await openCheckout(env, { cents: 400, day: 11, anonymous: true, origin: "http://localhost:4321" });

    expect(sent[0].get("custom_fields[0][key]")).toBe("credit");
    expect(sent[0].get("metadata[day]")).toBe("11");
    expect(sent[1].has("custom_fields[0][key]")).toBe(false);
  });

  test("passes on Stripe's reason when it says no, and refuses without a key", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ error: { message: "Amount must be no more than $999,999.99" } }, { status: 400 }));
    await expect(openCheckout(env, { cents: 400_000_000, day: 11, origin: "" })).rejects.toThrow("Amount must be no more than $999,999.99");
    await expect(openCheckout({ ...env, STRIPE_SECRET_KEY: "" }, { cents: 400, day: 11, origin: "" })).rejects.toBeInstanceOf(StripeError);
  });
});

describe("recordPayment", () => {
  test("saves a paid session once and brings its problem out of hiding", async () => {
    const { db, sqlite } = testDb();
    const id = addProblem(sqlite, { awaiting: true });
    const paid = session({ client_reference_id: id, metadata: { name: "Ada" } });

    expect(await recordPayment(db, paid, "2026-11-02T10:00:00.000Z")).toBe(true);
    expect(await recordPayment(db, paid, "2026-11-02T10:00:05.000Z")).toBe(false);

    expect(sqlite.prepare("SELECT awaiting_payment FROM problems WHERE id = ?").get(id)).toEqual({ awaiting_payment: 0 });
    expect(sqlite.prepare("SELECT email, problem_id, name, amount, paid_at FROM payments").all()).toEqual([
      { email: "payer@example.com", problem_id: id, name: "Ada", amount: 4000, paid_at: "2026-11-02T10:00:00.000Z" },
    ]);
  });

  test("credits the name typed at checkout, and keeps only guest days", async () => {
    const { db, sqlite } = testDb();
    await recordPayment(db, session({ id: "cs_test_a", metadata: { day: "11" }, custom_fields: [{ key: "credit", text: { value: "  Grace  " } }] }), "t");
    await recordPayment(db, session({ id: "cs_test_b", metadata: { day: "3" }, client_reference_id: "not-a-problem" }), "t");

    expect(sqlite.prepare("SELECT id, day, name, problem_id FROM payments ORDER BY id").all()).toEqual([
      { id: "cs_test_a", day: 11, name: "Grace", problem_id: null },
      { id: "cs_test_b", day: null, name: null, problem_id: null },
    ]);
  });
});

test("statusOf tells paid from still processing, open and expired", () => {
  expect(statusOf(session())).toBe("paid");
  expect(statusOf(session({ payment_status: "unpaid" }))).toBe("processing");
  expect(statusOf(session({ status: "open", payment_status: "unpaid" }))).toBe("open");
  expect(statusOf(session({ status: "expired", payment_status: "unpaid" }))).toBe("expired");
});
