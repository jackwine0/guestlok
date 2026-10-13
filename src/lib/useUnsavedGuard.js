import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useFeedback } from "./feedback.js";

/**
 * Warns before leaving a page with unsaved changes.
 * - Links inside the app: asks "Save and leave / Leave without saving / Keep editing".
 * - Refreshing or closing the tab: the browser's own "Leave site?" prompt.
 * save() must resolve to true when it saved.
 */
export function useUnsavedGuard(dirty, save, { what = "your changes" } = {}) {
  const navigate = useNavigate();
  const { confirm } = useFeedback();
  const live = useRef({ dirty, save });
  live.current = { dirty, save };

  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [dirty]);

  useEffect(() => {
    // Capture phase on document runs before React's handlers, so the link never navigates by itself.
    async function onClick(e) {
      if (!live.current.dirty || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest?.("a[href]");
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      e.preventDefault();
      e.stopPropagation();

      const answer = await confirm({
        title: "Save your changes?",
        body: `You changed ${what} but haven’t saved yet. If you leave now, the changes are lost.`,
        confirmLabel: "Save and leave",
        extraLabel: "Leave without saving",
        cancelLabel: "Keep editing",
      });
      if (answer === false) return;
      if (answer === true && !(await live.current.save())) return;
      live.current.dirty = false;
      navigate(url.pathname + url.search + url.hash);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [confirm, navigate, what]);
}
