import { flushSync } from "react-dom";
import type { Theme } from "@/hooks/useTheme";
import { coverRadius, morphBlobPathD } from "@/utils/leaf";
import { viewTransition } from "@/utils/motion";

/**
 * Leaf theme reveal — a faithful port of the portfolio's `startThemeReveal`
 * (`src/utils/themeTransition.ts`), with the circular `clip-path` swapped for a
 * growing / retracting leaf silhouette.
 *
 * Returns a handle whose `animation` a drag can scrub via
 * `animation.currentTime` (see `useThemeToggleController`), or leave to play
 * out on a plain click.
 *
 * Reused verbatim from the portfolio:
 *  - the theme attribute is applied SYNCHRONOUSLY inside the transition
 *    callback (`flushSync`), so the snapshot the browser captures already has
 *    the destination theme's real colours;
 *  - `data-theme-transition` also suppresses the global colour CSS transition;
 *  - the entering layer gets an explicit starting `clip-path` (via `--leaf-clip`,
 *    set before the pseudo tree exists) so it never renders one frame unclipped;
 *  - a module-scoped guard so two toggles can't run overlapping transitions;
 *  - the WAAPI animation is cancelled on `finished` so a `fill: both` animation
 *    bound to `::view-transition-*(root)` can't re-attach to the next
 *    transition's freshly-created pseudo tree.
 *
 * ONE continuous shape from end to end. The clip is a ~1px circle at the toggle
 * origin that grows and — as it gets larger, so this is exact in both
 * directions — *becomes* a leaf (`morphBlobPathD`), then keeps expanding to
 * blanket the viewport. The small end is far inside the 24px knob sitting over
 * the origin, so no finite shape ever pops in (light→dark) or blinks out
 * (dark→light): the reveal emerges from behind the knob and retracts back
 * behind it.
 *
 * The reverse (dark → light) is the SAME keyframes, reversed, on the *outgoing*
 * dark layer — and because "leafness" is driven by the shape's size, not by
 * time or direction, the reverse is a pixel-exact mirror.
 */

export interface ThemeOrigin {
  x: number;
  y: number;
}

interface ViewTransitionLike {
  ready: Promise<void>;
  finished: Promise<void>;
  skipTransition: () => void;
}

export interface ThemeRevealHandle {
  transition: ViewTransitionLike;
  animation: Animation;
  enteringDark: boolean;
}

export function supportsViewTransitions(): boolean {
  return typeof document !== "undefined" && "startViewTransition" in document;
}

export function prefersReducedMotionNow(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function startViewTransition(cb: () => void): ViewTransitionLike | null {
  const doc = document as unknown as { startViewTransition?: (cb: () => void) => ViewTransitionLike };
  return typeof doc.startViewTransition === "function" ? doc.startViewTransition(cb) : null;
}

let activeTransition: ViewTransitionLike | null = null;
let activeAnimation: Animation | null = null;

/** Frames across the reveal. Many, so the circle→leaf morph — which happens in
 *  the first third of the timeline — gets ~10 frames to interpolate over. Each
 *  frame is a short path string; Chrome interpolates `clip-path: path()`
 *  between these structurally-identical paths. Reverse is
 *  `[...frames].reverse()` — a pixel-exact mirror. */
const STEPS = 32;

/** Timeline fraction over which the circle becomes a leaf. The radius keeps
 *  growing linearly the whole time (unchanged from before) — only the *shape*
 *  finishes early, so a formed leaf is visible before it blankets the viewport,
 *  and a slow drag reads as circle → transitional → leaf across its first third
 *  then a leaf scaling up. */
const MORPH_END_T = 0.3;

/** Slight final tilt of the settled leaf; the circle end stays upright. */
const LEAF_END_ROT = -0.12;

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function leafKeyframes(origin: ThemeOrigin, endR: number): string[] {
  const r0 = 1; // a point — hidden behind the 24px knob sitting over the origin
  const frames: string[] = [];
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    const r = r0 + (endR - r0) * t; // linear in the timeline, exactly as before
    const leafness = clamp01(t / MORPH_END_T);
    frames.push(`path("${morphBlobPathD(origin.x, origin.y, r, leafness, LEAF_END_ROT)}")`);
  }
  return frames;
}

export async function startLeafThemeReveal(
  next: Theme,
  origin: ThemeOrigin,
  applyTheme: () => void,
  options: { paused?: boolean } = {},
): Promise<ThemeRevealHandle | null> {
  const root = document.documentElement;
  const enteringDark = next === "dark";

  // Never let two transitions run at once — skip whatever's still settling.
  try {
    activeAnimation?.cancel();
    activeTransition?.skipTransition();
  } catch {
    // Already settled.
  }
  activeAnimation = null;
  activeTransition = null;

  const endR = coverRadius(origin.x, origin.y, window.innerWidth, window.innerHeight);
  const grow = leafKeyframes(origin, endR);
  // dark→light retracts: the same silhouette, reversed.
  const keyframes = enteringDark ? grow : [...grow].reverse();
  const pseudo = enteringDark ? "::view-transition-new(root)" : "::view-transition-old(root)";

  // Establish the starting clip BEFORE the pseudo tree exists (index.css reads
  // it on the first frame — path() can't take a var(), so the whole path string
  // is the custom-property value).
  root.style.setProperty("--leaf-clip", keyframes[0]);
  root.style.setProperty("--reveal-x", `${origin.x}px`);
  root.style.setProperty("--reveal-y", `${origin.y}px`);
  root.setAttribute("data-theme-transition", enteringDark ? "to-dark" : "to-light");

  const transition = startViewTransition(() => {
    flushSync(applyTheme);
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Non-fatal.
    }
  });
  if (!transition) {
    flushSync(applyTheme);
    root.setAttribute("data-theme", next);
    root.removeAttribute("data-theme-transition");
    root.style.removeProperty("--leaf-clip");
    return null;
  }
  activeTransition = transition;
  let ownAnimation: Animation | null = null;

  const tidy = () => {
    ownAnimation?.cancel();
    if (activeAnimation === ownAnimation) activeAnimation = null;
    if (activeTransition !== transition) return;
    root.removeAttribute("data-theme-transition");
    root.style.removeProperty("--leaf-clip");
    root.style.removeProperty("--reveal-x");
    root.style.removeProperty("--reveal-y");
    activeTransition = null;
  };
  transition.finished.then(tidy, tidy);
  // Belt-and-braces: if `finished` never resolves (skipped-transition edge
  // cases), the attribute must not be left on <html> where its pseudo overlay
  // could keep intercepting clicks.
  const safety = window.setTimeout(tidy, viewTransition.durationMs + 1200);
  void transition.finished.finally(() => window.clearTimeout(safety));

  try {
    await transition.ready;
  } catch {
    // Skipped/aborted — theme already applied via the callback.
    return null;
  }

  const animation = root.animate(
    { clipPath: keyframes },
    {
      duration: viewTransition.durationMs,
      easing: viewTransition.easing,
      pseudoElement: pseudo,
      fill: "both",
    },
  );
  if (options.paused) animation.pause();

  activeAnimation = animation;
  ownAnimation = animation;
  animation.finished.catch(() => {
    // Cancelled by a newer gesture.
  });

  return { transition, animation, enteringDark };
}
