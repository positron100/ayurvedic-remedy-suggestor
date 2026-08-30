/**
 * Turns raw user input into normalized tokens and matches it against the
 * knowledge base's vocabularies (symptoms, red flags, condition aliases).
 *
 * Pure string work — no knowledge of scoring or safety policy. Deterministic:
 * the same input always produces the same matches.
 */
import type { KnowledgeBase } from "./types";
import type { MatchedSymptom, RedFlagHit } from "./result";

/** Lowercase, strip punctuation, collapse whitespace, drop a few stopwords. */
export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOPWORDS = new Set([
  "a", "an", "the", "i", "im", "ive", "my", "me", "have", "having", "having",
  "feel", "feeling", "felt", "with", "and", "or", "of", "to", "in", "on", "for",
  "some", "been", "is", "it", "that", "this", "get", "getting", "got", "very",
  "really", "quite", "bit", "little", "lot", "since", "been", "am", "are",
]);

/**
 * A very light stemmer — enough to make "burns" / "burning" / "burned" and
 * "stools" / "stool" match the same vocabulary entry, without pulling in a
 * dependency. Deliberately conservative: it only strips a few common suffixes
 * and never rewrites the stem.
 */
export function stem(word: string): string {
  let w = word;
  if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2);
  else if (w.length > 4 && w.endsWith("ly")) w = w.slice(0, -2);
  else if (w.length > 4 && w.endsWith("es")) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
  // "burn" from "burnin" -> add back a dropped consonant doubling is overkill;
  // just trim a trailing repeated letter ("runnin" -> "runni" -> leave).
  return w;
}

export function tokenize(input: string): string[] {
  return normalizeText(input)
    .split(" ")
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/** Significant, stemmed tokens of a string (drops stopwords + short words). */
function contentStems(input: string): Set<string> {
  return new Set(
    normalizeText(input)
      .split(" ")
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
      .map(stem),
  );
}

/** Ordered stemmed tokens of a string. */
function contentTokenList(input: string): string[] {
  return normalizeText(input)
    .split(" ")
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .map(stem);
}

/**
 * Two matchers over one haystack:
 *
 *  - `loose`  — every significant stemmed word of the phrase is present, in any
 *    order. Good recall for symptom phrasing ("burns in my stomach" ⇒
 *    "burning stomach"). Used for the symptom vocabulary only.
 *
 *  - `ordered` — the phrase appears verbatim, OR its significant stemmed words
 *    all appear in the same relative order. Tighter, so "no blood but I was
 *    vomiting" does NOT match the red-flag trigger "vomiting blood". Used for
 *    red flags, where a false positive is worse than a miss is safe.
 */
function makePhraseMatchers(haystack: string) {
  const normalized = haystack;
  const stems = contentStems(haystack);
  const haystackTokens = contentTokenList(haystack);

  function loose(phrase: string): boolean {
    const p = normalizeText(phrase);
    if (!p) return false;
    if (normalized.includes(p)) return true;
    const words = [...contentStems(p)];
    if (words.length === 0) return false;
    if (words.length === 1) return stems.has(words[0]);
    return words.every((w) => stems.has(w));
  }

  function ordered(phrase: string): boolean {
    const p = normalizeText(phrase);
    if (!p) return false;
    if (normalized.includes(p)) return true;
    const words = contentTokenList(p);
    if (words.length === 0) return false;
    if (words.length === 1) return stems.has(words[0]);
    let cursor = -1;
    for (const w of words) {
      const at = haystackTokens.indexOf(w, cursor + 1);
      if (at === -1) return false;
      cursor = at;
    }
    return true;
  }

  return { loose, ordered };
}

export interface TextMatchResult {
  symptoms: MatchedSymptom[];
  redFlags: RedFlagHit[];
  /** Condition ids named directly (by name or alias) in the text. */
  namedConditionIds: string[];
}

/** Match free text against every vocabulary in the knowledge base. */
export function matchText(kb: KnowledgeBase, text: string): TextMatchResult {
  const haystack = normalizeText(text);
  const symptoms: MatchedSymptom[] = [];
  const redFlags: RedFlagHit[] = [];
  const namedConditionIds: string[] = [];

  if (haystack) {
    const { loose, ordered } = makePhraseMatchers(haystack);

    for (const symptom of kb.symptoms) {
      const phrases = [symptom.label, ...symptom.synonyms];
      const hit = phrases.find((phrase) => loose(phrase));
      if (hit) {
        symptoms.push({ symptomId: symptom.id, label: symptom.label, via: "text", matchedText: hit });
      }
    }

    for (const flag of kb.redFlags) {
      const hit = flag.triggers.find((trigger) => ordered(trigger));
      if (hit) redFlags.push({ redFlag: flag, matchedText: hit });
    }

    for (const condition of kb.conditions) {
      const names = [condition.name, ...condition.aliases];
      if (names.some((n) => ordered(n))) namedConditionIds.push(condition.id);
    }
  }

  return { symptoms, redFlags, namedConditionIds };
}

/** Resolve chosen symptom ids to `MatchedSymptom`, silently dropping unknowns. */
export function resolveChosenSymptoms(kb: KnowledgeBase, symptomIds: string[]): MatchedSymptom[] {
  const byId = new Map(kb.symptoms.map((s) => [s.id, s]));
  return symptomIds.flatMap((id) => {
    const s = byId.get(id);
    return s ? [{ symptomId: s.id, label: s.label, via: "chip" as const }] : [];
  });
}

/** Merge chip-selected and text-matched symptoms, de-duplicating by id
 *  (a chip selection wins over a text match for the same symptom). */
export function mergeSymptoms(chips: MatchedSymptom[], text: MatchedSymptom[]): MatchedSymptom[] {
  const seen = new Set(chips.map((s) => s.symptomId));
  return [...chips, ...text.filter((s) => !seen.has(s.symptomId))];
}
