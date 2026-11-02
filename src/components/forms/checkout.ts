import { loadStripe, type StripeEmbeddedCheckout } from "@stripe/stripe-js";

export interface Opened {
  id: string;
  clientSecret: string;
  publishableKey: string;
}

export interface Paid {
  status: "paid" | "processing";
  amount: number;
  name: string | null;
  group?: string;
  problem: string | null;
  day: number | null;
}

export type Outcome = Paid | { status: "closed" };

interface Status extends Omit<Paid, "status"> {
  status: Paid["status"] | "open" | "expired";
}

const CONFIRM_TRIES = 15;
const CONFIRM_GAP_MS = 1000;

export async function startCheckout(body: { amount: number; anonymous: boolean; problem?: string; day?: number }): Promise<Opened> {
  const response = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error((await response.text()) || "Checkout didn’t open. Mind trying again?");
  return (await response.json()).checkout;
}

export async function checkoutStatus(id: string): Promise<Status | null> {
  const response = await fetch(`/api/checkout/${encodeURIComponent(id)}`, { headers: { Accept: "application/json" } }).catch(() => null);
  return response?.ok ? response.json() : null;
}

// Stripe tells the page as soon as a payment goes through, then the Worker checks with Stripe before anything counts.
async function confirm(id: string): Promise<Paid> {
  let last: Status | null = null;
  for (let i = 0; i < CONFIRM_TRIES; i++) {
    last = (await checkoutStatus(id)) ?? last;
    if (last?.status === "paid") return { ...last, status: "paid" };
    await new Promise((resolve) => setTimeout(resolve, CONFIRM_GAP_MS));
  }
  return { amount: 0, name: null, problem: null, day: null, ...last, status: "processing" };
}

// Opens Stripe's checkout in the page's checkout dialog and settles once they've paid or closed it.
export async function pay(open: () => Promise<Opened>, title: string): Promise<Outcome> {
  const dialog = document.querySelector<HTMLDialogElement>("dialog#checkout")!;
  const status = dialog.querySelector<HTMLElement>("[data-checkout-status]")!;
  const mount = dialog.querySelector<HTMLElement>("[data-checkout-mount]")!;
  dialog.querySelector("[data-checkout-title]")!.textContent = title;
  status.textContent = "Opening checkout…";
  mount.replaceChildren();
  dialog.showModal();

  let embedded: StripeEmbeddedCheckout | undefined;
  let confirming = false;
  const holdOpen = (event: Event) => confirming && event.preventDefault();
  const closer = dialog.querySelector<HTMLButtonElement>("[data-checkout-close]")!;
  const closeClicked = () => confirming || dialog.close();
  dialog.addEventListener("cancel", holdOpen);
  closer.addEventListener("click", closeClicked);

  const outcome = await new Promise<Outcome>((settle) => {
    dialog.addEventListener("close", () => settle({ status: "closed" }), { once: true });
    (async () => {
      const opened = await open();
      window.posthog?.capture("checkout_started", { title });
      const stripe = await loadStripe(opened.publishableKey);
      if (!stripe) throw new Error("Stripe didn’t load. Mind trying again?");
      embedded = await stripe.createEmbeddedCheckoutPage({
        clientSecret: opened.clientSecret,
        onComplete: async () => {
          confirming = true;
          closer.disabled = true;
          status.textContent = "Checking your payment with Stripe…";
          settle(await confirm(opened.id));
        },
      });
      if (!dialog.open) return embedded.destroy();
      status.textContent = "";
      embedded.mount(mount);
    })().catch((error: Error) => {
      status.textContent = error.message;
    });
  });

  dialog.removeEventListener("cancel", holdOpen);
  closer.removeEventListener("click", closeClicked);
  closer.disabled = false;
  embedded?.destroy();
  if (dialog.open) dialog.close();
  if (outcome.status === "closed") window.posthog?.capture("checkout_closed", { title });
  return outcome;
}

// Payment methods that leave the page come back with ?checkout=. Asking about it saves the payment, and the address
// bar swaps it for a link to whatever was sponsored.
export async function confirmReturn() {
  const url = new URL(location.href);
  const id = url.searchParams.get("checkout");
  if (!id) return;
  const paid = await checkoutStatus(id);
  url.searchParams.delete("checkout");
  if (paid?.problem) url.searchParams.set("idea", paid.problem);
  else if (paid?.day) url.searchParams.set("day", String(paid.day));
  history.replaceState(history.state, "", url);
}
