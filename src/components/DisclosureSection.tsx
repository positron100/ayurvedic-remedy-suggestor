import { useId, useState, type ReactNode } from "react";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import { duration, ease } from "@/utils/motion";

interface DisclosureSectionProps {
  title: string;
  /** Small count / status shown beside the title (e.g. "3", "not verified"). */
  hint?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * One expand/collapse block. Animates height/opacity only. Accessible: the
 * trigger is a real `<button>` with `aria-expanded` / `aria-controls`, the
 * panel is a region labelled by the trigger.
 */
export function DisclosureSection({ title, hint, defaultOpen = false, children }: DisclosureSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const reduceMotion = useReducedMotion();
  const id = useId();

  return (
    <div className="border-t border-border first:border-t-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        id={`${id}-trigger`}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 py-4 text-left"
      >
        <span className="flex items-baseline gap-2">
          <span className="font-medium text-fg">{title}</span>
          {hint && <span className="text-xs text-fg-faint">{hint}</span>}
        </span>
        <m.span
          aria-hidden="true"
          animate={{ rotate: open ? 180 : 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: duration.fast, ease: ease.standard }}
          className="shrink-0 text-fg-faint"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </m.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <m.div
            id={`${id}-panel`}
            role="region"
            aria-labelledby={`${id}-trigger`}
            initial={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduceMotion ? { opacity: 1 } : { height: "auto", opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: duration.fast, ease: ease.standard }}
            className={cn("overflow-hidden")}
          >
            <div className="pb-5 text-sm leading-relaxed text-fg-muted">{children}</div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
