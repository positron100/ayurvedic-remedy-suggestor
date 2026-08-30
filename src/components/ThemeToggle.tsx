import { useRef } from "react";
import { m, useTransform } from "framer-motion";
import type { Theme } from "@/hooks/useTheme";
import { useThemeToggleController } from "@/hooks/useThemeToggleController";

interface ThemeToggleProps {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const KNOB_TRAVEL_PX = 22;

/**
 * A quiet switch — neutral track, sliding knob, sun/moon cross-fade — driven by
 * one `darkness` value (0 = light, 1 = dark) from `useThemeToggleController`.
 *
 * A click runs the full leaf reveal; a drag scrubs it: how far you pull the
 * knob is how much of the new theme is revealed, released past halfway (or
 * flicked) it commits, otherwise it settles back. Same in reverse.
 *
 * The reveal opens from this knob — the origin is measured off its
 * `offsetParent` chain, anchored to the fixed `<header>` (see the controller).
 */
export function ThemeToggle({ theme, setTheme }: ThemeToggleProps) {
  const knobRef = useRef<HTMLSpanElement>(null);
  const { darkness, handleClick, handlePointerDown, handlePointerMove, handlePointerUp, handlePointerCancel } =
    useThemeToggleController(theme, setTheme, knobRef);

  const knobX = useTransform(darkness, [0, 1], [0, KNOB_TRAVEL_PX]);
  const sunOpacity = useTransform(darkness, [0, 0.5, 1], [1, 0, 0]);
  const sunRotate = useTransform(darkness, [0, 1], [0, 80]);
  const sunScale = useTransform(darkness, [0, 1], [1, 0.4]);
  const moonOpacity = useTransform(darkness, [0, 0.5, 1], [0, 0, 1]);
  const moonRotate = useTransform(darkness, [0, 1], [-80, 0]);
  const moonScale = useTransform(darkness, [0, 1], [0.4, 1]);

  return (
    <button
      type="button"
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      aria-pressed={theme === "dark"}
      className="relative flex h-8 w-14 shrink-0 touch-none items-center rounded-full border border-border bg-bg-subtle px-1 transition-colors select-none hover:border-border-strong"
    >
      <m.span
        ref={knobRef}
        style={{ x: knobX }}
        className="relative flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-bg-elevated text-fg shadow-sm"
      >
        <m.span
          style={{ opacity: sunOpacity, rotate: sunRotate, scale: sunScale }}
          className="absolute flex items-center justify-center"
        >
          <SunIcon />
        </m.span>
        <m.span
          style={{ opacity: moonOpacity, rotate: moonRotate, scale: moonScale }}
          className="absolute flex items-center justify-center"
        >
          <MoonIcon />
        </m.span>
      </m.span>
    </button>
  );
}

function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  );
}
