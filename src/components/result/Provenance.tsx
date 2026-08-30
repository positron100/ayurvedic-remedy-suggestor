import type { Provenance as ProvenanceLevel, VerificationLevel } from "@/engine/types";
import { cn } from "@/lib/cn";

const PROVENANCE_LABEL: Record<ProvenanceLevel, { label: string; tone: "accent" | "clay" | "neutral" }> = {
  sourced: { label: "Sourced", tone: "accent" },
  editorial: { label: "Editorial note", tone: "neutral" },
  "inherited-legacy-dataset": { label: "Legacy data — unverified", tone: "clay" },
  unverified: { label: "Unverified", tone: "clay" },
};

const VERIFICATION_LABEL: Record<VerificationLevel, { label: string; tone: "accent" | "clay" | "neutral" }> = {
  reviewed: { label: "Reviewed", tone: "accent" },
  sourced: { label: "Sourced", tone: "accent" },
  needs_review: { label: "Awaiting review", tone: "clay" },
  unverified: { label: "Unverified", tone: "clay" },
};

function toneClass(tone: "accent" | "clay" | "neutral") {
  return tone === "accent"
    ? "bg-accent-soft text-accent-strong"
    : tone === "clay"
      ? "bg-clay-soft text-clay-strong"
      : "bg-bg-subtle text-fg-muted";
}

export function ProvenanceBadge({ provenance, className }: { provenance: ProvenanceLevel; className?: string }) {
  const { label, tone } = PROVENANCE_LABEL[provenance];
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium", toneClass(tone), className)}>
      {label}
    </span>
  );
}

export function VerificationBadge({ level, className }: { level: VerificationLevel; className?: string }) {
  const { label, tone } = VERIFICATION_LABEL[level];
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium", toneClass(tone), className)}>
      {label}
    </span>
  );
}

/**
 * A banner shown at the top of a remedy card whose content is not verified —
 * so a reader never mistakes a schema field for authoritative medical advice.
 */
export function UnverifiedNotice({ level, summary }: { level: VerificationLevel; summary: string }) {
  if (level === "reviewed" || level === "sourced") return null;
  return (
    <div className="rounded-xl border border-clay/40 bg-clay-soft/50 px-3.5 py-3 text-xs leading-relaxed text-fg-muted">
      <strong className="font-semibold text-clay-strong">
        {level === "needs_review" ? "Not yet reviewed." : "Unverified."}
      </strong>{" "}
      {summary}
    </div>
  );
}
