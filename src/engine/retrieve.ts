/**
 * Deterministic retrieval: matched symptoms -> ranked conditions, then a
 * condition + severity -> ranked candidate remedies.
 *
 * No safety policy here (that is `safety.ts`) and no prose (that is
 * `templates.ts`). Pure scoring over the knowledge base.
 */
import type { Condition, KnowledgeBase, Severity } from "./types";
import type { ConditionMatch, MatchedSymptom, RemedySuggestion } from "./result";

/**
 * Score every condition against the matched symptoms.
 *
 *   score = Σ(weight of each matched symptom link) / Σ(weight of all this
 *           condition's symptom links), lightly boosted when a hallmark
 *           symptom is present and when the condition was named outright.
 *
 * Normalising by the condition's own total weight stops a condition with many
 * listed symptoms from always winning on raw overlap.
 */
export function scoreConditions(
  kb: KnowledgeBase,
  matched: MatchedSymptom[],
  namedConditionIds: string[] = [],
): ConditionMatch[] {
  const matchedIds = new Set(matched.map((m) => m.symptomId));

  const results = kb.conditions.map((condition): ConditionMatch => {
    const totalWeight = condition.symptoms.reduce((sum, s) => sum + s.weight, 0) || 1;
    let hitWeight = 0;
    let hallmarkHit = false;
    const matchedSymptoms: MatchedSymptom[] = [];

    for (const link of condition.symptoms) {
      if (matchedIds.has(link.symptomId)) {
        hitWeight += link.weight;
        if (link.hallmark) hallmarkHit = true;
        const m = matched.find((x) => x.symptomId === link.symptomId)!;
        matchedSymptoms.push(m);
      }
    }

    let score = hitWeight / totalWeight;
    if (hallmarkHit) score = Math.min(1, score + 0.15);
    if (namedConditionIds.includes(condition.id)) score = Math.min(1, score + 0.35);

    return { condition, score, matchedSymptoms };
  });

  return results.filter((r) => r.score > 0).sort((a, b) => b.score - a.score);
}

const SEVERITY_ORDER: Severity[] = ["mild", "moderate", "severe"];

/**
 * Rank a condition's remedies for a given (optional) severity.
 *
 * A remedy scores on: prominence (`weight`), whether its associated severity
 * band contains the requested severity (or an adjacent band), and a small
 * bonus for age-context alignment when the caller provides an age.
 *
 * This returns candidates with a raw `relevance` and a `rationale`. The safety
 * filter runs afterwards and may drop or annotate them.
 */
export function rankRemedies(
  kb: KnowledgeBase,
  condition: Condition,
  opts: { severity?: Severity; ageYears?: number } = {},
): RemedySuggestion[] {
  const remedyById = new Map(kb.remedies.map((r) => [r.id, r]));
  const requestedIdx = opts.severity ? SEVERITY_ORDER.indexOf(opts.severity) : -1;
  const ageBand = ageToBand(opts.ageYears);

  const scored = condition.remedies.flatMap((link): RemedySuggestion[] => {
    const remedy = remedyById.get(link.remedyId);
    if (!remedy) return []; // dangling ref — build script should have caught this

    const rationale: string[] = [];
    let relevance = link.weight / 3; // 0.33 - 1.0 base

    if (requestedIdx >= 0) {
      const bandDistance = Math.min(
        ...link.severity.map((s) => Math.abs(SEVERITY_ORDER.indexOf(s) - requestedIdx)),
      );
      if (bandDistance === 0) {
        relevance += 0.35;
        rationale.push(`Traditionally associated with ${opts.severity} presentations.`);
      } else if (bandDistance === 1) {
        relevance += 0.1;
      } else {
        relevance -= 0.1;
      }
    }

    if (ageBand && link.ageContext && link.ageContext !== "any") {
      if (link.ageContext === ageBand) {
        relevance += 0.1;
        rationale.push(`Legacy data paired this remedy with the ${ageBand} age context.`);
      }
    }

    if (link.weight === 3) rationale.push("One of the more prominent options for this condition in the source data.");
    if (link.note) rationale.push(link.note);

    return [
      {
        remedy,
        relevance: clamp01(relevance),
        rationale,
        safetyNotes: [],
      },
    ];
  });

  return scored.sort((a, b) => b.relevance - a.relevance);
}

function ageToBand(age?: number): "child" | "adolescent" | "adult" | "older-adult" | null {
  if (age == null || Number.isNaN(age)) return null;
  if (age < 12) return "child";
  if (age < 18) return "adolescent";
  if (age < 60) return "adult";
  return "older-adult";
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
