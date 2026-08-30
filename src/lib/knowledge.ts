import type { KnowledgeBase } from "@/engine/types";
import { assertValidKnowledgeBase } from "@/engine/validate";
import raw from "@/generated/knowledge.json";

/**
 * The compiled knowledge base. `content/` is validated and compiled to
 * `src/generated/knowledge.json` by `scripts/build-knowledge.mjs` (which runs
 * on `predev` / `prebuild`), so by the time this imports it the cross-
 * references have already been checked at build time.
 *
 * `assertValidKnowledgeBase` re-checks the structural invariants at load time
 * as a fail-safe — a corrupt or stale generated file throws here rather than
 * surfacing as a confusing runtime error deep in the engine.
 *
 * Tests do not use this module — they pass fixtures directly to the engine.
 */
let cached: KnowledgeBase | null = null;

export function getKnowledgeBase(): KnowledgeBase {
  if (cached) return cached;
  assertValidKnowledgeBase(raw);
  cached = raw;
  return cached;
}
