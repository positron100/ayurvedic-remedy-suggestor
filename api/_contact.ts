/**
 * The contact endpoint's actual work, free of any host framework — the same
 * pattern as `_recommend.ts`, ported from the portfolio's `api/_contact.ts`.
 * It takes a parsed body + env and returns a status plus a payload; it knows
 * nothing about `req`/`res` shapes.
 *
 * Nothing here is reachable from the browser bundle. The Resend API key lives
 * only in the environment of whatever runs this.
 */

export interface ContactPayload {
  name?: unknown;
  email?: unknown;
  message?: unknown;
  phone?: unknown;
  /** Honeypot. Real people never see this field, so anything in it is a bot. */
  company?: unknown;
}

export interface HandlerResult {
  status: number;
  body: { ok: boolean; error?: string };
}

export interface ContactEnv {
  RESEND_API_KEY?: string;
  CONTACT_EMAIL?: string;
  EMAIL_FROM?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Generous enough for a real enquiry, small enough to bound the payload. */
const LIMITS = { name: 120, email: 200, phone: 40, message: 5000 } as const;

const RATE_LIMIT = { windowMs: 60_000, max: 3 } as const;
const hits = new Map<string, number[]>();

/**
 * Best-effort per-instance rate limiting. In-memory on purpose: a serverless
 * deployment runs several instances and recycles them, so this bounds a burst
 * from one address against one instance rather than guaranteeing a global cap.
 * That is the right trade here — it costs nothing, needs no external store, and
 * stops the case that actually happens (a script hammering the form).
 */
export function rateLimit(key: string, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < RATE_LIMIT.windowMs);
  if (recent.length >= RATE_LIMIT.max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (v.every((t) => now - t >= RATE_LIMIT.windowMs)) hits.delete(k);
  }
  return true;
}

/**
 * Strips control characters and clamps length.
 *
 * The header-injection guard is the important part: a newline inside the name
 * would otherwise be interpolated into the Subject line, and a subject
 * containing a newline is how a header gets forged. Done as a codepoint filter
 * rather than a control-character regex — keeps tab and the two newline
 * characters (a real message keeps its line breaks), drops the rest.
 */
function clean(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  let out = "";
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    const isControl = (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) || code === 0x7f;
    if (!isControl) out += ch;
  }
  return out.trim().slice(0, max);
}

function cleanHeader(value: unknown, max: number): string {
  return clean(value, max).replace(/[\r\n]+/g, " ");
}

export interface BuiltEmail {
  from: string;
  to: string[];
  reply_to: string;
  subject: string;
  text: string;
}

export function buildEmail(
  fields: { name: string; email: string; phone: string; message: string },
  config: { from: string; to: string },
): BuiltEmail {
  const lines = ["New message from the Sattva website", "", `Name: ${fields.name}`, `Email: ${fields.email}`];
  if (fields.phone) lines.push(`Phone: ${fields.phone}`);
  lines.push("", "Message:", "", fields.message);

  return {
    from: config.from,
    to: [config.to],
    // The visitor's address cannot be the real `From`: sending as a domain you
    // do not control fails SPF/DKIM and the message is rejected or filed as
    // spam. It goes here instead, so hitting reply answers the visitor.
    reply_to: fields.email,
    subject: `Sattva — message from ${fields.name}`,
    text: lines.join("\n"),
  };
}

export async function handleContact(
  payload: ContactPayload,
  env: ContactEnv,
  clientKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<HandlerResult> {
  // Answered exactly like a success. A bot that filled the honeypot should
  // learn nothing from the response, and no mail is sent.
  if (clean(payload.company, 100)) return { status: 200, body: { ok: true } };

  const name = cleanHeader(payload.name, LIMITS.name);
  const email = cleanHeader(payload.email, LIMITS.email);
  const phone = cleanHeader(payload.phone, LIMITS.phone);
  const message = clean(payload.message, LIMITS.message);

  // Re-validated here, not trusted from the client.
  if (name.length < 2) return { status: 400, body: { ok: false, error: "A name is required." } };
  if (!EMAIL_PATTERN.test(email))
    return { status: 400, body: { ok: false, error: "A valid email address is required." } };
  if (message.length < 10) return { status: 400, body: { ok: false, error: "A message is required." } };

  if (!rateLimit(clientKey))
    return { status: 429, body: { ok: false, error: "Too many messages. Try again shortly." } };

  const apiKey = env.RESEND_API_KEY;
  const to = env.CONTACT_EMAIL;
  const from = env.EMAIL_FROM;
  if (!apiKey || !to || !from) {
    // Logged for the operator, never described to the caller: a public form
    // should not report which server-side variable is missing.
    console.error("[contact] missing RESEND_API_KEY, CONTACT_EMAIL or EMAIL_FROM");
    return { status: 500, body: { ok: false, error: "Unable to send right now." } };
  }

  const response = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(buildEmail({ name, email, phone, message }, { from, to })),
  });

  if (!response.ok) {
    console.error("[contact] provider rejected the message", response.status, await response.text());
    return { status: 502, body: { ok: false, error: "Unable to send right now." } };
  }

  return { status: 200, body: { ok: true } };
}
