import { TOTAL_DAYS, helpTypes, involvement, sponsorAmounts } from "../src/data/site";

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
    { name: "sponsor", options: sponsorAmounts.map((amount) => amount.value) },
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const form = url.pathname.match(/^\/api\/forms\/([a-z]+)\/?$/)?.[1];
    const fields = form && Object.hasOwn(forms, form) ? forms[form] : undefined;
    if (!form || !fields) return text("Not found.", 404);
    if (request.method !== "POST") return new Response("Method not allowed.", { status: 405, headers: { Allow: "POST" } });

    const origin = request.headers.get("Origin");
    if (origin && origin !== url.origin) return text("Forbidden.", 403);

    const thanks = Response.redirect(new URL("/thanks/", url).href, 303);
    let data: FormData;
    try {
      data = await request.formData();
    } catch {
      return text("Bad request.", 400);
    }
    // Honeypot: bots fill in every field, people never see this one.
    if (data.get("website")) return thanks;

    const values = parse(fields, data);
    const now = new Date().toISOString();

    // Join works with or without an email: save valid ones, then carry whatever was typed to the full form.
    if (form === "subscribe") {
      if (typeof values !== "string" && values.email) {
        const key = `join:${values.email}`;
        if (!(await env.FORMS.get(key))) await env.FORMS.put(key, JSON.stringify({ joinedAt: now, updatedAt: now, ...values }));
      }
      const typed = String(data.get("email") ?? "").trim();
      return Response.redirect(new URL(typed ? `/join/#email=${encodeURIComponent(typed)}` : "/join/", url).href, 303);
    }

    if (typeof values === "string") return text(values, 400);

    if (form === "join") {
      // An amount only counts while Sponsor is ticked, since unticking hides the amounts but keeps the choice.
      const sponsoring = [values.involved ?? []].flat().includes("sponsor");
      const amount = sponsoring ? sponsorAmounts.find(({ value }) => value === values.sponsor) : undefined;
      if (!sponsoring) delete values.sponsor;

      const key = `join:${values.email}`;
      const previous = await env.FORMS.get<Record<string, unknown>>(key, "json");
      await env.FORMS.put(key, JSON.stringify({ joinedAt: now, ...previous, ...values, updatedAt: now }));

      // Only the real domain takes real money: localhost and workers.dev previews use the sandbox.
      const live = url.hostname === "build40for40.com" || url.hostname.endsWith(".build40for40.com");
      const link = live ? amount?.link : amount?.testLink;
      if (!link) return thanks;
      const checkout = new URL(link);
      checkout.searchParams.set("prefilled_email", String(values.email));
      return Response.redirect(checkout.href, 303);
    }

    await env.FORMS.put(`${form}:${now}:${crypto.randomUUID()}`, JSON.stringify({ submittedAt: now, ...values }));
    return thanks;
  },
} satisfies ExportedHandler<Env>;
