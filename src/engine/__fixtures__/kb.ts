/**
 * A small, self-contained knowledge base for engine unit tests. Deliberately
 * not the real compiled content — tests should not break when curated data
 * changes. Shapes match `../types`.
 */
import type { KnowledgeBase } from "../types";

export function makeKb(overrides: Partial<KnowledgeBase> = {}): KnowledgeBase {
  const base: KnowledgeBase = {
    version: 1,
    generatedAt: "2026-01-01T00:00:00.000Z",
    sources: [
      { id: "src-nhs", title: "Test health authority page", publisher: "NHS (test)", kind: "health-authority" },
    ],
    symptoms: [
      { id: "burning-stomach", label: "Burning stomach pain", synonyms: ["burning in my stomach", "acid feeling"], category: "digestive" },
      { id: "worse-after-eating", label: "Worse after meals", synonyms: ["worse after eating", "worse after food"], category: "digestive" },
      { id: "nausea", label: "Nausea", synonyms: ["feel sick", "queasy"], category: "digestive" },
      { id: "throbbing-headache", label: "Throbbing headache", synonyms: ["pounding headache"], category: "head" },
      { id: "light-sensitivity", label: "Sensitivity to light", synonyms: ["bright lights bother me"], category: "neurological" },
    ],
    redFlags: [
      {
        id: "rf-gi-bleed",
        label: "blood in vomit or black stools",
        triggers: ["vomiting blood", "black tarry stools", "coffee ground vomit"],
        guidance: "Seek immediate care.",
        urgency: "emergency",
        provenance: "sourced",
        sources: ["src-nhs"],
      },
      {
        id: "rf-pregnancy",
        label: "pregnancy",
        triggers: ["pregnancy"],
        guidance: "Discuss with your midwife.",
        urgency: "advisory",
        provenance: "editorial",
      },
    ],
    remedies: [
      {
        id: "safe-herb",
        canonicalName: "Safe Herb",
        aliases: [],
        type: "single-herb",
        summary: { value: "A gentle culinary herb.", provenance: "editorial" },
        ingredients: [],
        traditionalUse: { value: "Traditionally used for mild indigestion.", provenance: "sourced", sources: ["src-nhs"] },
        preparation: { value: "Steep in hot water.", provenance: "editorial" },
        usage: null,
        contraindications: [],
        precautions: [],
        interactions: [],
        avoidIf: [],
        sources: [],
        verification: { level: "sourced", summary: "Sourced." },
      },
      {
        id: "pregnancy-unsafe",
        canonicalName: "Strong Formulation",
        aliases: [],
        type: "classical-formulation",
        summary: null,
        ingredients: [],
        traditionalUse: null,
        preparation: null,
        usage: null,
        contraindications: [
          { flag: "older-adult", detail: "Use a lower amount in older adults.", provenance: "editorial" },
        ],
        precautions: [],
        interactions: [],
        avoidIf: ["pregnancy"],
        sources: [],
        verification: { level: "needs_review", summary: "Needs review." },
      },
      {
        id: "unverified-remedy",
        canonicalName: "Unverified Powder",
        aliases: [],
        type: "classical-formulation",
        summary: null,
        ingredients: [],
        traditionalUse: null,
        preparation: null,
        usage: null,
        contraindications: [],
        precautions: [],
        interactions: [],
        avoidIf: [],
        sources: [],
        verification: { level: "unverified", summary: "Legacy pairing only." },
      },
    ],
    conditions: [
      {
        id: "gastritis",
        name: "Gastritis",
        aliases: ["acidity"],
        summary: "Stomach lining irritation.",
        ayurvedicView: null,
        symptoms: [
          { symptomId: "burning-stomach", weight: 3, hallmark: true },
          { symptomId: "worse-after-eating", weight: 2 },
          { symptomId: "nausea", weight: 1 },
        ],
        severityGuidance: { mild: "mild", moderate: "moderate", severe: "severe" },
        sensitiveDemographics: ["pregnancy"],
        remedies: [
          { remedyId: "safe-herb", severity: ["mild"], ageContext: "any", weight: 3, provenance: "inherited-legacy-dataset" },
          { remedyId: "pregnancy-unsafe", severity: ["severe"], ageContext: "any", weight: 2, provenance: "inherited-legacy-dataset" },
          { remedyId: "unverified-remedy", severity: ["moderate"], ageContext: "older-adult", weight: 1, provenance: "inherited-legacy-dataset" },
        ],
        redFlags: ["rf-gi-bleed"],
        generalPrecautions: [],
        whenToSeeProfessional: [{ value: "See a doctor if it persists.", provenance: "sourced", sources: ["src-nhs"] }],
        sources: ["src-nhs"],
        verification: { level: "needs_review", summary: "Needs review." },
      },
      {
        id: "migraine",
        name: "Migraine",
        aliases: [],
        summary: "A headache disorder.",
        ayurvedicView: null,
        symptoms: [
          { symptomId: "throbbing-headache", weight: 3, hallmark: true },
          { symptomId: "light-sensitivity", weight: 2 },
          { symptomId: "nausea", weight: 1 },
        ],
        severityGuidance: { mild: "mild", moderate: "moderate", severe: "severe" },
        sensitiveDemographics: ["pregnancy"],
        remedies: [
          { remedyId: "safe-herb", severity: ["mild"], ageContext: "any", weight: 2, provenance: "inherited-legacy-dataset" },
        ],
        redFlags: [],
        generalPrecautions: [],
        whenToSeeProfessional: [{ value: "See a doctor for a sudden severe headache.", provenance: "sourced", sources: ["src-nhs"] }],
        sources: ["src-nhs"],
        verification: { level: "needs_review", summary: "Needs review." },
      },
    ],
    safety: {
      globalRedFlags: ["rf-gi-bleed", "rf-pregnancy"],
      lowConfidenceThreshold: 0.5,
      insufficientInfoThreshold: 0.22,
      minSymptomSignals: 2,
      disclaimer: { short: "Guidance only.", full: "Guidance only — not medical advice." },
    },
  };

  return { ...base, ...overrides };
}
