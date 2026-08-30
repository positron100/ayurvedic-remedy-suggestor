import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { AnimatePresence, m, useReducedMotion, type Variants } from "framer-motion";
import { navLinks, siteConfig } from "@/data/site";
import { useTheme } from "@/hooks/useTheme";
import { useActiveSection } from "@/hooks/useActiveSection";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LiquidIndicator } from "@/components/LiquidIndicator";
import { Magnetic } from "@/components/Magnetic";
import { cn } from "@/lib/cn";
import { duration, ease, hoverLift, spring } from "@/utils/motion";
import { scrollToSection } from "@/utils/scroll";

interface NavbarProps {
  mode: "landing" | "result";
  onRestart: () => void;
}

/**
 * Floating glass shell. On landing it carries the portfolio's liquid
 * navigation: a `LiquidIndicator` pill sits behind the active section and
 * springs (with squash-and-stretch) between items on hover, click, and — the
 * tactile part — a horizontal drag across the bar that moves the pill
 * continuously and navigates the instant it crosses into an item.
 *
 * Drag mechanics are the portfolio's: geometry cached once per gesture, refs
 * for the live pointer value, a movement threshold before anything counts as a
 * drag, a mostly-vertical gesture handed straight back to the page, and a short
 * click-suppression window after release.
 */

/** Section ids the indicator can point at (in bar order). "top" hides it. */
const SECTION_IDS = ["top", ...navLinks.map((l) => l.id)];
const NAV_MAGNET_STRENGTH = 5;
const DRAG_THRESHOLD_PX = 6;
/** A neighbour must be this much closer before it takes the drag from the one
 *  currently held — a dead zone so a pointer on a boundary can't oscillate. */
const TARGET_HYSTERESIS_PX = 14;

/**
 * The mobile menu opens as one gesture — a port of the portfolio's `menuPanel`
 * (`src/components/Navbar.tsx`). The panel unfolds from the hamburger's own
 * corner (`transformOrigin: top right`) and the items follow it out on a
 * stagger, so the button, the panel and the list read as one movement. Closing
 * runs the stagger backwards: the items retreat first, then the panel folds up
 * after them (`staggerDirection: -1`).
 *
 * Elasticity is an under-damped spring, not hand-authored keyframes — the
 * overshoot and small secondary wobble fall out of the physics. The two scale
 * axes are tuned apart (height bounces at damping 15, width only breathes at
 * 20); that difference is the "liquid" part. Transform and opacity only: the
 * open cannot reflow the page behind it.
 */
const menuPanel: Variants = {
  hidden: { opacity: 0, scaleY: 0.7, scaleX: 0.9, y: -10 },
  visible: {
    opacity: 1,
    scaleY: 1,
    scaleX: 1,
    y: 0,
    transition: {
      opacity: { duration: 0.15, ease: ease.standard },
      scaleY: { type: "spring", stiffness: 520, damping: 15, mass: 0.9 },
      scaleX: { type: "spring", stiffness: 460, damping: 20, mass: 0.9 },
      y: { type: "spring", stiffness: 520, damping: 20, mass: 0.9 },
      staggerChildren: 0.038,
      delayChildren: 0.05,
    },
  },
  exit: {
    opacity: 0,
    scaleY: 0.55,
    scaleX: 0.9,
    y: -6,
    // Drop the blur for the collapse only: a `backdrop-filter` re-blurs
    // everything behind it on every transforming frame, which is the most
    // expensive paint on a phone. An explicit no-op filter, not `"none"` —
    // Framer resolves `"none"` component-wise and would greyscale the backdrop.
    backdropFilter: "blur(0px) saturate(1)",
    transition: {
      staggerChildren: 0.008,
      staggerDirection: -1,
      scaleY: { type: "spring", stiffness: 360, damping: 21, mass: 0.9, delay: 0.07, restDelta: 0.004 },
      scaleX: { type: "spring", stiffness: 360, damping: 26, mass: 0.9, delay: 0.07, restDelta: 0.004 },
      y: { type: "spring", stiffness: 360, damping: 26, mass: 0.9, delay: 0.07 },
      opacity: { duration: 0.26, delay: 0.1, ease: ease.exit },
      backdropFilter: { duration: 0 },
    },
  },
};

