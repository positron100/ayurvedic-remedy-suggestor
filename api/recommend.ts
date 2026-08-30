/**
 * The deployed `/api/recommend` endpoint.
 *
 * Written against the Web `Request`/`Response` API so it runs as-is on Vercel
 * (a Vite SPA with an `api/` directory) and ports elsewhere by re-exporting it.
 * All work is in `_recommend.ts`, which has no host dependencies. The LLM API
 * key lives only in this function's environment and never reaches the browser.
 */
import { handleRecommend, handleCapabilities } from "./_recommend.ts";
import type { LLMEnv } from "./_llm/types.ts";

export const config = { runtime: "edge" };

const MAX_BODY_BYTES = 16_000;

export default async function handler(request: Request): Promise<Response> {
  const env = process.env as LLMEnv;

  if (request.method === "GET") {
    const result = handleCapabilities(env);
    return json(result.status, result.body);
  }

  if (request.method !== "POST") {
    return json(405, { error: "Method not allowed." });
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json(413, { error: "Payload too large." });

  let payload: unknown;
  try {
    payload = JSON.parse(raw || "{}");
  } catch {
    return json(400, { error: "Malformed request." });
  }

  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const clientKey = forwarded.split(",")[0].trim() || "unknown";

  const result = await handleRecommend(payload, env, clientKey);
  return json(result.status, result.body);
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
