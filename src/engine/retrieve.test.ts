import { describe, it, expect } from "vitest";
import { scoreConditions, rankRemedies } from "./retrieve";
import { resolveChosenSymptoms } from "./normalize";
import { makeKb } from "./__fixtures__/kb";

const kb = makeKb();

describe("scoreConditions", () => {
  it("ranks the condition whose hallmark symptom matched first", () => {
    const matched = resolveChosenSymptoms(kb, ["burning-stomach", "worse-after-eating"]);
    const ranked = scoreConditions(kb, matched);
    expect(ranked[0].condition.id).toBe("gastritis");
    expect(ranked[0].score).toBeGreaterThan(0.5);
  });

  it("excludes conditions with no matched symptoms", () => {
    const matched = resolveChosenSymptoms(kb, ["throbbing-headache"]);
    const ranked = scoreConditions(kb, matched);
    expect(ranked.map((r) => r.condition.id)).toEqual(["migraine"]);
  });

  it("boosts a condition that was named outright", () => {
    const matched = resolveChosenSymptoms(kb, ["nausea"]); // shared, weak signal
    const withoutName = scoreConditions(kb, matched);
    const withName = scoreConditions(kb, matched, ["migraine"]);
    const m1 = withoutName.find((r) => r.condition.id === "migraine")!.score;
    const m2 = withName.find((r) => r.condition.id === "migraine")!.score;
    expect(m2).toBeGreaterThan(m1);
  });

  it("returns an empty array when nothing matches", () => {
    expect(scoreConditions(kb, [])).toEqual([]);
  });
});

describe("rankRemedies", () => {
  const gastritis = kb.conditions.find((c) => c.id === "gastritis")!;

  it("orders by prominence when no severity is given", () => {
    const ranked = rankRemedies(kb, gastritis);
    expect(ranked[0].remedy.id).toBe("safe-herb"); // weight 3
  });

  it("lifts a remedy whose severity band matches the request", () => {
    const mild = rankRemedies(kb, gastritis, { severity: "mild" });
    const severe = rankRemedies(kb, gastritis, { severity: "severe" });
    // safe-herb is a mild remedy; it should score higher under a mild request.
    const mildScore = mild.find((r) => r.remedy.id === "safe-herb")!.relevance;
    const severeScore = severe.find((r) => r.remedy.id === "safe-herb")!.relevance;
    expect(mildScore).toBeGreaterThan(severeScore);
  });

  it("records a rationale for a severity match", () => {
    const ranked = rankRemedies(kb, gastritis, { severity: "mild" });
    const top = ranked.find((r) => r.remedy.id === "safe-herb")!;
    expect(top.rationale.join(" ")).toMatch(/mild/i);
  });

  it("never returns a relevance outside 0..1", () => {
    for (const s of ["mild", "moderate", "severe"] as const) {
      for (const r of rankRemedies(kb, gastritis, { severity: s })) {
        expect(r.relevance).toBeGreaterThanOrEqual(0);
        expect(r.relevance).toBeLessThanOrEqual(1);
      }
    }
  });

  it("uses age context softly — an older-adult age lifts a matching remedy and records why", () => {
    const neutral = rankRemedies(kb, gastritis, { severity: "moderate" });
    const older = rankRemedies(kb, gastritis, { severity: "moderate", ageYears: 72 });
    const n = neutral.find((r) => r.remedy.id === "unverified-remedy")!.relevance;
    const o = older.find((r) => r.remedy.id === "unverified-remedy")!;
    expect(o.relevance).toBeGreaterThan(n);
    expect(o.rationale.join(" ")).toMatch(/older-adult/);
  });

  it("does not duplicate a remedy that is linked from more than one condition", () => {
    const migraine = kb.conditions.find((c) => c.id === "migraine")!;
    const ranked = rankRemedies(kb, migraine);
    const ids = ranked.map((r) => r.remedy.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("safe-herb"); // also linked to gastritis
  });
});
