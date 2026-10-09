import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Wordmark } from "./Brand.jsx";

const SITE_LINKS = [
  ["How it works", "#how"],
  ["Features", "#features"],
  ["Pricing", "#pricing"],
  ["Questions", "#faq"],
];

/**
 * The one header for the public site. Same items in the same places at every size:
 * logo · section links (desktop) · account link · main button (tablet up) · menu (phones/tablets).
 * Sits flat on the dark hero, then turns into a floating dark pill once you scroll.
 */
export default function SiteHeader({ session, startHref }) {
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  const [current, setCurrent] = useState(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Highlight the section you're reading.
  useEffect(() => {
    const sections = SITE_LINKS.map(([, href]) => document.querySelector(href)).filter(Boolean);
    if (!sections.length || typeof IntersectionObserver !== "function") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setCurrent(`#${e.target.id}`);
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  // Menu open: lock page scroll, close on Escape.
  useEffect(() => {
    if (!menu) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && setMenu(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const account = session ? ["My events", "/app"] : ["Sign in", "/login"];

  const bar = (inMenu) => (
    <div
      className={`mx-auto w-full max-w-6xl h-14 sm:h-16 flex items-center gap-2 sm:gap-3 rounded-full transition-[background-color,box-shadow,padding] duration-300 ${
        scrolled && !inMenu ? "bg-brown/95 backdrop-blur shadow-[0_14px_40px_rgba(43,27,18,0.28)] pl-4 sm:pl-6 pr-1.5 sm:pr-2" : "pl-1 pr-0"
      }`}
    >
      <Link to="/" onClick={() => setMenu(false)} aria-label="Guestlok home" className="text-[24px] sm:text-[28px] shrink-0">
        <Wordmark disc="#EEB12F" hole="#2B1B12" />
      </Link>

      {!inMenu && (
        <nav aria-label="Sections" className="hidden lg:flex flex-1 justify-center gap-1">
          {SITE_LINKS.map(([label, href]) => (
            <a
              key={href}
              href={href}
              aria-current={current === href ? "location" : undefined}
              className={`h-10 px-4 rounded-full inline-flex items-center text-[15px] transition-colors ${
                current === href ? "bg-white/10 text-ochre" : "text-cream/85 hover:text-ochre"
              }`}
            >
              {label}
            </a>
          ))}
        </nav>
      )}
      <span className={`flex-1 ${inMenu ? "" : "lg:hidden"}`} />

      {!inMenu && (
        <>
          <Link
            to={account[1]}
            className="h-10 sm:h-11 px-4 rounded-full border-[1.5px] border-cream/35 hover:border-cream text-cream inline-flex items-center text-[14px] sm:text-[15px] font-medium whitespace-nowrap shrink-0 transition-colors"
          >
            {account[0]}
          </Link>
          <Link to={startHref} className="max-sm:hidden btn-ochre h-11 px-5 text-[15px] shrink-0">
            Plan your event
          </Link>
        </>
      )}
      <button
        type="button"
        onClick={() => setMenu((m) => !m)}
        aria-label={inMenu ? "Close menu" : "Open menu"}
        aria-expanded={menu}
        className={`lg:hidden w-10 h-10 sm:w-11 sm:h-11 shrink-0 rounded-full inline-flex items-center justify-center text-cream transition-colors ${
          inMenu ? "bg-white/10" : "bg-white/10 hover:bg-white/15"
        }`}
      >
        {inMenu ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
      </button>
    </div>
  );

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-40 px-3 sm:px-5 text-cream transition-[padding] duration-300 ${
          scrolled ? "pt-[max(0.75rem,env(safe-area-inset-top))]" : "pt-[max(0.5rem,env(safe-area-inset-top))]"
        }`}
      >
        {bar(false)}
      </header>

      {menu && (
        <div
          className="gl-fade fixed inset-0 z-50 bg-brown text-cream lg:hidden flex flex-col px-3 sm:px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
        >
          {bar(true)}
          <nav aria-label="Sections" className="mt-6 px-2 flex flex-col">
            {SITE_LINKS.map(([label, href]) => (
              <a
                key={href}
                href={href}
                onClick={() => setMenu(false)}
                className="py-4 border-b border-white/10 text-[clamp(28px,8vw,40px)] tracking-[-0.04em] leading-none hover:text-ochre"
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="mt-auto pt-8 px-2 grid gap-3 sm:grid-cols-2">
            <Link to={startHref} onClick={() => setMenu(false)} className="btn-ochre btn-lg">
              Plan your event <ArrowRight />
            </Link>
            <Link to={account[1]} onClick={() => setMenu(false)} className="btn btn-lg border-[1.5px] border-cream/40 text-cream">
              {account[0]}
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
