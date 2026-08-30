import { useEffect, useRef, type ReactNode } from "react";
import { m, useReducedMotion } from "framer-motion";
import { Disclaimer } from "@/components/Disclaimer";
import { duration, ease } from "@/utils/motion";

interface ResultFrameProps {
  eyebrow: string;
  /** Announced to screen readers when the result appears. */
  announce: string;
  heading: string;
  /** Accent bar / tone for the header rule. */
  tone?: "accent" | "clay" | "danger";
  children: ReactNode;
  onRestart: () => void;
  restartLabel?: string;
}

/**
 * Shared page frame for every recommendation outcome. Owns:
 *  - focus management (moves focus to the heading when a result mounts)
 *  - the polite live-region announcement of the outcome
 *  - the persistent disclaimer and the "start again" affordance
 */
export function ResultFrame({
  eyebrow,
  announce,
  heading,
  tone = "accent",
  children,
  onRestart,
  restartLabel = "Start a new assessment",
}: ResultFrameProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    // Move focus to the outcome heading so keyboard and screen-reader users
    // land on the new content. `preventScroll` so it doesn't fight the
    // scroll-to-top below.
    window.scrollTo({ top: 0, behavior: "auto" });
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  const rule =
    tone === "danger" ? "bg-danger" : tone === "clay" ? "bg-clay" : "bg-accent";

  return (
    <m.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: duration.section, ease: ease.standard }}
      className="container-px mx-auto max-w-2xl pt-28 pb-20 sm:pt-32"
    >
      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>

      <div className="flex items-center gap-3">
        <span aria-hidden="true" className={`h-1 w-8 rounded-full ${rule}`} />
        <p className="text-xs font-medium tracking-[0.16em] text-fg-faint uppercase">{eyebrow}</p>
      </div>

      <h1
        ref={headingRef}
        tabIndex={-1}
        className="mt-4 font-display text-3xl leading-tight font-medium tracking-tight text-balance text-fg outline-none sm:text-4xl"
      >
        {heading}
      </h1>

      <div className="mt-8">{children}</div>

      <div className="mt-10 space-y-5">
        <Disclaimer />
        <button
          type="button"
          onClick={onRestart}
          className="inline-flex items-center gap-2 text-sm font-medium text-fg-muted transition-colors hover:text-fg"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 12a9 9 0 1 0 3-6.7M3 4v4h4" />
          </svg>
          {restartLabel}
        </button>
      </div>
    </m.div>
  );
}
