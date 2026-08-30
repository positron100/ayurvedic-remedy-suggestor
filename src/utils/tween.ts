/**
 * A minimal requestAnimationFrame tween. One update per painted frame, no
 * React state, cancellable. Used by the leaf reveals to drive a `clip-path`
 * string from geometry each frame (the value being animated is a path, not a
 * number, so WAAPI/CSS interpolation is sidestepped entirely).
 */
export interface TweenOptions {
  durationMs: number;
  /** Cubic-bezier control points, matching CSS `cubic-bezier(x1,y1,x2,y2)`. */
  easing?: readonly [number, number, number, number];
  onUpdate: (t: number) => void;
  onDone?: () => void;
}

function cubicBezier([x1, y1, x2, y2]: readonly [number, number, number, number]) {
  // Newton-Raphson solve for x(t) = p, then evaluate y(t). Cheap and accurate
  // enough for one frame at a time.
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const dX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (p: number) => {
    let t = p;
    for (let i = 0; i < 5; i++) {
      const x = sampleX(t) - p;
      const d = dX(t);
      if (Math.abs(x) < 1e-4 || d === 0) break;
      t -= x / d;
    }
    return sampleY(Math.min(1, Math.max(0, t)));
  };
}

export function tween({ durationMs, easing, onUpdate, onDone }: TweenOptions): () => void {
  const ease = easing ? cubicBezier(easing) : (p: number) => p;
  const start = performance.now();
  let raf = 0;
  let cancelled = false;

  function frame(now: number) {
    if (cancelled) return;
    const p = Math.min(1, (now - start) / durationMs);
    onUpdate(ease(p));
    if (p < 1) {
      raf = requestAnimationFrame(frame);
    } else {
      onDone?.();
    }
  }
  raf = requestAnimationFrame(frame);

  return () => {
    cancelled = true;
    cancelAnimationFrame(raf);
  };
}
