import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

const TYPE_SPEED_MS = 46;
/** Added at random per character so the rhythm isn't metronomic, small enough
 *  that it never reads as hesitation. */
const TYPE_JITTER_MS = 34;
/** A short beat before the first character, so the caret is visibly waiting. */
const LEAD_IN_MS = 180;

/**
 * Types a single string out once, character by character, starting only when
 * `start` turns true. Collapses to the finished text under reduced motion.
 *
 * Ported from the portfolio (`src/hooks/useTypeOnce.ts`) — used by the contact
 * letter's delivery confirmation.
 */
export function useTypeOnce(text: string, start: boolean): { display: string; done: boolean } {
  const reduceMotion = useReducedMotion();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!start) return;
    if (reduceMotion) {
      // Synchronous jump to the finished text — the animation is the point of
      // this hook, and there is nothing to animate under reduced motion.
      // oxlint-disable-next-line react/set-state-in-effect
      setCount(text.length);
      return;
    }

    let cancelled = false;
    let timeoutId: number;

    function step(index: number) {
      if (cancelled) return;
      setCount(index);
      if (index >= text.length) return;
      timeoutId = window.setTimeout(() => step(index + 1), TYPE_SPEED_MS + Math.random() * TYPE_JITTER_MS);
    }

    timeoutId = window.setTimeout(() => step(1), LEAD_IN_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [text, start, reduceMotion]);

  return { display: text.slice(0, count), done: count >= text.length };
}
