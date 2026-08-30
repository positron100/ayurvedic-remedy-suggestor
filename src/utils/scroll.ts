/**
 * Bounded, predictable smooth scroll — ported from the portfolio
 * (`src/utils/scroll.ts`), unchanged.
 *
 * The browser's own smooth scroll sizes its duration from the distance; on a
 * tall page a far jump gets a very long decelerating tail that reads as "the
 * button did nothing". Driving it here means the far end of the page takes the
 * same fraction of a second as the near end. `behavior: "instant"` on each
 * frame is deliberate — the global `scroll-behavior: smooth` would otherwise
 * try to animate every one of these steps.
 *
 * A superseding call tears down the previous run's abort listeners as well as
 * stopping its frame, so sweeping the navbar drag across several items does not
 * leave a trail of attached wheel/touch/key listeners.
 */

const MAX_DURATION_MS = 850;
const MIN_DURATION_MS = 420;

let activeScroll: number | null = null;
let releaseActive: (() => void) | null = null;

function cancelActiveScroll() {
  if (activeScroll !== null) cancelAnimationFrame(activeScroll);
  activeScroll = null;
  releaseActive?.();
  releaseActive = null;
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;

  history.replaceState(null, "", `#${id}`);

  const start = window.scrollY;
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  const target = Math.min(el.getBoundingClientRect().top + start, maxScroll);
  const distance = target - start;

  cancelActiveScroll();

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion || Math.abs(distance) < 2) {
    window.scrollTo({ top: target, behavior: "instant" });
    return;
  }

  const duration = Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, Math.abs(distance) * 0.32));
  const startTime = performance.now();

  // Any real scroll input hands control straight back to the visitor.
  function abort() {
    cancelActiveScroll();
  }
  function detach() {
    window.removeEventListener("wheel", abort);
    window.removeEventListener("touchstart", abort);
    window.removeEventListener("keydown", abort);
  }
  window.addEventListener("wheel", abort, { passive: true });
  window.addEventListener("touchstart", abort, { passive: true });
  window.addEventListener("keydown", abort);
  releaseActive = detach;

  function step(now: number) {
    const t = Math.min(1, (now - startTime) / duration);
    window.scrollTo({ top: start + distance * easeInOutCubic(t), behavior: "instant" });
    if (t < 1) {
      activeScroll = requestAnimationFrame(step);
      return;
    }
    activeScroll = null;
    detach();
    releaseActive = null;
  }
  activeScroll = requestAnimationFrame(step);
}
