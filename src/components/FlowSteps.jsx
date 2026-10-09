import { Check } from "lucide-react";

/** The four stages a host goes through, shown on every onboarding screen. */
const FLOW = ["Event details", "Guests & plan", "Pay", "Set up"];

export default function FlowSteps({ current, className = "" }) {
  return (
    <ol className={`flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] ${className}`} aria-label="Progress">
      {FLOW.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex items-center gap-1.5 shrink-0">
            <span
              aria-current={active ? "step" : undefined}
              className={`h-10 pl-1.5 pr-4 rounded-full inline-flex items-center gap-2 text-sm transition ${
                active ? "bg-brown text-cream" : done ? "bg-white" : "bg-white/50 text-brown-soft"
              }`}
            >
              <span
                className={`w-7 h-7 rounded-full inline-flex items-center justify-center text-xs font-medium ${
                  active ? "bg-ochre text-brown" : done ? "bg-leaf text-white" : "bg-tile"
                }`}
              >
                {done ? <Check size={14} strokeWidth={2.6} aria-hidden="true" /> : i + 1}
              </span>
              <span className={active ? "" : "max-sm:hidden"}>{label}</span>
              {done && <span className="sr-only">(done)</span>}
            </span>
            {i < FLOW.length - 1 && <span className={`w-4 h-[2px] rounded-full ${done ? "bg-leaf" : "bg-white"}`} aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}
