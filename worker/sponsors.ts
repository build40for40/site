import type { Sponsor } from "../src/data/days";

export interface SponsorPayment {
  name: string | null;
  email: string | null;
  amount: number;
}

// Only named sponsors can share an identity. A keyed token keeps their email private,
// including when the browser credits a new payment before the next refresh.
export async function sponsorGroup(name: string | null, email: string | null, secret?: string) {
  if (!name || name === "Anonymous" || !email?.trim() || !secret) return undefined;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(`sponsor:${email.trim().toLowerCase()}`)));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function publicSponsors(payments: SponsorPayment[], secret?: string): Promise<Sponsor[]> {
  const rows: SponsorPayment[] = [];
  const named = new Map<string, SponsorPayment>();
  for (const payment of payments) {
    const email = payment.email?.trim().toLowerCase();
    if (!payment.name || payment.name === "Anonymous" || !email) {
      rows.push({ ...payment });
      continue;
    }
    const previous = named.get(email);
    if (previous) previous.amount += payment.amount;
    else {
      const row = { ...payment };
      named.set(email, row);
      rows.push(row);
    }
  }
  return Promise.all(rows.map(async ({ name, email, amount }) => {
    const group = await sponsorGroup(name, email, secret);
    return { name: name || "Anonymous", amount: amount / 100, ...(group ? { group } : {}) };
  }));
}
