import { lazy, Suspense, useCallback, useEffect } from "react";
import { AnimatePresence, domAnimation, LazyMotion, m, useReducedMotion } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { IntroOverlay } from "@/components/IntroOverlay";
import { Landing } from "@/views/Landing";
import { Processing } from "@/views/Processing";
import { useAssessment } from "@/hooks/useAssessment";
import { useIntro } from "@/hooks/useIntro";
import { getKnowledgeBase } from "@/lib/knowledge";
import type { EngineInput } from "@/engine/result";
import { duration, ease } from "@/utils/motion";

const kb = getKnowledgeBase();

/**
 * The result view is only reached after an assessment, so it is code-split out
 * of the initial bundle. It is prefetched the moment the user submits (well
 * before the ~950ms processing beat finishes), so the Suspense fallback should
 * never actually be seen.
 */
const Result = lazy(() => import("@/views/Result"));
const prefetchResult = () => void import("@/views/Result");

function App() {
  const { stage, input, recommendation, submit, refine, restart } = useAssessment();
  const { introDone, finishIntro } = useIntro();
  const reduceMotion = useReducedMotion();

  const handleSubmit = useCallback(
    (value: EngineInput) => {
      prefetchResult();
      submit(value);
    },
    [submit],
  );

  // Belt-and-braces: also warm the chunk once the processing screen is up, for
  // any path that reaches it without going through `handleSubmit`.
  useEffect(() => {
    if (stage === "processing") prefetchResult();
  }, [stage]);

  const fade = {
    initial: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 },
    transition: { duration: duration.base, ease: ease.standard },
  };

  return (
    <LazyMotion features={domAnimation} strict>
      {/* While the opening reveal is playing, the site beneath it must not be
          reachable by keyboard or exposed to assistive tech. */}
      <div inert={introDone ? undefined : true}>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-accent-fg"
        >
          Skip to content
        </a>

        <Navbar mode={stage === "compose" ? "landing" : "result"} onRestart={restart} />

        <main id="main">
          <AnimatePresence mode="wait">
            {stage === "compose" && (
              <m.div key="compose" {...fade}>
                <Landing kb={kb} initial={input} onSubmit={handleSubmit} />
              </m.div>
            )}
            {stage === "processing" && (
              <m.div key="processing" {...fade}>
                <Processing />
              </m.div>
            )}
            {stage === "result" && recommendation && (
              <m.div key="result" {...fade}>
                <Suspense fallback={<ResultFallback />}>
                  <Result kb={kb} recommendation={recommendation} onRefine={refine} onRestart={restart} />
                </Suspense>
              </m.div>
            )}
          </AnimatePresence>
        </main>

        {stage === "compose" && <Footer />}
      </div>

      {!introDone && <IntroOverlay onDone={finishIntro} />}
    </LazyMotion>
  );
}

/** Shown only if the (prefetched) result chunk somehow isn't ready yet. */
function ResultFallback() {
  return (
    <div className="flex min-h-[100svh] items-center justify-center">
      <div aria-hidden="true" className="h-10 w-10 animate-pulse rounded-full bg-accent/20" />
      <span className="sr-only">Preparing your guidance</span>
    </div>
  );
}

export default App;
