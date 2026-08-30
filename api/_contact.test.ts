import { describe, it, expect } from "vitest";
import { handleContact, buildEmail, type ContactEnv } from "./_contact.ts";

const env: ContactEnv = {
  RESEND_API_KEY: "test-key",
  CONTACT_EMAIL: "owner@example.com",
  EMAIL_FROM: "Sattva <noreply@example.com>",
};

/** Stub the provider so nothing real is sent. `calls` records the outgoing payload. */
function stubFetch() {
  const calls: { url: string; init: RequestInit; body: Record<string, unknown> }[] = [];
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {}, body: JSON.parse(String(init?.body ?? "{}")) });
    return { ok: true, status: 200, text: async () => "" } as Response;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const valid = {
  name: "John Doe",
  email: "john@example.com",
  message: "Hello, I noticed a remedy entry that looks like it needs a citation.",
};

describe("handleContact", () => {
  it("sends the expected email on a valid submission", async () => {
    const { impl, calls } = stubFetch();
    const result = await handleContact(valid, env, "ip-1", impl);

    expect(result.status).toBe(200);
    expect(calls).toHaveLength(1);

    const sent = calls[0].body;
    expect(sent.to).toEqual(["owner@example.com"]);
    expect(sent.from).toBe("Sattva <noreply@example.com>");
    expect(sent.reply_to).toBe("john@example.com");
    expect(sent.subject).toBe("Sattva — message from John Doe");
    expect(String(sent.text)).toMatch(/^New message from the Sattva website/);
    expect(String(sent.text).trimEnd().endsWith(valid.message)).toBe(true);
    expect(String(sent.text)).not.toContain("Phone:");
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer test-key");
  });

  it("includes a phone line only when supplied", async () => {
    const { impl, calls } = stubFetch();
    await handleContact({ ...valid, phone: "+91 90000 00000" }, env, "ip-phone", impl);
    expect(String(calls[0].body.text)).toMatch(/Phone: \+91 90000 00000/);
  });

  it("cannot be used to forge a header", async () => {
    const { impl, calls } = stubFetch();
    await handleContact({ ...valid, name: "Evil\r\nBcc: victim@example.com" }, env, "ip-inject", impl);
    expect(String(calls[0].body.subject)).not.toMatch(/[\r\n]/);
    expect(calls[0].body.subject).toBe("Sattva — message from Evil Bcc: victim@example.com");
  });

  it.each([
    ["missing name", { ...valid, name: "" }],
    ["bad email", { ...valid, email: "not-an-email" }],
    ["short message", { ...valid, message: "hi" }],
  ])("rejects %s server-side and sends nothing", async (_label, payload) => {
    const { impl, calls } = stubFetch();
    const result = await handleContact(payload, env, `ip-${_label}`, impl);
    expect(result.status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it("answers the honeypot like a success but sends nothing", async () => {
    const { impl, calls } = stubFetch();
    const result = await handleContact({ ...valid, company: "spam co" }, env, "ip-bot", impl);
    expect(result.status).toBe(200);
    expect(calls).toHaveLength(0);
  });

  it("rate-limits a burst from one address without reaching the provider", async () => {
    const { impl, calls } = stubFetch();
    const key = "ip-flood";
    for (let i = 0; i < 3; i++) {
      expect((await handleContact(valid, env, key, impl)).status).toBe(200);
    }
    expect((await handleContact(valid, env, key, impl)).status).toBe(429);
    expect(calls).toHaveLength(3);
    expect((await handleContact(valid, env, "ip-other", impl)).status).toBe(200);
  });

  it("never names the missing variable when misconfigured", async () => {
    const { impl, calls } = stubFetch();
    const result = await handleContact(valid, {}, "ip-noenv", impl);
    expect(result.status).toBe(500);
    expect(result.body.error ?? "").not.toMatch(/API|KEY|EMAIL_FROM|CONTACT_EMAIL/i);
    expect(calls).toHaveLength(0);
  });

  it("surfaces a provider failure as a retryable error", async () => {
    const failing = (async () => ({ ok: false, status: 422, text: async () => "domain not verified" })) as unknown as typeof fetch;
    const result = await handleContact(valid, env, "ip-fail", failing);
    expect(result.status).toBe(502);
    expect(result.body.ok).toBe(false);
  });
});

describe("buildEmail", () => {
  it("formats the subject and reply-to", () => {
    const email = buildEmail(
      { name: "Ada", email: "ada@example.com", phone: "", message: "Hi" },
      { from: "a@b.com", to: "c@d.com" },
    );
    expect(email.subject).toBe("Sattva — message from Ada");
    expect(email.reply_to).toBe("ada@example.com");
  });
});
