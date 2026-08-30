import type { KnowledgeBase } from "@/engine/types";
import type { EngineInput, Recommendation } from "@/engine/result";
import { Guidance } from "@/components/result/Guidance";
import { NeedMoreInfo } from "@/components/result/NeedMoreInfo";
import { NoMatch } from "@/components/result/NoMatch";
import { SeeAProfessional } from "@/components/result/SeeAProfessional";

interface ResultProps {
  kb: KnowledgeBase;
  recommendation: Recommendation;
  onRefine: (patch: Partial<EngineInput>) => void;
  onRestart: () => void;
}

/** Routes a recommendation to the right outcome screen. No logic here — the
 *  engine already decided `kind`. Default-exported so `App` can `lazy()` it. */
export default function Result({ kb, recommendation, onRefine, onRestart }: ResultProps) {
  switch (recommendation.kind) {
    case "red_flag":
      return <SeeAProfessional recommendation={recommendation} onRestart={onRestart} />;
    case "insufficient_information":
      return (
        <NeedMoreInfo kb={kb} recommendation={recommendation} onRefine={onRefine} onRestart={onRestart} />
      );
    case "no_matching_condition":
      return <NoMatch recommendation={recommendation} onRestart={onRestart} />;
    case "ok":
    case "low_confidence":
      return (
        <Guidance kb={kb} recommendation={recommendation} onRefine={onRefine} onRestart={onRestart} />
      );
  }
}
