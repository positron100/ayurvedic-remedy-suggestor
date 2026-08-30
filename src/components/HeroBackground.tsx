import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";

/**
 * A soft, slow-breathing wash behind the hero. Pure CSS — a couple of blurred
 * radial blooms in the accent and clay tints. The breathing animation is
 * disabled under reduced motion by the global rule in index.css.
 */
export function HeroBackground() {
  const reduceMotion = useReducedMotion();

  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
      <div
        className={cn(
          "absolute -top-32 left-1/2 h-[38rem] w-[38rem] -translate-x-1/2 rounded-full blur-3xl",
          !reduceMotion && "motion-safe:[animation:breathe_9s_ease-in-out_infinite]",
        )}
        style={{
          background:
            "radial-gradient(circle at 50% 50%, color-mix(in oklab, var(--accent) 26%, transparent), transparent 70%)",
        }}
      />
      <div
        className={cn(
          "absolute top-24 right-[-6rem] h-[26rem] w-[26rem] rounded-full blur-3xl",
          !reduceMotion && "motion-safe:[animation:breathe_11s_ease-in-out_infinite_reverse]",
        )}
        style={{
          background:
            "radial-gradient(circle at 50% 50%, color-mix(in oklab, var(--clay) 20%, transparent), transparent 70%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(70% 60% at 50% 35%, transparent 0%, var(--bg) 82%)",
        }}
      />
    </div>
  );
}
