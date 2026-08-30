import { useState } from "react";
import type { KnowledgeBase } from "@/engine/types";
import type { EngineInput, Recommendation } from "@/engine/result";
import { collectConditionSources } from "@/lib/sources";
import { symptomLabels } from "@/lib/symptoms";
import { resultCopy } from "@/data/site";
import { ResultFrame } from "./ResultFrame";
import { ConfidenceMeter } from "./ConfidenceMeter";
import { RemedyCard } from "./RemedyCard";
import { DisclosureSection } from "@/components/DisclosureSection";
import { SourceList } from "./SourceList";
import { ProvenanceBadge } from "./Provenance";
import { SecondaryRemedyList } from "./SecondaryRemedyList";
import { SymptomChip } from "@/components/SymptomInput/SymptomChip";

interface GuidanceProps {
  kb: KnowledgeBase;
  recommendation: Recommendation;
  onRefine: (patch: Partial<EngineInput>) => void;
  onRestart: () => void;
}

export function Guidance({ kb, recommendation, onRefine, onRestart }: GuidanceProps) {
  const { condition, suggestions, confidence, confidenceReasons, contenderConditionNames, narrative, kind } =
    recommendation;
  const [refinePicked, setRefinePicked] = useState<string[]>([]);

  // `condition` is always present for ok / low_confidence.
  const conditionName = condition?.condition.name ?? "your symptoms";
  const matchedLabels = (condition?.matchedSymptoms ?? recommendation.recognisedSymptoms).map((s) => s.label);
  const [primary, ...secondary] = suggestions;
  const conditionSources = condition ? collectConditionSources(kb, condition.condition) : [];
  const clarifiers = symptomLabels(kb, recommendation.clarifyingSymptomIds);

  return (
    <ResultFrame
      eyebrow={kind === "low_confidence" ? resultCopy.low_confidence.eyebrow : resultCopy.ok.eyebrow}
      announce={kind === "low_confidence" ? resultCopy.low_confidence.announce : resultCopy.ok.announce}
      heading={`Guidance for ${conditionName.toLowerCase()}`}
      onRestart={onRestart}
    >
      <div className="space-y-6">
        <ConfidenceMeter
          confidence={confidence}
          reasons={confidenceReasons}
          matchedSymptomLabels={matchedLabels}
          contenderNames={contenderConditionNames}
        />

        {kind === "low_confidence" && clarifiers.length > 0 && (
          <div className="rounded-2xl border border-clay/40 bg-clay-soft/40 p-4">
            <p className="text-sm font-medium text-fg">Not sure this is right?</p>
            <p className="mt-1 text-sm text-fg-muted">
              Add anything that applies and Sattva will re-check — you won&apos;t lose your place.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {clarifiers.map((c) => (
                <SymptomChip
                  key={c.id}
                  label={c.label}
                  selected={refinePicked.includes(c.id)}
                  onToggle={() =>
                    setRefinePicked((cur) =>
                      cur.includes(c.id) ? cur.filter((x) => x !== c.id) : [...cur, c.id],
                    )
                  }
                />
              ))}
            </div>
            {refinePicked.length > 0 && (
              <button
                type="button"
                onClick={() => onRefine({ symptomIds: refinePicked })}
                className="mt-3 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-fg hover:bg-accent-strong"
              >
                Re-check with {refinePicked.length} more
              </button>
            )}
          </div>
        )}

        {primary ? (
          <RemedyCard
            kb={kb}
            suggestion={primary}
            conditionName={conditionName}
            matchedSymptomLabels={matchedLabels}
            primary
            lead={{ summary: narrative.summary, whyItMayHelp: narrative.whyItMayHelp }}
          />
        ) : (
          <p className="rounded-2xl border border-border bg-bg-elevated p-4 text-sm text-fg-muted">
            Every remedy the knowledge base associates with {conditionName.toLowerCase()} was set aside
            for your situation (for example because of pregnancy). Please speak with a professional about
            options that are appropriate for you.
          </p>
        )}

        <SecondaryRemedyList
          kb={kb}
          suggestions={secondary}
          conditionName={conditionName}
          matchedSymptomLabels={matchedLabels}
        />

        {condition && (
          <div className="rounded-2xl border border-border bg-bg-elevated px-5 py-1 sm:px-6">
            <DisclosureSection title={`When to see a professional about ${conditionName.toLowerCase()}`} defaultOpen>
              <ul className="space-y-2">
                {condition.condition.whenToSeeProfessional.map((p, i) => (
                  <li key={i} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span>{p.value}</span>
                    <ProvenanceBadge provenance={p.provenance} />
                  </li>
                ))}
              </ul>
            </DisclosureSection>
            {condition.condition.generalPrecautions.length > 0 && (
              <DisclosureSection title="General precautions">
                <ul className="space-y-2">
                  {condition.condition.generalPrecautions.map((p, i) => (
                    <li key={i} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span>{p.value}</span>
                      <ProvenanceBadge provenance={p.provenance} />
                    </li>
                  ))}
                </ul>
              </DisclosureSection>
            )}
            <DisclosureSection title={`About ${conditionName.toLowerCase()}`}>
              <p>{condition.condition.summary}</p>
            </DisclosureSection>
            <DisclosureSection title="Condition sources" hint={String(conditionSources.length)}>
              <SourceList sources={conditionSources} />
            </DisclosureSection>
          </div>
        )}
      </div>
    </ResultFrame>
  );
}
