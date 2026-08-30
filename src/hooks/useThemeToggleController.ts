import { useRef } from "react";
import { useMotionValue } from "framer-motion";
import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from "react";
import type { Theme } from "@/hooks/useTheme";
import {
  startLeafThemeReveal,
  prefersReducedMotionNow,
  supportsViewTransitions,
  type ThemeOrigin,
} from "@/utils/themeReveal";
import { viewTransition } from "@/utils/motion";

/**
 * Ported from the portfolio (`src/hooks/useThemeToggleController.ts`), with the
 * circular reveal swapped for the leaf reveal.
 *
 * A plain click/tap/keyboard activation runs the full leaf reveal. The same
 * button also supports dragging — the drag distance directly scrubs the
 * reveal's progress via `animation.currentTime` (no React re-renders per
 * pointer move), and release either plays it to completion or reverses it,
 * based on progress + flick velocity.
 *
 * Raw pointer position only ever updates a *target* progress; a small per-frame
 * exponential smoothing loop drives the visible reveal and knob, so the motion
 * reads as damped, direct manipulation rather than snapping to the cursor.
 *
 * `darkness` (0 = light, 1 = dark) tracks that smoothed visual progress for the
 * knob position and sun/moon icons, in sync with click, drag and release.
 */

const DRAG_THRESHOLD_PX = 6;
/** Physical distance for a full 0→1 drag. Larger than the toggle so dragging
 *  past the control is normal and progress isn't hypersensitive. */
const DRAG_RANGE_PX = 150;
const FLICK_VELOCITY_PX_MS = 0.55;
const SMOOTHING_TAU_MS = 40;
/** Mirrors `KNOB_TRAVEL_PX` in ThemeToggle.tsx. */
const KNOB_TRAVEL_PX = 22;

