import { featuresFor } from "../lib/plans.js";

/**
 * What the host is paying for, each feature with one line on what it does.
 * tone: 'dark' on brown panels, 'light' on white/tile. compact: titles only on phones.
 */
export default function WhatYouGet({ delivery = "self", tone = "light", columns = 1, compact = false, className = "" }) {
  const dark = tone === "dark";
  const list = featuresFor(delivery);
  return (
    <ul className={`grid gap-x-6 ${compact ? "gap-y-2.5" : "gap-y-4"} ${columns === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"} ${className}`}>
      {list.map((f) => {
        const plus = f.id === "plus";
        return (
          <li key={f.id} className={`flex items-start gap-3 ${plus && columns === 2 ? "sm:col-span-2" : ""}`}>
            <span
              className={`${compact ? "w-6 h-6" : "mt-0.5 w-8 h-8"} shrink-0 rounded-full inline-flex items-center justify-center ${
                plus ? (dark ? "bg-ochre text-brown" : "bg-brown text-cream") : dark ? "bg-white/10 text-ochre" : "bg-ochre text-brown"
              }`}
              aria-hidden="true"
            >
              <f.icon size={compact ? 12 : 15} />
            </span>
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2 text-[15px] leading-snug">
                {f.title}
                {plus && <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${dark ? "bg-ochre text-brown" : "bg-brown text-cream"}`}>Plus</span>}
              </span>
              {!compact && <span className={`mt-0.5 block text-[13px] leading-relaxed ${dark ? "text-sand" : "text-brown-soft"}`}>{f.what}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
