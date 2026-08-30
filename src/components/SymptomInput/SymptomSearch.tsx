import { useId, useRef, useState } from "react";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import type { KnowledgeBase, Symptom } from "@/engine/types";
import { searchSymptoms } from "@/lib/symptoms";
import { cn } from "@/lib/cn";
import { duration, ease } from "@/utils/motion";

interface SymptomSearchProps {
  kb: KnowledgeBase;
  /** Ids already chosen — excluded from results. */
  selectedIds: string[];
  /** `sourceRect` is the picked option's rect, so the parent can fly the new
   *  chip up from the dropdown. */
  onAdd: (symptom: Symptom, sourceRect?: DOMRect) => void;
}

/**
 * An accessible combobox for finding a symptom by name when it isn't in the
 * suggested set. WAI-ARIA combobox pattern: arrow keys move the active option,
 * Enter adds it, Escape closes.
 */
export function SymptomSearch({ kb, selectedIds, onAdd }: SymptomSearchProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const reduceMotion = useReducedMotion();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const results = searchSymptoms(kb, query).filter((s) => !selectedIds.includes(s.id));
  const showList = open && query.trim().length > 0;

  function choose(symptom: Symptom | undefined, sourceRect?: DOMRect) {
    if (!symptom) return;
    onAdd(symptom, sourceRect);
    setQuery("");
    setActiveIndex(0);
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!showList || results.length === 0) {
      if (e.key === "Escape") setQuery("");
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(results[activeIndex]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setQuery("");
    }
  }

  const activeId = showList && results[activeIndex] ? `${listId}-opt-${results[activeIndex].id}` : undefined;

  return (
    <div className="relative">
      <label htmlFor={`${listId}-input`} className="sr-only">
        Search for a symptom to add
      </label>
      <div className="flex items-center gap-2 rounded-xl border border-border bg-bg px-3 py-2 focus-within:border-accent focus-within:bg-accent-soft/40">
        <SearchIcon />
        <input
          ref={inputRef}
          id={`${listId}-input`}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={`${listId}-list`}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          autoComplete="off"
          value={query}
          placeholder="Search for another symptom…"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          className="w-full bg-transparent text-sm text-fg outline-none placeholder:text-fg-faint"
        />
      </div>

      <AnimatePresence>
        {showList && (
          <m.ul
            id={`${listId}-list`}
            role="listbox"
            aria-label="Matching symptoms"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={{ duration: duration.fast, ease: ease.standard }}
            className="absolute z-20 mt-1.5 max-h-64 w-full overflow-auto rounded-xl border border-border bg-bg-elevated p-1 shadow-lg"
          >
            {results.length === 0 ? (
              <li className="px-3 py-2 text-sm text-fg-faint">No matching symptom in scope.</li>
            ) : (
              results.map((s, i) => (
                <li
                  key={s.id}
                  id={`${listId}-opt-${s.id}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  onMouseEnter={() => setActiveIndex(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(s, e.currentTarget.getBoundingClientRect());
                  }}
                  className={cn(
                    "cursor-pointer rounded-lg px-3 py-2 text-sm",
                    i === activeIndex ? "bg-accent-soft text-fg" : "text-fg-muted",
                  )}
                >
                  {s.label}
                </li>
              ))
            )}
          </m.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-fg-faint" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
