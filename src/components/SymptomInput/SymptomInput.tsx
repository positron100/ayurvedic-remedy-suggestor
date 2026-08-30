import { useId, useMemo, useState } from "react";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import type { KnowledgeBase, Severity } from "@/engine/types";
import type { EngineInput } from "@/engine/result";
import { matchText } from "@/engine";
import { starterSymptoms } from "@/lib/symptoms";
import { examplePrompts, severityOptions } from "@/data/site";
import { cn } from "@/lib/cn";
import { duration, ease, press } from "@/utils/motion";
import { Magnetic } from "@/components/Magnetic";
import { SymptomChip } from "./SymptomChip";
import { SymptomSearch } from "./SymptomSearch";

interface SymptomInputProps {
  kb: KnowledgeBase;
  initial?: EngineInput;
  onSubmit: (input: EngineInput) => void;
  submitLabel?: string;
  variant?: "hero" | "inline";
  autoFocus?: boolean;
}

export function SymptomInput({
  kb,
  initial,
  onSubmit,
  submitLabel = "Get guidance",
  variant = "hero",
  autoFocus = false,
}: SymptomInputProps) {
  const reduceMotion = useReducedMotion();
  const fieldId = useId();
  const [text, setText] = useState(initial?.text ?? "");
  const [selectedIds, setSelectedIds] = useState<string[]>(initial?.symptomIds ?? []);
  const [severity, setSeverity] = useState<Severity | undefined>(initial?.severity);
  const [severityChosen, setSeverityChosen] = useState(initial?.severity !== undefined);
  const [showMore, setShowMore] = useState(false);
  const [attempted, setAttempted] = useState(false);

  const starters = useMemo(() => starterSymptoms(kb, 8), [kb]);
  const byId = useMemo(() => new Map(kb.symptoms.map((s) => [s.id, s])), [kb]);

  // Where a just-selected chip should fly *from*, keyed by symptom id: the pick
  // chip's rect at click time. Set in the same batch as the selection, so the
  // render that first mounts the chip in "Your symptoms" already has it; the
  // chip reads it once on mount and clears it via `onFlyEnd`. One extra render
  // per selection, none per frame.
  const [flyFrom, setFlyFrom] = useState<Record<string, DOMRect>>({});
  const clearFlyFrom = (id: string) =>
    setFlyFrom((cur) => {
      if (!(id in cur)) return cur;
      const next = { ...cur };
      delete next[id];
      return next;
    });

  // Ids whose "Your symptoms" chip is still playing its roll-back exit. Kept out
  // of the "Add more" lists until the exit finishes, so the pill doesn't appear
  // in two places at once.
  const [exitingIds, setExitingIds] = useState<Set<string>>(() => new Set());
  const endExit = (id: string) =>
    setExitingIds((cur) => {
      if (!cur.has(id)) return cur;
      const next = new Set(cur);
      next.delete(id);
      return next;
    });
  const hidden = (id: string) => selectedIds.includes(id) || exitingIds.has(id);

  // Informational only — the engine re-derives this itself from `text`.
  const recognised = useMemo(() => {
    if (text.trim().length < 3) return [];
    return matchText(kb, text).symptoms.filter((s) => !selectedIds.includes(s.symptomId) && !exitingIds.has(s.symptomId));
  }, [kb, text, selectedIds, exitingIds]);

  const hasInput = text.trim().length > 0 || selectedIds.length > 0;

  function toggle(id: string, sourceRect?: DOMRect) {
    const adding = !selectedIds.includes(id);
    if (adding) {
      setSelectedIds((cur) => (cur.includes(id) ? cur : [...cur, id]));
      if (sourceRect) setFlyFrom((cur) => ({ ...cur, [id]: sourceRect }));
    } else {
      // Mark it exiting *and* drop it from the selection in one batch, so the
      // engine sees it gone immediately while the chip rolls back out.
      setExitingIds((cur) => new Set(cur).add(id));
      setSelectedIds((cur) => cur.filter((x) => x !== id));
      clearFlyFrom(id);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAttempted(true);
    if (!hasInput) return;
    onSubmit({
      text: text.trim() || undefined,
      symptomIds: selectedIds.length ? selectedIds : undefined,
      severity: severityChosen ? severity : undefined,
      demographics: initial?.demographics,
    });
  }

  const selectedSymptoms = selectedIds.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "rounded-3xl border border-border bg-bg-elevated/90 backdrop-blur-sm",
        variant === "hero"
          ? "shadow-[0_20px_60px_-30px_hsl(var(--shadow-color)/0.5)]"
          : "shadow-sm",
      )}
    >
      {/* The field itself — the focus of the whole page. */}
      <div className="p-3 sm:p-4">
        <div className="rounded-2xl bg-bg p-4 text-left sm:p-5">
          <label htmlFor={fieldId} className="text-sm font-medium text-fg-muted">
            Describe how you&apos;re feeling
          </label>
          <textarea
            id={fieldId}
            value={text}
            rows={2}
            autoFocus={autoFocus}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. my stomach burns after eating and I feel a bit sick"
            className="mt-1.5 w-full resize-none bg-transparent text-base leading-relaxed text-fg outline-none placeholder:text-fg-faint"
          />

          <AnimatePresence initial={false}>
            {recognised.length > 0 && (
              <m.div
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                transition={{ duration: duration.fast, ease: ease.standard }}
                className="overflow-hidden"
              >
                <p className="mt-3 text-xs text-fg-faint">Recognised — tap to pin one to your symptoms</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {recognised.map((s) => (
                    <SymptomChip
                      key={s.symptomId}
                      label={s.label}
                      tone="ghost"
                      magnetic
                      onToggle={(rect) => toggle(s.symptomId, rect)}
                    />
                  ))}
                </div>
              </m.div>
            )}
          </AnimatePresence>

          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-fg-faint">
            <span>Try:</span>
            {examplePrompts.slice(0, 2).map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => setText(prompt)}
                className="text-left text-accent hover:text-accent-strong"
              >
                “{prompt}”
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4 px-4 pb-1 sm:px-5">
        {selectedSymptoms.length > 0 && (
          <div>
            <p className="text-xs font-medium tracking-wide text-fg-faint uppercase">Your symptoms</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <AnimatePresence initial={false}>
                {selectedSymptoms.map((s) => (
                  <SymptomChip
                    key={s.id}
                    label={s.label}
                    selected
                    onRemove={() => toggle(s.id)}
                    flyFrom={flyFrom[s.id] ?? null}
                    onFlyEnd={() => clearFlyFrom(s.id)}
                    onExitEnd={() => endExit(s.id)}
                  />
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        <div>
          <p className="text-xs font-medium tracking-wide text-fg-faint uppercase">
            {selectedSymptoms.length > 0 ? "Add more" : "Or pick from common symptoms"}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {starters
              .filter((s) => !hidden(s.id))
              .map((s) => (
                <SymptomChip key={s.id} label={s.label} magnetic onToggle={(rect) => toggle(s.id, rect)} />
              ))}
          </div>
        </div>

        {/* How severe — a small, always-visible signal. */}
        <fieldset>
          <legend className="text-xs font-medium tracking-wide text-fg-faint uppercase">How severe does it feel?</legend>
          <div className="mt-2 inline-flex flex-wrap gap-1.5">
            {severityOptions.map((opt) => (
              <Magnetic key={opt.label} strength={5}>
                <button
                  type="button"
                  aria-pressed={severityChosen && severity === opt.value}
                  onClick={() => {
                    setSeverity(opt.value);
                    setSeverityChosen(true);
                  }}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-sm transition-colors",
                    severityChosen && severity === opt.value
                      ? "bg-fg text-bg"
                      : "border border-border-strong text-fg-muted hover:border-fg-faint hover:text-fg",
                  )}
                >
                  {opt.label}
                </button>
              </Magnetic>
            ))}
          </div>
        </fieldset>

        {/* Everything else is progressive — hidden until asked for. */}
        <div>
          <button
            type="button"
            aria-expanded={showMore}
            onClick={() => setShowMore((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent-strong"
          >
            <m.span animate={{ rotate: showMore ? 90 : 0 }} transition={{ duration: duration.micro }}>
              ▸
            </m.span>
            Add a specific symptom
          </button>
          <AnimatePresence initial={false}>
            {showMore && (
              <m.div
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                transition={{ duration: duration.fast, ease: ease.standard }}
                className="overflow-visible"
              >
                <div className="pt-3">
                  <SymptomSearch
                    kb={kb}
                    selectedIds={selectedIds}
                    onAdd={(s, rect) => toggle(s.id, rect)}
                  />
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {kb.symptoms
                      .filter((s) => !hidden(s.id) && !starters.some((st) => st.id === s.id))
                      .map((s) => (
                        <SymptomChip key={s.id} label={s.label} magnetic onToggle={(rect) => toggle(s.id, rect)} />
                      ))}
                  </div>
                </div>
              </m.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 pb-4 sm:px-5">
        <p aria-live="polite" className="max-w-[16rem] text-xs text-fg-faint">
          {attempted && !hasInput
            ? "Add a description or pick at least one symptom."
            : "Informational guidance, not medical advice."}
        </p>
        <Magnetic>
          <m.button
            type="submit"
            disabled={!hasInput}
            whileTap={reduceMotion || !hasInput ? undefined : press.whileTap}
            transition={press.transition}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-colors",
              hasInput ? "bg-accent text-accent-fg hover:bg-accent-strong" : "cursor-not-allowed bg-bg-subtle text-fg-faint",
            )}
          >
            {submitLabel}
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </m.button>
        </Magnetic>
      </div>
    </form>
  );
}
