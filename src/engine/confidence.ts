/**
 * Confidence in the condition match. Separate from the raw retrieval score so
 * the policy for "how sure are we, really" lives in one place.
 *
 * Inputs that raise confidence:
 *  - more distinct symptom signals
 *  - a hallmark symptom present
 *  - a clear gap between the top condition and the runner-up
 *  - the condition was named outright
 *
 * Inputs that lower it:
 *  - only one weak signal
 *  - two conditions scoring close together (ambiguous)
 */
import type { ConditionMatch } from "./result";

export interface ConfidenceOutcome {
  /** 0-1. */
  value: number;
  /** Whichever conditions are within `ambiguityBand` of the top score. */
  contenders: ConditionMatch[];
  reasons: string[];
}

const AMBIGUITY_BAND = 0.12;

export function assessConfidence(
  ranked: ConditionMatch[],
  signalCount: number,
): ConfidenceOutcome {
  if (ranked.length === 0) {
    return { value: 0, contenders: [], reasons: ["No symptoms matched a condition in scope."] };
  }

  const top = ranked[0];
  const runnerUp = ranked[1];
  const reasons: string[] = [];

  let value = top.score;

  // Signal count: 0 extra for 1, up to +0.2 by 4+.
  const signalBoost = Math.min(0.2, Math.max(0, signalCount - 1) * 0.07);
  value += signalBoost;
  if (signalCount >= 3) reasons.push(`${signalCount} of your symptoms line up with this condition.`);
  else if (signalCount === 1) reasons.push("Only one symptom matched, so this is a loose guess.");

  // Separation from the runner-up.
  const gap = runnerUp ? top.score - runnerUp.score : top.score;
  if (runnerUp && gap < AMBIGUITY_BAND) {
    value -= 0.15;
    reasons.push(`It overlaps with ${runnerUp.condition.name}, so the match is not clear-cut.`);
  } else if (gap >= 0.3) {
    value += 0.1;
    reasons.push("It stands clearly apart from the other conditions considered.");
  }

  const contenders = runnerUp && gap < AMBIGUITY_BAND ? ranked.filter((r) => top.score - r.score < AMBIGUITY_BAND) : [top];

  return { value: clamp01(value), contenders, reasons };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
