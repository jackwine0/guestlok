import { useCallback, useLayoutEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

// Tab switches use the browser's View Transitions API: the dark pill glides to
// the new tab and the section underneath fades up. Browsers without it (or with
// reduced motion on) simply switch instantly.

let settle = null;

/** Call from the component that owns the tabs; resolves the transition once the new tab has rendered. */
export function useTabCommitted() {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    if (settle) {
      settle();
      settle = null;
    }
  }, [pathname]);
}

/** onClick handler for tab links: `onClick={(e) => go(e)}`. */
export function useTabNavigate() {
  const navigate = useNavigate();
  return useCallback(
    (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const href = e.currentTarget.getAttribute("href");
      if (!href || href === window.location.pathname) return;
      if (typeof document.startViewTransition !== "function") return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      e.preventDefault();
      const root = document.documentElement;
      // Only slide the page body when we're near the top; otherwise the old snapshot
      // would sit over the sticky header while it fades.
      root.dataset.glVt = window.scrollY < 60 ? "tab-page" : "tab";
      const vt = document.startViewTransition(
        () =>
          new Promise((resolve) => {
            settle = resolve;
            navigate(href);
            setTimeout(resolve, 400); // never hold the screen if something stalls
          }),
      );
      vt.finished.finally(() => {
        delete root.dataset.glVt;
      });
    },
    [navigate],
  );
}
