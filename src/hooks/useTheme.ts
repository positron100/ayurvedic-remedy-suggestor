import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

/**
 * The theme is already resolved and stamped onto `<html data-theme>` by the
 * inline script in index.html before React mounts, so we read it back from
 * there rather than recomputing (and risking a mismatch).
 */
function readInitialTheme(): Theme {
  const attr = document.documentElement.getAttribute("data-theme");
  return attr === "dark" ? "dark" : "light";
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("theme", theme);
    } catch {
      // Private mode / storage disabled — the in-memory state still works.
    }
  }, [theme]);

  return { theme, setTheme };
}
