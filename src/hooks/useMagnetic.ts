import { useEffect, useRef, useSyncExternalStore, type MouseEvent } from "react";
import { useReducedMotion, useSpring } from "framer-motion";

/**
 * `(pointer: fine)` as a subscribed external store. Using
 * `useSyncExternalStore` rather than `useState` + effect keeps this a genuine
 * read of an external system (the media query) with no synchronous
 * set-state-in-effect, and it stays correct if the pointer type changes
 * (e.g. a tablet docked to a mouse).
 */
function usePointerFine(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};
      const mq = window.matchMedia("(pointer: fine)");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(pointer: fine)").matches : false),
    () => false,
  );
}

interface UseMagneticOptions {
  /** Peak offset in px at the element's edge. */
  strength?: number;
  /** Neutralizes the pull and springs back to rest while true. */
  disabled?: boolean;
}

const PULL_SPRING = { stiffness: 220, damping: 20, mass: 0.4 } as const;

/**
 * A control drifts subtly toward the cursor while hovered, springing back when
 * it leaves. Desktop / fine-pointer only, inert under reduced motion.
 *
 * Ported from the portfolio, minus the squash-and-stretch variant — this site
 * uses the plain pull only, sparingly, on primary actions.
 */
export function useMagnetic({ strength = 12, disabled = false }: UseMagneticOptions = {}) {
  const ref = useRef<HTMLElement | null>(null);
  const reduceMotion = useReducedMotion();
  const pointerFine = usePointerFine();
  const enabled = pointerFine && !reduceMotion;
  const rectRef = useRef<DOMRect | null>(null);

  const x = useSpring(0, PULL_SPRING);
  const y = useSpring(0, PULL_SPRING);

  useEffect(() => {
    if (!disabled) return;
    x.set(0);
    y.set(0);
  }, [disabled, x, y]);

  useEffect(() => {
    function invalidate() {
      rectRef.current = null;
    }
    window.addEventListener("scroll", invalidate, { passive: true });
    window.addEventListener("resize", invalidate);
    return () => {
      window.removeEventListener("scroll", invalidate);
      window.removeEventListener("resize", invalidate);
    };
  }, []);

  function onMouseMove(event: MouseEvent<Element>) {
    if (!enabled || disabled || !ref.current) return;
    const rect = (rectRef.current ??= ref.current.getBoundingClientRect());
    if (!rect.width || !rect.height) return;
    const relX = event.clientX - (rect.left + rect.width / 2);
    const relY = event.clientY - (rect.top + rect.height / 2);
    x.set((relX / (rect.width / 2)) * strength);
    y.set((relY / (rect.height / 2)) * strength);
  }

  function onMouseLeave() {
    rectRef.current = null;
    x.set(0);
    y.set(0);
  }

  const style = enabled ? { x, y } : undefined;

  /** Attach the element from a component that also keeps its own ref (a merged
   *  callback ref), rather than writing into `ref.current` from outside. */
  function attach(el: HTMLElement | null) {
    ref.current = el;
  }

  // `x`/`y` are exposed so a caller can subtract the live pull from a
  // `getBoundingClientRect` and recover the element's resting box.
  return { ref, attach, onMouseMove, onMouseLeave, style, x, y };
}
