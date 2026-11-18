// The "you're on the list" email for an app's waiting list, sent through the site's own Postmark server.
// Only apps listed here get one. Nothing is sent until POSTMARK_SERVER_TOKEN and EMAIL_FROM are set.

const API = "https://api.postmarkapp.com/email";
const TIMEOUT_MS = 15_000;

export const WAITLIST_APPS: Record<string, string> = {
  poppy: "Poppy",
  handup: "Handup",
};

type Fetch = (input: string, init: RequestInit) => Promise<Response>;

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function waitlistEmail(app: string, name: string | null) {
  const appName = WAITLIST_APPS[app];
  const first = name?.trim().split(/\s+/)[0] || "there";
  const paragraphs = [
    `Hi ${first},`,
    `You're on the ${appName} waiting list. Due to insane demand we had to put one up, and you made it on.`,
    "We'll email you the moment there's room for you.",
    "The 40 for 40 team",
  ];
  return {
    subject: `You're on the ${appName} waiting list`,
    text: [...paragraphs, "https://build40for40.com"].join("\n\n"),
    html:
      paragraphs.map((p) => `<p>${escape(p)}</p>`).join("") +
      `<p><a href="https://build40for40.com/${app}/">build40for40.com/${app}</a></p>`,
  };
}

export async function sendWaitlistEmail(env: Env, app: string, to: string, name: string | null, fetchImpl: Fetch = fetch) {
  if (!WAITLIST_APPS[app] || !env.POSTMARK_SERVER_TOKEN || !env.EMAIL_FROM) return;
  const email = waitlistEmail(app, name);
  const response = await fetchImpl(API, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", "X-Postmark-Server-Token": env.POSTMARK_SERVER_TOKEN },
    body: JSON.stringify({
      From: `${WAITLIST_APPS[app]} <${env.EMAIL_FROM}>`,
      To: to,
      Subject: email.subject,
      TextBody: email.text,
      HtmlBody: email.html,
      MessageStream: env.POSTMARK_STREAM || "outbound",
      Tag: `waitlist-${app}`,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  // Postmark's messages can quote the address, so only the code is logged.
  const code = ((await response.json().catch(() => null)) as { ErrorCode?: number } | null)?.ErrorCode;
  if (!response.ok || code) console.error(`Waitlist email for ${app} failed: Postmark ${response.status}, code ${code ?? "none"}`);
}
