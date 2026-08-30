/**
 * The leaf — one silhouette, shared by the opening reveal, the theme-change
 * reveal, and the small logo mark. Two cubic béziers meeting at a top and a
 * bottom point, widest in the middle: a calm, bilateral tulsi/bay-leaf shape.
 *
 * `r` is the half-width. Half-height is `r * HEIGHT_RATIO`, so the shape reads
 * as a leaf rather than an ellipse. `coverRadius()` tells the caller how large
 * `r` must be for the leaf to blanket a viewport from a given origin.
 */

export const HEIGHT_RATIO = 1.5;

/** Shared easing for every leaf motion — a soft organic settle, no bounce. */
export const LEAF_EASE_CSS = "cubic-bezier(0.22, 1, 0.32, 1)";
export const LEAF_EASE_ARRAY = [0.22, 1, 0.32, 1] as const;

function rotate(px: number, py: number, cx: number, cy: number, a: number): [number, number] {
  if (a === 0) return [px, py];
  const s = Math.sin(a);
  const c = Math.cos(a);
  const dx = px - cx;
  const dy = py - cy;
  return [cx + dx * c - dy * s, cy + dx * s + dy * c];
}

function n(v: number): string {
  return (Math.round(v * 100) / 100).toString();
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Smooth 0→1 ramp, flat slope at both ends. Clamps its input. */
function smoothstep(t: number): number {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * (3 - 2 * x);
}

/**
 * One path that is a CIRCLE at `leafness = 0` and the `leafPathD` leaf at
 * `leafness = 1`, morphing continuously between the two. Same `M + 2×C + Z`
 * command structure at every value, so any two outputs interpolate cleanly
 * (Chrome interpolates `clip-path: path()` between structurally-identical
 * paths).
 *
 * Used only by the theme reveal: the small end of the reveal then reads as the
 * round toggle knob growing and *becoming* a leaf, rather than a fully-formed
 * small leaf popping in beside the knob. `leafPathD` is untouched — the opening
 * overlay and the logo mark keep using it.
 *
 * The circle is a two-cubic approximation (handles at ±4/3·r); at the knob's
 * ~12px radius its ~5% side bulge is sub-pixel, and it is morphing regardless.
 */
export function morphBlobPathD(cx: number, cy: number, r: number, leafness: number, leafRot = 0): string {
  const k = smoothstep(leafness);
  const rot = leafRot * k; // circle unrotated; the leaf carries the tilt
  const heightRatio = lerp(1, HEIGHT_RATIO, k);
  const halfH = r * heightRatio;
  const c1x = lerp(4 / 3, 1.32, k);
  const c1y = lerp(-1, -0.42, k);
  const c2x = lerp(4 / 3, 1.05, k);
  const c2y = lerp(1, 0.62, k);

  const pts: [number, number][] = [
    [cx, cy - halfH], // top
    [cx + r * c1x, cy + halfH * c1y], // upper-right control
    [cx + r * c2x, cy + halfH * c2y], // lower-right control
    [cx, cy + halfH], // bottom
    [cx - r * c2x, cy + halfH * c2y], // lower-left control
    [cx - r * c1x, cy + halfH * c1y], // upper-left control
  ].map(([x, y]) => rotate(x, y, cx, cy, rot));

  const [t, c1, c2, b, c3, c4] = pts;
  return (
    `M ${n(t[0])} ${n(t[1])} ` +
    `C ${n(c1[0])} ${n(c1[1])} ${n(c2[0])} ${n(c2[1])} ${n(b[0])} ${n(b[1])} ` +
    `C ${n(c3[0])} ${n(c3[1])} ${n(c4[0])} ${n(c4[1])} ${n(t[0])} ${n(t[1])} Z`
  );
}

/**
 * SVG path `d` for a leaf centred at `(cx, cy)`, half-width `r`, rotated
 * `rotRad` radians. The command structure is fixed (M + 2×C + Z) so two
 * strings from this function are also interpolation-compatible if ever needed.
 */
export function leafPathD(cx: number, cy: number, r: number, rotRad = 0): string {
  const halfH = r * HEIGHT_RATIO;
  const pts: [number, number][] = [
    [cx, cy - halfH], // top
    [cx + r * 1.32, cy - halfH * 0.42], // upper-right control
    [cx + r * 1.05, cy + halfH * 0.62], // lower-right control
    [cx, cy + halfH], // bottom
    [cx - r * 1.05, cy + halfH * 0.62], // lower-left control
    [cx - r * 1.32, cy - halfH * 0.42], // upper-left control
  ].map(([x, y]) => rotate(x, y, cx, cy, rotRad));

  const [t, c1, c2, b, c3, c4] = pts;
  return (
    `M ${n(t[0])} ${n(t[1])} ` +
    `C ${n(c1[0])} ${n(c1[1])} ${n(c2[0])} ${n(c2[1])} ${n(b[0])} ${n(b[1])} ` +
    `C ${n(c3[0])} ${n(c3[1])} ${n(c4[0])} ${n(c4[1])} ${n(t[0])} ${n(t[1])} Z`
  );
}

/** A very large rectangle minus the leaf (even-odd), i.e. an opaque curtain
 *  with a leaf-shaped hole. Used by the opening overlay's `clip-path`. */
export function curtainPathD(cx: number, cy: number, r: number, rotRad = 0): string {
  return `M -20000 -20000 H 40000 V 40000 H -20000 Z ${leafPathD(cx, cy, r, rotRad)}`;
}

/** The smallest half-width `r` at which a leaf centred at `(x, y)` covers every
 *  corner of a `w × h` viewport, with margin. Accounts for the leaf being
 *  narrower than it is tall (the width axis is the binding constraint). */
export function coverRadius(x: number, y: number, w: number, h: number): number {
  const maxDx = Math.max(x, w - x);
  const maxDy = Math.max(y, h - y);
  const corner = Math.hypot(maxDx, maxDy);
  return corner * 1.25;
}
