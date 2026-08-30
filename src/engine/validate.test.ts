import { describe, it, expect } from "vitest";
import { assertValidKnowledgeBase, findKnowledgeBaseProblems, KnowledgeBaseError } from "./validate";
import { recommend } from "./assemble";
import { makeKb } from "./__fixtures__/kb";
import type { KnowledgeBase } from "./types";

describe("assertValidKnowledgeBase", () => {
  it("accepts the fixture knowledge base", () => {
    expect(() => assertValidKnowledgeBase(makeKb())).not.toThrow();
  });

  it("accepts a well-formed but empty knowledge base", () => {
    const empty: KnowledgeBase = {
      version: 1,
      generatedAt: "2026-01-01T00:00:00.000Z",
      conditions: [],
      remedies: [],
      symptoms: [],
      redFlags: [],
      sources: [],
      safety: {
        globalRedFlags: [],
        lowConfidenceThreshold: 0.5,
        insufficientInfoThreshold: 0.22,
        minSymptomSignals: 2,
        disclaimer: { short: "s", full: "f" },
      },
    };
    expect(() => assertValidKnowledgeBase(empty)).not.toThrow();
  });

  it("rejects a non-object", () => {
    expect(() => assertValidKnowledgeBase(null)).toThrow(KnowledgeBaseError);
    expect(() => assertValidKnowledgeBase("nope")).toThrow(KnowledgeBaseError);
    expect(() => assertValidKnowledgeBase(42)).toThrow(KnowledgeBaseError);
  });

  it("rejects a knowledge base missing a required collection", () => {
    const bad = { ...makeKb() } as Record<string, unknown>;
    delete bad.remedies;
    expect(() => assertValidKnowledgeBase(bad)).toThrow(/remedies/);
  });

  it("rejects a knowledge base with no safety config", () => {
    const bad = { ...makeKb(), safety: null };
    expect(() => assertValidKnowledgeBase(bad)).toThrow(/safety/);
  });

  it("detects a duplicate remedy id", () => {
    const kb = makeKb();
    kb.remedies.push({ ...kb.remedies[0] });
    const problems = findKnowledgeBaseProblems(kb);
    expect(problems.some((p) => /duplicate remedy id/.test(p))).toBe(true);
  });

  it("detects a condition referencing an unknown symptom", () => {
    const kb = makeKb();
    kb.conditions[0].symptoms.push({ symptomId: "ghost-symptom", weight: 2 });
    expect(findKnowledgeBaseProblems(kb)).toEqual(
      expect.arrayContaining([expect.stringMatching(/unknown symptom "ghost-symptom"/)]),
    );
  });

  it("detects a condition referencing an unknown remedy", () => {
    const kb = makeKb();
    kb.conditions[0].remedies.push({
      remedyId: "ghost-remedy",
      severity: ["mild"],
      weight: 1,
      provenance: "inherited-legacy-dataset",
    });
    expect(findKnowledgeBaseProblems(kb)).toEqual(
      expect.arrayContaining([expect.stringMatching(/unknown remedy "ghost-remedy"/)]),
    );
  });

  it("detects an attributed field / record referencing an unknown source", () => {
    const kb = makeKb();
    kb.conditions[0].sources.push("ghost-source");
    expect(findKnowledgeBaseProblems(kb)).toEqual(
      expect.arrayContaining([expect.stringMatching(/unknown source "ghost-source"/)]),
    );
  });

  it("detects safety.globalRedFlags pointing at an unknown red flag", () => {
    const kb = makeKb();
    kb.safety.globalRedFlags.push("rf-does-not-exist");
    expect(findKnowledgeBaseProblems(kb)).toEqual(
      expect.arrayContaining([expect.stringMatching(/unknown red flag "rf-does-not-exist"/)]),
    );
  });

  it("aggregates multiple problems into one error", () => {
    const bad = { conditions: [], remedies: "x", symptoms: [], redFlags: [], sources: [], safety: null };
    try {
      assertValidKnowledgeBase(bad);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(KnowledgeBaseError);
      expect((e as KnowledgeBaseError).problems.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("engine tolerates a valid but empty knowledge base", () => {
  const empty: KnowledgeBase = {
    version: 1,
    generatedAt: "2026-01-01T00:00:00.000Z",
    conditions: [],
    remedies: [],
    symptoms: [],
    redFlags: [],
    sources: [],
    safety: {
      globalRedFlags: [],
      lowConfidenceThreshold: 0.5,
      insufficientInfoThreshold: 0.22,
      minSymptomSignals: 2,
      disclaimer: { short: "s", full: "f" },
    },
  };

  it("returns insufficient_information rather than throwing", () => {
    const r = recommend(empty, { text: "burning stomach pain, worse after eating" });
    expect(r.kind).toBe("insufficient_information");
    expect(r.suggestions).toHaveLength(0);
  });
});
