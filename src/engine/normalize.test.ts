import { describe, it, expect } from "vitest";
import { normalizeText, tokenize, matchText, resolveChosenSymptoms, mergeSymptoms } from "./normalize";
import { makeKb } from "./__fixtures__/kb";

const kb = makeKb();

describe("normalizeText", () => {
  it("lowercases, strips punctuation and apostrophes, collapses whitespace", () => {
    expect(normalizeText("  I've GOT a Burning, Stomach!!  ")).toBe("ive got a burning stomach");
  });
});

describe("tokenize", () => {
  it("drops stopwords and single characters", () => {
    expect(tokenize("I have a burning feeling in my stomach")).toEqual(["burning", "stomach"]);
  });
});

describe("matchText", () => {
  it("matches a symptom by its canonical label", () => {
    const r = matchText(kb, "burning stomach pain that is bad");
    expect(r.symptoms.map((s) => s.symptomId)).toContain("burning-stomach");
  });

  it("matches a symptom by a synonym phrase", () => {
    const r = matchText(kb, "everything is worse after eating a big meal");
    expect(r.symptoms.map((s) => s.symptomId)).toContain("worse-after-eating");
  });

  it("does not match a symptom from unrelated text", () => {
    const r = matchText(kb, "my elbow is a bit sore today");
    expect(r.symptoms).toHaveLength(0);
  });

  it("flags a red flag trigger phrase", () => {
    const r = matchText(kb, "I have been vomiting blood since this morning");
    expect(r.redFlags.map((f) => f.redFlag.id)).toContain("rf-gi-bleed");
  });

  it("recognises a condition named outright", () => {
    const r = matchText(kb, "I think this is my migraine again");
    expect(r.namedConditionIds).toContain("migraine");
  });

  it("returns nothing for empty input", () => {
    const r = matchText(kb, "   ");
    expect(r.symptoms).toHaveLength(0);
    expect(r.redFlags).toHaveLength(0);
  });

  it("light stemming matches inflected words (burns ⇒ burning stomach)", () => {
    const r = matchText(kb, "my stomach burns a lot lately");
    expect(r.symptoms.map((s) => s.symptomId)).toContain("burning-stomach");
  });

  it("red-flag triggers are order-sensitive so negations don't false-positive", () => {
    const negated = matchText(kb, "there was no blood, but I had been vomiting all night");
    expect(negated.redFlags.map((f) => f.redFlag.id)).not.toContain("rf-gi-bleed");

    const real = matchText(kb, "I have been vomiting blood since this morning");
    expect(real.redFlags.map((f) => f.redFlag.id)).toContain("rf-gi-bleed");
  });
});

describe("resolveChosenSymptoms / mergeSymptoms", () => {
  it("resolves known ids and drops unknown ones", () => {
    const r = resolveChosenSymptoms(kb, ["nausea", "does-not-exist"]);
    expect(r.map((s) => s.symptomId)).toEqual(["nausea"]);
    expect(r[0].via).toBe("chip");
  });

  it("prefers a chip selection over a text match for the same symptom", () => {
    const chips = resolveChosenSymptoms(kb, ["nausea"]);
    const text = matchText(kb, "feel sick and queasy").symptoms;
    const merged = mergeSymptoms(chips, text);
    expect(merged.filter((s) => s.symptomId === "nausea")).toHaveLength(1);
    expect(merged.find((s) => s.symptomId === "nausea")!.via).toBe("chip");
  });
});
