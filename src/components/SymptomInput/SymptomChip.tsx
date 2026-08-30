import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { animate, m, useMotionValue, usePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import { spring } from "@/utils/motion";
import { useMagnetic } from "@/hooks/useMagnetic";

interface SymptomChipProps {
  label: string;
  /** Interactive (toggle / removable) vs. a static read-only pill. */
  selected?: boolean;
  /** Passed the chip's own bounding rect at click time, so the parent can fly
   *  the freshly-selected chip up from exactly here. */
  onToggle?: (sourceRect: DOMRect) => void;
  onRemove?: () => void;
  /** Visual weight — "detected" pills (from free text) read quieter. */
  tone?: "solid" | "outline" | "ghost";
  /** Subtle cursor-attraction on the pick lists (fine pointer / desktop only). */
  magnetic?: boolean;
  /**
   * When set, the chip mounts visually at this rect and springs to its real
   * layout position — the "picked up and carried into Your symptoms" motion.
   * The parent computes nothing: the chip measures its own final position once,
   * on mount, and derives the offset from that.
   */
  flyFrom?: DOMRect | null;
  /** Fired once the travel settles (or immediately if there's nothing to fly). */
  onFlyEnd?: () => void;
  /** Fired once the roll-back exit has finished and the chip may be dropped. */
  onExitEnd?: () => void;
}

/** Sideways carry — quick, minimal overshoot. */
const TRAVEL_SPRING = { type: "spring" as const, stiffness: 420, damping: 34, mass: 1 };
/** The upward "picked up and set down" arc height, in px. The two lists sit
 *  right on top of each other, so a chip moving between them barely changes
 *  absolute position — this arc is what makes the pick-up read physically. It
 *  is added on top of whatever real travel the layout produces. */
const LIFT_PX = 22;
const LIFT_TWEEN = { duration: 0.46, ease: [0.22, 1, 0.32, 1] as [number, number, number, number], times: [0, 0.4, 1] };
/** Roll-back on removal — the pick-up reversed: nudge down and fade out. */
const EXIT_DROP_PX = 20;
const EXIT_EASE: [number, number, number, number] = [0.4, 0, 1, 1];

export function SymptomChip({
  label,
  selected,
  onToggle,
  onRemove,
  tone = "outline",
  magnetic = false,
  flyFrom,
  onFlyEnd,
  onExitEnd,
}: SymptomChipProps) {
  const reduceMotion = useReducedMotion();
  const mag = useMagnetic({ strength: 5, disabled: !magnetic });
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const removable = Boolean(onRemove);

  // Frozen at mount: a chip is a fly-in chip xor a magnetic pick chip, never both.
  const [flySource] = useState(() => flyFrom ?? null);
  const flyX = useMotionValue(0);
  const flyY = useMotionValue(0);
  const chipOpacity = useMotionValue(1);
  const flewRef = useRef(false);

  useLayoutEffect(() => {
    if (flewRef.current) return; // StrictMode re-invoke — the first animation is still running
    flewRef.current = true;
    const el = btnRef.current;
    if (!flySource || reduceMotion || !el) {
      onFlyEnd?.();
      return;
    }
    // One layout read, before paint — the first painted frame is already offset.
    const now = el.getBoundingClientRect();
    const dx = flySource.left + flySource.width / 2 - (now.left + now.width / 2);
    const dy = flySource.top + flySource.height / 2 - (now.top + now.height / 2);
    flyX.set(dx);
    flyY.set(dy);
    animate(flyX, 0, TRAVEL_SPRING);
    // Always arc upward through a small lift before settling, so a short hop
    // (first symptom, source ≈ destination) still reads as "picked up and
    // placed" and a long carry gets a gentle overshoot.
    const settle = animate(flyY, [dy, Math.min(dy, 0) - LIFT_PX, 0], LIFT_TWEEN);
    settle.then(() => onFlyEnd?.()).catch(() => {});
    // No stop-on-cleanup: a StrictMode unmount/remount would otherwise kill the
    // travel; a real mid-flight unmount just lets framer GC the finished value.
  }, [flySource, reduceMotion, flyX, flyY, onFlyEnd]);

  // --- roll-back exit -----------------------------------------------------
  // `usePresence` registers this chip as a presence consumer, so once it is
  // inside an exiting <AnimatePresence> subtree it MUST call `safeToRemove` —
  // otherwise it blocks that subtree's exit forever. Removable chips roll back
  // (nudge down + fade) first; everything else releases immediately.
  const [isPresent, safeToRemove] = usePresence();
  const exitedRef = useRef(false);
  useEffect(() => {
    if (isPresent) {
      exitedRef.current = false;
      return;
    }
    if (exitedRef.current) return;
    exitedRef.current = true;

    if (!removable || reduceMotion || !safeToRemove) {
      onExitEnd?.();
      safeToRemove?.();
      return;
    }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      onExitEnd?.();
      safeToRemove();
    };
    const drop = animate(flyY, flyY.get() + EXIT_DROP_PX, { duration: 0.22, ease: EXIT_EASE });
    const fade = animate(chipOpacity, 0, { duration: 0.2, ease: EXIT_EASE });
    Promise.all([drop, fade]).then(finish).catch(finish);
  }, [isPresent, removable, reduceMotion, flyY, chipOpacity, onExitEnd, safeToRemove]);

  const setRefs = useCallback(
    (el: HTMLButtonElement | null) => {
      btnRef.current = el;
      mag.attach(el);
    },
    [mag],
  );

  const base = "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors";
  const toneClass =
    tone === "ghost"
      ? "border border-dashed border-border-strong text-fg-muted"
      : selected
        ? "bg-accent text-accent-fg"
        : "border border-border-strong text-fg-muted hover:border-accent hover:text-fg";

  const content = (
    <>
      <span>{label}</span>
      {onRemove && (
        <span
          aria-hidden="true"
          className={cn(
            "-mr-1 flex h-4 w-4 items-center justify-center rounded-full",
            selected ? "hover:bg-black/15" : "hover:bg-bg-subtle",
          )}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M2 2l6 6M8 2l-6 6" />
          </svg>
        </span>
      )}
    </>
  );

  if (!onToggle && !onRemove) {
    return <span className={cn(base, toneClass)}>{content}</span>;
  }

  // Removable chips carry x/y/opacity through the travel-in and roll-back-out;
  // pick chips carry only the magnetic pull.
  const style = removable
    ? { x: flyX, y: flyY, opacity: chipOpacity }
    : magnetic
      ? mag.style
      : undefined;

  return (
    <m.button
      ref={setRefs}
      type="button"
      onClick={(e) => {
        if (onRemove) {
          onRemove();
          return;
        }
        // Source = the chip's *resting* box: subtract any live magnetic pull so
        // the travel doesn't start a few px off.
        const r = e.currentTarget.getBoundingClientRect();
        onToggle?.(new DOMRect(r.left - mag.x.get(), r.top - mag.y.get(), r.width, r.height));
      }}
      onMouseMove={magnetic ? mag.onMouseMove : undefined}
      onMouseLeave={magnetic ? mag.onMouseLeave : undefined}
      style={style}
      aria-pressed={onToggle ? Boolean(selected) : undefined}
      aria-label={onRemove ? `Remove ${label}` : `${selected ? "Remove" : "Add"} ${label}`}
      whileTap={reduceMotion ? undefined : { scale: 0.95 }}
      transition={spring.indicator}
      className={cn(base, toneClass, "cursor-pointer")}
    >
      {content}
    </m.button>
  );
}
