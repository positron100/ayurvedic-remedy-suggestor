import { useId, useState } from "react";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import type { KnowledgeBase } from "@/engine/types";
import type { RemedySuggestion } from "@/engine/result";
import { cn } from "@/lib/cn";
import { duration, ease } from "@/utils/motion";
import { VerificationBadge } from "./Provenance";
import { RemedyCard } from "./RemedyCard";

interface SecondaryRemedyListProps {
  kb: KnowledgeBase;
  suggestions: RemedySuggestion[];
  conditionName: string;
  matchedSymptomLabels: string[];
}

/**
 * The non-primary remedies, as a compact expandable list rather than a stack
 * of full cards — one line each until opened. Keeps the page calm when the
 * knowledge base associates many (mostly unverified) remedies with a condition.
 */
export function SecondaryRemedyList({
  kb,
  suggestions,
  conditionName,
  matchedSymptomLabels,
}: SecondaryRemedyListProps) {
  if (suggestions.length === 0) return null;

  return (
    <div>
      <p className="mb-3 text-xs font-medium tracking-wide text-fg-faint uppercase">
        Other remedies associated with {conditionName.toLowerCase()}
      </p>
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-bg-elevated">
        {suggestions.map((s) => (
          <SecondaryRow
            key={s.remedy.id}
            kb={kb}
            suggestion={s}
            conditionName={conditionName}
            matchedSymptomLabels={matchedSymptomLabels}
          />
        ))}
      </ul>
    </div>
  );
}

function SecondaryRow({
  kb,
  suggestion,
  conditionName,
  matchedSymptomLabels,
}: {
  kb: KnowledgeBase;
  suggestion: RemedySuggestion;
  conditionName: string;
  matchedSymptomLabels: string[];
}) {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const id = useId();
  const { remedy } = suggestion;

  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span className="min-w-0">
          <span className="font-medium text-fg">{remedy.canonicalName}</span>
          <span className="ml-2 text-xs text-fg-faint">
            {remedy.type.replace(/-/g, " ")}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <VerificationBadge level={remedy.verification.level} />
          <m.span
            aria-hidden="true"
            animate={{ rotate: open ? 180 : 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: duration.fast, ease: ease.standard }}
            className="text-fg-faint"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </m.span>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <m.div
            id={`${id}-panel`}
            initial={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduceMotion ? { opacity: 1 } : { height: "auto", opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: duration.fast, ease: ease.standard }}
            className={cn("overflow-hidden")}
          >
            <div className="px-5 pb-4">
              <RemedyCard
                kb={kb}
                suggestion={suggestion}
                conditionName={conditionName}
                matchedSymptomLabels={matchedSymptomLabels}
                embedded
              />
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </li>
  );
}
