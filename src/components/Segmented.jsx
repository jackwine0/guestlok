import { useRef } from "react";
import { useSlidingPill } from "../lib/tabTransition.js";

const TONES = {
  // light surfaces (cards, page)
  tile: { track: "bg-tile", pill: "bg-brown", on: "text-cream", off: "text-brown-soft hover:text-brown", count: ["text-white/70", "text-mute"] },
  white: { track: "bg-white border border-sand", pill: "bg-brown", on: "text-cream", off: "text-brown-soft hover:text-brown", count: ["text-white/70", "text-mute"] },
  // dark surfaces (scanner, invitation preview)
  dark: { track: "bg-white/10", pill: "bg-ochre", on: "text-brown font-medium", off: "text-sand hover:text-cream", count: ["text-brown/70", "text-sand"] },
};

const EASE = "duration-[420ms] ease-[cubic-bezier(.3,1.25,.45,1)]";

/**
 * Pill switch with the same gliding highlight as the event tabs.
 *
 * options: [{ value, label, icon?: Component, count? }]
 * tone: "tile" | "white" | "dark"
 * fill: stretch to the container (equal-width items); grid2: 2×2 grid on phones
 * role: "tablist" (switches a panel) or "group" (filters; buttons use aria-pressed)
 */
export default function Segmented({
  options,
  value,
  onChange,
  label,
  tone = "tile",
  size = "md",
  fill = false,
  grid2 = false,
  role = "tablist",
  className = "",
}) {
  const trackRef = useRef(null);
  const pill = useSlidingPill(trackRef, value, "[data-on]");
  const t = TONES[tone];
  const h = size === "lg" ? "h-12 text-[15px]" : size === "sm" ? "h-9 text-sm" : "h-10 text-sm";
  const layout = grid2
    ? "grid grid-cols-2 sm:inline-flex rounded-[22px] sm:rounded-full"
    : fill
      ? "grid rounded-full"
      : "inline-flex rounded-full";

  return (
    <div
      ref={trackRef}
      role={role}
      aria-label={label}
      className={`relative isolate gap-1 p-1 ${layout} ${t.track} ${className}`}
      style={fill && !grid2 ? { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` } : undefined}
    >
      <span aria-hidden="true" className={`absolute left-0 top-0 -z-10 rounded-full ${t.pill} transition-[transform,width,height] ${EASE}`} style={pill} />
      {options.map(({ value: v, label: text, icon: Icon, count }) => {
        const on = v === value;
        return (
          <button
            key={v}
            type="button"
            data-on={on ? "" : undefined}
            {...(role === "tablist" ? { role: "tab", "aria-selected": on } : { "aria-pressed": on })}
            onClick={() => !on && onChange(v)}
            className={`${h} px-4 rounded-full whitespace-nowrap inline-flex items-center justify-center gap-2 select-none [-webkit-tap-highlight-color:transparent] transition-colors duration-300 active:scale-[0.96] ${on ? t.on : t.off}`}
          >
            {Icon && <Icon size={size === "lg" ? 17 : 15} aria-hidden="true" className="shrink-0" />}
            {text}
            {count != null && <span className={`text-xs tabular-nums ${on ? t.count[0] : t.count[1]}`}>{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
