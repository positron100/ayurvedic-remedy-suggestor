/**
 * Bridges the deterministic `Recommendation` and the LLM phrasing call.
 *
 *  - `buildPhrasePayload` extracts the *minimal* set of already-decided,
 *    non-secret facts for a phrasing request. It sends only what the operation
 *    needs (privacy) — never the whole knowledge base, other remedies, or
 *    engine internals.
 *
 *  - `applyPhrasing` merges the returned prose into the recommendation's
 *    narrative. It only ever touches `summary`, `whyItMayHelp` and (when the KB
 *    had the facts) `howItIsUsed`. It never touches the safety prose
 *    (`precautionsIntro`, `professionalCareIntro`), the structured data, the
 *    confidence, the suggestions, or provenance — those stay deterministic.
 */
import type { KnowledgeBase } from "@/engine/types";
import type { Recommendation } from "@/engine/result";
import type { PhrasePayload, PhrasedNarrative } from "./recommendApi";

const USER_DESCRIPTION_MAX = 600;

export function buildPhrasePayload(
  recommendation: Recommendation,
  userText: string | undefined,
): PhrasePayload | null {
  if (recommendation.kind !== "ok" && recommendation.kind !== "low_confidence") return null;
  // Phrasing exists to relate the guidance to what the person *described*. With
  // only chips there is nothing to relate it to, so no call is made.
  if (!userText?.trim()) return null;
  const primary = recommendation.suggestions[0];
  const condition = recommendation.condition;
  if (!primary || !condition) return null;

  const r = primary.remedy;
  return {
    conditionName: condition.condition.name,
    userDescription: (userText ?? "").slice(0, USER_DESCRIPTION_MAX),
    matchedSymptoms: condition.matchedSymptoms.map((s) => s.label),
    rationale: primary.rationale,
    remedy: {
      name: r.canonicalName,
      type: r.type,
      verification: r.verification.level,
      summary: r.summary?.value ?? null,
      traditionalUse: r.traditionalUse?.value ?? null,
      preparation: r.preparation?.value ?? null,
      usage: r.usage?.value ?? null,
      precautions: r.precautions.map((p) => p.value),
      avoidIf: r.avoidIf,
    },
  };
}

export function applyPhrasing(recommendation: Recommendation, phrased: PhrasedNarrative): Recommendation {
  const n = recommendation.narrative;
  return {
    ...recommendation,
    enhanced: true,
    narrative: {
      ...n,
      summary: phrased.summary,
      whyItMayHelp: phrased.whyThisMatches,
      // Only accept phrased traditional context when the KB actually had that
      // fact (i.e. the template produced something). Otherwise keep the
      // deterministic "not verified" text — the model must not fill the gap.
      howItIsUsed: n.howItIsUsed && phrased.traditionalContext ? phrased.traditionalContext : n.howItIsUsed,
    },
  };
}

/** The symptom vocabulary the parse-intent call needs. Not secret. */
export function allowedSymptoms(kb: KnowledgeBase) {
  return kb.symptoms.map((s) => ({ id: s.id, label: s.label, synonyms: s.synonyms }));
}
