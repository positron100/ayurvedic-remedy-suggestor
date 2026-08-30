import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup, configure } from "@testing-library/react";

// The App-flow tests render the full tree (framer-motion + a lazily-imported,
// Suspense-wrapped result view) and drive it through compose → result. Under
// parallel workers that round trip can exceed the 1000ms default before the
// result heading is queryable, so `findBy*` / `waitFor` get more room.
configure({ asyncUtilTimeout: 5000 });

// `globals: false` in the vitest config means Testing Library's automatic
// afterEach cleanup is not registered — do it here so renders don't stack
// across tests.
afterEach(() => cleanup());

// jsdom lacks these; framer-motion and the composer's media-query hooks call them.
if (typeof window !== "undefined") {
  if (!window.matchMedia) {
    window.matchMedia = (query: string) =>
      ({
        // Tests run as if reduced motion is on: the assessment flow then skips
        // its timed processing screen and resolves synchronously, and framer
        // renders final states immediately.
        matches: query.includes("reduced-motion"),
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList;
  }
  // jsdom defines these as throwing stubs — override so framer-motion and
  // ResultFrame's scroll-to-top don't spew "Not implemented" noise.
  window.scrollTo = (() => {}) as typeof window.scrollTo;
  Element.prototype.scrollIntoView = () => {};

  // jsdom has no IntersectionObserver — the navbar's active-section hook uses
  // one. A no-op stub keeps it inert (the indicator just never appears in tests).
  if (!("IntersectionObserver" in window)) {
    class IO {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    }
    (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = IO;
    (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = IO;
  }
}
