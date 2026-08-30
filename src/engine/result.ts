/**
 * The engine's output shape — a *structured* recommendation, never a
 * pre-rendered paragraph. The UI composes cards from this; the optional LLM
 * layer may rephrase individual fields but may not add to it.
 */
import type { Condition, RedFlag, Remedy, Severity } from "./types";

export interface EngineInput {
  /** Raw free text, if the person typed a description. */
  text?: string;
  /** Symptom ids chosen from chips/autocomplete. */
  symptomIds?: string[];
  /** Optional self-reported severity. */
  severity?: Severity;
  /** Optional demographic context the person volunteered. */
  demographics?: {
    pregnant?: boolean;
    breastfeeding?: boolean;
    ageYears?: number;
  };
}

/** Every distinct outcome the UI must render a state for. */
export type RecommendationKind =
  | "ok" // a confident, structured recommendation
  | "low_confidence" // a recommendation, but hedged
  | "insufficient_information" // need more input before guessing
  | "no_matching_condition" // input didn't match anything in scope
  | "red_flag"; // stop — seek professional care

export interface MatchedSymptom {
  symptomId: string;
  label: string;
  /** How it was matched: a chosen chip or a phrase found in the text. */
  via: "chip" | "text";
  matchedText?: string;
}

export interface ConditionMatch {
  condition: Condition;
  /** 0-1. */
  score: number;
  matchedSymptoms: MatchedSymptom[];
}

export interface RemedySuggestion {
  remedy: Remedy;
  /** 0-1 relevance within the matched condition. */
  relevance: number;
  /** Why this surfaced — matched severity, age context, prominence. */
  rationale: string[];
  /** True when the deterministic safety filter removed something or flagged it. */
  safetyNotes: string[];
}

export interface RedFlagHit {
  redFlag: RedFlag;
  matchedText?: string;
}

export interface Recommendation {
  kind: RecommendationKind;
  /** Present for `ok` / `low_confidence`. */
  condition?: ConditionMatch;
  /** Ordered best-first. Present for `ok` / `low_confidence`. */
  suggestions: RemedySuggestion[];
  /** Present for `red_flag`. */
  redFlags: RedFlagHit[];
  /** 0-1 overall confidence in the condition match. */
  confidence: number;
  /** Plain-language reasons the confidence is where it is (from the engine's
   *  own assessment) — for the UI to explain the match. */
  confidenceReasons: string[];
  /** Names of conditions that scored close to the top one (ambiguous match). */
  contenderConditionNames: string[];
  /** All symptoms the engine recognised from the input. */
  recognisedSymptoms: MatchedSymptom[];
  /** Symptom ids the engine could ask about to disambiguate. */
  clarifyingSymptomIds: string[];
  /** Always populated — the standing disclaimer. */
  disclaimer: { short: string; full: string };
  /** Deterministic prose for each field, used when the LLM layer is off. */
  narrative: RecommendationNarrative;
  /** Set by the LLM layer in Phase D when it successfully rephrases. */
  enhanced?: boolean;
}

/**
 * Templated, deterministic prose. Generated from the structured data with no
 * model involved. The LLM layer, when present, produces a parallel version of
 * these strings — it never produces the structured data above.
 */
export interface RecommendationNarrative {
  headline: string;
  summary: string;
  whyItMayHelp: string | null;
  howItIsUsed: string | null;
  precautionsIntro: string | null;
  professionalCareIntro: string;
}
