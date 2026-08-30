/**
 * The recommendation engine's public surface.
 *
 * Pure TypeScript, no React, no network, no environment access. Give it a
 * `KnowledgeBase` and an `EngineInput`, get a structured `Recommendation`.
 *
 *   import { recommend } from "@/engine";
 *   import { getKnowledgeBase } from "@/lib/knowledge";
 *   const result = recommend(getKnowledgeBase(), { text: "..." });
 *
 * The optional LLM layer (Phase D) sits *outside* this module: it may take a
 * `Recommendation` and rephrase its `narrative`, but it cannot change the
 * engine's structured output or bypass it.
 */
export { recommend } from "./assemble";
export { assertValidKnowledgeBase, findKnowledgeBaseProblems, KnowledgeBaseError } from "./validate";
export * from "./types";
export * from "./result";

// Lower-level pieces, exported for targeted unit tests and reuse in the UI
// (e.g. the symptom autocomplete uses the same normalization).
export { normalizeText, tokenize, matchText, resolveChosenSymptoms } from "./normalize";
export { scoreConditions, rankRemedies } from "./retrieve";
export { detectRedFlags, applySafetyFilter, demographicFlags } from "./safety";
export { assessConfidence } from "./confidence";
export { buildNarrative } from "./templates";
