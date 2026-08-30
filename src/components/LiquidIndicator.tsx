import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { m, useMotionValue, useReducedMotion, useSpring, useTransform, useVelocity } from "framer-motion";
import { cn } from "@/lib/cn";

/**
 * Ported from the portfolio (`src/components/LiquidIndicator.tsx`), unchanged
 * except the `cn` import path. One element that never unmounts, springs between
 * items, and deforms in its own travel direction — squash-and-stretch derived
 * from the indicator's *own* spring velocity, so a jump across the whole bar
 * reads differently from a nudge to the next item. Idle cost is nothing:
 * framer stops driving a settled spring and every value here derives from one.
 */
interface LiquidIndicatorProps {
  containerRef: RefObject<HTMLElement | null>;
  getTarget: () => HTMLElement | null;
  orientation?: "horizontal" | "vertical" | "auto";
  className?: string;
  dependency: unknown;
  /** While true, re-measures every frame so a gesture can drive it. */
  live?: boolean;
  getOverride?: () => Partial<{ x: number; width: number; y: number; height: number }> | null;
}

const TRAVEL_SPRING = { stiffness: 320, damping: 30, mass: 0.9 } as const;
const SIZE_SPRING = { stiffness: 380, damping: 34, mass: 0.8 } as const;
const VELOCITY_FOR_MAX_STRETCH = 2600;
const MAX_STRETCH = 0.3;
const STRETCH_SPRING = { stiffness: 260, damping: 26, mass: 0.6 } as const;
const MAX_MEASURE_RETRIES = 3;

export function LiquidIndicator({
  containerRef,
  getTarget,
  orientation = "horizontal",
  className,
  dependency,
  live = false,
  getOverride,
}: LiquidIndicatorProps) {
  const reduceMotion = useReducedMotion();
  const measuredRef = useRef(false);
  // Deliberate (portfolio pattern): the caller passes inline arrows, so keeping
  // the latest one in a ref stops `measure` — and the layout effect that reads
  // it — from being invalidated on every render.
  const getTargetRef = useRef(getTarget);
  // oxlint-disable-next-line react/refs
  getTargetRef.current = getTarget;
  const getOverrideRef = useRef(getOverride);
  // oxlint-disable-next-line react/refs
  getOverrideRef.current = getOverride;
  const retriesRef = useRef(0);
  const retryFrameRef = useRef<number | null>(null);

  const x = useSpring(0, TRAVEL_SPRING);
  const y = useSpring(0, TRAVEL_SPRING);
  const width = useSpring(0, SIZE_SPRING);
  const height = useSpring(0, SIZE_SPRING);
  const opacity = useMotionValue(0);

  const usesX = orientation !== "vertical";
  const usesY = orientation !== "horizontal";
  const toStretch = (v: number, enabled: boolean) =>
    reduceMotion || !enabled ? 0 : Math.min(Math.abs(v) / VELOCITY_FOR_MAX_STRETCH, 1) * MAX_STRETCH;

  const velocityX = useVelocity(x);
  const velocityY = useVelocity(y);
  const stretchX = useSpring(
    useTransform(velocityX, (v) => toStretch(v, usesX)),
    STRETCH_SPRING,
  );
  const stretchY = useSpring(
    useTransform(velocityY, (v) => toStretch(v, usesY)),
    STRETCH_SPRING,
  );
  const scaleX = useTransform([stretchX, stretchY], ([sx, sy]: number[]) => 1 + sx - sy * 0.55);
  const scaleY = useTransform([stretchX, stretchY], ([sx, sy]: number[]) => 1 + sy - sx * 0.55);

  const measure = useCallback(() => {
    const target = getTargetRef.current();
    const container = containerRef.current;
    if (!target || !container) {
      if (retriesRef.current < MAX_MEASURE_RETRIES) {
        retriesRef.current += 1;
        cancelAnimationFrame(retryFrameRef.current ?? 0);
        // oxlint-disable-next-line react/immutability -- deliberate self-retry
        retryFrameRef.current = requestAnimationFrame(() => measure());
        return;
      }
      opacity.set(0);
      return;
    }
    retriesRef.current = 0;

    let next: { x: number; y: number; w: number; h: number } | null = null;
    let offsetX = 0;
    let offsetY = 0;
    let node: HTMLElement | null = target;
    while (node && node !== container) {
      offsetX += node.offsetLeft;
      offsetY += node.offsetTop;
      const parent = node.offsetParent as HTMLElement | null;
      if (!parent) break;
      if (parent === container) {
        next = { x: offsetX, y: offsetY, w: target.offsetWidth, h: target.offsetHeight };
        break;
      }
      node = parent;
    }
    if (!next) {
      const t = target.getBoundingClientRect();
      const c = container.getBoundingClientRect();
      next = { x: t.left - c.left, y: t.top - c.top, w: t.width, h: t.height };
    }
    const override = getOverrideRef.current?.();
    if (override) {
      next = {
        x: override.x ?? next.x,
        y: override.y ?? next.y,
        w: override.width ?? next.w,
        h: override.height ?? next.h,
      };
    }

    if (!next.w || !next.h) return;
    if (!measuredRef.current || reduceMotion) {
      measuredRef.current = true;
      x.jump(next.x);
      y.jump(next.y);
      width.jump(next.w);
      height.jump(next.h);
    } else {
      x.set(next.x);
      y.set(next.y);
      width.set(next.w);
      height.set(next.h);
    }
    opacity.set(1);
  }, [containerRef, reduceMotion, x, y, width, height, opacity]);

  useLayoutEffect(() => {
    retriesRef.current = 0;
    measure();
  }, [measure, dependency]);

  useEffect(() => () => cancelAnimationFrame(retryFrameRef.current ?? 0), []);

  useEffect(() => {
    if (!live) return;
    let frame = requestAnimationFrame(function tick() {
      measure();
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [live, measure]);

  useEffect(() => {
    window.addEventListener("resize", measure);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  return (
    <m.span
      aria-hidden="true"
      style={{ x, y, width, height, opacity, scaleX, scaleY }}
      className={cn("pointer-events-none absolute top-0 left-0", className)}
    />
  );
}
