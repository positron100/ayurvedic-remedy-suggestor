import { useCallback, useState } from "react";

/**
 * Whether the opening leaf reveal should play.
 *
 * It plays on EVERY load / reload — no sessionStorage or localStorage gating
 * (the portfolio's opening does the same). It is skipped only under reduced
 * motion. The decision is made in the state initializer — synchronously, before
 * the first paint — so there is no frame where the overlay flashes for a
 * reduced-motion user, and no frame where the site shows before the reveal for
 * everyone else.
 */
export function useIntro() {
  const [done, setDone] = useState<boolean>(() => {
    try {
      if (typeof window === "undefined") return true;
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return true;
    }
  });

  const finishIntro = useCallback(() => setDone(true), []);

  return { introDone: done, finishIntro };
}
