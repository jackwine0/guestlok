import { Link } from "react-router-dom";
import { EVENT_STATUS } from "../lib/status.js";
import { KeyholeDisc, Wordmark } from "./Brand.jsx";
import { Sunburst } from "./HeroStage.jsx";

/** Title block used at the top of every signed-in page. */
export function PageHeader({ kicker, title, sub, actions, as: Tag = "h1" }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 px-1">
      <div className="min-w-0">
        {kicker && <p className="eyebrow mb-2">{kicker}</p>}
        <Tag className="page-title">{title}</Tag>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {actions && <div className="w-full sm:w-auto">{actions}</div>}
    </div>
  );
}

/** Live / Ended / Awaiting payment pill. */
export function StatusChip({ status, className = "" }) {
  const s = EVENT_STATUS[status] ?? EVENT_STATUS.draft;
  return <span className={`chip ${s.cls} ${className}`}>{s.text}</span>;
}

/** In-app empty / locked / not-found state, inside a white card. */
export function EmptyState({ icon: Icon, title, body, children }) {
  return (
    <div className="bento flex flex-col items-center text-center gap-3 py-14">
      <span className="w-16 h-16 rounded-full bg-tile inline-flex items-center justify-center" aria-hidden="true">
        {Icon ? <Icon size={26} /> : <KeyholeDisc className="w-9 h-9" disc="#2B1B12" hole="#F4F1EC" />}
      </span>
      <h2 className="section-title text-[24px]">{title}</h2>
      {body && <p className="text-brown-soft max-w-md">{body}</p>}
      {children && <div className="mt-2 flex flex-wrap justify-center gap-2.5">{children}</div>}
    </div>
  );
}

/**
 * Full-screen branded message for pages outside the app shell:
 * not found, invalid invite, closed scanner.
 * tone: "ochre" (guests) | "dark" (ushers).
 */
export function MessageScreen({ tone = "ochre", kicker, title, body, children }) {
  const dark = tone === "dark";
  return (
    <main className={`relative min-h-dvh overflow-hidden flex flex-col ${dark ? "bg-brown text-cream" : "bg-ochre text-brown"}`}>
      <div className={`pointer-events-none absolute left-1/2 top-1/2 w-[1100px] h-[1100px] -translate-x-1/2 -translate-y-1/2 ${dark ? "opacity-[0.12]" : "opacity-[0.18] [&_rect]:fill-brown"}`} aria-hidden="true">
        <Sunburst className="w-full h-full" />
      </div>
      <header className="relative px-6 pt-6">
        <Link to="/" className="text-[26px]" aria-label="Guestlok home">
          <Wordmark disc={dark ? "#EEB12F" : "#2B1B12"} hole={dark ? "#2B1B12" : "#EEB12F"} />
        </Link>
      </header>
      <div className="relative flex-1 flex flex-col items-center justify-center gap-5 px-6 pb-16 text-center">
        <KeyholeDisc className="w-20 h-20 sm:w-24 sm:h-24 gl-bob" disc={dark ? "#EEB12F" : "#2B1B12"} hole={dark ? "#2B1B12" : "#EEB12F"} />
        {kicker && <p className={`font-mono text-xs uppercase tracking-[0.16em] ${dark ? "text-sand" : "text-brown/70"}`}>{kicker}</p>}
        <h1 className="text-[44px] sm:text-[72px] font-normal tracking-[-0.045em] leading-[0.95] max-w-3xl">{title}</h1>
        {body && <p className={`max-w-md text-[17px] ${dark ? "text-sand" : ""}`}>{body}</p>}
        {children && <div className="mt-3 flex flex-col sm:flex-row gap-2.5">{children}</div>}
      </div>
    </main>
  );
}
