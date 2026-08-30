import { useEffect, useState } from "react";

/**
 * Types `text` out one character at a time while `active` is true — a
 * ghost/example preview inside an empty field. Resets to empty the instant
 * `active` goes false, so real typing always wins immediately.
 *
 * Ported from the portfolio (`src/hooks/useTypingPreview.ts`).
 */
export function useTypingPreview(text: string, active: boolean, speedMs = 45): string {
  const [display, setDisplay] = useState("");

  useEffect(() => {
    if (!active) {
      // Reset the moment the field is no longer previewing, so real typing
      // (which flips `active` off upstream) always wins immediately.
      // oxlint-disable-next-line react/set-state-in-effect
      setDisplay("");
      return;
    }

    let cancelled = false;
    let timeoutId: number;

    function typeNext(index: number) {
      if (cancelled) return;
      setDisplay(text.slice(0, index));
      if (index < text.length) {
        timeoutId = window.setTimeout(() => typeNext(index + 1), speedMs + Math.random() * 35);
      }
    }

    timeoutId = window.setTimeout(() => typeNext(1), 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [active, text, speedMs]);

  return display;
}
