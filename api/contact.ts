/**
 * The deployed `/api/contact` endpoint.
 *
 * Written against the Web `Request`/`Response` API so it runs as-is on Vercel
 * (a Vite SPA with an `api/` directory) and ports elsewhere by re-exporting it.
 * All work is in `_contact.ts`, which has no host dependencies. The Resend API
 * key lives only in this function's environment and never reaches the browser.
 */
import { handleContact, type ContactEnv, type ContactPayload } from "./_contact.ts";

export const config = { runtime: "edge" };

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return json(405, { ok: false, error: "Method not allowed." });
  }

  let payload: ContactPayload;
  try {
    payload = (await request.json()) as ContactPayload;
  } catch {
    return json(400, { ok: false, error: "Malformed request." });
  }

  // Behind a proxy the socket address is the proxy's, so the forwarded header
  // is the visitor. First entry only: the rest can be spoofed by the client.
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const clientKey = forwarded.split(",")[0].trim() || "unknown";

  const result = await handleContact(payload, process.env as ContactEnv, clientKey);
  return json(result.status, result.body);
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
