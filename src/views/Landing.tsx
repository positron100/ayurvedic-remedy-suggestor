import { m, useReducedMotion } from "framer-motion";
import type { KnowledgeBase } from "@/engine/types";
import type { EngineInput } from "@/engine/result";
import { HeroBackground } from "@/components/HeroBackground";
import { Reveal } from "@/components/Reveal";
import { SectionTitle } from "@/components/SectionTitle";
import { SymptomInput } from "@/components/SymptomInput";
import { Contact } from "@/components/Contact/Contact";
import { conditionsInScope, disclaimer, siteConfig } from "@/data/site";
import { duration, ease } from "@/utils/motion";

interface LandingProps {
  kb: KnowledgeBase;
  initial?: EngineInput;
  onSubmit: (input: EngineInput) => void;
}

export function Landing({ kb, initial, onSubmit }: LandingProps) {
  return (
    <>
      <Hero kb={kb} initial={initial} onSubmit={onSubmit} />
      <HowItWorks />
      <About />
      <Contact />
    </>
  );
}

function Hero({ kb, initial, onSubmit }: LandingProps) {
  const reduceMotion = useReducedMotion();

  return (
    <section id="top" className="relative flex min-h-[100svh] items-center overflow-hidden">
      <HeroBackground />

      <div className="container-px relative mx-auto w-full max-w-2xl py-28 sm:py-32">
        <div className="text-center">
          <m.p
            initial={reduceMotion ? undefined : { opacity: 0, y: 10 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-xs font-medium tracking-[0.2em] text-accent uppercase"
          >
            Ayurvedic remedy guidance
          </m.p>

          <m.h1
            initial={reduceMotion ? undefined : { opacity: 0, y: 14 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: duration.cinematic, ease: ease.entrance, delay: 0.08 }}
            className="mt-5 font-display text-4xl leading-[1.1] font-medium tracking-tight text-balance text-fg sm:text-5xl"
          >
            How are you feeling today?
          </m.h1>

          <m.p
            initial={reduceMotion ? undefined : { opacity: 0, y: 14 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-pretty text-fg-muted"
          >
            {siteConfig.intro}
          </m.p>
        </div>

        <m.div
          initial={reduceMotion ? undefined : { opacity: 0, y: 16 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.32 }}
          className="mt-8"
        >
          <SymptomInput kb={kb} initial={initial} onSubmit={onSubmit} />
          <p className="mt-3 text-center text-xs text-fg-faint">{disclaimer.short}</p>
        </m.div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      title: "You describe your symptoms",
      body: "In plain language, or by picking from suggested symptoms. No accounts, no forms that feel like a database.",
    },
    {
      title: "We match a curated knowledge base",
      body: "Your input is normalised and matched — deterministically — against curated Ayurvedic entries for the conditions we cover. The knowledge base is the source of truth, not a language model.",
    },
    {
      title: "You get structured guidance",
      body: "A primary suggestion with how it is traditionally used, precautions, when to avoid it, a match-strength indicator, and clear signals for when to see a professional instead.",
    },
  ];

  return (
    <section id="how-it-works" className="container-px mx-auto max-w-5xl scroll-mt-24 py-24 sm:py-32">
      <SectionTitle
        kicker="How it works"
        heading="Guidance you can reason about"
        subtitle="Every recommendation is traceable to a curated entry. Where a language model is involved at all, it only rephrases information already retrieved — it never invents remedies."
      />

      <ol className="mt-14 grid gap-4 sm:grid-cols-3">
        {steps.map((step, i) => (
          <Reveal as="li" key={step.title} delay={i * 0.08}>
            <div className="h-full rounded-2xl border border-border bg-bg-elevated p-6">
              <span className="font-display text-2xl text-accent">{i + 1}</span>
              <h3 className="mt-3 font-medium text-fg">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">{step.body}</p>
            </div>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}

function About() {
  return (
    <section id="about" className="scroll-mt-24 border-t border-border bg-bg-subtle/40">
      <div className="container-px mx-auto max-w-5xl py-24 sm:py-32">
        <SectionTitle
          kicker="About"
          heading="Small, careful scope"
          subtitle={`This first version covers four conditions — ${conditionsInScope.join(
            ", ",
          )}. The knowledge base is curated and versioned; adding conditions or remedies later means editing content, not code.`}
        />
        <Reveal className="mt-10" delay={0.1}>
          <div className="rounded-2xl border border-caution/40 bg-caution-soft/60 p-6">
            <p className="text-sm leading-relaxed text-fg">
              <strong className="font-semibold">Safety note.</strong> {disclaimer.full}
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
