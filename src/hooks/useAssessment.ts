import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { recommend } from "@/engine";
import type { EngineInput, Recommendation } from "@/engine";
import { getKnowledgeBase } from "@/lib/knowledge";
import { fetchCapabilities, parseIntent, phrase } from "@/lib/recommendApi";
import { allowedSymptoms, applyPhrasing, buildPhrasePayload } from "@/lib/grounding";

/**
 * Orchestrates the assessment flow. It calls the DETERMINISTIC engine to decide
 * the recommendation, then — only if an optional LLM layer is configured —
 * uses it for two presentational things:
 *
 *   1. `parseIntent`, but ONLY when the deterministic engine could not
 *      understand the free text (insufficient / no match). The hints are
 *      merged into the input and the engine runs AGAIN — so red flags and
 *      every safety rule are re-evaluated on the original text regardless.
 *
 *   2. `phrase`, in the background AFTER the deterministic result is already on
 *      screen. It replaces templated prose in fixed slots; it never changes the
 *      structured recommendation, the safety text, the confidence, or
 *      provenance. If it fails or is slow, the user keeps the deterministic
 *      prose and sees nothing wrong.
 */
export type AssessmentStage = "compose" | "processing" | "result";

const PROCESSING_MS = 950;
const kb = getKnowledgeBase();

export function useAssessment() {
  const [stage, setStage] = useState<AssessmentStage>("compose");
  const [input, setInput] = useState<EngineInput>({});
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [llmReady, setLlmReady] = useState(false);
  const reduceMotion = useReducedMotion();

  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    fetchCapabilities().then((c) => {
      if (alive) setLlmReady(c.llm);
    });
    return () => {
      alive = false;
    };
  }, []);

  const cancelPending = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const finalize = useCallback(
    (result: Recommendation, resolvedInput: EngineInput, controller: AbortController) => {
      if (controller.signal.aborted) return;
      setRecommendation(result);
      setStage("result");

      // Background phrasing — never blocks, never changes structure.
      if (llmReady && (result.kind === "ok" || result.kind === "low_confidence")) {
        const payload = buildPhrasePayload(result, resolvedInput.text);
        if (payload) {
          const primaryId = result.suggestions[0]?.remedy.id;
          phrase(payload, controller.signal).then((p) => {
            if (!p || controller.signal.aborted) return;
            setRecommendation((cur) => {
              if (
                !cur ||
                cur.enhanced ||
                cur.kind !== result.kind ||
                cur.suggestions[0]?.remedy.id !== primaryId
              ) {
                return cur;
              }
              return applyPhrasing(cur, p);
            });
          });
        }
      }
    },
    [llmReady],
  );

  const run = useCallback(
    (next: EngineInput) => {
      cancelPending();
      const controller = new AbortController();
      abortRef.current = controller;

      setInput(next);
      let resolved = next;
      let result = recommend(kb, resolved);

      const needsParse =
        Boolean(next.text?.trim()) &&
        llmReady &&
        (result.kind === "insufficient_information" || result.kind === "no_matching_condition");

      if (!needsParse && reduceMotion) {
        finalize(result, resolved, controller);
        return;
      }

      setStage("processing");
      const minBeat = reduceMotion ? 0 : PROCESSING_MS;
      const started = Date.now();

      const proceed = () => {
        const wait = Math.max(0, minBeat - (Date.now() - started));
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null;
          finalize(result, resolved, controller);
        }, wait);
      };

      if (!needsParse) {
        proceed();
        return;
      }

      parseIntent(resolved.text!.trim(), allowedSymptoms(kb), controller.signal).then((hints) => {
        if (controller.signal.aborted) return;
        if (hints && (hints.symptomIds.length > 0 || hints.severity)) {
          resolved = {
            ...resolved,
            symptomIds: [...new Set([...(resolved.symptomIds ?? []), ...hints.symptomIds])],
            severity: resolved.severity ?? hints.severity ?? undefined,
          };
          setInput(resolved);
          result = recommend(kb, resolved); // safety + red flags re-evaluated
        }
        proceed();
      });
    },
    [cancelPending, finalize, llmReady, reduceMotion],
  );

  const submit = useCallback((value: EngineInput) => run(value), [run]);

  const refine = useCallback(
    (patch: Partial<EngineInput>) => {
      run({
        ...input,
        ...patch,
        symptomIds: [...new Set([...(input.symptomIds ?? []), ...(patch.symptomIds ?? [])])],
        demographics: { ...input.demographics, ...patch.demographics },
      });
    },
    [input, run],
  );

  const restart = useCallback(() => {
    cancelPending();
    setRecommendation(null);
    setInput({});
    setStage("compose");
  }, [cancelPending]);

  useEffect(() => cancelPending, [cancelPending]);

  return { stage, input, recommendation, submit, refine, restart, llmReady };
}
