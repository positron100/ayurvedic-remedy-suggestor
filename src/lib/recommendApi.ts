/**
 * Browser client for `/api/recommend`. Every function here is best-effort: on
 * any failure — no key, offline, timeout, malformed response, HTTP error — it
 * resolves to `null` / `{ llm: false }` and never throws. The caller then uses
 * the deterministic result, and the user sees no error.
 *
 * The LLM API key is never here. This only ever sees the JSON on the wire.
 */
import type {
  CapabilitiesResponse,
  IntentHints,
  PhrasePayload,
  PhrasedNarrative,
  ParseIntentResponse,
  PhraseResponse,
} from "../../api/_llm/dto";

const ENDPOINT = "/api/recommend";
const CLIENT_TIMEOUT_MS = 12_000;

export type { IntentHints, PhrasePayload, PhrasedNarrative };

async function postJson(body: unknown, signal?: AbortSignal): Promise<unknown | null> {
  const local = new AbortController();
  const timer = window.setTimeout(() => local.abort(), CLIENT_TIMEOUT_MS);
  const onAbort = () => local.abort();
  signal?.addEventListener("abort", onAbort);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: local.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

let capabilitiesCache: Promise<CapabilitiesResponse> | null = null;

/** Test seam — clears the session capabilities cache. */
export function resetCapabilitiesCacheForTests(): void {
  capabilitiesCache = null;
}

/** Whether the LLM enhancement layer is configured. Cached for the session. */
export function fetchCapabilities(): Promise<CapabilitiesResponse> {
  if (!capabilitiesCache) {
    capabilitiesCache = (async () => {
      try {
        const res = await fetch(ENDPOINT, { method: "GET" });
        if (!res.ok) return { llm: false };
        const data = (await res.json()) as CapabilitiesResponse;
        return data && typeof data.llm === "boolean" ? data : { llm: false };
      } catch {
        return { llm: false };
      }
    })();
  }
  return capabilitiesCache;
}

/** Free text → candidate structured hints. Returns null unless the response is
 *  a well-formed success. */
export async function parseIntent(
  text: string,
  allowedSymptoms: { id: string; label: string; synonyms: string[] }[],
  signal?: AbortSignal,
): Promise<IntentHints | null> {
  const data = (await postJson({ op: "parse-intent", text, allowedSymptoms }, signal)) as ParseIntentResponse | null;
  if (!data || data.available !== true) return null;
  const i = data.intent;
  if (!i || !Array.isArray(i.symptomIds)) return null;
  return {
    symptomIds: i.symptomIds.filter((x): x is string => typeof x === "string"),
    severity: i.severity ?? null,
    durationDays: typeof i.durationDays === "number" ? i.durationDays : null,
  };
}

/** Structured recommendation facts → prose. Returns null unless well-formed. */
export async function phrase(payload: PhrasePayload, signal?: AbortSignal): Promise<PhrasedNarrative | null> {
  const data = (await postJson({ op: "phrase", payload }, signal)) as PhraseResponse | null;
  if (!data || data.available !== true) return null;
  const p = data.phrased;
  if (!p || typeof p.summary !== "string" || typeof p.whyThisMatches !== "string") return null;
  return {
    summary: p.summary,
    whyThisMatches: p.whyThisMatches,
    traditionalContext: typeof p.traditionalContext === "string" ? p.traditionalContext : null,
  };
}
