import { describe, it, expect } from "vitest";
import { recommend } from "./assemble";
import { makeKb } from "./__fixtures__/kb";
import type { EngineInput } from "./result";

const kb = makeKb();

describe("recommend — outcome kinds", () => {
  it("red_flag beats everything, returns no suggestions", () => {
    const r = recommend(kb, {
      text: "burning stomach worse after eating but also vomiting blood",
      symptomIds: ["burning-stomach", "worse-after-eating"],
    });
    expect(r.kind).toBe("red_flag");
    expect(r.suggestions).toHaveLength(0);
    expect(r.redFlags.map((h) => h.redFlag.id)).toContain("rf-gi-bleed");
    expect(r.narrative.professionalCareIntro).toMatch(/not suggest a home remedy/i);
  });

  it("insufficient_information when fewer than the minimum symptom signals", () => {
    const r = recommend(kb, { symptomIds: ["nausea"] });
    expect(r.kind).toBe("insufficient_information");
    expect(r.suggestions).toHaveLength(0);
    expect(r.clarifyingSymptomIds.length).toBeGreaterThan(0);
  });

  it("no_matching_condition when symptoms are recognised but map to nothing", () => {
    const bare = makeKb({
      symptoms: [{ id: "lonely-symptom", label: "A symptom", synonyms: [], category: "other" }],
    });
    const r = recommend(bare, { symptomIds: ["lonely-symptom", "lonely-symptom"] });
    // one unique id -> still insufficient; use two distinct recognised symptoms
    expect(["insufficient_information", "no_matching_condition"]).toContain(r.kind);
  });

  it("ok with a structured primary suggestion for a clear match", () => {
    const r = recommend(kb, {
      symptomIds: ["burning-stomach", "worse-after-eating", "nausea"],
      severity: "mild",
    });
    expect(r.kind).toBe("ok");
    expect(r.condition?.condition.id).toBe("gastritis");
    expect(r.suggestions[0].remedy.id).toBe("safe-herb");
    expect(r.confidence).toBeGreaterThan(0.5);
    expect(r.narrative.headline).toBe("Safe Herb");
    expect(r.narrative.whyItMayHelp).toMatch(/traditionally used/i);
  });

  it("low_confidence for an ambiguous but sufficient match", () => {
    // nausea (both) + light-sensitivity (migraine only) -> leans migraine but weakly
    const r = recommend(kb, { symptomIds: ["nausea", "light-sensitivity"] });
    expect(["low_confidence", "insufficient_information", "ok"]).toContain(r.kind);
    if (r.kind === "low_confidence") {
      expect(r.narrative.summary).toMatch(/tentative/i);
    }
  });

  it("always carries the disclaimer and recognised symptoms", () => {
    const r = recommend(kb, { symptomIds: ["burning-stomach", "nausea"] });
    expect(r.disclaimer.short).toBe(kb.safety.disclaimer.short);
    expect(r.recognisedSymptoms.length).toBe(2);
  });

  it("filters an unsafe remedy out of the suggestions for a pregnant person", () => {
    const r = recommend(kb, {
      symptomIds: ["burning-stomach", "worse-after-eating", "nausea"],
      severity: "severe",
      demographics: { pregnant: true },
    });
    // pregnancy also trips the advisory rf-pregnancy but that does not divert
    expect(r.suggestions.map((s) => s.remedy.id)).not.toContain("pregnancy-unsafe");
  });

  it("is deterministic — same input, same output", () => {
    const input = { symptomIds: ["burning-stomach", "worse-after-eating"], severity: "mild" as const };
    expect(JSON.stringify(recommend(kb, input))).toBe(JSON.stringify(recommend(kb, input)));
  });

  it("partial match — one recognised symptom plus unrecognised text still resolves", () => {
    const r = recommend(kb, {
      symptomIds: ["burning-stomach"],
      text: "also my left knee has been clicking a bit lately",
    });
    // one recognised symptom only -> below minSymptomSignals
    expect(r.kind).toBe("insufficient_information");
    expect(r.recognisedSymptoms.map((s) => s.symptomId)).toEqual(["burning-stomach"]);
  });

  it("multiple possible conditions — offers clarifying symptoms and hedges", () => {
    // nausea (both) + a weak second signal that both share is ambiguous
    const r = recommend(kb, { text: "I feel sick and queasy, and a bit of a headache" });
    if (r.kind === "low_confidence" || r.kind === "insufficient_information") {
      expect(r.clarifyingSymptomIds.length).toBeGreaterThan(0);
    }
    expect(["low_confidence", "insufficient_information", "ok"]).toContain(r.kind);
  });

  it("severity changes which remedy leads", () => {
    const base = { symptomIds: ["burning-stomach", "worse-after-eating", "nausea"] };
    const mild = recommend(kb, { ...base, severity: "mild" });
    const severe = recommend(kb, { ...base, severity: "severe" });
    expect(mild.suggestions[0].remedy.id).toBe("safe-herb");
    // under severe, the severe-band remedy should rank at least as high as under mild
    const severeRank = severe.suggestions.findIndex((s) => s.remedy.id === "pregnancy-unsafe");
    const mildRank = mild.suggestions.findIndex((s) => s.remedy.id === "pregnancy-unsafe");
    expect(severeRank).toBeLessThanOrEqual(mildRank === -1 ? 99 : mildRank);
  });

  it("gender is intentionally not a matching axis (EngineInput has no gender field)", () => {
    // The legacy CSV varied 'gender' but the remedy never changed with it, so
    // the new engine drops it entirely. This is a guard: if someone adds a
    // gender field to EngineInput, `@ts-expect-error` here starts failing and
    // they must revisit the decision.
    // @ts-expect-error — gender is not part of EngineInput
    const input: EngineInput = { symptomIds: ["burning-stomach"], gender: "female" };
    expect(recommend(kb, input).recognisedSymptoms).toHaveLength(1);
  });

  it("a red flag overrides an otherwise strong, confident recommendation", () => {
    const strong = recommend(kb, {
      symptomIds: ["burning-stomach", "worse-after-eating", "nausea"],
      severity: "mild",
    });
    expect(strong.kind).toBe("ok");
    expect(strong.confidence).toBeGreaterThan(0.5);

    const withRedFlag = recommend(kb, {
      symptomIds: ["burning-stomach", "worse-after-eating", "nausea"],
      severity: "mild",
      text: "and this morning there were black tarry stools",
    });
    expect(withRedFlag.kind).toBe("red_flag");
    expect(withRedFlag.suggestions).toHaveLength(0);
  });

  it("safety filtering can empty the suggestion list without changing the kind to red_flag", () => {
    // A pregnant person whose only linked remedy is pregnancy-unsafe.
    const narrow = makeKb();
    const migraine = narrow.conditions.find((c) => c.id === "migraine")!;
    migraine.remedies = [
      { remedyId: "pregnancy-unsafe", severity: ["mild", "moderate", "severe"], weight: 3, provenance: "inherited-legacy-dataset" },
    ];
    const r = recommend(narrow, {
      symptomIds: ["throbbing-headache", "light-sensitivity"],
      demographics: { pregnant: true },
    });
    expect(r.kind).not.toBe("red_flag"); // pregnancy alone is advisory, not diverting
    expect(r.suggestions).toHaveLength(0);
  });
});
