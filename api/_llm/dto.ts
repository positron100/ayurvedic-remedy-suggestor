/**
 * Wire shapes for POST/GET `/api/recommend`, shared by the edge handler and
 * the browser client. Pure types — safe to import from either side.
 *
 * The endpoint always answers 200 for the two optional operations (parse-intent
 * / phrase): a failure comes back as `{ available: false }`, never a 5xx and
 * never a provider error string. The client treats anything other than a
 * well-formed success as "no enhancement" and uses the deterministic result.
 */
import type { IntentHints, PhrasePayload, PhrasedNarrative } from "./types";

export type { IntentHints, PhrasePayload, PhrasedNarrative };

export interface CapabilitiesResponse {
  llm: boolean;
  /** Model id when configured — not a secret. */
  model?: string;
}

export interface ParseIntentRequest {
  op: "parse-intent";
  text: string;
  /** The client's own symptom vocabulary — keeps the endpoint stateless and
   *  decoupled from the compiled knowledge base. */
  allowedSymptoms: { id: string; label: string; synonyms: string[] }[];
}

export type ParseIntentResponse = { available: true; intent: IntentHints } | { available: false };

export interface PhraseRequest {
  op: "phrase";
  payload: PhrasePayload;
}

export type PhraseResponse = { available: true; phrased: PhrasedNarrative } | { available: false };

export type RecommendRequest = ParseIntentRequest | PhraseRequest;
