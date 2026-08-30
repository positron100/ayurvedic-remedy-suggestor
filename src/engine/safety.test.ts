import { describe, it, expect } from "vitest";
import { detectRedFlags, applySafetyFilter, demographicFlags } from "./safety";
import { rankRemedies } from "./retrieve";
import { makeKb } from "./__fixtures__/kb";

const kb = makeKb();

describe("detectRedFlags", () => {
  it("diverts on an emergency trigger in free text", () => {
    const out = detectRedFlags(kb, { text: "I keep vomiting blood" });
    expect(out.diverts).toBe(true);
    expect(out.highestUrgency).toBe("emergency");
    expect(out.hits.map((h) => h.redFlag.id)).toContain("rf-gi-bleed");
  });

  it("does not divert on an advisory-only hit", () => {
    const out = detectRedFlags(kb, { demographics: { pregnant: true } });
    expect(out.hits.map((h) => h.redFlag.id)).toContain("rf-pregnancy");
    expect(out.diverts).toBe(false);
    expect(out.highestUrgency).toBe("advisory");
  });

  it("returns no hits for ordinary input", () => {
    const out = detectRedFlags(kb, { text: "mild burning in my stomach after lunch" });
    expect(out.hits).toHaveLength(0);
    expect(out.diverts).toBe(false);
  });
});

describe("demographicFlags", () => {
  it("maps volunteered demographics to structured flags", () => {
    expect(demographicFlags({ demographics: { pregnant: true, ageYears: 8 } }).sort()).toEqual(
      ["child", "pregnancy"].sort(),
    );
    expect(demographicFlags({ demographics: { ageYears: 70 } })).toEqual(["older-adult"]);
    expect(demographicFlags({})).toEqual([]);
  });
});

describe("applySafetyFilter", () => {
  const gastritis = kb.conditions.find((c) => c.id === "gastritis")!;

  it("removes a remedy whose avoidIf matches the person's demographics", () => {
    const ranked = rankRemedies(kb, gastritis, { severity: "severe" });
    const { kept, removed } = applySafetyFilter(ranked, { demographics: { pregnant: true } });
    expect(kept.map((s) => s.remedy.id)).not.toContain("pregnancy-unsafe");
    expect(removed.map((r) => r.suggestion.remedy.id)).toContain("pregnancy-unsafe");
    expect(removed[0].reason).toMatch(/pregnancy/i);
  });

  it("annotates (does not remove) a matching structured contraindication", () => {
    const ranked = rankRemedies(kb, gastritis, { severity: "severe" });
    const { kept } = applySafetyFilter(ranked, { demographics: { ageYears: 72 } });
    const strong = kept.find((s) => s.remedy.id === "pregnancy-unsafe")!;
    expect(strong).toBeDefined();
    expect(strong.safetyNotes.join(" ")).toMatch(/older/i);
  });

  it("flags an unverified remedy as informational only", () => {
    const ranked = rankRemedies(kb, gastritis, { severity: "moderate" });
    const { kept } = applySafetyFilter(ranked, {});
    const unv = kept.find((s) => s.remedy.id === "unverified-remedy")!;
    expect(unv.safetyNotes.join(" ")).toMatch(/not been verified/i);
  });
});