/** Menu item — a port of the portfolio's `menuItem`. Its spring is stiffer and
 *  better damped than the panel's, so items settle *inside* the container while
 *  it is still finding its last few percent: they read as contents of a liquid
 *  object, not a second animation alongside it. Out ahead of the panel on
 *  close (opacity + y only). */
const menuItem: Variants = {
  hidden: { opacity: 0, y: -12, scale: 0.94 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 560, damping: 24, mass: 0.7 } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.1, ease: ease.standard } },
};

/** Reduced motion — same three states, no springs, near-instant. */
const reducedPanel: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.01, staggerChildren: 0 } },
  exit: { opacity: 0, transition: { duration: 0.01 } },
};
const reducedItem: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.01 } },
  exit: { opacity: 0, transition: { duration: 0.01 } },
};

export function Navbar({ mode, onRestart }: NavbarProps) {
  const { theme, setTheme } = useTheme();
  const reduceMotion = useReducedMotion();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [dragTargetId, setDragTargetId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // SECTION_IDS is a stable module constant, so the observer isn't rebuilt on
  // every render. In result mode the sections don't exist and it no-ops.
  const activeId = useActiveSection(SECTION_IDS);
  const currentId = pendingId ?? activeId;

  const navRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const mobileNavRef = useRef<HTMLDivElement>(null);
  const mobileItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const menuVisible = menuOpen && mode === "landing";
  useEffect(() => {
    if (!menuVisible) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuVisible]);

  // While the menu is open the page behind it is pinned, so a stray vertical
  // swipe on a stationary menu can't scroll the hero away. The lock is released
  // the instant a drag actually starts (so `scrollToSection` can move the page
  // while the finger is still down) and synchronously on tap — see
  // `handleMobilePointerMove` and `handleNavClick`. (Portfolio pattern.)
  useEffect(() => {
    document.body.style.overflow = menuVisible ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuVisible]);

  // Hand control back to the scroll observer once it agrees with a pending nav
  // (portfolio pattern — synchronising with the IntersectionObserver's output).
  useEffect(() => {
    if (isDragging) return;
    // oxlint-disable-next-line react/set-state-in-effect
    if (pendingId && activeId === pendingId) setPendingId(null);
  }, [activeId, pendingId, isDragging]);

  function handleNavClick(id: string) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    setMenuOpen(false);
    setPendingId(id === "top" ? null : id);
    // Release the scroll lock synchronously: a smooth scroll started while the
    // body is `overflow: hidden` is dropped, and the effect above only clears
    // it after the next commit — too late for `scrollToSection`.
    document.body.style.overflow = "";
    scrollToSection(id);
  }

  function onBrand() {
    if (mode === "result") onRestart();
    else handleNavClick("top");
  }

  // --- desktop drag-to-navigate ------------------------------------------
  const draggingRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0 });
  const pointerXRef = useRef(0);
  const suppressClickRef = useRef(false);
  const geometryRef = useRef<{ id: string; left: number; width: number; centre: number }[]>([]);
  const dragTargetRef = useRef<string | null>(null);

  function cacheGeometry() {
    const nav = navRef.current;
    if (!nav) return;
    geometryRef.current = navLinks.flatMap((link) => {
      const el = itemRefs.current[link.id];
      if (!el) return [];
      const left = el.offsetLeft;
      return [{ id: link.id, left, width: el.offsetWidth, centre: left + el.offsetWidth / 2 }];
    });
  }

  function resolveTarget(localX: number) {
    const items = geometryRef.current;
    if (!items.length) return null;
    let best = items[0];
    for (const item of items) {
      if (Math.abs(item.centre - localX) < Math.abs(best.centre - localX)) best = item;
    }
    const held = items.find((i) => i.id === dragTargetRef.current);
    if (!held || held.id === best.id) return best;
    const gain = Math.abs(held.centre - localX) - Math.abs(best.centre - localX);
    return gain > TARGET_HYSTERESIS_PX ? best : held;
  }

  function activateTarget(id: string) {
    dragTargetRef.current = id;
    setDragTargetId(id);
    setPendingId(id);
    // `scrollToSection` cancels whatever run is in flight before starting its
    // own, so sweeping the drag across items does not queue multiple scrolls —
    // each new target replaces the last and the newest always wins.
    scrollToSection(id);
  }

  /** Read by the indicator each frame while dragging: a continuous free
   *  position that interpolates between items, plus the targeted item's width. */
  function dragOverride() {
    if (!draggingRef.current) return null;
    const nav = navRef.current;
    const items = geometryRef.current;
    if (!nav || !items.length) return null;
    const localX = pointerXRef.current - nav.getBoundingClientRect().left;
    const target = resolveTarget(localX);
    if (!target) return null;
    if (dragTargetRef.current !== target.id) activateTarget(target.id);
    const first = items[0];
    const last = items[items.length - 1];
    const x = Math.min(Math.max(localX - target.width / 2, first.left), last.left + last.width - target.width);
    return { x, width: target.width };
  }

  function handleNavPointerDown(e: ReactPointerEvent<HTMLElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    draggingRef.current = false;
    startRef.current = { x: e.clientX, y: e.clientY };
    pointerXRef.current = e.clientX;
    cacheGeometry();
  }

  function handleNavPointerMove(e: ReactPointerEvent<HTMLElement>) {
    if (e.buttons === 0) return;
    pointerXRef.current = e.clientX;
    if (draggingRef.current) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    if (Math.abs(dx) < DRAG_THRESHOLD_PX) return;
    if (Math.abs(dy) > Math.abs(dx)) return; // vertical → belongs to the page
    draggingRef.current = true;
    setIsDragging(true);
    dragTargetRef.current = currentId === "top" ? navLinks[0].id : currentId;
    setDragTargetId(dragTargetRef.current);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Capture is a nice-to-have.
    }
  }

  function handleNavPointerUp(e: ReactPointerEvent<HTMLElement>) {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Already released.
    }
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setIsDragging(false);
    suppressClickRef.current = true;
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 300);
    const landed = dragTargetRef.current;
    dragTargetRef.current = null;
    setDragTargetId(null);
    if (landed) setPendingId(landed);
  }

  // --- mobile drag-to-navigate -----------------------------------------
  // The desktop gesture turned on its side — a port of the portfolio's mobile
  // block. Geometry cached once per gesture from `offsetTop`/`offsetHeight`
  // (layout values, which transforms can't reach); the finger touches the panel
  // where it is *drawn*, so `mobileScaleRef` (the panel's live vertical scale
  // while it springs open) converts the visual pointer offset into that same
  // layout space. Crossing detection runs from the pointer handler at input
  // rate, not from the indicator's render loop.
  const mobileDraggingRef = useRef(false);
  const mobileStartRef = useRef({ x: 0, y: 0 });
  const mobilePointerYRef = useRef(0);
  const mobileGeometryRef = useRef<{ id: string; top: number; height: number; centre: number }[]>([]);
  const mobileScaleRef = useRef(1);

  function cacheMobileGeometry() {
    const nav = mobileNavRef.current;
    if (!nav) return;
    const rect = nav.getBoundingClientRect();
    mobileScaleRef.current = nav.offsetHeight > 0 ? rect.height / nav.offsetHeight : 1;
    mobileGeometryRef.current = navLinks.flatMap((link) => {
      const el = mobileItemRefs.current[link.id];
      if (!el) return [];
      const top = el.offsetTop;
      return [{ id: link.id, top, height: el.offsetHeight, centre: top + el.offsetHeight / 2 }];
    });
  }

  /** Pointer position in the list's own layout space. */
  function mobileLocalY() {
    const nav = mobileNavRef.current;
    if (!nav) return 0;
    const scale = mobileScaleRef.current || 1;
    return (mobilePointerYRef.current - nav.getBoundingClientRect().top) / scale;
  }

  function resolveMobileTarget(localY: number) {
    const items = mobileGeometryRef.current;
    if (!items.length) return null;
    let best = items[0];
    for (const item of items) {
      if (Math.abs(item.centre - localY) < Math.abs(best.centre - localY)) best = item;
    }
    const held = items.find((i) => i.id === dragTargetRef.current);
    if (!held || held.id === best.id) return best;
    const gain = Math.abs(held.centre - localY) - Math.abs(best.centre - localY);
    return gain > TARGET_HYSTERESIS_PX ? best : held;
  }

  /** Detect a crossing on the pointer event that caused it — at input rate,
   *  whatever the renderer is doing. `activateTarget` still fires only on a
   *  real change of item, so it can't restart the scroll on every sample. */
  function updateMobileTarget() {
    const nav = mobileNavRef.current;
    const items = mobileGeometryRef.current;
    if (!nav || !items.length) return;
    const target = resolveMobileTarget(mobileLocalY());
    if (target && dragTargetRef.current !== target.id) activateTarget(target.id);
  }

  /** Free vertical position for the indicator, clamped to the list. Pure —
   *  read once per frame while dragging. */
  function mobileDragOverride() {
    if (!mobileDraggingRef.current) return null;
    const nav = mobileNavRef.current;
    const items = mobileGeometryRef.current;
    if (!nav || !items.length) return null;
    const localY = mobileLocalY();
    const held = items.find((i) => i.id === dragTargetRef.current) ?? items[0];
    const first = items[0];
    const last = items[items.length - 1];
    const y = Math.min(Math.max(localY - held.height / 2, first.top), last.top + last.height - held.height);
    return { y, height: held.height };
  }

  function handleMobilePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    mobileDraggingRef.current = false;
    mobileStartRef.current = { x: e.clientX, y: e.clientY };
    mobilePointerYRef.current = e.clientY;
    cacheMobileGeometry();
  }

  function handleMobilePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    mobilePointerYRef.current = e.clientY;
    if (mobileDraggingRef.current) {
      updateMobileTarget();
      return;
    }
    const dx = e.clientX - mobileStartRef.current.x;
    const dy = e.clientY - mobileStartRef.current.y;
    if (Math.abs(dy) < DRAG_THRESHOLD_PX) return;
    if (Math.abs(dx) > Math.abs(dy)) return; // mostly-horizontal → not this gesture
    mobileDraggingRef.current = true;
    setIsDragging(true);
    dragTargetRef.current = currentId === "top" ? navLinks[0].id : currentId;
    setDragTargetId(dragTargetRef.current);
    // Hand the page back its scroll so `scrollToSection` can move it while the
    // finger is still down.
    document.body.style.overflow = "";
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Capture is a nice-to-have.
    }
    // Resolve on the sample that started the drag, so a fast flick across
    // several items still lands correctly.
    updateMobileTarget();
  }

  function endMobileDrag(e: ReactPointerEvent<HTMLDivElement>) {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Already released.
    }
    if (!mobileDraggingRef.current) return; // a plain tap — onClick owns it
    mobileDraggingRef.current = false;
    setIsDragging(false);
    suppressClickRef.current = true;
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 300);
    const landed = dragTargetRef.current;
    dragTargetRef.current = null;
    setDragTargetId(null);
    if (landed) setPendingId(landed);
    setMenuOpen(false);
  }

  const showIndicator = mode === "landing" && (isDragging || currentId !== "top" || hoveredId !== null);
  const indicatorTargetId = dragTargetId ?? hoveredId ?? (currentId === "top" ? null : currentId);

  return (
    <header className="fixed inset-x-0 top-3 z-50 sm:top-4">
      <div className="container-px mx-auto max-w-5xl">
        <div
          className={cn(
            "relative flex h-14 items-center justify-between rounded-full pr-2 pl-5 transition-[background-color,border-color,box-shadow] duration-300",
            scrolled || mode === "result"
              ? "border border-border/70 bg-bg/70 shadow-[0_10px_30px_-16px_hsl(var(--shadow-color)/0.5)] backdrop-blur-xl backdrop-saturate-150"
              : "border border-transparent bg-bg/25 backdrop-blur-sm",
          )}
        >
          {/* The one glass cue — a hairline of light along the top edge. */}
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-x-6 top-0 h-px rounded-full bg-gradient-to-r from-transparent via-fg/15 to-transparent transition-opacity duration-300",
              scrolled || mode === "result" ? "opacity-100" : "opacity-0",
            )}
          />

          <button type="button" onClick={onBrand} className="relative font-display text-lg font-medium tracking-tight text-fg">
            {siteConfig.name}
          </button>

          {mode === "landing" ? (
            <>
              <nav
                ref={navRef}
                aria-label="Primary"
                className="relative hidden touch-pan-y items-center gap-1 sm:flex"
                onMouseLeave={() => setHoveredId(null)}
                onPointerDown={handleNavPointerDown}
                onPointerMove={handleNavPointerMove}
                onPointerUp={handleNavPointerUp}
                onPointerCancel={handleNavPointerUp}
              >
                {/* Hover preview — under the active pill, deliberately fainter. */}
                <AnimatePresence>
                  {hoveredId && hoveredId !== indicatorTargetId && (
                    <m.span
                      key="hover-halo"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: duration.micro }}
                      className="pointer-events-none absolute inset-0"
                    >
                      <LiquidIndicator
                        containerRef={navRef}
                        getTarget={() => (hoveredId ? (itemRefs.current[hoveredId] ?? null) : null)}
                        dependency={hoveredId}
                        className="rounded-full bg-fg/[0.05]"
                      />
                    </m.span>
                  )}
                </AnimatePresence>

                {showIndicator && (
                  <LiquidIndicator
                    containerRef={navRef}
                    getTarget={() => (indicatorTargetId ? (itemRefs.current[indicatorTargetId] ?? null) : null)}
                    dependency={`${isDragging}:${indicatorTargetId}`}
                    live={isDragging}
                    getOverride={dragOverride}
                    className="rounded-full border border-accent/25 bg-accent-soft"
                  />
                )}

                {navLinks.map((link) => (
                  <Magnetic key={link.id} strength={NAV_MAGNET_STRENGTH} disabled={isDragging} className="inline-block">
                    <m.button
                      ref={(el) => {
                        itemRefs.current[link.id] = el;
                      }}
                      type="button"
                      onClick={() => handleNavClick(link.id)}
                      onMouseEnter={() => setHoveredId(link.id)}
                      onFocus={() => setHoveredId(link.id)}
                      onBlur={() => setHoveredId(null)}
                      whileHover={reduceMotion ? undefined : { ...hoverLift, transition: spring.indicator }}
                      whileTap={{ scale: 0.96 }}
                      aria-current={currentId === link.id ? "true" : undefined}
                      className={cn(
                        "relative rounded-full px-4 py-2 text-sm font-medium transition-colors",
                        currentId === link.id || dragTargetId === link.id ? "text-fg" : "text-fg-muted hover:text-fg",
                      )}
                    >
                      {link.label}
                    </m.button>
                  </Magnetic>
                ))}
              </nav>

              <div className="flex items-center gap-2">
                <ThemeToggle theme={theme} setTheme={setTheme} />
                <button
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-label={menuOpen ? "Close menu" : "Open menu"}
                  aria-expanded={menuOpen}
                  aria-controls="mobile-nav"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-fg-muted transition-colors hover:text-fg sm:hidden"
                >
                  <MenuGlyph open={menuOpen} />
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onRestart}
                className="rounded-full border border-border-strong px-4 py-1.5 text-sm font-medium text-fg-muted transition-colors hover:border-accent hover:text-fg"
              >
                New assessment
              </button>
              <ThemeToggle theme={theme} setTheme={setTheme} />
            </div>
          )}
        </div>

        <AnimatePresence>
          {menuVisible && (
            <m.nav
              id="mobile-nav"
              aria-label="Mobile"
              variants={reduceMotion ? reducedPanel : menuPanel}
              initial="hidden"
              animate="visible"
              exit="exit"
              // Unfolds from the hamburger's own corner, so the panel reads as
              // the button that opened it expanding into place.
              style={{ transformOrigin: "top right" }}
              className="relative mt-2 overflow-hidden rounded-3xl border border-border/70 bg-bg/70 shadow-[0_12px_40px_-16px_hsl(var(--shadow-color)/0.45)] backdrop-blur-md backdrop-saturate-150 sm:hidden"
            >
              {/* The one glass cue — a hairline of light along the top edge,
                  the same treatment the navbar shell uses, so the panel reads
                  as the same material rather than a second surface. */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-8 top-0 h-px rounded-full bg-gradient-to-r from-transparent via-fg/20 to-transparent"
              />

              <div
                ref={mobileNavRef}
                // `touch-action: none` scoped to this list only: inside it a
                // vertical drag belongs to the navigation; everywhere else on
                // the page native scrolling is untouched.
                className="relative flex touch-none flex-col gap-1 p-3"
                onPointerDown={handleMobilePointerDown}
                onPointerMove={handleMobilePointerMove}
                onPointerUp={endMobileDrag}
                onPointerCancel={endMobileDrag}
              >
                {(isDragging || currentId !== "top") && (
                  <LiquidIndicator
                    containerRef={mobileNavRef}
                    // Points at whatever the finger is over while dragging, so
                    // the pill's height morphs to the item being targeted;
                    // `getOverride` supplies the continuous position between.
                    getTarget={() => mobileItemRefs.current[dragTargetId ?? currentId] ?? null}
                    orientation="vertical"
                    // `isDragging` in the key for the same reason as desktop:
                    // the drag already set `pendingId`, so on release the id
                    // alone is unchanged and the indicator would keep the free
                    // position the gesture left it at, stranded between two
                    // items. Changing the key forces one measurement of the
                    // real element so the springs settle onto it.
                    dependency={`${isDragging}:${dragTargetId ?? currentId}`}
                    live={isDragging}
                    getOverride={mobileDragOverride}
                    className="rounded-2xl border border-accent/25 bg-accent-soft"
                  />
                )}
                {navLinks.map((link) => (
                  <m.button
                    key={link.id}
                    variants={reduceMotion ? reducedItem : menuItem}
                    ref={(el) => {
                      mobileItemRefs.current[link.id] = el;
                    }}
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleNavClick(link.id)}
                    aria-current={currentId === link.id ? "true" : undefined}
                    className={cn(
                      "relative rounded-2xl px-3 py-2.5 text-left text-base font-medium transition-colors",
                      currentId === link.id || dragTargetId === link.id ? "text-fg" : "text-fg-muted",
                    )}
                  >
                    {link.label}
                  </m.button>
                ))}
              </div>
            </m.nav>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}

/**
 * Three bars that *become* the close mark — a port of the portfolio's
 * `MenuIcon`. The outer two travel to the middle and cross; the middle one
 * thins out from its centre as they arrive. Transform and opacity only, no SVG
 * path morphing. Each bar animates independently to its own resting state, so
 * an open/close/open in quick succession is just three interrupted springs
 * that re-target and settle — the icon can't be left half-formed.
 */
function MenuGlyph({ open }: { open: boolean }) {
  const bar = "absolute left-0 h-[2px] w-4 rounded-full bg-current";
  const barSpring = { type: "spring" as const, stiffness: 500, damping: 32 };
  return (
    <span aria-hidden="true" className="relative block h-4 w-4">
      <m.span
        className={bar}
        style={{ top: 3 }}
        initial={false}
        animate={open ? { y: 5, rotate: 45 } : { y: 0, rotate: 0 }}
        transition={barSpring}
      />
      <m.span
        className={bar}
        style={{ top: 8 }}
        initial={false}
        animate={open ? { opacity: 0, scaleX: 0.3 } : { opacity: 1, scaleX: 1 }}
        transition={{ duration: duration.fast, ease: ease.standard }}
      />
      <m.span
        className={bar}
        style={{ top: 13 }}
        initial={false}
        animate={open ? { y: -5, rotate: -45 } : { y: 0, rotate: 0 }}
        transition={barSpring}
      />
    </span>
  );
}
