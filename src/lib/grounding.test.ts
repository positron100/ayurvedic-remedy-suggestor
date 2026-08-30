import { describe, it, expect } from "vitest";
import { recommend } from "@/engine";
import { makeKb } from "@/engine/__fixtures__/kb";
import { buildPhrasePayload, applyPhrasing, allowedSymptoms } from "./grounding";
import type { PhrasedNarrative } from "./recommendApi";

const kb = makeKb();

function okRecommendation() {
  const r = recommend(kb, { symptomIds: ["burning-stomach", "worse-after-eating", "nausea"], severity: "mild" });
  expect(r.kind).toBe("ok");
  return r;
}

describe("buildPhrasePayload", () => {
  it("returns null for non-recommendation outcomes", () => {
    const rf = recommend(kb, { text: "vomiting blood since this morning" });
    expect(rf.kind).toBe("red_flag");
    expect(buildPhrasePayload(rf, "vomiting blood")).toBeNull();
  });

  it("returns null for a chips-only assessment (no description to relate to)", () => {
    expect(buildPhrasePayload(okRecommendation(), undefined)).toBeNull();
    expect(buildPhrasePayload(okRecommendation(), "   ")).toBeNull();
  });

  it("sends only the minimal, already-decided facts", () => {
    const payload = buildPhrasePayload(okRecommendation(), "my stomach burns after eating")!;
    expect(payload).not.toBeNull();
    expect(Object.keys(payload).sort()).toEqual(
      ["conditionName", "matchedSymptoms", "rationale", "remedy", "userDescription"].sort(),
    );
    expect(payload.conditionName).toBe("Gastritis");
    // no confidence, no other suggestions, no KB internals
    expect(JSON.stringify(payload)).not.toContain("confidence");
  });

  it("clamps the user description length", () => {
    const long = "burning ".repeat(200);
    const payload = buildPhrasePayload(okRecommendation(), long)!;
    expect(payload.userDescription.length).toBeLessThanOrEqual(600);
  });

  it("passes through only KB facts that exist (nulls stay null)", () => {
    const payload = buildPhrasePayload(okRecommendation(), "x")!;
    // fixture "safe-herb" has traditionalUse + preparation, no usage
    expect(payload.remedy.traditionalUse).toBeTruthy();
    expect(payload.remedy.usage).toBeNull();
    expect(payload.remedy.verification).toBe("sourced");
  });
});

describe("applyPhrasing — structure is immutable", () => {
  const phrased: PhrasedNarrative = {
    summary: "A warm rephrased summary.",
    whyThisMatches: "A warm rephrased why.",
    traditionalContext: "A warm rephrased how.",
  };

  it("replaces prose slots and sets enhanced, nothing else", () => {
    const before = okRecommendation();
    const after = applyPhrasing(before, phrased);

    expect(after.enhanced).toBe(true);
    expect(after.narrative.summary).toBe(phrased.summary);
    expect(after.narrative.whyItMayHelp).toBe(phrased.whyThisMatches);

    // structured data untouched
    expect(after.kind).toBe(before.kind);
    expect(after.confidence).toBe(before.confidence);
    expect(after.suggestions).toBe(before.suggestions);
    expect(after.condition).toBe(before.condition);
    expect(after.redFlags).toBe(before.redFlags);
    expect(after.disclaimer).toEqual(before.disclaimer);

    // safety prose is NOT LLM-generated
    expect(after.narrative.professionalCareIntro).toBe(before.narrative.professionalCareIntro);
    expect(after.narrative.precautionsIntro).toBe(before.narrative.precautionsIntro);
  });

  it("does not accept phrased traditional context when the KB had no such fact", () => {
    const before = okRecommendation();
    // force the templated howItIsUsed to the "not verified" form
    const noFacts = {
      ...before,
      narrative: { ...before.narrative, howItIsUsed: null },
    };
    const after = applyPhrasing(noFacts, phrased);
    expect(after.narrative.howItIsUsed).toBeNull();
  });
});

describe("allowedSymptoms", () => {
  it("exposes only id/label/synonyms", () => {
    const list = allowedSymptoms(kb);
    expect(list.length).toBe(kb.symptoms.length);
    expect(Object.keys(list[0]).sort()).toEqual(["id", "label", "synonyms"]);
  });
});
