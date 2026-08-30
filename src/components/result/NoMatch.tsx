import type { Recommendation } from "@/engine/result";
import { conditionsInScope, resultCopy } from "@/data/site";
import { ResultFrame } from "./ResultFrame";
import { SymptomChip } from "@/components/SymptomInput/SymptomChip";

interface NoMatchProps {
  recommendation: Recommendation;
  onRestart: () => void;
}

export function NoMatch({ recommendation, onRestart }: NoMatchProps) {
  const { narrative, recognisedSymptoms } = recommendation;

  return (
    <ResultFrame
      eyebrow={resultCopy.no_matching_condition.eyebrow}
      announce={resultCopy.no_matching_condition.announce}
      heading={narrative.headline}
      tone="clay"
      onRestart={onRestart}
      restartLabel="Try describing it again"
    >
      <div className="space-y-6">
        <p className="text-base leading-relaxed text-pretty text-fg">{narrative.summary}</p>

        {recognisedSymptoms.length > 0 && (
          <div>
            <p className="text-xs font-medium tracking-wide text-fg-faint uppercase">What Sattva picked up</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {recognisedSymptoms.map((s) => (
                <SymptomChip key={s.symptomId} label={s.label} />
              ))}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-border bg-bg-elevated p-4 text-sm leading-relaxed text-fg-muted">
          <p>Sattva currently covers {conditionsInScope.join(", ")}.</p>
          <p className="mt-2">{narrative.professionalCareIntro}</p>
        </div>
      </div>
    </ResultFrame>
  );
}
