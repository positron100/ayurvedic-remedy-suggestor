import { m, useReducedMotion } from "framer-motion";
import { leafPathD, LEAF_EASE_ARRAY } from "@/utils/leaf";

interface LeafMarkProps {
  size?: number;
  className?: string;
  /** Stroke-draws the outline then the midrib on mount. */
  draw?: boolean;
  /** Seconds before the draw starts. */
  delay?: number;
}

/**
 * The leaf as a small line mark — the same silhouette as the full-screen
 * reveals, drawn as a stroke with a central vein. Sizing is in a 48-unit
 * viewBox; `r = 18` and a slight tilt read as organic rather than heraldic.
 */
export function LeafMark({ size = 44, className, draw = false, delay = 0 }: LeafMarkProps) {
  const reduceMotion = useReducedMotion();
  const cx = 24;
  const cy = 24;
  const outline = leafPathD(cx, cy, 12.5, -0.32);
  const shouldDraw = draw && !reduceMotion;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <m.path
        d={outline}
        initial={shouldDraw ? { pathLength: 0, opacity: 0 } : false}
        animate={shouldDraw ? { pathLength: 1, opacity: 1 } : undefined}
        transition={{ pathLength: { duration: 0.7, delay, ease: LEAF_EASE_ARRAY }, opacity: { duration: 0.2, delay } }}
      />
      {/* Midrib — from tip to tip along the tilt axis. */}
      <m.path
        d="M17.4 14.3 L30.6 33.7"
        initial={shouldDraw ? { pathLength: 0, opacity: 0 } : false}
        animate={shouldDraw ? { pathLength: 1, opacity: 0.7 } : undefined}
        transition={{ pathLength: { duration: 0.5, delay: delay + 0.35, ease: LEAF_EASE_ARRAY }, opacity: { duration: 0.2, delay: delay + 0.35 } }}
      />
    </svg>
  );
}
