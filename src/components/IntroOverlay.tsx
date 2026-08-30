import { useEffect, useRef, useState } from "react";
import { m } from "framer-motion";
import { LeafMark } from "@/components/LeafMark";
import { coverRadius, curtainPathD, LEAF_EASE_ARRAY } from "@/utils/leaf";
import { leaf } from "@/utils/motion";
import { tween } from "@/utils/tween";

/** Reveal growth: a slow, gathering start that accelerates, then a smooth,
 *  decelerating finish — a leaf unfolding, not a wipe. */
const REVEAL_EASE = [0.55, 0, 0.24, 1] as const;

/**
 * The opening. An Ayurvedic leaf is drawn in the centre, settles, then unfolds
 * outward — becoming a hole in an opaque curtain through which the live site
 * (already rendered underneath) is revealed. `clip-path: path(evenodd, ...)` on
 * one fixed solid-colour element, written each frame by a single rAF tween:
 * no layout work, no per-frame React state. ~2.2s, cinematic.
 *
 * Only ever mounted when it will actually play (see `useIntro`): skipped for
 * reduced motion and once-per-session.
 */
export function IntroOverlay({ onDone }: { onDone: () => void }) {
  const curtainRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"mark" | "reveal">("mark");

  useEffect(() => {
    const curtain = curtainRef.current;
    if (!curtain) return;

    const w = window.innerWidth;
    const h = window.innerHeight;
    const cx = w / 2;
    const cy = h / 2;
    const endR = coverRadius(cx, cy, w, h);
    const startR = endR * 0.018;

    curtain.style.clipPath = `path(evenodd, "${curtainPathD(cx, cy, startR, -0.5)}")`;

    const root = document.documentElement;
    const prevOverflow = root.style.overflow;
    root.style.overflow = "hidden";

    const markTimer = window.setTimeout(() => setPhase("reveal"), leaf.intro.markMs);

    let cancelReveal: (() => void) | undefined;
    const revealTimer = window.setTimeout(() => {
      cancelReveal = tween({
        durationMs: leaf.intro.revealMs,
        easing: REVEAL_EASE,
        onUpdate: (t) => {
          const r = startR + (endR - startR) * t;
          const rot = -0.5 + 0.38 * t; // the leaf unfurls toward upright as it opens
          curtain.style.clipPath = `path(evenodd, "${curtainPathD(cx, cy, r, rot)}")`;
        },
        onDone,
      });
    }, leaf.intro.markMs + leaf.intro.holdMs);

    return () => {
      window.clearTimeout(markTimer);
      window.clearTimeout(revealTimer);
      cancelReveal?.();
      root.style.overflow = prevOverflow;
    };
  }, [onDone]);

  const revealing = phase === "reveal";

  return (
    <div className="pointer-events-none fixed inset-0 z-[200]" aria-hidden="true">
      <div ref={curtainRef} className="absolute inset-0 bg-bg" style={{ willChange: "clip-path" }} />

      {/* The mark rides on top, unclipped, then scales up and fades as the
          growing hole overtakes it — the small drawn leaf becoming the reveal. */}
      <m.div
        className="absolute inset-0 grid place-items-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: revealing ? 0 : 1 }}
        transition={{ duration: revealing ? 0.42 : 0.34, ease: LEAF_EASE_ARRAY }}
      >
        <m.div
          className="relative"
          initial={{ scale: 0.82 }}
          animate={{ scale: revealing ? 1.55 : 1 }}
          transition={{ duration: revealing ? 0.7 : 1, ease: revealing ? REVEAL_EASE : LEAF_EASE_ARRAY }}
        >
          <div
            aria-hidden="true"
            className="absolute -inset-8 rounded-full bg-accent/12 blur-2xl"
          />
          <LeafMark size={84} draw className="relative text-accent" />
        </m.div>
      </m.div>
    </div>
  );
}
