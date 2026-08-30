/**
 * The LLM boundary.
 *
 * The deterministic engine (src/engine) is the sole authority for what a
 * recommendation *is*. This layer does exactly two presentational things, and
 * nothing else:
 *
 *   parseIntent()          — free text → candidate structured hints, which are
 *                            then validated and fed into the deterministic
 *                            engine. It cannot pick a remedy, name a condition,
 *                            or bypass safety.
 *
 *   phraseRecommendation() — an already-decided deterministic recommendation →
 *                            three prose strings. It may only rephrase facts
 *                            present in the payload it is given.
 *
 * A provider implements this interface with raw HTTP to its own API. Nothing
 * provider-specific leaks past `providers/`.
 */

/** Candidate structured hints extracted from free text. */
export interface IntentHints {
  /** Symptom ids — MUST be drawn from the `allowedSymptoms` supplied in the
   *  request. Any id not in that list is dropped by the validator. */
  symptomIds: string[];
  /** Only when the user explicitly stated a severity. */
  severity: "mild" | "moderate" | "severe" | null;
  /** Only when the user explicitly stated a duration, in whole days. */
  durationDays: number | null;
}

/** The minimal, already-public facts a phrasing call is grounded in. */
export interface PhrasePayload {
  conditionName: string;
  /** Verbatim snippet of what the user typed (bounded) — used only to relate
   *  the guidance to their words. */
  userDescription: string;
  matchedSymptoms: string[];
  remedy: {
    name: string;
    type: string;
    /** "sourced" | "reviewed" | "needs_review" | "unverified" */
    verification: string;
    /** Present only when the KB actually has this fact. */
    summary: string | null;
    traditionalUse: string | null;
    preparation: string | null;
    usage: string | null;
    precautions: string[];
    avoidIf: string[];
  };
  /** Why the engine matched this — rationale strings from the engine. */
  rationale: string[];
}

/** Prose produced by a phrasing call. Rendered into fixed slots as plain text. */
export interface PhrasedNarrative {
  summary: string;
  whyThisMatches: string;
  /** null when the KB has no traditional-use / preparation facts to phrase. */
  traditionalContext: string | null;
}

export interface LLMProvider {
  /** Human-readable model id, for the capabilities response (not a secret). */
  readonly model: string;
  parseIntent(input: { text: string; allowedSymptoms: AllowedSymptom[] }): Promise<IntentHints>;
  phraseRecommendation(payload: PhrasePayload): Promise<PhrasedNarrative>;
}

export interface AllowedSymptom {
  id: string;
  label: string;
  synonyms: string[];
}

/** Raised by a provider on any transport/parse failure. Never surfaced to the
 *  browser — the caller turns it into a silent fallback. */
export class ProviderError extends Error {
  readonly detail?: unknown;
  constructor(message: string, detail?: unknown) {
    super(message);
    this.name = "ProviderError";
    this.detail = detail;
  }
}

export interface LLMEnv {
  LLM_PROVIDER?: string;
  LLM_API_KEY?: string;
  LLM_MODEL?: string;
  LLM_TIMEOUT_MS?: string;
}
