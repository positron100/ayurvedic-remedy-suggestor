import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * A calm backdrop for the closing section — a single soft accent glow that
 * follows the pointer, written straight to a CSS custom property (no React
 * state, no rAF loop). Adapted from the portfolio's `ContactBackground`; the
 * portfolio's abstract network SVG is dropped — off-metaphor here, and the
 * letter card already carries the section's visual weight.
 */
export function ContactBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;
    const el = containerRef.current;
    if (!el) return;

    function handlePointerMove(event: PointerEvent) {
      const rect = el!.getBoundingClientRect();
      el!.style.setProperty("--px", `${event.clientX - rect.left}px`);
      el!.style.setProperty("--py", `${event.clientY - rect.top}px`);
    }

    el.addEventListener("pointermove", handlePointerMove);
    return () => el.removeEventListener("pointermove", handlePointerMove);
  }, [reduceMotion]);

  return (
    <div ref={containerRef} aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0 opacity-80"
        style={{
          background:
            "radial-gradient(460px circle at var(--px, 50%) var(--py, 12%), color-mix(in srgb, var(--accent) 9%, transparent), transparent 70%)",
        }}
      />
    </div>
  );
}
