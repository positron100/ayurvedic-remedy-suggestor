import { describe, it, expect } from "vitest";
import { validateIntent, validatePhrasing, extractJsonObject } from "./validate.ts";
import { ProviderError, type PhrasePayload, type AllowedSymptom } from "./types.ts";

const ALLOWED: AllowedSymptom[] = [
  { id: "burning-stomach", label: "Burning stomach", synonyms: [] },
  { id: "nausea", label: "Nausea", synonyms: [] },
];

const basePayload = (over: Partial<PhrasePayload["remedy"]> = {}): PhrasePayload => ({
  conditionName: "Gastritis",
  userDescription: "burning after meals",
  matchedSymptoms: ["Burning stomach"],
  rationale: ["Prominent option in the source data."],
  remedy: {
    name: "Hingvastaka Churna",
    type: "classical-formulation",
    verification: "unverified",
    summary: null,
    traditionalUse: null,
    preparation: null,
    usage: null,
    precautions: [],
    avoidIf: [],
    ...over,
  },
});

describe("validateIntent", () => {
  it("keeps only symptom ids from the allowed list", () => {
    const r = validateIntent({ symptomIds: ["burning-stomach", "made-up-id", "nausea"], severity: null, durationDays: null }, ALLOWED);
    expect(r.symptomIds).toEqual(["burning-stomach", "nausea"]);
  });

  it("accepts an explicit severity, rejects anything else", () => {
    expect(validateIntent({ symptomIds: [], severity: "moderate" }, ALLOWED).severity).toBe("moderate");
    expect(validateIntent({ symptomIds: [], severity: "very bad" }, ALLOWED).severity).toBeNull();
    expect(validateIntent({ symptomIds: [] }, ALLOWED).severity).toBeNull();
  });

  it("clamps duration and ignores non-numbers", () => {
    expect(validateIntent({ symptomIds: [], durationDays: 3.7 }, ALLOWED).durationDays).toBe(4);
    expect(validateIntent({ symptomIds: [], durationDays: "ages" }, ALLOWED).durationDays).toBeNull();
    expect(validateIntent({ symptomIds: [], durationDays: 999999 }, ALLOWED).durationDays).toBe(3650);
  });

  it("ignores unexpected fields and tolerates missing ones", () => {
    const r = validateIntent({ symptomIds: ["nausea"], remedy: "turmeric", condition: "gastritis", note: "x" }, ALLOWED);
    expect(r).toEqual({ symptomIds: ["nausea"], severity: null, durationDays: null });
  });

  it("throws on a non-object", () => {
    expect(() => validateIntent("nope", ALLOWED)).toThrow(ProviderError);
    expect(() => validateIntent(null, ALLOWED)).toThrow(ProviderError);
  });
});

describe("validatePhrasing", () => {
  it("returns clean strings for a well-formed grounded response", () => {
    const r = validatePhrasing(
      {
        summary: "Based on the burning after meals, this looks like gastritis.",
        whyThisMatches: "You mentioned a burning stomach, a hallmark of the condition.",
        traditionalContext: null,
      },
      basePayload(),
    );
    expect(r.summary).toMatch(/gastritis/i);
    expect(r.traditionalContext).toBeNull();
  });

  it("strips HTML and markdown from the prose", () => {
    const r = validatePhrasing(
      { summary: "This is <script>alert(1)</script> **bold** guidance", whyThisMatches: "why `code`", traditionalContext: null },
      basePayload(),
    );
    expect(r.summary).not.toMatch(/[<>*`]/);
    expect(r.whyThisMatches).not.toMatch(/[<>*`]/);
  });

  it("rejects traditionalContext when the KB has no such fact (grounding)", () => {
    expect(() =>
      validatePhrasing(
        { summary: "s", whyThisMatches: "w", traditionalContext: "Traditionally taken with warm water after meals." },
        basePayload(), // all traditional fields null
      ),
    ).toThrow(/traditionalContext for absent facts/);
  });

  it("allows traditionalContext when the KB does have the fact", () => {
    const r = validatePhrasing(
      { summary: "s here", whyThisMatches: "w here", traditionalContext: "Rephrased from the record." },
      basePayload({ traditionalUse: "Traditionally used for indigestion.", verification: "sourced" }),
    );
    expect(r.traditionalContext).toBe("Rephrased from the record.");
  });

  it("rejects efficacy claims on unverified knowledge", () => {
    expect(() =>
      validatePhrasing(
        { summary: "This remedy is clinically proven to cure gastritis.", whyThisMatches: "w", traditionalContext: null },
        basePayload({ verification: "unverified" }),
      ),
    ).toThrow(/overclaim/);
  });

  it("permits the same phrasing when the remedy IS verified", () => {
    const r = validatePhrasing(
      { summary: "Ginger is often used for nausea.", whyThisMatches: "It matched your nausea.", traditionalContext: null },
      basePayload({ verification: "sourced" }),
    );
    expect(r.summary).toMatch(/ginger/i);
  });

  it("rejects a response missing a required field", () => {
    expect(() => validatePhrasing({ summary: "only this" }, basePayload())).toThrow(ProviderError);
    expect(() => validatePhrasing({ whyThisMatches: "only this" }, basePayload())).toThrow(ProviderError);
  });

  it("rejects a non-object", () => {
    expect(() => validatePhrasing("text", basePayload())).toThrow(ProviderError);
  });
});

describe("extractJsonObject", () => {
  it("pulls a JSON object out of surrounding prose / fences", () => {
    expect(extractJsonObject('Sure! ```json\n{"a": 1, "b": {"c": 2}}\n``` done')).toEqual({ a: 1, b: { c: 2 } });
  });

  it("handles braces inside strings", () => {
    expect(extractJsonObject('{"note": "a } brace", "ok": true}')).toEqual({ note: "a } brace", ok: true });
  });

  it("throws when there is no object", () => {
    expect(() => extractJsonObject("no json here")).toThrow(ProviderError);
  });

  it("throws on malformed JSON", () => {
    expect(() => extractJsonObject('{"a": }')).toThrow(/malformed JSON/);
  });
});
