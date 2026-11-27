// Tells the team about waitlist sign-ups for apps that ask for it, by email through Postmark.
// Without POSTMARK_SERVER_TOKEN it does nothing, so local dev and tests never send mail.

export const NOTIFY_APPS: Record<string, string> = { ember: "Ember" };
export const TEAM_INBOX = "hello@40for40.app";

export interface SignUp {
  app: string;
  name?: string;
  email: string;
  firm?: string;
  note?: string;
}

export function signUpEmail({ app, name, email, firm, note }: SignUp) {
  const label = NOTIFY_APPS[app] ?? app;
  const who = [name, firm].filter(Boolean).join(" at ") || email;
  const lines = [
    `Someone joined the ${label} waitlist on build40for40.com/${app}/.`,
    "",
    `Name: ${name ?? "(not given)"}`,
    `Email: ${email}`,
    `Company: ${firm ?? "(not given)"}`,
    `Note: ${note ?? "(none)"}`,
    "",
    "Reply to this email to write straight back to them.",
  ];
  return {
    From: "40 for 40 <noreply@build40for40.com>",
    To: TEAM_INBOX,
    ReplyTo: email,
    Subject: `New ${label} sign-up: ${who}`,
    TextBody: lines.join("\n"),
    MessageStream: "outbound",
  };
}

export async function notifySignUp(token: string | undefined, signUp: SignUp, send: typeof fetch = fetch) {
  if (!token || !NOTIFY_APPS[signUp.app]) return false;
  const response = await send("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", "X-Postmark-Server-Token": token },
    body: JSON.stringify(signUpEmail(signUp)),
  });
  if (!response.ok) throw new Error(`Postmark said ${response.status}`);
  return true;
}
