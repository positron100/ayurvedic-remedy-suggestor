import { confidenceBands } from "@/data/site";
import { cn } from "@/lib/cn";

interface ConfidenceMeterProps {
  /** 0–1 from the engine. */
  confidence: number;
  reasons: string[];
  matchedSymptomLabels: string[];
  contenderNames: string[];
}

function band(confidence: number) {
  return confidenceBands.find((b) => confidence >= b.min) ?? confidenceBands[confidenceBands.length - 1];
}

/**
 * Communicates *how well the input matched a condition* — never medical
 * certainty or effectiveness. Four discrete segments, a word label, and the
 * reasons behind it.
 */
export function ConfidenceMeter({ confidence, reasons, matchedSymptomLabels, contenderNames }: ConfidenceMeterProps) {
  const b = band(confidence);
  const filled = Math.max(1, Math.round(confidence * 4));

  return (
    <div className="rounded-2xl border border-border bg-bg-elevated p-4">
      <div className="flex items-center justify-between gap-3">
        <span className={cn("text-sm font-semibold", b.tone === "clay" ? "text-clay-strong" : "text-accent-strong")}>
          {b.label}
        </span>
        <span className="text-xs text-fg-faint">match strength</span>
      </div>

      <div className="mt-2 flex gap-1" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full",
              i < filled ? (b.tone === "clay" ? "bg-clay" : "bg-accent") : "bg-border-strong",
            )}
          />
        ))}
      </div>

      <p className="mt-3 text-sm text-fg-muted">
        This reflects how closely what you described lines up with a condition Sattva covers — not how
        effective any remedy is.
      </p>

      {matchedSymptomLabels.length > 0 && (
        <p className="mt-2 text-sm text-fg-muted">
          <span className="text-fg-faint">Matched on: </span>
          {matchedSymptomLabels.join(", ")}.
        </p>
      )}

      {contenderNames.length > 0 && (
        <p className="mt-2 text-sm text-fg-muted">
          <span className="text-fg-faint">Also considered: </span>
          {contenderNames.join(", ")}.
        </p>
      )}

      {reasons.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-fg-faint">
          {reasons.map((r) => (
            <li key={r}>· {r}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
