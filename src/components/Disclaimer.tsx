import { useState } from "react";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { disclaimer } from "@/data/site";
import { duration, ease } from "@/utils/motion";

/**
 * The standing medical notice. Concise by default with the full text one tap
 * away — never a wall of legal text in the layout. Wording comes from
 * `data/site.ts` so it reads identically everywhere.
 */
export function Disclaimer() {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  return (
    <div className="rounded-2xl border border-border bg-bg-subtle/50 p-4 text-sm">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="mt-0.5 shrink-0 text-fg-faint">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
        </span>
        <div className="min-w-0">
          <p className="text-fg-muted">{disclaimer.short}</p>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="mt-1 text-xs font-medium text-accent hover:text-accent-strong"
          >
            {open ? "Show less" : "Why this matters"}
          </button>
          <AnimatePresence initial={false}>
            {open && (
              <m.p
                initial={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                animate={reduceMotion ? { opacity: 1 } : { height: "auto", opacity: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                transition={{ duration: duration.fast, ease: ease.standard }}
                className="overflow-hidden text-xs leading-relaxed text-fg-muted"
              >
                <span className="mt-2 block">{disclaimer.full}</span>
              </m.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
