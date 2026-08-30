/**
 * The orchestrator. Wires normalization -> red-flag check -> retrieval ->
 * safety filter -> confidence -> narrative into a single `Recommendation`.
 *
 * This is the only place the pipeline order is expressed. Every step is a pure
 * function from the modules beside this one.
 */
import type { KnowledgeBase } from "./types";
import type { EngineInput, Recommendation, MatchedSymptom } from "./result";
import { matchText, resolveChosenSymptoms, mergeSymptoms } from "./normalize";
import { scoreConditions, rankRemedies } from "./retrieve";
import { detectRedFlags, applySafetyFilter } from "./safety";
import { assessConfidence } from "./confidence";
import { buildNarrative } from "./templates";

const MAX_SUGGESTIONS = 4;

export function recommend(kb: KnowledgeBase, input: EngineInput): Recommendation {
  const disclaimer = kb.safety.disclaimer;

  // 1. Normalize input into a symptom set.
  const textResult = input.text ? matchText(kb, input.text) : { symptoms: [], redFlags: [], namedConditionIds: [] };
  const chosen = resolveChosenSymptoms(kb, input.symptomIds ?? []);
  const symptoms: MatchedSymptom[] = mergeSymptoms(chosen, textResult.symptoms);

  // 2. Red flags first — they win over everything.
  const redFlagOutcome = detectRedFlags(kb, input);
  if (redFlagOutcome.diverts) {
    return {
      kind: "red_flag",
      suggestions: [],
      redFlags: redFlagOutcome.hits,
      confidence: 0,
      confidenceReasons: [],
      contenderConditionNames: [],
      recognisedSymptoms: symptoms,
      clarifyingSymptomIds: [],
      disclaimer,
      narrative: buildNarrative({ kind: "red_flag", redFlags: redFlagOutcome.hits, clarifyingLabels: [] }),
    };
  }

  // 3. Not enough to go on.
  if (symptoms.length < kb.safety.minSymptomSignals) {
    return {
      kind: "insufficient_information",
      suggestions: [],
      redFlags: redFlagOutcome.hits,
      confidence: 0,
      confidenceReasons: symptoms.length === 0
        ? ["No symptoms were recognised from your input yet."]
        : ["Only one symptom was recognised — at least two are needed to suggest anything."],
      contenderConditionNames: [],
      recognisedSymptoms: symptoms,
      clarifyingSymptomIds: suggestClarifiers(kb, symptoms),
      disclaimer,
      narrative: buildNarrative({
        kind: "insufficient_information",
        redFlags: redFlagOutcome.hits,
        clarifyingLabels: labelsFor(kb, suggestClarifiers(kb, symptoms)),
      }),
    };
  }

  // 4. Retrieve conditions.
  const ranked = scoreConditions(kb, symptoms, textResult.namedConditionIds);
  if (ranked.length === 0) {
    return {
      kind: "no_matching_condition",
      suggestions: [],
      redFlags: redFlagOutcome.hits,
      confidence: 0,
      confidenceReasons: ["Your symptoms did not match any condition Sattva currently covers."],
      contenderConditionNames: [],
      recognisedSymptoms: symptoms,
      clarifyingSymptomIds: [],
      disclaimer,
      narrative: buildNarrative({ kind: "no_matching_condition", redFlags: redFlagOutcome.hits, clarifyingLabels: [] }),
    };
  }

  const confidence = assessConfidence(ranked, symptoms.length);
  const top = ranked[0];

  // 5. Rank + safety-filter that condition's remedies.
  const rawSuggestions = rankRemedies(kb, top.condition, {
    severity: input.severity,
    ageYears: input.demographics?.ageYears,
  });
  const filtered = applySafetyFilter(rawSuggestions, input);
  const suggestions = filtered.kept.slice(0, MAX_SUGGESTIONS);

  // 6. Decide kind from confidence thresholds.
  let kind: Recommendation["kind"] = "ok";
  if (confidence.value < kb.safety.insufficientInfoThreshold) {
    kind = "insufficient_information";
  } else if (confidence.value < kb.safety.lowConfidenceThreshold) {
    kind = "low_confidence";
  }

  const clarifiers =
    kind === "ok" ? [] : suggestClarifiers(kb, symptoms, confidence.contenders.map((c) => c.condition.id));
  const contenderConditionNames = confidence.contenders
    .filter((c) => c.condition.id !== top.condition.id)
    .map((c) => c.condition.name);

  if (kind === "insufficient_information") {
    return {
      kind,
      condition: top,
      suggestions: [],
      redFlags: redFlagOutcome.hits,
      confidence: confidence.value,
      confidenceReasons: confidence.reasons,
      contenderConditionNames,
      recognisedSymptoms: symptoms,
      clarifyingSymptomIds: clarifiers,
      disclaimer,
      narrative: buildNarrative({
        kind,
        condition: top,
        redFlags: redFlagOutcome.hits,
        clarifyingLabels: labelsFor(kb, clarifiers),
      }),
    };
  }

  return {
    kind,
    condition: top,
    suggestions,
    redFlags: redFlagOutcome.hits,
    confidence: confidence.value,
    confidenceReasons: confidence.reasons,
    contenderConditionNames,
    recognisedSymptoms: symptoms,
    clarifyingSymptomIds: clarifiers,
    disclaimer,
    narrative: buildNarrative({
      kind,
      condition: top,
      primary: suggestions[0],
      redFlags: redFlagOutcome.hits,
      clarifyingLabels: labelsFor(kb, clarifiers),
    }),
  };
}

/**
 * Symptoms the engine could ask about to disambiguate — hallmark symptoms of
 * the contender conditions that the person has not already mentioned.
 */
function suggestClarifiers(
  kb: KnowledgeBase,
  have: MatchedSymptom[],
  conditionIds?: string[],
): string[] {
  const haveIds = new Set(have.map((s) => s.symptomId));
  const pool = conditionIds?.length
    ? kb.conditions.filter((c) => conditionIds.includes(c.id))
    : kb.conditions;

  const out: string[] = [];
  for (const condition of pool) {
    for (const link of condition.symptoms) {
      if (link.weight >= 2 && !haveIds.has(link.symptomId) && !out.includes(link.symptomId)) {
        out.push(link.symptomId);
      }
    }
  }
  return out.slice(0, 5);
}

function labelsFor(kb: KnowledgeBase, ids: string[]): string[] {
  const byId = new Map(kb.symptoms.map((s) => [s.id, s.label]));
  return ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
}
