import { useEffect, useState } from "react";
import { m, useReducedMotion } from "framer-motion";
import { processingSteps } from "@/data/site";
import { ease } from "@/utils/motion";

/**
 * The micro-transition between submitting and seeing a result. The engine is
 * synchronous — this is a brief, honest hand-off (not a fake load), roughly
 * matching `useAssessment`'s PROCESSING_MS. Under reduced motion this screen is
 * never shown (the hook goes straight to the result).
 */
export function Processing() {
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState(0);

  useEffect(() => {
    const per = 900 / processingSteps.length;
    const timers = processingSteps.map((_, i) => window.setTimeout(() => setActive(i), i * per));
    return () => timers.forEach(window.clearTimeout);
  }, []);

  return (
    <div className="container-px mx-auto flex min-h-[100svh] max-w-md flex-col items-center justify-center py-32 text-center">
      <m.div
        aria-hidden="true"
        animate={reduceMotion ? undefined : { scale: [1, 1.08, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className="h-12 w-12 rounded-full bg-accent/30 blur-md"
      />
      <p role="status" aria-live="polite" className="mt-8 text-sm font-medium text-fg">
        {processingSteps[active]}
      </p>
      <div className="mt-4 flex gap-1.5">
        {processingSteps.map((step, i) => (
          <m.span
            key={step}
            animate={{ opacity: i <= active ? 1 : 0.3, width: i === active ? 24 : 6 }}
            transition={{ duration: 0.3, ease: ease.standard }}
            className="h-1.5 rounded-full bg-accent"
          />
        ))}
      </div>
    </div>
  );
}
