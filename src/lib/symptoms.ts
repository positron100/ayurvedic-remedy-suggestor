import type { KnowledgeBase, Symptom } from "@/engine/types";
import { normalizeText } from "@/engine";

/**
 * UI-side helpers over the symptom vocabulary. No recommendation logic here —
 * this is presentation support for the composer (a starter set, search, label
 * lookup). The engine still owns all matching that feeds a recommendation.
 */

/**
 * A small starter set for the composer, before the user opens the full list:
 * the hallmark / high-weight symptoms across the in-scope conditions, capped.
 */
export function starterSymptoms(kb: KnowledgeBase, limit = 8): Symptom[] {
  const score = new Map<string, number>();
  for (const c of kb.conditions) {
    for (const link of c.symptoms) {
      score.set(link.symptomId, Math.max(score.get(link.symptomId) ?? 0, link.weight + (link.hallmark ? 1 : 0)));
    }
  }
  return [...kb.symptoms]
    .sort((a, b) => (score.get(b.id) ?? 0) - (score.get(a.id) ?? 0))
    .slice(0, limit);
}

/** Substring search over label + synonyms, for the "add a symptom" field. */
export function searchSymptoms(kb: KnowledgeBase, query: string, limit = 8): Symptom[] {
  const q = normalizeText(query);
  if (!q) return [];
  const scored = kb.symptoms.flatMap((s) => {
    const haystacks = [s.label, ...s.synonyms].map(normalizeText);
    const best = haystacks.reduce((acc, h) => {
      if (h === q) return Math.max(acc, 3);
      if (h.startsWith(q)) return Math.max(acc, 2);
      if (h.includes(q)) return Math.max(acc, 1);
      return acc;
    }, 0);
    return best > 0 ? [{ symptom: s, rank: best }] : [];
  });
  return scored.sort((a, b) => b.rank - a.rank).slice(0, limit).map((x) => x.symptom);
}

export function symptomLabels(kb: KnowledgeBase, ids: string[]): { id: string; label: string }[] {
  const byId = new Map(kb.symptoms.map((s) => [s.id, s]));
  return ids.flatMap((id) => {
    const s = byId.get(id);
    return s ? [{ id, label: s.label }] : [];
  });
}