function clampUnit(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

interface Sample {
  x: number;
  t: number;
}

export function useThemeToggleController(
  theme: Theme,
  setTheme: (theme: Theme) => void,
  /** The knob. The reveal opens from the thing the finger is on. Optional —
   *  without it the button is used. */
  originRef?: { current: HTMLElement | null },
) {
  const darkness = useMotionValue(theme === "dark" ? 1 : 0);

  /**
   * Measured fresh at the start of every gesture, never cached. Returns a
   * viewport-relative point.
   *
   * Not `getBoundingClientRect` on the knob directly: on mobile the toggle
   * lives inside the nav menu panel, still running its open spring for ~400ms,
   * and `getBoundingClientRect` folds every ancestor transform into its result
   * — so a tap during that window opened the reveal from the wrong place.
   *
   * `offsetLeft`/`offsetTop` are layout values transforms never touch. The
   * knob's untransformed box is summed up the `offsetParent` chain and anchored
   * to the `<header>`'s rect — the header is `position: fixed` and never
   * transformed, so its rect is reliable at any scroll offset. The knob's own
   * `x` transform (offset* omits it) is added back explicitly.
   */
  function measureOrigin(fallback: HTMLElement): ThemeOrigin {
    const el = originRef?.current ?? fallback;
    const header = el.closest("header");
    if (!header) {
      const rect = el.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
    let ox = 0;
    let oy = 0;
    let node: HTMLElement | null = el;
    while (node && node !== header) {
      ox += node.offsetLeft;
      oy += node.offsetTop;
      node = node.offsetParent as HTMLElement | null;
    }
    const headerRect = header.getBoundingClientRect();
    const knobSelfShiftX = clampUnit(darkness.get()) * KNOB_TRAVEL_PX;
    return {
      x: headerRect.left + ox + knobSelfShiftX + el.offsetWidth / 2,
      y: headerRect.top + oy + el.offsetHeight / 2,
    };
  }

  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const gestureOriginRef = useRef<ThemeOrigin>({ x: 0, y: 0 });
  const directionRef = useRef<1 | -1>(1);
  const nextThemeRef = useRef<Theme>("dark");
  const originalThemeRef = useRef<Theme>(theme);
  const animationRef = useRef<Animation | null>(null);
  const progressRef = useRef(0);
  const smoothedProgressRef = useRef(0);
  const scrubFrameRef = useRef<number | null>(null);
  const samplesRef = useRef<Sample[]>([]);
  const suppressClickRef = useRef(false);
  const themeFlippedRef = useRef(false);
  const revealSettledRef = useRef(false);
  const pendingReleaseRef = useRef<boolean | null>(null);
  const gestureIdRef = useRef(0);

  function applyDarkness(progress: number) {
    darkness.set(directionRef.current === 1 ? progress : 1 - progress);
  }

  function startScrubLoop() {
    let lastTime: number | null = null;

    function tick(now: number) {
      if (!draggingRef.current) {
        scrubFrameRef.current = null;
        return;
      }
      const dt = lastTime === null ? 16 : now - lastTime;
      lastTime = now;

      const target = progressRef.current;
      const alpha = 1 - Math.exp(-dt / SMOOTHING_TAU_MS);
      let smoothed = smoothedProgressRef.current + (target - smoothedProgressRef.current) * alpha;
      if (Math.abs(target - smoothed) < 0.0015) smoothed = target;
      smoothedProgressRef.current = smoothed;

      applyDarkness(smoothed);
      if (animationRef.current) {
        animationRef.current.currentTime = smoothed * viewTransition.durationMs;
      }
      scrubFrameRef.current = requestAnimationFrame(tick);
    }

    if (scrubFrameRef.current === null) {
      scrubFrameRef.current = requestAnimationFrame(tick);
    }
  }

  function pollAnimation(animation: Animation) {
    function tick() {
      if (animation.playState !== "running") {
        applyDarkness(animation.playbackRate > 0 ? 1 : 0);
        return;
      }
      const t = typeof animation.currentTime === "number" ? animation.currentTime : 0;
      applyDarkness(Math.min(1, Math.max(0, t / viewTransition.durationMs)));
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function revertToOriginalTheme() {
    setTheme(originalThemeRef.current);
    document.documentElement.setAttribute("data-theme", originalThemeRef.current);
    try {
      localStorage.setItem("theme", originalThemeRef.current);
    } catch {
      // Non-fatal.
    }
  }

  function finalizeWithoutAnimation(commit: boolean) {
    if (commit) {
      if (!themeFlippedRef.current) setTheme(nextThemeRef.current);
      darkness.set(nextThemeRef.current === "dark" ? 1 : 0);
    } else {
      if (themeFlippedRef.current) revertToOriginalTheme();
      darkness.set(originalThemeRef.current === "dark" ? 1 : 0);
    }
  }

  function applyDecisionToAnimation(animation: Animation, commit: boolean) {
    if (!commit) revertToOriginalTheme();
    animation.playbackRate = commit ? 1 : -1;
    animation.play();
    pollAnimation(animation);
  }

  function triggerFullTransition(origin: ThemeOrigin) {
    const next: Theme = theme === "dark" ? "light" : "dark";
    directionRef.current = next === "dark" ? 1 : -1;

    if (!supportsViewTransitions() || prefersReducedMotionNow()) {
      setTheme(next);
      darkness.set(next === "dark" ? 1 : 0);
      return;
    }

    void startLeafThemeReveal(next, origin, () => setTheme(next)).then((handle) => {
      if (!handle) {
        darkness.set(next === "dark" ? 1 : 0);
        return;
      }
      pollAnimation(handle.animation);
    });
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    gestureIdRef.current += 1;
    draggingRef.current = false;
    startXRef.current = event.clientX;
    progressRef.current = 0;
    smoothedProgressRef.current = 0;
    samplesRef.current = [{ x: event.clientX, t: event.timeStamp }];
    originalThemeRef.current = theme;
    nextThemeRef.current = theme === "dark" ? "light" : "dark";
    directionRef.current = nextThemeRef.current === "dark" ? 1 : -1;
    animationRef.current = null;
    themeFlippedRef.current = false;
    revealSettledRef.current = false;
    pendingReleaseRef.current = null;

    gestureOriginRef.current = measureOrigin(event.currentTarget);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Capture is a nice-to-have.
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.buttons === 0) return;
    const deltaX = event.clientX - startXRef.current;

    if (!draggingRef.current) {
      if (Math.abs(deltaX) < DRAG_THRESHOLD_PX) return;
      draggingRef.current = true;
      startScrubLoop();

      if (supportsViewTransitions() && !prefersReducedMotionNow()) {
        themeFlippedRef.current = true;
        const gestureId = gestureIdRef.current;

        void startLeafThemeReveal(
          nextThemeRef.current,
          gestureOriginRef.current,
          () => setTheme(nextThemeRef.current),
          { paused: true },
        ).then((handle) => {
          if (gestureIdRef.current !== gestureId) return; // superseded
          revealSettledRef.current = true;

          if (!handle) {
            if (pendingReleaseRef.current !== null) {
              const commit = pendingReleaseRef.current;
              pendingReleaseRef.current = null;
              finalizeWithoutAnimation(commit);
            }
            return;
          }

          animationRef.current = handle.animation;
          animationRef.current.currentTime = smoothedProgressRef.current * viewTransition.durationMs;

          if (pendingReleaseRef.current !== null) {
            const commit = pendingReleaseRef.current;
            pendingReleaseRef.current = null;
            applyDecisionToAnimation(animationRef.current, commit);
          }
        });
      }
    }

    progressRef.current = Math.min(1, Math.max(0, (directionRef.current * deltaX) / DRAG_RANGE_PX));

    samplesRef.current.push({ x: event.clientX, t: event.timeStamp });
    if (samplesRef.current.length > 6) samplesRef.current.shift();
  }

  function computeVelocity(): number {
    const samples = samplesRef.current;
    if (samples.length < 2) return 0;
    const first = samples[0];
    const last = samples[samples.length - 1];
    const dt = last.t - first.t;
    if (dt < 8) return 0;
    return (directionRef.current * (last.x - first.x)) / dt;
  }

  function commitOrCancel(commit: boolean) {
    if (animationRef.current) {
      applyDecisionToAnimation(animationRef.current, commit);
      return;
    }
    if (themeFlippedRef.current && !revealSettledRef.current) {
      pendingReleaseRef.current = commit;
      return;
    }
    finalizeWithoutAnimation(commit);
  }

  function endDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Already released.
    }
    if (!draggingRef.current) {
      draggingRef.current = false;
      return;
    }

    suppressClickRef.current = true;
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 400);

    const velocity = computeVelocity();
    let commit: boolean;
    if (velocity > FLICK_VELOCITY_PX_MS) commit = true;
    else if (velocity < -FLICK_VELOCITY_PX_MS) commit = false;
    else commit = progressRef.current >= 0.5;

    draggingRef.current = false; // stops the scrub loop before release takes over
    commitOrCancel(commit);
    animationRef.current = null;
  }

  function cancelDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Already released.
    }
    if (!draggingRef.current) return;

    suppressClickRef.current = true;
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 400);

    draggingRef.current = false;
    commitOrCancel(false);
    animationRef.current = null;
  }

  function handleClick(event: ReactMouseEvent<HTMLButtonElement>) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    gestureIdRef.current += 1;
    triggerFullTransition(measureOrigin(event.currentTarget));
  }

  return {
    darkness,
    handleClick,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp: endDrag,
    handlePointerCancel: cancelDrag,
  };
}
