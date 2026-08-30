/**
 * The Ayurvedic knowledge model.
 *
 * This is the single source of truth for the recommendation engine. It is NOT
 * derived from the legacy CSV's shape — the CSV (condition + age + gender +
 * severity -> drug string) was only the old app's storage format. Here the
 * model is condition-centric, with an explicit relationship between symptoms,
 * conditions and remedies, and explicit provenance / verification on every
 * record.
 *
 * Nothing in here depends on React. The engine consumes a `KnowledgeBase`
 * value; tests pass fixtures, the app passes the compiled `content/`.
 */

/* ------------------------------------------------------------------ provenance */

/**
 * Where a piece of information came from. This is deliberately explicit so the
 * UI can distinguish "a traditional source says this" from "the old dataset
 * implied this" from "not yet checked".
 */
export type Provenance =
  /** Carried over from the legacy dataset (data/drug-prescription.csv). NOT
   *  clinically validated — it only tells us the old app paired these. */
  | "inherited-legacy-dataset"
  /** Backed by a cited source in `sources`. */
  | "sourced"
  /** Written by the maintainer as neutral, non-clinical connective text
   *  (summaries, symptom phrasings, synonyms). Makes no medical claim. */
  | "editorial"
  /** Placeholder — the field exists in the schema but has no trustworthy
   *  content yet. */
  | "unverified";

export type VerificationLevel =
  /** No review has happened. Treat as informational only. */
  | "unverified"
  /** Content exists but a qualified reviewer has not signed off. */
  | "needs_review"
  /** Backed by cited sources, not yet reviewer-approved. */
  | "sourced"
  /** A qualified reviewer has approved this record. */
  | "reviewed";

export interface Source {
  id: string;
  title: string;
  publisher?: string;
  url?: string;
  /** ISO date the source was accessed, when from the web. */
  accessed?: string;
  kind: "classical-text" | "pharmacopoeia" | "review-article" | "health-authority" | "reference" | "other";
}

export interface VerificationStatus {
  level: VerificationLevel;
  /** Human-readable note on what is and isn't trustworthy in this record. */
  summary: string;
  lastReviewed?: string;
  reviewer?: string;
}

/** A value plus where it came from. Used for fields that carry medical weight. */
export interface Attributed<T> {
  value: T;
  provenance: Provenance;
  /** Source ids (into the record's `sources`) when provenance is "sourced". */
  sources?: string[];
  note?: string;
}

/* ------------------------------------------------------------------- symptoms */

/**
 * A symptom is a first-class, shared entity so the same "nausea" can point at
 * several conditions with different weights, and so the input layer has one
 * vocabulary to autocomplete against.
 */
export interface Symptom {
  id: string;
  /** Canonical display label, e.g. "Burning pain in upper abdomen". */
  label: string;
  /** Lay phrasings and misspellings that should match this symptom. */
  synonyms: string[];
  /** Broad body area, for grouping in the UI. */
  category:
    | "digestive"
    | "head"
    | "musculoskeletal"
    | "systemic"
    | "neurological"
    | "skin"
    | "respiratory"
    | "other";
}

/* ------------------------------------------------------------------ red flags */

/**
 * A symptom or situation that should short-circuit remedy suggestions and send
 * the person to a professional. Matched by the same normalization the symptom
 * layer uses.
 */
export interface RedFlag {
  id: string;
  label: string;
  /** Phrases that indicate this red flag in free text. */
  triggers: string[];
  /** What the UI tells the person. */
  guidance: string;
  /** "emergency" gets the strongest treatment; "urgent" is see-someone-soon. */
  urgency: "emergency" | "urgent" | "advisory";
  provenance: Provenance;
  sources?: string[];
}

/* ------------------------------------------------------------------ demographics */

export type DemographicFlag =
  | "pregnancy"
  | "breastfeeding"
  | "child"
  | "older-adult"
  | "none";

/* ------------------------------------------------------------------- remedies */

