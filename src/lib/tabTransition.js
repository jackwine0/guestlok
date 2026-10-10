import { useLayoutEffect, useRef, useState } from "react";

// Tab switching motion that works on every browser (no View Transitions needed):
// a dark pill glides from the old tab to the new one, and the section underneath
// rises in (see .gl-tab-in in index.css).

/**
 * Measures the active link (aria-current="page") inside `trackRef` and returns the
 * style for an absolutely positioned pill. The first placement doesn't animate;
 * later moves glide. Re-measures when the track resizes (fonts, badges, rotation).
 */
export function useSlidingPill(trackRef, activeKey, selector = '[aria-current="page"]') {
  const [rect, setRect] = useState(null);
  const placed = useRef(false);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const measure = () => {
      const el = track.querySelector(selector);
      if (!el) return setRect(null);
      const next = { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
      setRect((r) => (r && r.x === next.x && r.y === next.y && r.w === next.w && r.h === next.h ? r : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    for (const child of track.children) if (!child.hasAttribute("aria-hidden")) ro.observe(child);
    return () => ro.disconnect();
  }, [trackRef, activeKey, selector]);

  useLayoutEffect(() => {
    if (!rect || placed.current) return;
    // Let the first placement paint without a transition.
    const id = requestAnimationFrame(() => (placed.current = true));
    return () => cancelAnimationFrame(id);
  }, [rect]);

  if (!rect) return { display: "none" };
  return {
    width: rect.w,
    height: rect.h,
    transform: `translate3d(${rect.x}px, ${rect.y}px, 0)`,
    transition: placed.current ? undefined : "none",
  };
}

/**
 * Class for content that changes with a tab: it glides in from the side of the tab
 * you picked (same motion as the event tabs). Key the content by the tab so it re-mounts.
 */
export function useSwapMotion(index) {
  const ref = useRef({ index, cls: "" });
  if (ref.current.index !== index) {
    ref.current = { index, cls: index > ref.current.index ? "gl-tab-in gl-from-right" : "gl-tab-in gl-from-left" };
  }
  return ref.current.cls;
}
