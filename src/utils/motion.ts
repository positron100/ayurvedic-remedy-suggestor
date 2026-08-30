import type { Transition, Variants } from "framer-motion";

/**
 * The shared motion vocabulary. Reuse these rather than inventing per-component
 * spring configs. Adapted from the portfolio's motion tokens, tuned a little
 * calmer for a wellness product — nothing snappy or theatrical.
 */

/** Durations, in seconds — one scale used everywhere. */
export const duration = {
  micro: 0.16,
  fast: 0.26,
  base: 0.42,
  section: 0.6,
  cinematic: 0.9,
} as const;

/** Cubic-bezier easing curves — no linear/default easing anywhere. */
export const ease = {
  standard: [0.16, 1, 0.3, 1],
  entrance: [0.22, 1, 0.36, 1],
  exit: [0.4, 0, 1, 1],
} as const;

export const spring = {
  soft: { type: "spring", stiffness: 240, damping: 28 } satisfies Transition,
  gentle: { type: "spring", stiffness: 170, damping: 26 } satisfies Transition,
  indicator: { type: "spring", stiffness: 320, damping: 32 } satisfies Transition,
} as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.section, ease: ease.standard },
  },
};

export const staggerContainer = (stagger = 0.08, delayChildren = 0): Variants => ({
  hidden: {},
  visible: { transition: { staggerChildren: stagger, delayChildren } },
});

/** Reveal child — pairs with `staggerContainer`. */
export const revealItem: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.base, ease: ease.standard },
  },
};

export const scaleTap = { scale: 0.97 };
export const hoverLift = { y: -2 };

/** Press-and-settle for buttons: compress on tap, gentle spring back. */
export const press = {
  whileTap: { scale: 0.96 },
  transition: { type: "spring", stiffness: 420, damping: 18 } satisfies Transition,
};

/** Word-by-word reveal for a promoted statement. */
export const wordReveal = (stagger = 0.04): Variants => ({
  hidden: {},
  visible: { transition: { staggerChildren: stagger } },
});

export const wordItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.165, 0.84, 0.44, 1] },
  },
};

/**
 * Small, reason-driven reactions — a field settling the first time it is
 * focused, a validation-error shake. Never decorative constant motion.
 */
export const jiggle = {
  settle: { x: [0, -1.5, 1.5, 0] },
  settleTransition: { duration: 0.28, ease: "easeInOut" } satisfies Transition,
  shake: { x: [0, -6, 6, -4, 4, 0] },
  shakeTransition: { duration: 0.4, ease: "easeInOut" } satisfies Transition,
};

/**
 * The leaf reveals — opening sequence and theme change — share one easing
 * philosophy and related timing. Opening is slower and more cinematic; the
 * theme change is quicker and responsive. Both grow the same leaf silhouette
 * from a point.
 */
export const leaf = {
  /**
   * Opening: the mark draws + settles, holds a beat, then the reveal grows
   * with acceleration into a smooth finish. ~2.2s total, cinematic.
   */
  intro: { markMs: 760, holdMs: 220, revealMs: 1220 },
} as const;

/**
 * The leaf theme reveal runs on the Web Animations API directly (pseudo-
 * elements aren't reachable through Framer Motion), so its timing lives here in
 * WAAPI's own units (ms). Values match the portfolio's `viewTransition` token —
 * this is what a drag scrubs `animation.currentTime` across.
 */
export const viewTransition = {
  durationMs: 800,
  easing: "cubic-bezier(0.65, 0, 0.35, 1)",
} as const;
