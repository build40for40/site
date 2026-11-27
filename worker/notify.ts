// Tells the team inbox about early access sign-ups for apps that want it, by Postmark.
// Skips quietly when POSTMARK_SERVER_TOKEN isn't set, so local dev and tests send nothing.

const POSTMARK_URL = "https://api.postmarkapp.com/email";
const TEAM_INBOX = "hello@40for40.app";
const FROM = "noreply@build40for40.com";

// Apps whose waitlist sign-ups get an email, with the name to use for them.
const NOTIFY: Record<string, string> = { ember: "Ember" };

export interface AccessRequest {
  app: string;
  name?: string;
  email: string;
  firm?: string;
  note?: string;
  createdAt: string;
}

const london = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" });
const oneLine = (text: string) => text.replace(/[\r\n]+/g, " ").trim();

export function accessEmail(request: AccessRequest) {
  const product = NOTIFY[request.app];
  if (!product) return null;
  const who = request.firm || request.name || request.email;
  const lines = [
    `Someone joined the ${product} waitlist.`,
    "",
    `Name: ${request.name ?? "(not given)"}`,
    `Email: ${request.email}`,
    `Company: ${request.firm ?? "(not given)"}`,
    `Note: ${request.note ?? "(none)"}`,
    `When: ${london.format(new Date(request.createdAt))} UK time`,
    "",
    "Reply to this email to write back to them.",
  ];
  return {
    From: `"${product} waitlist" <${FROM}>`,
    To: TEAM_INBOX,
    ReplyTo: request.email,
    Subject: oneLine(`New ${product} waitlist sign-up: ${who}`).slice(0, 200),
    TextBody: lines.join("\n"),
    MessageStream: "outbound",
  };
}

export async function notifyAccessRequest(env: Pick<Env, "POSTMARK_SERVER_TOKEN">, request: AccessRequest, send: typeof fetch = fetch) {
  const message = accessEmail(request);
  if (!message || !env.POSTMARK_SERVER_TOKEN) return false;
  const response = await send(POSTMARK_URL, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", "X-Postmark-Server-Token": env.POSTMARK_SERVER_TOKEN },
    body: JSON.stringify(message),
  });
  if (!response.ok) throw new Error(`Postmark said ${response.status}`);
  return true;
}