export interface Ingredient {
  /** Common name as used in the formulation, e.g. "Ginger". */
  name: string;
  /** Botanical binomial when known/sourced, e.g. "Zingiber officinale". */
  botanical?: string;
  provenance: Provenance;
  sources?: string[];
}

export interface Contraindication {
  /** Structured flag where possible, else free text. */
  flag: DemographicFlag | "condition" | "medication" | "other";
  detail: string;
  provenance: Provenance;
  sources?: string[];
}

export type RemedyType =
  | "single-herb"
  | "classical-formulation"
  | "home-preparation"
  | "mineral-preparation"
  | "combination"
  | "procedure";

export interface Remedy {
  id: string;
  canonicalName: string;
  aliases: string[];
  type: RemedyType;
  /** For `type: "combination"` — ids of the component remedies. */
  components?: string[];

  /** Neutral, non-claim description. May be null when nothing safe can be said. */
  summary: Attributed<string> | null;

  ingredients: Ingredient[];
  /** How it is traditionally used / what it is traditionally used for. */
  traditionalUse: Attributed<string> | null;
  preparation: Attributed<string> | null;
  usage: Attributed<string> | null;

  contraindications: Contraindication[];
  precautions: Attributed<string>[];
  interactions: Attributed<string>[];
  /** Structured "do not use if" flags, for the deterministic safety filter. */
  avoidIf: DemographicFlag[];

  /** Source ids into `KnowledgeBase.sources`. */
  sources: string[];
  verification: VerificationStatus;
}

/* ------------------------------------------------------------------ conditions */

/** A remedy's link to a condition, with the context the legacy data implied. */
export interface RemedyLink {
  remedyId: string;
  /** Which severity bands this remedy was associated with in the old data. */
  severity: Severity[];
  /** Soft age-context note (e.g. "adults"). NOT a hard matching key. */
  ageContext?: "child" | "adolescent" | "adult" | "older-adult" | "any";
  /** Relative prominence for this condition, 1 (fringe) - 3 (primary). */
  weight: 1 | 2 | 3;
  provenance: Provenance;
  sources?: string[];
  note?: string;
}

export type Severity = "mild" | "moderate" | "severe";

/** Weighted symptom association for a condition. */
export interface SymptomLink {
  symptomId: string;
  /** 1 (loosely associated) - 3 (hallmark). */
  weight: 1 | 2 | 3;
  /** If true, absence makes this condition unlikely (used to down-rank). */
  hallmark?: boolean;
}

export interface Condition {
  id: string;
  name: string;
  aliases: string[];
  /** Neutral description. */
  summary: string;
  /** Ayurvedic framing (dosha etc.) when sourced; else null. */
  ayurvedicView: Attributed<string> | null;

  symptoms: SymptomLink[];
  /** How severity is described to the user for this condition. */
  severityGuidance: Record<Severity, string>;
  /** Demographics that materially change safety for this condition. */
  sensitiveDemographics: DemographicFlag[];

  remedies: RemedyLink[];
  redFlags: string[]; // ids into KnowledgeBase.redFlags
  generalPrecautions: Attributed<string>[];
  whenToSeeProfessional: Attributed<string>[];

  /** Source ids into `KnowledgeBase.sources`. */
  sources: string[];
  verification: VerificationStatus;
}

/* ---------------------------------------------------------------- safety config */

export interface SafetyConfig {
  /** Red flags that apply regardless of condition. */
  globalRedFlags: string[]; // ids
  /** Below this retrieval confidence we do not lead with a remedy. */
  lowConfidenceThreshold: number;
  /** Below this we ask for more information instead of guessing. */
  insufficientInfoThreshold: number;
  /** Minimum distinct symptom signals before we'll name a condition. */
  minSymptomSignals: number;
  disclaimer: { short: string; full: string };
}

/* ------------------------------------------------------------- knowledge base */

export interface KnowledgeBase {
  version: number;
  generatedAt: string;
  conditions: Condition[];
  remedies: Remedy[];
  symptoms: Symptom[];
  redFlags: RedFlag[];
  /** Source registry — every `sources` id elsewhere resolves to one of these. */
  sources: Source[];
  safety: SafetyConfig;
}
