/**
 * Deterministic safety policy. Runs before and after retrieval:
 *
 *  - `detectRedFlags` decides whether the whole request should be diverted to
 *    a "seek professional care" result instead of any remedy.
 *  - `applySafetyFilter` removes or annotates individual remedies based on the
 *    person's volunteered demographics and each remedy's `avoidIf` /
 *    `contraindications`.
 *
 * Policy is conservative on purpose: when in doubt it suppresses a remedy and
 * points to a professional. That is the safe direction to be wrong in.
 */
import type { DemographicFlag, KnowledgeBase } from "./types";
import type { EngineInput, RedFlagHit, RemedySuggestion } from "./result";
import { matchText } from "./normalize";

export interface RedFlagOutcome {
  hits: RedFlagHit[];
  /** True if any hit is `emergency` or `urgent`. */
  diverts: boolean;
  highestUrgency: "emergency" | "urgent" | "advisory" | null;
}

/**
 * Collect red-flag hits from the free text and from structured demographics.
 * Global red flags plus the red flags of every plausibly-matched condition are
 * all in scope — a red flag never depends on us first guessing the condition
 * right.
 */
export function detectRedFlags(kb: KnowledgeBase, input: EngineInput): RedFlagOutcome {
  const byId = new Map(kb.redFlags.map((f) => [f.id, f]));
  const hits = new Map<string, RedFlagHit>();

  // Text triggers — matchText already scans every red flag in the KB.
  if (input.text) {
    for (const hit of matchText(kb, input.text).redFlags) {
      hits.set(hit.redFlag.id, hit);
    }
  }

  // Structured demographic red flags (e.g. a "pregnancy" red flag id listed in
  // safety config or a condition, matched against the volunteered flag).
  const demoFlags = demographicFlags(input);
  for (const flag of kb.redFlags) {
    if (demoFlags.some((d) => flag.triggers.includes(d))) {
      hits.set(flag.id, { redFlag: flag });
    }
  }

  // Keep only ids that actually exist (defensive; build script cross-checks).
  const resolved = [...hits.values()].filter((h) => byId.has(h.redFlag.id));

  const urgencyRank = { emergency: 3, urgent: 2, advisory: 1 } as const;
  let highest: RedFlagOutcome["highestUrgency"] = null;
  for (const h of resolved) {
    if (!highest || urgencyRank[h.redFlag.urgency] > urgencyRank[highest]) {
      highest = h.redFlag.urgency;
    }
  }

  return {
    hits: resolved,
    diverts: highest === "emergency" || highest === "urgent",
    highestUrgency: highest,
  };
}

/** Translate volunteered demographics into structured flags. */
export function demographicFlags(input: EngineInput): DemographicFlag[] {
  const flags: DemographicFlag[] = [];
  const d = input.demographics;
  if (!d) return flags;
  if (d.pregnant) flags.push("pregnancy");
  if (d.breastfeeding) flags.push("breastfeeding");
  if (typeof d.ageYears === "number") {
    if (d.ageYears < 12) flags.push("child");
    if (d.ageYears >= 60) flags.push("older-adult");
  }
  return flags;
}

/**
 * Filter and annotate remedy suggestions.
 *
 *  - A remedy whose `avoidIf` intersects the person's demographic flags is
 *    removed and recorded in `removed`.
 *  - A remedy with a matching structured contraindication is annotated (kept,
 *    but the note surfaces in the UI).
 *  - A remedy with `verification.level === "unverified"` and no safe summary is
 *    kept but flagged as information-only.
 */
export function applySafetyFilter(
  suggestions: RemedySuggestion[],
  input: EngineInput,
): { kept: RemedySuggestion[]; removed: { suggestion: RemedySuggestion; reason: string }[] } {
  const flags = demographicFlags(input);
  const kept: RemedySuggestion[] = [];
  const removed: { suggestion: RemedySuggestion; reason: string }[] = [];

  for (const s of suggestions) {
    const blocked = s.remedy.avoidIf.find((f) => flags.includes(f));
    if (blocked) {
      removed.push({ suggestion: s, reason: `Not suggested here because of: ${humanFlag(blocked)}.` });
      continue;
    }

    const notes = [...s.safetyNotes];
    for (const c of s.remedy.contraindications) {
      if (c.flag !== "condition" && c.flag !== "medication" && c.flag !== "other" && flags.includes(c.flag)) {
        notes.push(`Caution (${humanFlag(c.flag)}): ${c.detail}`);
      }
    }
    if (s.remedy.verification.level === "unverified") {
      // Structured signal for consumers of the engine (including a future LLM
      // layer). The UI surfaces verification state via its own badge/banner and
      // filters this line out of the per-request safety notes.
      notes.push("unverified: details for this remedy have not been verified yet — treat as informational only.");
    }

    kept.push({ ...s, safetyNotes: notes });
  }

  return { kept, removed };
}

function humanFlag(flag: DemographicFlag): string {
  switch (flag) {
    case "pregnancy":
      return "pregnancy";
    case "breastfeeding":
      return "breastfeeding";
    case "child":
      return "young age (under 12)";
    case "older-adult":
      return "older age";
    case "none":
      return "no specific factor";
  }
}
