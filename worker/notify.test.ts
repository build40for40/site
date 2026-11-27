import { describe, expect, test } from "vitest";
import { notifySignUp, signUpEmail } from "./notify";

const fake = () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const send = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response("{}", { status: 200 });
  }) as unknown as typeof fetch;
  return { calls, send };
};

describe("sign-up emails", () => {
  test("emails the team inbox about an Ember sign-up, with reply going to the person", async () => {
    const { calls, send } = fake();
    const sent = await notifySignUp("token", { app: "ember", name: "Fen", email: "fen@example.com", firm: "Example Events", note: "Records in: FileMaker." }, send);

    expect(sent).toBe(true);
    expect(calls[0].url).toBe("https://api.postmarkapp.com/email");
    expect((calls[0].init.headers as Record<string, string>)["X-Postmark-Server-Token"]).toBe("token");
    const body = JSON.parse(String(calls[0].init.body));
    expect(body).toMatchObject({
      To: "hello@40for40.app",
      ReplyTo: "fen@example.com",
      Subject: "New Ember sign-up: Fen at Example Events",
      MessageStream: "outbound",
    });
    expect(body.TextBody).toContain("Note: Records in: FileMaker.");
  });

  test("sends nothing without a token, or for apps that didn't ask", async () => {
    const { calls, send } = fake();
    expect(await notifySignUp(undefined, { app: "ember", email: "a@example.com" }, send)).toBe(false);
    expect(await notifySignUp("token", { app: "synergy", email: "a@example.com" }, send)).toBe(false);
    expect(calls).toHaveLength(0);
  });

  test("falls back to the email in the subject when there's no name or company", () => {
    expect(signUpEmail({ app: "ember", email: "a@example.com" }).Subject).toBe("New Ember sign-up: a@example.com");
  });
});
