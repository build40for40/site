import { describe, expect, test, vi } from "vitest";
import { sendWaitlistEmail, waitlistEmail } from "./waitlist";

const env = { POSTMARK_SERVER_TOKEN: "fake-token", EMAIL_FROM: "hello@example.com", POSTMARK_STREAM: "outbound" } as Env;
const ok = () => vi.fn(async () => Response.json({ ErrorCode: 0 }));

describe("waiting list emails", () => {
  test("go out through Postmark from the app's name", async () => {
    const fetchImpl = ok();
    await sendWaitlistEmail(env, "poppy", "mac@example.com", "Mac Smith", fetchImpl);

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.postmarkapp.com/email");
    expect((init.headers as Record<string, string>)["X-Postmark-Server-Token"]).toBe("fake-token");
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ From: "Poppy <hello@example.com>", To: "mac@example.com", Subject: "You're on the Poppy waiting list", MessageStream: "outbound", Tag: "waitlist-poppy" });
    expect(body.TextBody).toContain("Hi Mac,");
    expect(body.TextBody).toContain("Due to insane demand");
  });

  test("aren't sent for apps without a waiting list, or before Postmark is set up", async () => {
    const fetchImpl = ok();
    await sendWaitlistEmail(env, "sous", "mac@example.com", "Mac", fetchImpl);
    await sendWaitlistEmail({ ...env, POSTMARK_SERVER_TOKEN: "" }, "poppy", "mac@example.com", "Mac", fetchImpl);

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test("escape the name in the HTML", () => {
    expect(waitlistEmail("handup", "<b>Ada</b>").html).toContain("Hi &lt;b&gt;Ada&lt;/b&gt;,");
  });

  test("log only the error code when Postmark refuses", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await sendWaitlistEmail(env, "handup", "mac@example.com", null, vi.fn(async () => Response.json({ ErrorCode: 406, Message: "mac@example.com is inactive" }, { status: 422 })));

    expect(log).toHaveBeenCalledWith("Waitlist email for handup failed: Postmark 422, code 406");
    log.mockRestore();
  });
});
