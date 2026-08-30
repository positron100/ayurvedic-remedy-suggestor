/**
 * The `/api/recommend` core, free of any host framework (same pattern as the
 * portfolio's `_contact.ts`). It takes a parsed body + env and returns a
 * status + JSON body. It knows nothing about `req`/`res`.
 *
 * This endpoint is ENHANCEMENT ONLY. It never returns a recommendation, a
 * remedy, a condition, or a safety verdict — those are decided entirely by the
 * deterministic engine in the browser. It returns, at most:
 *   - structured symptom hints (to be re-validated and fed into that engine)
 *   - three prose strings (to replace templated prose in fixed UI slots)
 *
 * Any failure of the optional operations answers `{ available: false }` with
 * HTTP 200. Provider errors and secrets are logged for the operator and never
 * put on the wire.
 */
import { getProvider } from "./_llm/providers/index.ts";
import type { LLMEnv } from "./_llm/types.ts";
import type {
  CapabilitiesResponse,
  ParseIntentResponse,
  PhraseResponse,
  RecommendRequest,
} from "./_llm/dto.ts";

export interface HandlerResult {
  status: number;
  body: unknown;
}

const LIMITS = {
  text: 2000,
  allowedSymptoms: 60,
  synonyms: 40,
  description: 600,
  precautions: 12,
  rationale: 12,
  field: 800,
} as const;

const RATE_LIMIT = { windowMs: 60_000, max: 20 } as const;
const hits = new Map<string, number[]>();

/** Best-effort per-instance rate limiting (see the portfolio's note). */
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

function str(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function strArray(value: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is string => typeof x === "string").slice(0, maxItems).map((s) => s.slice(0, maxLen));
}

/** GET → capabilities. No secrets, no user data. */
export function handleCapabilities(env: LLMEnv): HandlerResult {
  const provider = getProvider(env);
  const body: CapabilitiesResponse = provider ? { llm: true, model: provider.model } : { llm: false };
  return { status: 200, body };
}

export async function handleRecommend(raw: unknown, env: LLMEnv, clientKey: string): Promise<HandlerResult> {
  if (typeof raw !== "object" || raw === null) {
    return { status: 400, body: { error: "Malformed request." } };
  }
  const body = raw as Record<string, unknown>;

  if (body.op !== "parse-intent" && body.op !== "phrase") {
    return { status: 400, body: { error: "Unknown operation." } };
  }

  if (!rateLimit(clientKey)) {
    // Optional feature — a limited caller simply gets no enhancement.
    return { status: 200, body: { available: false } };
  }

  const provider = getProvider(env);
  if (!provider) return { status: 200, body: { available: false } };

  try {
    if (body.op === "parse-intent") {
      const req = body as unknown as RecommendRequest & { op: "parse-intent" };
      const text = str(req.text, LIMITS.text).trim();
      if (!text) return { status: 200, body: { available: false } satisfies ParseIntentResponse };

      const rawAllowed: unknown[] = Array.isArray(req.allowedSymptoms) ? req.allowedSymptoms : [];
      const allowedSymptoms = rawAllowed
        .slice(0, LIMITS.allowedSymptoms)
        .flatMap((s: unknown) => {
          const item = s as Record<string, unknown>;
          const id = str(item.id, 80);
          const label = str(item.label, 200);
          if (!id || !label) return [];
          return [{ id, label, synonyms: strArray(item.synonyms, LIMITS.synonyms, 120) }];
        });
      if (allowedSymptoms.length === 0) {
        return { status: 200, body: { available: false } satisfies ParseIntentResponse };
      }

      const intent = await provider.parseIntent({ text, allowedSymptoms });
      return { status: 200, body: { available: true, intent } satisfies ParseIntentResponse };
    }

    // op === "phrase"
    const p = (body.payload ?? {}) as Record<string, unknown>;
    const r = (p.remedy ?? {}) as Record<string, unknown>;
    const payload = {
      conditionName: str(p.conditionName, 120),
      userDescription: str(p.userDescription, LIMITS.description),
      matchedSymptoms: strArray(p.matchedSymptoms, 20, 160),
      rationale: strArray(p.rationale, LIMITS.rationale, LIMITS.field),
      remedy: {
        name: str(r.name, 160),
        type: str(r.type, 60),
        verification: str(r.verification, 40),
        summary: r.summary == null ? null : str(r.summary, LIMITS.field),
        traditionalUse: r.traditionalUse == null ? null : str(r.traditionalUse, LIMITS.field),
        preparation: r.preparation == null ? null : str(r.preparation, LIMITS.field),
        usage: r.usage == null ? null : str(r.usage, LIMITS.field),
        precautions: strArray(r.precautions, LIMITS.precautions, LIMITS.field),
        avoidIf: strArray(r.avoidIf, 8, 60),
      },
    };
    if (!payload.conditionName || !payload.remedy.name) {
      return { status: 200, body: { available: false } satisfies PhraseResponse };
    }

    const phrased = await provider.phraseRecommendation(payload);
    return { status: 200, body: { available: true, phrased } satisfies PhraseResponse };
  } catch (e) {
    // ProviderError (transport, timeout, refusal, malformed JSON, failed
    // grounding check) — logged for the operator, invisible to the browser.
    console.error(`[recommend] ${body.op} fell back to deterministic:`, e instanceof Error ? e.message : e);
    return { status: 200, body: { available: false } };
  }
}
