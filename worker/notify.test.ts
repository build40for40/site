import { describe, expect, test } from "vitest";
import { accessEmail, notifyAccessRequest } from "./notify";

const signup = {
  app: "ember",
  name: "Fen Example",
  email: "fen@example.com",
  firm: "Example Events",
  note: "Records in: FileMaker.",
  createdAt: "2026-11-27T16:05:00.000Z",
};

describe("access request emails", () => {
  test("writes an Ember sign-up up for the team inbox, with a reply-to the person", () => {
    const message = accessEmail(signup);
    expect(message).toMatchObject({
      To: "hello@40for40.app",
      From: '"Ember waitlist" <noreply@build40for40.com>',
      ReplyTo: "fen@example.com",
      Subject: "New Ember waitlist sign-up: Example Events",
      MessageStream: "outbound",
    });
    expect(message?.TextBody).toContain("Note: Records in: FileMaker.");
    expect(message?.TextBody).toContain("27 Nov 2026, 16:05 UK time");
  });

  test("ignores apps that haven't asked for emails", () => {
    expect(accessEmail({ ...signup, app: "poppy" })).toBeNull();
  });

  test("sends nothing without a Postmark token", async () => {
    let called = false;
    const sent = await notifyAccessRequest({ POSTMARK_SERVER_TOKEN: "" }, signup, (async () => {
      called = true;
      return new Response("{}");
    }) as typeof fetch);
    expect(sent).toBe(false);
    expect(called).toBe(false);
  });

  test("posts to Postmark with the server token", async () => {
    let request: { url: string; init?: RequestInit } | undefined;
    const sent = await notifyAccessRequest({ POSTMARK_SERVER_TOKEN: "test-token" }, signup, (async (url: string, init?: RequestInit) => {
      request = { url, init };
      return new Response("{}", { status: 200 });
    }) as typeof fetch);
    expect(sent).toBe(true);
    expect(request?.url).toBe("https://api.postmarkapp.com/email");
    expect((request?.init?.headers as Record<string, string>)["X-Postmark-Server-Token"]).toBe("test-token");
    expect(JSON.parse(String(request?.init?.body)).To).toBe("hello@40for40.app");
  });

  test("throws when Postmark refuses, so the caller can log it", async () => {
    await expect(
      notifyAccessRequest({ POSTMARK_SERVER_TOKEN: "test-token" }, signup, (async () => new Response("{}", { status: 422 })) as typeof fetch),
    ).rejects.toThrow("Postmark said 422");
  });
});
