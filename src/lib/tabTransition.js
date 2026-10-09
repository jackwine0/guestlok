import { useLayoutEffect, useRef, useState } from "react";

// Tab switching motion that works on every browser (no View Transitions needed):
// a dark pill glides from the old tab to the new one, and the section underneath
// rises in (see .gl-tab-in in index.css).

/**
 * Measures the active link (aria-current="page") inside `trackRef` and returns the
 * style for an absolutely positioned pill. The first placement doesn't animate;
 * later moves glide. Re-measures when the track resizes (fonts, badges, rotation).
 */
export function useSlidingPill(trackRef, activeKey) {
  const [rect, setRect] = useState(null);
  const placed = useRef(false);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const measure = () => {
      const el = track.querySelector('[aria-current="page"]');
      if (!el) return setRect(null);
      const next = { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
      setRect((r) => (r && r.x === next.x && r.y === next.y && r.w === next.w && r.h === next.h ? r : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    for (const child of track.children) if (!child.hasAttribute("aria-hidden")) ro.observe(child);
    return () => ro.disconnect();
  }, [trackRef, activeKey]);

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
