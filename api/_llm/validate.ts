/**
 * Response validators — the real grounding enforcement.
 *
 * The prompt asks the model to stay grounded, but nothing here trusts that.
 * These functions take the raw parsed model output and either return a clean,
 * bounded, schema-correct value or throw — in which case the caller falls back
 * to the deterministic templates.
 */
import { ProviderError, type IntentHints, type PhrasedNarrative, type PhrasePayload, type AllowedSymptom } from "./types.ts";

const MAX_INTENT_SYMPTOMS = 8;
const PHRASE_FIELD_MAX = 700;
const PHRASE_TOTAL_MAX = 1800;

const TAGS = /<[^>]*>/g;
const MARKDOWN = /[`*_#|>[\]]/g;

/**
 * Strip anything that could turn a prose string into markup when rendered, and
 * collapse whitespace (which folds away control whitespace). The UI renders
 * these as escaped plain text already; this is defence in depth.
 */
function toPlainText(value: unknown): string {
  if (typeof value !== "string") throw new ProviderError("expected string");
  return value.replace(TAGS, "").replace(MARKDOWN, "").replace(/\s+/g, " ").trim();
}

/** Claim language that must never be attached to non-verified knowledge. */
const OVERCLAIM =
  /\b(proven|clinically proven|scientifically proven|guaranteed|will cure|cures?|treats?|heals?|effective (for|against|at)|medically recommended|doctors recommend)\b/i;

export function validateIntent(raw: unknown, allowed: AllowedSymptom[]): IntentHints {
  if (typeof raw !== "object" || raw === null) throw new ProviderError("intent: not an object");
  const r = raw as Record<string, unknown>;

  const allowedIds = new Set(allowed.map((s) => s.id));
  const symptomIds = Array.isArray(r.symptomIds)
    ? [
        ...new Set(r.symptomIds.filter((x): x is string => typeof x === "string" && allowedIds.has(x))),
      ].slice(0, MAX_INTENT_SYMPTOMS)
    : [];

  let severity: IntentHints["severity"] = null;
  if (r.severity === "mild" || r.severity === "moderate" || r.severity === "severe") severity = r.severity;

  let durationDays: number | null = null;
  if (typeof r.durationDays === "number" && Number.isFinite(r.durationDays) && r.durationDays >= 0) {
    durationDays = Math.min(Math.round(r.durationDays), 3650);
  }

  return { symptomIds, severity, durationDays };
}

export function validatePhrasing(raw: unknown, payload: PhrasePayload): PhrasedNarrative {
  if (typeof raw !== "object" || raw === null) throw new ProviderError("phrasing: not an object");
  const r = raw as Record<string, unknown>;

  const summary = toPlainText(r.summary).slice(0, PHRASE_FIELD_MAX);
  const whyThisMatches = toPlainText(r.whyThisMatches).slice(0, PHRASE_FIELD_MAX);

  let traditionalContext: string | null = null;
  const hasTraditionalFacts = Boolean(
    payload.remedy.traditionalUse || payload.remedy.preparation || payload.remedy.usage || payload.remedy.summary,
  );
  if (r.traditionalContext !== null && r.traditionalContext !== undefined) {
    // The model returned prose for a field that must be null when the KB has
    // no such fact. Reject the whole response rather than render invented text.
    if (!hasTraditionalFacts) throw new ProviderError("phrasing: traditionalContext for absent facts");
    traditionalContext = toPlainText(r.traditionalContext).slice(0, PHRASE_FIELD_MAX);
  }

  if (!summary || !whyThisMatches) throw new ProviderError("phrasing: empty required field");

  // Epistemic status must survive. If the underlying remedy is not verified,
  // the prose may not assert efficacy.
  const verified = payload.remedy.verification === "sourced" || payload.remedy.verification === "reviewed";
  if (!verified) {
    for (const field of [summary, whyThisMatches, traditionalContext ?? ""]) {
      if (OVERCLAIM.test(field)) throw new ProviderError("phrasing: overclaim on unverified knowledge");
    }
  }

  const total = summary.length + whyThisMatches.length + (traditionalContext?.length ?? 0);
  if (total > PHRASE_TOTAL_MAX) throw new ProviderError("phrasing: response too long");

  return { summary, whyThisMatches, traditionalContext };
}

/** Pull the first balanced JSON object out of a model text response. */
export function extractJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  if (start === -1) throw new ProviderError("no JSON object in response");
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch (e) {
          throw new ProviderError("malformed JSON in response", e);
        }
      }
    }
  }
  throw new ProviderError("unterminated JSON object in response");
}
