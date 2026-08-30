/**
 * Deterministic, templated prose. Generated purely from the structured
 * recommendation — no language model. When the Phase D LLM layer is present it
 * produces a parallel, warmer version of these same strings; it never touches
 * the structured data.
 *
 * Every function tolerates missing/unverified fields: if the knowledge base has
 * nothing trustworthy to say, the prose says exactly that rather than inventing.
 */
import type { RecommendationKind, RecommendationNarrative, ConditionMatch, RemedySuggestion, RedFlagHit } from "./result";

export function buildNarrative(args: {
  kind: RecommendationKind;
  condition?: ConditionMatch;
  primary?: RemedySuggestion;
  redFlags: RedFlagHit[];
  clarifyingLabels: string[];
}): RecommendationNarrative {
  const { kind, condition, primary, redFlags, clarifyingLabels } = args;

  if (kind === "red_flag") {
    return {
      headline: "Please speak to a health professional",
      summary: redFlagSummary(redFlags),
      whyItMayHelp: null,
      howItIsUsed: null,
      precautionsIntro: null,
      professionalCareIntro:
        "Some of what you described can be a sign of something that needs proper medical assessment. Sattva will not suggest a home remedy in this situation.",
    };
  }

  if (kind === "insufficient_information") {
    return {
      headline: "Tell me a little more",
      summary: clarifyingLabels.length
        ? `A few more details would help narrow this down — for example: ${listOf(clarifyingLabels)}.`
        : "There isn't quite enough here yet to suggest anything responsibly. Try describing your main symptom, how long you've had it, and how severe it feels.",
      whyItMayHelp: null,
      howItIsUsed: null,
      precautionsIntro: null,
      professionalCareIntro: standardProfessionalIntro(),
    };
  }

  if (kind === "no_matching_condition") {
    return {
      headline: "Nothing in scope matched",
      summary:
        "This version of Sattva only covers arthritis, diarrhea, gastritis and migraine, and what you described doesn't clearly fit any of them. That doesn't mean it isn't real or worth attention.",
      whyItMayHelp: null,
      howItIsUsed: null,
      precautionsIntro: null,
      professionalCareIntro:
        "If the symptoms are bothering you or persist, a health professional is the right next step.",
    };
  }

  // ok / low_confidence
  const conditionName = condition?.condition.name ?? "your symptoms";
  const hedge = kind === "low_confidence" ? " This is a tentative match, so weigh it lightly." : "";

  const headline = primary
    ? `${primary.remedy.canonicalName}`
    : `Guidance for ${conditionName}`;

  const summary = primary
    ? `Based on what you described, this looks most like ${conditionName}.${hedge} A commonly referenced option in that context is ${primary.remedy.canonicalName}.`
    : `Based on what you described, this looks most like ${conditionName}.${hedge}`;

  return {
    headline,
    summary,
    whyItMayHelp: primary ? whyItMayHelp(primary, conditionName) : null,
    howItIsUsed: primary ? howItIsUsed(primary) : null,
    precautionsIntro: primary ? precautionsIntro(primary) : null,
    professionalCareIntro: standardProfessionalIntro(),
  };
}

function whyItMayHelp(s: RemedySuggestion, conditionName: string): string {
  if (s.remedy.traditionalUse?.value) {
    const src = s.remedy.traditionalUse.provenance === "sourced" ? " (from cited sources)" : "";
    return `${s.remedy.traditionalUse.value}${src}`;
  }
  if (s.remedy.summary?.value) return s.remedy.summary.value;
  return `The legacy dataset paired ${s.remedy.canonicalName} with ${conditionName}, but Sattva does not yet have a verified explanation of how or why it is traditionally used. Treat this as a pointer for further reading, not advice.`;
}

function howItIsUsed(s: RemedySuggestion): string | null {
  const parts: string[] = [];
  if (s.remedy.preparation?.value) parts.push(s.remedy.preparation.value);
  if (s.remedy.usage?.value) parts.push(s.remedy.usage.value);
  if (parts.length === 0) {
    return "Preparation and dosage details for this remedy have not been verified and are intentionally omitted. Do not guess at a dose — a qualified Ayurvedic practitioner or pharmacist can advise.";
  }
  return parts.join(" ");
}

function precautionsIntro(s: RemedySuggestion): string {
  const count = s.remedy.precautions.length + s.remedy.contraindications.length;
  if (count === 0) {
    return "No verified precautions or contraindications are on file for this remedy yet. Absence of a warning here is not the same as a remedy being confirmed safe for you.";
  }
  return "Before considering this remedy, note the following:";
}

function redFlagSummary(hits: RedFlagHit[]): string {
  if (hits.length === 0) return "Some of what you described should be checked by a professional.";
  const labels = hits.map((h) => h.redFlag.label.toLowerCase());
  return `What you described includes ${listOf(labels)}. That should be assessed by a health professional rather than managed with a home remedy.`;
}

function standardProfessionalIntro(): string {
  return "See a health professional if symptoms are severe, persistent, getting worse, or not improving with time — and before starting any new remedy if you are pregnant, breastfeeding, managing another condition, or taking regular medication.";
}

function listOf(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}
