import type { Attributed, Contraindication, DemographicFlag } from "@/engine/types";
import { ProvenanceBadge } from "./Provenance";

const FLAG_LABEL: Record<DemographicFlag, string> = {
  pregnancy: "pregnancy",
  breastfeeding: "breastfeeding",
  child: "children (under 12)",
  "older-adult": "older adults",
  none: "no specific factor",
};

interface PrecautionListProps {
  precautions: Attributed<string>[];
  interactions: Attributed<string>[];
  contraindications: Contraindication[];
  avoidIf: DemographicFlag[];
  /** Deterministic safety-filter notes for this specific request. */
  safetyNotes: string[];
}

export function PrecautionList({
  precautions,
  interactions,
  contraindications,
  avoidIf,
  safetyNotes: rawSafetyNotes,
}: PrecautionListProps) {
  // The "unverified:" note is shown by the card's verification banner instead.
  const safetyNotes = rawSafetyNotes.filter((n) => !n.startsWith("unverified:"));
  const nothing =
    precautions.length === 0 &&
    interactions.length === 0 &&
    contraindications.length === 0 &&
    avoidIf.length === 0 &&
    safetyNotes.length === 0;

  if (nothing) {
    return (
      <p className="text-sm text-fg-muted">
        No verified precautions or contraindications are on file for this remedy yet.{" "}
        <span className="text-fg-faint">
          Absence of a warning here is not the same as this remedy being confirmed safe for you — check
          with a professional first.
        </span>
      </p>
    );
  }

  return (
    <div className="space-y-4 text-sm">
      {safetyNotes.length > 0 && (
        <div className="rounded-xl border border-clay/40 bg-clay-soft/50 p-3">
          <p className="text-xs font-semibold tracking-wide text-clay-strong uppercase">For your situation</p>
          <ul className="mt-1.5 space-y-1 text-fg-muted">
            {safetyNotes.map((n) => (
              <li key={n}>· {n}</li>
            ))}
          </ul>
        </div>
      )}

      {avoidIf.length > 0 && (
        <p className="text-fg">
          <span className="font-medium">Do not use if: </span>
          {avoidIf.map((f) => FLAG_LABEL[f]).join(", ")}.
        </p>
      )}

      {contraindications.length > 0 && (
        <ul className="space-y-2">
          {contraindications.map((c, i) => (
            <li key={i} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-fg-muted">
              <span>{c.detail}</span>
              <ProvenanceBadge provenance={c.provenance} />
            </li>
          ))}
        </ul>
      )}

      {precautions.length > 0 && (
        <ul className="space-y-2">
          {precautions.map((p, i) => (
            <li key={i} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-fg-muted">
              <span>{p.value}</span>
              <ProvenanceBadge provenance={p.provenance} />
            </li>
          ))}
        </ul>
      )}

      {interactions.length > 0 && (
        <div>
          <p className="font-medium text-fg">Interactions</p>
          <ul className="mt-1.5 space-y-2">
            {interactions.map((p, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-fg-muted">
                <span>{p.value}</span>
                <ProvenanceBadge provenance={p.provenance} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
