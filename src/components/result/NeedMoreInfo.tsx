import { useState } from "react";
import { m, useReducedMotion } from "framer-motion";
import type { KnowledgeBase } from "@/engine/types";
import type { EngineInput, Recommendation } from "@/engine/result";
import { symptomLabels } from "@/lib/symptoms";
import { resultCopy } from "@/data/site";
import { press } from "@/utils/motion";
import { ResultFrame } from "./ResultFrame";
import { SymptomChip } from "@/components/SymptomInput/SymptomChip";
import { Magnetic } from "@/components/Magnetic";

interface NeedMoreInfoProps {
  kb: KnowledgeBase;
  recommendation: Recommendation;
  onRefine: (patch: Partial<EngineInput>) => void;
  onRestart: () => void;
}

/**
 * The low-signal outcome. Never shows a remedy — instead it names the specific
 * information that would help and lets the person add it *in place* and
 * continue, without restarting the assessment.
 */
export function NeedMoreInfo({ kb, recommendation, onRefine, onRestart }: NeedMoreInfoProps) {
  const reduceMotion = useReducedMotion();
  const [picked, setPicked] = useState<string[]>([]);
  const [extra, setExtra] = useState("");

  const clarifiers = symptomLabels(kb, recommendation.clarifyingSymptomIds);
  const recognised = recommendation.recognisedSymptoms;
  const canContinue = picked.length > 0 || extra.trim().length > 0;

  function toggle(id: string) {
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  function submit() {
    if (!canContinue) return;
    onRefine({
      symptomIds: picked,
      text: extra.trim() || undefined,
    });
  }

  return (
    <ResultFrame
      eyebrow={resultCopy.insufficient_information.eyebrow}
      announce={resultCopy.insufficient_information.announce}
      heading={recommendation.narrative.headline}
      tone="clay"
      onRestart={onRestart}
      restartLabel="Start over"
    >
      <div className="space-y-6">
        <p className="text-base leading-relaxed text-pretty text-fg">{recommendation.narrative.summary}</p>

        {recognised.length > 0 && (
          <div>
            <p className="text-xs font-medium tracking-wide text-fg-faint uppercase">So far you&apos;ve told me</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {recognised.map((s) => (
                <SymptomChip key={s.symptomId} label={s.label} />
              ))}
            </div>
          </div>
        )}

        {clarifiers.length > 0 && (
          <div>
            <p className="text-sm font-medium text-fg">Do any of these apply?</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {clarifiers.map((c) => (
                <SymptomChip
                  key={c.id}
                  label={c.label}
                  selected={picked.includes(c.id)}
                  onToggle={() => toggle(c.id)}
                />
              ))}
            </div>
          </div>
        )}

        <div>
          <label htmlFor="refine-detail" className="text-sm font-medium text-fg">
            Or add a little more detail
          </label>
          <textarea
            id="refine-detail"
            rows={2}
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            placeholder="e.g. it's been three days, and it's worse in the mornings"
            className="mt-2 w-full resize-none rounded-xl border border-border bg-bg px-3 py-2 text-sm text-fg outline-none focus:border-accent focus:bg-accent-soft/40 placeholder:text-fg-faint"
          />
        </div>

        <Magnetic>
          <m.button
            type="button"
            onClick={submit}
            disabled={!canContinue}
            whileTap={reduceMotion || !canContinue ? undefined : press.whileTap}
            transition={press.transition}
            className={
              canContinue
                ? "inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-fg hover:bg-accent-strong"
                : "inline-flex cursor-not-allowed items-center gap-2 rounded-full bg-bg-subtle px-6 py-3 text-sm font-semibold text-fg-faint"
            }
          >
            Continue
          </m.button>
        </Magnetic>
      </div>
    </ResultFrame>
  );
}
