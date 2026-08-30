import type { Attributed, Condition, KnowledgeBase, Remedy, Source } from "@/engine/types";

export function resolveSources(kb: KnowledgeBase, ids: Iterable<string>): Source[] {
  const byId = new Map(kb.sources.map((s) => [s.id, s]));
  const seen = new Set<string>();
  const out: Source[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const s = byId.get(id);
    if (s) out.push(s);
  }
  return out;
}

function attributedIds(...values: (Attributed<unknown> | null | undefined)[]): string[] {
  return values.flatMap((v) => v?.sources ?? []);
}

/** Every source id referenced anywhere in a remedy record. */
export function collectRemedySources(kb: KnowledgeBase, remedy: Remedy): Source[] {
  const ids = [
    ...remedy.sources,
    ...attributedIds(remedy.summary, remedy.traditionalUse, remedy.preparation, remedy.usage),
    ...remedy.precautions.flatMap((p) => p.sources ?? []),
    ...remedy.interactions.flatMap((p) => p.sources ?? []),
    ...remedy.contraindications.flatMap((c) => c.sources ?? []),
    ...remedy.ingredients.flatMap((i) => i.sources ?? []),
  ];
  return resolveSources(kb, ids);
}

/** Every source id referenced anywhere in a condition record. */
export function collectConditionSources(kb: KnowledgeBase, condition: Condition): Source[] {
  const ids = [
    ...condition.sources,
    ...attributedIds(condition.ayurvedicView),
    ...condition.generalPrecautions.flatMap((p) => p.sources ?? []),
    ...condition.whenToSeeProfessional.flatMap((p) => p.sources ?? []),
  ];
  return resolveSources(kb, ids);
}
