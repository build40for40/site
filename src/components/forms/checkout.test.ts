// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const stripe = { complete: () => {}, mounted: false, destroyed: false };
vi.mock("@stripe/stripe-js", () => ({
  loadStripe: async () => ({
    createEmbeddedCheckoutPage: async ({ onComplete }: { onComplete: () => void }) => {
      stripe.complete = onComplete;
      return {
        mount: () => (stripe.mounted = true),
        destroy: () => (stripe.destroyed = true),
      };
    },
  }),
}));

const { pay } = await import("./checkout");

let statuses: string[] = [];
const opened = async () => ({ id: "cs_test_1", clientSecret: "secret", publishableKey: "pk_test" });
const dialog = () => document.querySelector("dialog")!;

beforeEach(() => {
  Object.assign(stripe, { mounted: false, destroyed: false });
  document.body.innerHTML = `<dialog id="checkout"><h2 data-checkout-title></h2><button data-checkout-close></button><p data-checkout-status></p><div data-checkout-mount></div></dialog>`;
  vi.stubGlobal("fetch", async () => Response.json({ status: statuses.shift() ?? "open", amount: 40, name: "Ada", problem: "p1", day: null }));
});

afterEach(() => vi.unstubAllGlobals());

const until = (check: () => boolean) => vi.waitFor(() => expect(check()).toBe(true));

test("settles as paid once the Worker confirms it, and tidies the dialog away", async () => {
  statuses = ["paid"];
  const outcome = pay(opened, "Sponsor $40");
  await until(() => stripe.mounted);
  expect(dialog().open).toBe(true);
  stripe.complete();

  expect(await outcome).toEqual({ status: "paid", amount: 40, name: "Ada", problem: "p1", day: null });
  expect(dialog().open).toBe(false);
  expect(stripe.destroyed).toBe(true);
});

test("can't be closed while the payment is being checked", async () => {
  statuses = ["open", "paid"];
  const outcome = pay(opened, "Sponsor $40");
  await until(() => stripe.mounted);
  stripe.complete();
  document.querySelector<HTMLButtonElement>("[data-checkout-close]")!.click();
  expect(dialog().open).toBe(true);
  expect((await outcome).status).toBe("paid");
});

test("closing it before paying settles as closed", async () => {
  const outcome = pay(opened, "Sponsor $40");
  await until(() => stripe.mounted);
  document.querySelector<HTMLButtonElement>("[data-checkout-close]")!.click();
  expect(await outcome).toEqual({ status: "closed" });
  expect(stripe.destroyed).toBe(true);
});

test("shows why checkout didn't open", async () => {
  const outcome = pay(async () => Promise.reject(new Error("Stripe said no: nope")), "Sponsor $40");
  await until(() => document.querySelector("[data-checkout-status]")!.textContent === "Stripe said no: nope");
  dialog().close();
  expect((await outcome).status).toBe("closed");
});
