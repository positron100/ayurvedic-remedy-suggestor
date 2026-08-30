import { describe, it, expect } from "vitest";
import { assessConfidence } from "./confidence";
import { scoreConditions } from "./retrieve";
import { resolveChosenSymptoms } from "./normalize";
import { makeKb } from "./__fixtures__/kb";

const kb = makeKb();

describe("assessConfidence", () => {
  it("is zero when nothing ranked", () => {
    expect(assessConfidence([], 0).value).toBe(0);
  });

  it("rises with more matched symptoms", () => {
    const one = scoreConditions(kb, resolveChosenSymptoms(kb, ["burning-stomach"]));
    const three = scoreConditions(kb, resolveChosenSymptoms(kb, ["burning-stomach", "worse-after-eating", "nausea"]));
    expect(assessConfidence(three, 3).value).toBeGreaterThan(assessConfidence(one, 1).value);
  });

  it("drops and reports contenders when two conditions score close together", () => {
    // "nausea" alone is weight 1 in both conditions -> near-tie.
    const ranked = scoreConditions(kb, resolveChosenSymptoms(kb, ["nausea"]));
    const out = assessConfidence(ranked, 1);
    expect(out.contenders.length).toBeGreaterThan(1);
    expect(out.reasons.join(" ")).toMatch(/overlaps with/i);
  });

  it("notes a single weak signal", () => {
    const ranked = scoreConditions(kb, resolveChosenSymptoms(kb, ["light-sensitivity"]));
    const out = assessConfidence(ranked, 1);
    expect(out.reasons.join(" ")).toMatch(/one symptom/i);
  });
});
