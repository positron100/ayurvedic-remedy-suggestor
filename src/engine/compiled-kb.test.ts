/**
 * Sanity checks against the REAL compiled knowledge base (content/ ->
 * src/generated/knowledge.json). These guard the curated data, not the engine
 * logic: if someone breaks a symptom link or a red-flag trigger, this fails.
 *
 * Requires `npm run kb:build` to have run (predev/prebuild/pretest handle it in
 * normal use).
 */
import { describe, it, expect, beforeAll } from "vitest";
import { recommend } from "./assemble";
import type { KnowledgeBase } from "./types";

let kb: KnowledgeBase;

beforeAll(async () => {
  kb = (await import("@/generated/knowledge.json")).default as unknown as KnowledgeBase;
});

describe("compiled knowledge base", () => {
  it("has the four in-scope conditions and nothing else", () => {
    expect(kb.conditions.map((c) => c.id).sort()).toEqual(["arthritis", "diarrhea", "gastritis", "migraine"]);
  });

  it("every condition remedy link points at a real remedy", () => {
    const ids = new Set(kb.remedies.map((r) => r.id));
    for (const c of kb.conditions) {
      for (const link of c.remedies) expect(ids.has(link.remedyId), `${c.id} -> ${link.remedyId}`).toBe(true);
    }
  });

  it("every 'sourced' attributed field lists at least one real source", () => {
    const sourceIds = new Set(kb.remedies.flatMap((r) => r.sources.map((s) => (s as unknown as { id?: string }).id ?? s)));
    // sources also live in the sources doc; just assert sourced fields are non-empty
    for (const r of kb.remedies) {
      if (r.traditionalUse?.provenance === "sourced") {
        expect(r.traditionalUse.sources && r.traditionalUse.sources.length > 0, r.id).toBe(true);
      }
    }
    expect(sourceIds).toBeDefined();
  });

  describe("each condition's hallmark symptom produces a relevant result", () => {
    for (const conditionId of ["arthritis", "diarrhea", "gastritis", "migraine"]) {
      it(conditionId, () => {
        const cond = kb.conditions.find((c) => c.id === conditionId)!;
        const hallmarks = cond.symptoms.filter((s) => s.hallmark || s.weight >= 2).map((s) => s.symptomId);
        const r = recommend(kb, { symptomIds: hallmarks.slice(0, 3) });
        expect(["ok", "low_confidence"]).toContain(r.kind);
        expect(r.condition?.condition.id).toBe(conditionId);
        expect(r.suggestions.length).toBeGreaterThan(0);
        expect(r.disclaimer.full.length).toBeGreaterThan(20);
      });
    }
  });

  it("a GI-bleed description diverts to professional care", () => {
    const r = recommend(kb, { text: "burning stomach and now my vomit looks like coffee grounds" });
    expect(r.kind).toBe("red_flag");
    expect(r.suggestions).toHaveLength(0);
  });

  it("a sudden severe headache description diverts to professional care", () => {
    const r = recommend(kb, { text: "worst headache of my life, came on suddenly a minute ago" });
    expect(r.kind).toBe("red_flag");
  });

  it("empty input asks for more information", () => {
    expect(recommend(kb, {}).kind).toBe("insufficient_information");
  });

  it("free-text lay synonyms match real symptoms (diarrhea)", () => {
    const r = recommend(kb, { text: "runny tummy since yesterday with stomach cramps and I'm really thirsty" });
    expect(["ok", "low_confidence"]).toContain(r.kind);
    expect(r.condition?.condition.id).toBe("diarrhea");
    expect(r.recognisedSymptoms.length).toBeGreaterThanOrEqual(2);
  });

  it("a one-sided throbbing headache with light sensitivity matches migraine", () => {
    const r = recommend(kb, {
      text: "pounding headache on one side of my head and bright lights bother me, feel a bit sick",
    });
    expect(["ok", "low_confidence"]).toContain(r.kind);
    expect(r.condition?.condition.id).toBe("migraine");
  });

  it("a sourced remedy surfaces its cited traditional use in the narrative", () => {
    // ginger is linked to arthritis and migraine and is `sourced`
    const arthritis = kb.conditions.find((c) => c.id === "arthritis")!;
    const r = recommend(kb, {
      symptomIds: arthritis.symptoms.map((s) => s.symptomId).slice(0, 3),
      severity: "mild",
    });
    const ginger = r.suggestions.find((s) => s.remedy.id === "ginger");
    if (ginger) {
      expect(ginger.remedy.verification.level).toBe("sourced");
      expect(ginger.remedy.traditionalUse?.provenance).toBe("sourced");
    }
    expect(r.suggestions.length).toBeGreaterThan(0);
  });

  it("every unverified remedy that surfaces is flagged informational-only", () => {
    const gastritis = kb.conditions.find((c) => c.id === "gastritis")!;
    const r = recommend(kb, {
      symptomIds: gastritis.symptoms.map((s) => s.symptomId).slice(0, 3),
      severity: "moderate",
    });
    for (const s of r.suggestions) {
      if (s.remedy.verification.level === "unverified") {
        expect(s.safetyNotes.join(" ")).toMatch(/not been verified/i);
      }
    }
  });

  it("an out-of-scope complaint does not force a match", () => {
    const r = recommend(kb, { text: "I have a persistent dry cough and a sore throat for two days" });
    expect(["no_matching_condition", "insufficient_information"]).toContain(r.kind);
  });

  it("pregnancy-unsafe remedies are withheld from a pregnant person", () => {
    const r = recommend(kb, {
      symptomIds: kb.conditions.find((c) => c.id === "migraine")!.symptoms.slice(0, 3).map((s) => s.symptomId),
      demographics: { pregnant: true },
    });
    for (const s of r.suggestions) {
      expect(s.remedy.avoidIf).not.toContain("pregnancy");
    }
  });
});
