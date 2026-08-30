import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import type { Attributed, KnowledgeBase } from "@/engine/types";
import type { RemedySuggestion } from "@/engine/result";
import { collectRemedySources } from "@/lib/sources";
import { cn } from "@/lib/cn";
import { duration, ease } from "@/utils/motion";
import { DisclosureSection } from "@/components/DisclosureSection";
import { ProvenanceBadge, VerificationBadge, UnverifiedNotice } from "./Provenance";
import { PrecautionList } from "./PrecautionList";
import { SourceList } from "./SourceList";

const REMEDY_TYPE_LABEL: Record<string, string> = {
  "single-herb": "Single herb",
  "classical-formulation": "Classical formulation",
  "home-preparation": "Home preparation",
  "mineral-preparation": "Mineral / processed preparation",
  combination: "Combination",
  procedure: "Procedure",
};

interface RemedyCardProps {
  kb: KnowledgeBase;
  suggestion: RemedySuggestion;
  conditionName: string;
  matchedSymptomLabels: string[];
  primary?: boolean;
  /** Rendered flush inside a parent container (the "also associated" list) —
   *  no outer card chrome, tighter heading. */
  embedded?: boolean;
  /** Warm framing for the primary card (from the recommendation narrative). */
  lead?: { summary: string; whyItMayHelp: string | null };
}

function AttributedText({ value }: { value: Attributed<string> }) {
  return (
    <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span>{value.value}</span>
      <ProvenanceBadge provenance={value.provenance} />
    </span>
  );
}

export function RemedyCard({
  kb,
  suggestion,
  conditionName,
  matchedSymptomLabels,
  primary = false,
  embedded = false,
  lead,
}: RemedyCardProps) {
  const { remedy, rationale, safetyNotes } = suggestion;
  const Heading = primary ? "h2" : "h3";
  const sources = collectRemedySources(kb, remedy);

  const hasAbout = Boolean(remedy.summary) || remedy.ingredients.length > 0;
  const usageParts = [remedy.traditionalUse, remedy.preparation, remedy.usage].filter(Boolean) as Attributed<string>[];
  const relevantSafetyNotes = safetyNotes.filter((n) => !n.startsWith("unverified:"));
  const isVerified = remedy.verification.level === "sourced" || remedy.verification.level === "reviewed";

  return (
    <article
      className={cn(
        !embedded && "rounded-2xl border bg-bg-elevated",
        !embedded && (primary ? "border-accent/30 shadow-[0_16px_50px_-30px_hsl(var(--shadow-color)/0.5)]" : "border-border"),
      )}
    >
      <div className={cn(embedded ? "pb-2" : "p-5 sm:p-6")}>
        {!embedded && (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium tracking-wide text-fg-faint uppercase">
                {primary ? "Primary suggestion" : "Associated remedy"}
              </p>
              <Heading className="mt-1 font-display text-2xl font-medium text-fg">{remedy.canonicalName}</Heading>
              <p className="mt-1 text-xs text-fg-faint">
                {REMEDY_TYPE_LABEL[remedy.type] ?? remedy.type}
                {remedy.aliases.length > 0 && <> · also called {remedy.aliases.slice(0, 2).join(", ")}</>}
              </p>
            </div>
            <VerificationBadge level={remedy.verification.level} />
          </div>
        )}

        {primary && lead && <LeadSummary text={lead.summary} />}

        {!isVerified && (
          <div className={cn(embedded ? "mb-2" : "mt-4")}>
            <UnverifiedNotice level={remedy.verification.level} summary={remedy.verification.summary} />
          </div>
        )}
      </div>

      <div className={cn(!embedded && "px-5 sm:px-6")}>
        <DisclosureSection title="Why this matches" defaultOpen={primary}>
          <div className="space-y-2">
            {lead?.whyItMayHelp && <p className="text-fg-muted">{lead.whyItMayHelp}</p>}
            <ul className="space-y-1.5">
              {rationale.length > 0 ? (
                rationale.map((r) => <li key={r}>· {r}</li>)
              ) : (
                <li>· Associated with {conditionName.toLowerCase()} in the curated knowledge base.</li>
              )}
              {matchedSymptomLabels.length > 0 && <li>· You described: {matchedSymptomLabels.join(", ")}.</li>}
            </ul>
          </div>
        </DisclosureSection>

        {hasAbout && (
          <DisclosureSection title="About this remedy">
            <div className="space-y-3">
              {remedy.summary && <AttributedText value={remedy.summary} />}
              {remedy.ingredients.length > 0 && (
                <div>
                  <p className="font-medium text-fg">Ingredients</p>
                  <ul className="mt-1 space-y-1">
                    {remedy.ingredients.map((ing, i) => (
                      <li key={i} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span>
                          {ing.name}
                          {ing.botanical && <span className="text-fg-faint italic"> ({ing.botanical})</span>}
                        </span>
                        <ProvenanceBadge provenance={ing.provenance} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </DisclosureSection>
        )}

        <DisclosureSection
          title="How it is traditionally used"
          hint={usageParts.length === 0 ? "not verified" : undefined}
        >
          {usageParts.length === 0 ? (
            <p>
              Sattva does not yet have a sourced description of how {remedy.canonicalName} is prepared or
              used, so none is shown.{" "}
              <span className="text-fg-faint">
                Do not guess at a preparation or dose — a qualified Ayurvedic practitioner or pharmacist can
                advise.
              </span>
            </p>
          ) : (
            <div className="space-y-3">
              {remedy.traditionalUse && (
                <Field label="Traditional use">
                  <AttributedText value={remedy.traditionalUse} />
                </Field>
              )}
              {remedy.preparation && (
                <Field label="Preparation">
                  <AttributedText value={remedy.preparation} />
                </Field>
              )}
              {remedy.usage && (
                <Field label="Usage">
                  <AttributedText value={remedy.usage} />
                </Field>
              )}
            </div>
          )}
        </DisclosureSection>

        <DisclosureSection
          title="Precautions & when to avoid"
          hint={relevantSafetyNotes.length > 0 ? "relevant to you" : undefined}
          defaultOpen={primary && relevantSafetyNotes.length > 0}
        >
          <PrecautionList
            precautions={remedy.precautions}
            interactions={remedy.interactions}
            contraindications={remedy.contraindications}
            avoidIf={remedy.avoidIf}
            safetyNotes={safetyNotes}
          />
        </DisclosureSection>

        <DisclosureSection title="Sources" hint={sources.length > 0 ? String(sources.length) : "none"}>
          <SourceList sources={sources} />
        </DisclosureSection>
      </div>
    </article>
  );
}

/**
 * The primary card's lead sentence. When the optional phrasing layer swaps the
 * templated prose for a warmer version (a beat after the result appears), it
 * cross-fades rather than snapping. No "AI" marker — the source of the prose is
 * deliberately invisible to the reader.
 */
function LeadSummary({ text }: { text: string }) {
  const reduceMotion = useReducedMotion();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <m.p
        key={text}
        initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: duration.fast, ease: ease.standard }}
        className="mt-4 text-sm leading-relaxed text-fg"
      >
        {text}
      </m.p>
    </AnimatePresence>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-medium text-fg">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}
