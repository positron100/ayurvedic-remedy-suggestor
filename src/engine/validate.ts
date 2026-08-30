/**
 * A runtime guard for the knowledge base.
 *
 * `scripts/build-knowledge.mjs` is the exhaustive, build-time validator with
 * friendly messages. This is the lighter fail-safe that runs when the compiled
 * JSON is loaded (or when a test/LLM layer hands the engine a KB): it proves
 * the structural invariants the engine relies on — required collections
 * present, no duplicate ids, no dangling cross-references — and throws a single
 * aggregated error otherwise.
 *
 * Pure. No React, no environment.
 */
import type { KnowledgeBase } from "./types";

export class KnowledgeBaseError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(`Invalid knowledge base:\n  - ${problems.join("\n  - ")}`);
    this.name = "KnowledgeBaseError";
    this.problems = problems;
  }
}

/** Throws `KnowledgeBaseError` if `input` is not a usable `KnowledgeBase`. */
export function assertValidKnowledgeBase(input: unknown): asserts input is KnowledgeBase {
  const problems = collectProblems(input);
  if (problems.length) throw new KnowledgeBaseError(problems);
}

/** Non-throwing form — returns the problem list (empty means valid). */
export function findKnowledgeBaseProblems(input: unknown): string[] {
  return collectProblems(input);
}

function collectProblems(input: unknown): string[] {
  const problems: string[] = [];

  if (typeof input !== "object" || input === null) {
    return ["knowledge base is not an object"];
  }
  const kb = input as Record<string, unknown>;

  for (const key of ["conditions", "remedies", "symptoms", "redFlags", "sources"] as const) {
    if (!Array.isArray(kb[key])) problems.push(`"${key}" must be an array`);
  }
  if (typeof kb.safety !== "object" || kb.safety === null) {
    problems.push(`"safety" must be an object`);
  }
  // If the shape is already broken, deeper checks would just produce noise.
  if (problems.length) return problems;

  const conditions = kb.conditions as Array<Record<string, unknown>>;
  const remedies = kb.remedies as Array<Record<string, unknown>>;
  const symptoms = kb.symptoms as Array<Record<string, unknown>>;
  const redFlags = kb.redFlags as Array<Record<string, unknown>>;
  const sources = kb.sources as Array<Record<string, unknown>>;
  const safety = kb.safety as Record<string, unknown>;

  const remedyIds = idSet(remedies, "remedy", problems);
  const symptomIds = idSet(symptoms, "symptom", problems);
  const redFlagIds = idSet(redFlags, "red flag", problems);
  const sourceIds = idSet(sources, "source", problems);
  idSet(conditions, "condition", problems);

  for (const key of ["lowConfidenceThreshold", "insufficientInfoThreshold", "minSymptomSignals"] as const) {
    if (typeof safety[key] !== "number") problems.push(`safety.${key} must be a number`);
  }
  const disclaimer = safety.disclaimer as Record<string, unknown> | undefined;
  if (!disclaimer || typeof disclaimer.short !== "string" || typeof disclaimer.full !== "string") {
    problems.push("safety.disclaimer must have string `short` and `full`");
  }
  for (const id of asStringArray(safety.globalRedFlags)) {
    if (!redFlagIds.has(id)) problems.push(`safety.globalRedFlags references unknown red flag "${id}"`);
  }

  for (const flag of redFlags) {
    for (const id of asStringArray(flag.sources)) {
      if (!sourceIds.has(id)) problems.push(`red flag "${strId(flag)}" references unknown source "${id}"`);
    }
  }

  for (const r of remedies) {
    const where = `remedy "${strId(r)}"`;
    for (const id of asStringArray(r.sources)) {
      if (!sourceIds.has(id)) problems.push(`${where} references unknown source "${id}"`);
    }
    for (const cid of asStringArray(r.components)) {
      if (!remedyIds.has(cid)) problems.push(`${where} references unknown component remedy "${cid}"`);
    }
  }

  for (const c of conditions) {
    const where = `condition "${strId(c)}"`;
    for (const link of asArray(c.symptoms)) {
      const sid = (link as Record<string, unknown>).symptomId;
      if (typeof sid !== "string" || !symptomIds.has(sid)) {
        problems.push(`${where} references unknown symptom "${String(sid)}"`);
      }
    }
    for (const link of asArray(c.remedies)) {
      const rid = (link as Record<string, unknown>).remedyId;
      if (typeof rid !== "string" || !remedyIds.has(rid)) {
        problems.push(`${where} references unknown remedy "${String(rid)}"`);
      }
    }
    for (const id of asStringArray(c.redFlags)) {
      if (!redFlagIds.has(id)) problems.push(`${where} references unknown red flag "${id}"`);
    }
    for (const id of asStringArray(c.sources)) {
      if (!sourceIds.has(id)) problems.push(`${where} references unknown source "${id}"`);
    }
  }

  return problems;
}

function idSet(arr: Array<Record<string, unknown>>, kind: string, problems: string[]): Set<string> {
  const set = new Set<string>();
  for (const item of arr) {
    const id = item.id;
    if (typeof id !== "string" || id.length === 0) {
      problems.push(`${kind} record is missing a string id`);
      continue;
    }
    if (set.has(id)) problems.push(`duplicate ${kind} id "${id}"`);
    set.add(id);
  }
  return set;
}

function strId(item: Record<string, unknown>): string {
  return typeof item.id === "string" ? item.id : "<no id>";
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}
