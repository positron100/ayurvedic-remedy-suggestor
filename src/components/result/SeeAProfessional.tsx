import type { Recommendation } from "@/engine/result";
import { resultCopy } from "@/data/site";
import { ResultFrame } from "./ResultFrame";

const URGENCY_LABEL: Record<string, string> = {
  emergency: "Emergency",
  urgent: "See someone soon",
  advisory: "Worth mentioning",
};

interface SeeAProfessionalProps {
  recommendation: Recommendation;
  onRestart: () => void;
}

/**
 * The red-flag outcome. Visually and semantically distinct from a
 * recommendation: no remedy, calm framing, the specific reasons from the
 * safety system, and a clear pointer to professional care.
 */
export function SeeAProfessional({ recommendation, onRestart }: SeeAProfessionalProps) {
  const { narrative, redFlags } = recommendation;

  return (
    <ResultFrame
      eyebrow={resultCopy.red_flag.eyebrow}
      announce={resultCopy.red_flag.announce}
      heading={narrative.headline}
      tone="danger"
      onRestart={onRestart}
      restartLabel="Describe something else"
    >
      <div className="space-y-6">
        <p className="text-base leading-relaxed text-pretty text-fg">{narrative.summary}</p>

        {redFlags.length > 0 && (
          <ul className="space-y-3">
            {redFlags.map((hit) => (
              <li key={hit.redFlag.id} className="rounded-2xl border border-danger/30 bg-danger-soft/40 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex rounded-full bg-danger/15 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-danger uppercase">
                    {URGENCY_LABEL[hit.redFlag.urgency] ?? hit.redFlag.urgency}
                  </span>
                  <span className="text-sm font-medium text-fg">{hit.redFlag.label}</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-fg-muted">{hit.redFlag.guidance}</p>
              </li>
            ))}
          </ul>
        )}

        <div className="rounded-2xl border border-border bg-bg-elevated p-4">
          <p className="text-sm leading-relaxed text-fg-muted">{narrative.professionalCareIntro}</p>
        </div>
      </div>
    </ResultFrame>
  );
}
