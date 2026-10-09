import { useEffect, useMemo, useRef, useState } from "react";
import HeroStage, { Sunburst } from "../components/HeroStage.jsx";
import YorubaPhrase from "../components/YorubaPhrase.jsx";
import {
  Armchair,
  Menu,
  Briefcase,
  ChartColumn,
  Check,
  Clock,
  Download,
  Gift,
  MessageCircleQuestion,
  Palette,
  Plus,
  Printer,
  Search,
  Send,
  UserPlus,
  Users,
  Utensils,
  WifiOff,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  KeyholeDisc,
  Loader,
  SunMark,
  Wordmark,
} from "../components/Brand.jsx";
import { useAuth } from "../lib/auth.jsx";
import { formatNaira } from "../lib/format.js";
import { useTitle } from "../lib/useTitle.js";
import { planPriceKobo, plusExtraKobo, plusPerGuestNaira, usePricing } from "../lib/pricing.js";

const STEPS = [
  { title: "Create your event", body: "Date, venue and how many people you’re expecting. Pay once for that size.", time: "5 min" },
  { title: "Add your guests", body: "Type names or upload your list. Set plus-ones and sides.", time: "10 min" },
  { title: "Send on WhatsApp", body: "Every guest gets their own invite with a personal QR. No app needed.", time: "1 tap each" },
  { title: "Scan at the gate", body: "Ushers scan with any phone. Each code works once. You watch arrivals live.", time: "½ second" },
];

const OCCASIONS = ["Weddings", "Owambes", "50th birthdays", "Naming ceremonies", "Burials", "Engagements", "House warmings", "Product launches", "Church events", "Reunions"];

const COMPARE = [
  ["Photocopied in minutes", "Every code works once"],
  ["Forwarded on WhatsApp", "The second person sees “Used”"],
  ["Ushers guess who’s real", "Ushers see one word: Valid"],
  ["You count heads afterwards", "Arrivals live on your phone"],
  ["Printing and dispatch riders", "Sent to everyone in minutes"],
];

const FEATURES = [
  { title: "Plus-ones, your rules", body: "“Admits 2” means two. Nobody brings their whole street.", icon: UserPlus },
  { title: "Sent on WhatsApp", body: "Every guest gets their own invite. Family can share the sending.", icon: Send },
  { title: "Your invite, your style", body: "Your photo, your colours, your words.", icon: Palette },
  { title: "Name lookup", body: "Dead battery? Ushers find guests by name.", icon: Search },
  { title: "Ask the host", body: "Not on the list but insists? You decide from your phone.", icon: MessageCircleQuestion },
  { title: "Live dashboard", body: "See who’s arrived as the gate scans.", icon: ChartColumn },
];
const ALSO = [
  ["Guests by side", Users],
  ["Printable tickets", Printer],
  ["Attendance download", Download],
];
const SOON = [
  ["Works offline", WifiOff],
  ["Table seating", Armchair],
  ["Planner accounts", Briefcase],
];

const FAQ = [
  {
    q: "Do my guests need to download an app?",
    a: "No. They tap the link in their WhatsApp invite and show the QR code at the gate. They can also save it as an image or PDF.",
  },
  {
    q: "What if someone forwards their invite?",
    a: "Each code opens the gate once. Whoever shows it second sees “Used” on the usher’s screen, along with the time it was first scanned.",
  },
  {
    q: "What about guests without smartphones?",
    a: "Print their ticket for them, or let ushers find them by name at the gate. Ushers check the last 4 digits of their phone number before letting them in.",
  },
  {
    q: "Who scans at the gate?",
    a: "Your ushers or security, with any phone that has a camera. You send them one scanner link. Several ushers can use it at the same time.",
  },
  {
    q: "What if someone not on the list insists they were invited?",
    a: "The usher taps “Ask the host”. You get the request on your dashboard and tap yes or no. A yes adds them to the list and lets them in.",
  },
  {
    q: "Can I change the details after sending invites?",
    a: "Yes. Change the time, venue or note in Settings and every guest sees the update the next time they open their invite.",
  },
  {
    q: "How much does it cost, and how do I pay?",
    a: "One payment per event, based on how many people you’re expecting. Every feature is included. Pay with card, bank transfer or USSD through Paystack. No subscriptions.",
  },
  {
    q: "Do I have to send 300 invites myself?",
    a: "No. Share the sending: give your sister, your planner or each family a private link, and they send their own guests’ invites from their WhatsApp. People get their invite from someone they know, and you watch the progress from your dashboard.",
  },
  {
    q: "What happens after the party?",
    a: "The gate closes 24 hours after the start time, or when you end the event. You can download the attendance list, and old invites show that the event has ended.",
  },
];

export default function Landing() {
  useTitle();
  const { session } = useAuth();
  const { tiers, settings } = usePricing();
  const startHref = session ? "/app/events/new" : "/login?next=/app/events/new";
  const [menu, setMenu] = useState(false);

  // Intro: roll-call loader once per visit, then the hero animates in and the pills drop.
  const [intro, setIntro] = useState(() => {
    try {
      if (sessionStorage.getItem("gl_intro_seen")) return "done";
    } catch {
      /* storage blocked */
    }
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "done" : "showing";
  });
  const [heroIn, setHeroIn] = useState(intro === "done");

  useEffect(() => {
    if (intro !== "showing") {
      const t = setTimeout(() => setHeroIn(true), 50);
      return () => clearTimeout(t);
    }
    let alive = true;
    const minWait = new Promise((r) => setTimeout(r, 1600));
    const fonts = document.fonts?.ready ?? Promise.resolve();
    Promise.all([minWait, fonts]).then(() => {
      if (!alive) return;
      try {
        sessionStorage.setItem("gl_intro_seen", "1");
      } catch {
        /* ignore */
      }
      setIntro("leaving");
      setHeroIn(true);
      setTimeout(() => alive && setIntro("done"), 550);
    });
    return () => {
      alive = false;
    };
  }, [intro]);

  const rise = (delay) => ({
    className: `transition-all duration-700 ease-out ${heroIn ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`,
    style: { transitionDelay: heroIn ? `${delay}ms` : "0ms" },
  });

  // Slim bar with the main button once you scroll past the hero.
  const [pastHero, setPastHero] = useState(false);
  useEffect(() => {
    const onScroll = () => setPastHero(window.scrollY > window.innerHeight * 0.9);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const fromPrice = tiers.length ? formatNaira(Math.min(...tiers.map((t) => t.price_kobo))) : null;
  const navLinks = [
    ["How it works", "#how"],
    ["Features", "#features"],
    ["Pricing", "#pricing"],
    ["Questions", "#faq"],
  ];
  const accountLink = (cls) => (
    <Link to={session ? "/app" : "/login"} className={cls}>
      {session ? "My events" : "Sign in"}
    </Link>
  );

  return (
    <div className="overflow-x-hidden">
      {intro !== "done" && (
        <div className={`fixed inset-0 z-50 transition-opacity duration-500 ${intro === "leaving" ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
          <Loader fullScreen label="Checking the list" />
        </div>
      )}

      {/* Sticky bar after the hero */}
      <div
        className={`fixed z-40 inset-x-0 top-0 transition duration-300 ${pastHero && !menu ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0 pointer-events-none"}`}
        aria-hidden={!pastHero}
      >
        <div className="mx-auto max-w-6xl px-3 sm:px-5 pt-3">
          <div className="flex items-center gap-2 rounded-full bg-brown/95 backdrop-blur text-cream pl-5 pr-1.5 py-1.5 shadow-[0_14px_40px_rgba(43,27,18,0.25)]">
            <Link to="/" aria-label="Guestlok home" className="text-[22px] min-w-0" tabIndex={pastHero ? 0 : -1}>
              <Wordmark disc="#EEB12F" hole="#2B1B12" />
            </Link>
            <nav className="hidden md:flex flex-1 justify-center gap-6 text-[14px]">
              {navLinks.map(([label, href]) => (
                <a key={href} href={href} tabIndex={pastHero ? 0 : -1} className="hover:text-ochre">{label}</a>
              ))}
            </nav>
            <span className="flex-1 md:hidden" />
            <Link to={session ? "/app" : "/login"} tabIndex={pastHero ? 0 : -1} className="max-[359px]:hidden px-2 sm:px-3 text-[14px] whitespace-nowrap hover:text-ochre">
              {session ? "My events" : "Sign in"}
            </Link>
            <Link to={startHref} tabIndex={pastHero ? 0 : -1} className="btn-ochre h-10 px-4 text-[14px] whitespace-nowrap shrink-0">
              Plan your event
            </Link>
            <button type="button" onClick={() => setMenu(true)} aria-label="Open menu" tabIndex={pastHero ? 0 : -1} className="md:hidden w-10 h-10 shrink-0 rounded-full bg-white/10 inline-flex items-center justify-center">
              <Menu size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {menu && (
        <div className="gl-fade fixed inset-0 z-50 bg-brown text-cream md:hidden flex flex-col px-5 pb-8" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="flex items-center justify-between py-4">
            <Link to="/" onClick={() => setMenu(false)} aria-label="Guestlok home" className="text-[26px]">
              <Wordmark disc="#EEB12F" hole="#2B1B12" />
            </Link>
            <button type="button" onClick={() => setMenu(false)} aria-label="Close menu" autoFocus className="w-11 h-11 rounded-full border-[1.5px] border-cream/40 inline-flex items-center justify-center">
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <nav className="mt-6 flex flex-col">
            {navLinks.map(([label, href]) => (
              <a key={href} href={href} onClick={() => setMenu(false)} className="py-4 border-b border-white/10 text-[34px] tracking-[-0.04em] leading-none">
                {label}
              </a>
            ))}
          </nav>
          <div className="mt-auto flex flex-col gap-3">
            <Link to={startHref} onClick={() => setMenu(false)} className="btn-ochre btn-lg">
              Plan your event <ArrowRight />
            </Link>
            {accountLink("btn btn-lg border-[1.5px] border-cream/40 text-cream")}
          </div>
        </div>
      )}

      {/* ---------------- HERO ---------------- */}
      <section className="relative bg-brown text-cream overflow-hidden pb-14 sm:pb-16">
        <div
          className="pointer-events-none absolute left-1/2 top-[62%] w-[1100px] h-[1100px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(238,177,47,.36), rgba(238,177,47,0) 60%)" }}
          aria-hidden="true"
        />
        <div className="pointer-events-none absolute left-1/2 top-[64%] w-[1300px] h-[1300px] -translate-x-1/2 -translate-y-1/2 opacity-[0.12]" aria-hidden="true">
          <Sunburst className="w-full h-full" />
        </div>

        <div className="relative mx-auto max-w-6xl px-5">
          <nav className="flex items-center justify-between gap-3 py-4 sm:py-5">
            <Link to="/" aria-label="Guestlok home" className="text-[26px] sm:text-[30px] shrink-0">
              <Wordmark disc="#EEB12F" hole="#2B1B12" />
            </Link>
            <div className="flex items-center gap-2 sm:gap-7 text-[15px] font-medium">
              {navLinks.slice(0, 3).map(([label, href]) => (
                <a key={href} href={href} className="hidden md:inline hover:text-ochre">{label}</a>
              ))}
              {accountLink("sm:hidden h-11 px-4 rounded-full border-[1.5px] border-cream/40 inline-flex items-center text-[14px] whitespace-nowrap")}
              {accountLink("hidden sm:inline hover:text-ochre")}
              <Link to={startHref} className="max-sm:hidden btn-ochre h-11 px-5 text-[15px]">Plan your event</Link>
              <button type="button" onClick={() => setMenu(true)} aria-label="Open menu" aria-expanded={menu} className="md:hidden w-11 h-11 rounded-full border-[1.5px] border-cream/40 inline-flex items-center justify-center">
                <Menu size={20} aria-hidden="true" />
              </button>
            </div>
          </nav>

          <div className="flex flex-col items-center text-center">
            <span className={`mt-8 sm:mt-14 inline-flex items-center gap-2 border-[1.5px] border-cream/40 rounded-full px-3.5 py-1.5 text-[13px] sm:text-[14px] font-medium ${rise(0).className}`} style={rise(0).style}>
              <span className="w-2 h-2 rounded-full bg-coral" aria-hidden="true" /> Guest-list control for Nigerian parties
            </span>

            <h1
              aria-label="Guests only."
              className={`mt-5 text-[clamp(72px,14vw,200px)] font-bold tracking-[-0.065em] leading-[0.86] ${rise(80).className}`}
              style={rise(80).style}
            >
              Guests{" "}
              <span className="whitespace-nowrap">
                <KeyholeDisc disc="#EEB12F" hole="#2B1B12" className="inline-block gl-turnkey" style={{ width: "0.6em", height: "0.6em", margin: "0 0.015em 0 0", verticalAlign: "-0.02em" }} />
                nly.
              </span>
            </h1>

            <p className={`mt-6 max-w-[580px] text-lg sm:text-xl leading-relaxed text-sand ${rise(160).className}`} style={rise(160).style}>
              Every guest gets a personal QR invite on WhatsApp. Ushers scan it once at the gate. The <YorubaPhrase dark /> crowd stays outside.
            </p>

            <div className={`mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 w-full sm:w-auto ${rise(240).className}`} style={rise(240).style}>
              <Link to={startHref} className="btn-ochre btn-lg px-7 w-full sm:w-auto max-w-xs">
                Plan your event <ArrowRight />
              </Link>
              <a href="#how" className="btn btn-lg px-7 w-full sm:w-auto max-w-xs border-[1.5px] border-cream/50 text-cream hover:bg-cream hover:text-brown">
                See how it works
              </a>
            </div>

            <ul className={`mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[14px] text-sand ${rise(300).className}`} style={rise(300).style}>
              {["No app for guests", "Any phone can scan", fromPrice ? `Pay once, from ${fromPrice}` : "Pay once per event"].map((t) => (
                <li key={t} className="inline-flex items-center gap-1.5">
                  <Check size={15} className="text-ochre" aria-hidden="true" /> {t}
                </li>
              ))}
            </ul>
          </div>

          <div className={`relative mt-10 sm:mt-14 ${rise(380).className}`} style={rise(380).style}>
            <HeroStage />
          </div>
        </div>
      </section>

      {/* ---------------- OCCASIONS BAND ---------------- */}
      <div className="bg-ochre text-brown overflow-hidden py-4 sm:py-5" aria-label="Made for weddings, owambes, birthdays, naming ceremonies, burials and more">
        <div className="flex w-max gl-marquee" aria-hidden="true">
          {[0, 1].map((k) => (
            <div key={k} className="flex items-center shrink-0">
              {OCCASIONS.map((o) => (
                <span key={o} className="flex items-center text-[22px] sm:text-[28px] font-medium tracking-[-0.03em] whitespace-nowrap">
                  <span className="px-5 sm:px-7">{o}</span>
                  <KeyholeDisc disc="#2B1B12" hole="#EEB12F" className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ---------------- PROBLEM ---------------- */}
      <Problem />

      {/* ---------------- HOW IT WORKS ---------------- */}
      <section id="how" className="px-5 py-16 sm:py-24 scroll-mt-20">
        <div className="mx-auto max-w-6xl flex flex-col gap-8 sm:gap-12">
          <SectionHead eyebrow="How it works" title="List to gate in four steps." sub="Most hosts are ready to send invites the same evening." />
          <ol className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((st, i) => {
              const last = i === STEPS.length - 1;
              return (
                <li key={st.title} className={`rounded-[28px] p-5 sm:p-7 flex max-sm:flex-row sm:flex-col gap-4 ${last ? "bg-brown text-cream" : "bg-white"}`}>
                  <span className={`w-11 h-11 sm:w-12 sm:h-12 shrink-0 rounded-full flex items-center justify-center text-lg font-semibold ${last ? "bg-ochre text-brown" : "bg-ochre"}`}>{i + 1}</span>
                  <div className="flex flex-col gap-2 sm:gap-3 min-w-0">
                    <h3 className="text-[20px] sm:text-[22px] font-medium tracking-[-0.03em] leading-tight">{st.title}</h3>
                    <p className={`leading-relaxed ${last ? "text-sand" : "text-brown-soft"}`}>{st.body}</p>
                    <span className={`self-start mt-1 h-7 px-3 rounded-full text-[13px] inline-flex items-center gap-1.5 ${last ? "bg-white/10" : "bg-tile"}`}>
                      <Clock size={13} aria-hidden="true" /> {st.time}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* ---------------- AT THE GATE ---------------- */}
      <section className="mx-0 sm:mx-5 bg-brown text-cream rounded-[36px] sm:rounded-[48px] px-5 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] items-center gap-8 lg:gap-14">
          <div className="flex flex-col gap-5">
            <span className="eyebrow text-ochre">At the gate</span>
            <h2 className="land-h2">Your usher sees one word.</h2>
            <p className="text-[17px] sm:text-lg leading-relaxed text-sand max-w-[440px]">
              No training and no arguments. The screen tells them what to do in half a second, and the system takes the blame, not you.
            </p>
            <p className="inline-flex items-start gap-3 rounded-[20px] bg-white/[0.07] p-4 text-[15px] max-w-[440px]">
              <MessageCircleQuestion size={20} className="shrink-0 text-ochre mt-0.5" aria-hidden="true" />
              <span>
                Someone insists they were invited? The usher taps <b className="font-medium">Ask the host</b> and you decide from your phone.
              </span>
            </p>
          </div>
          <div className="grid gap-2.5 sm:gap-4 grid-cols-3">
            <ResultTile tone="bg-leaf text-white" word="Valid" sub="Adaeze O. · Admits 2" icon={Check} />
            <ResultTile tone="bg-coral text-brown" word="Used" sub="Scanned at 2:14pm" icon={Clock} />
            <ResultTile tone="bg-cream text-brown" word="Not invited" sub="Code not on this list" icon={X} />
          </div>
        </div>
      </section>

      {/* ---------------- WHY NOT PRINTED CARDS ---------------- */}
      <section className="px-5 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl flex flex-col gap-8 sm:gap-12">
          <SectionHead eyebrow="Why Guestlok" title="Printed cards don’t stop anyone." sub="A photocopier, a WhatsApp forward or a confident smile gets past them. A single-use QR doesn’t." />
          <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2">
            <div className="rounded-[28px] bg-white p-5 sm:p-8">
              <p className="text-[15px] text-brown-soft">Printed cards and wristbands</p>
              <ul className="mt-4 flex flex-col">
                {COMPARE.map(([bad]) => (
                  <li key={bad} className="flex items-center gap-3 py-3.5 border-b border-tile last:border-0 text-[16px] text-brown-soft">
                    <span className="w-7 h-7 shrink-0 rounded-full bg-coral/15 text-[#9A3324] inline-flex items-center justify-center" aria-hidden="true">
                      <X size={14} strokeWidth={2.6} />
                    </span>
                    {bad}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-[28px] bg-brown text-cream p-5 sm:p-8">
              <p className="text-[15px] text-sand inline-flex items-center gap-2">
                <KeyholeDisc disc="#EEB12F" hole="#2B1B12" className="w-5 h-5" /> Guestlok
              </p>
              <ul className="mt-4 flex flex-col">
                {COMPARE.map(([, good]) => (
                  <li key={good} className="flex items-center gap-3 py-3.5 border-b border-white/10 last:border-0 text-[16px]">
                    <span className="w-7 h-7 shrink-0 rounded-full bg-ochre text-brown inline-flex items-center justify-center" aria-hidden="true">
                      <Check size={14} strokeWidth={2.8} />
                    </span>
                    {good}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- FEATURES ---------------- */}
      <section id="features" className="bg-white rounded-[36px] sm:rounded-[48px] px-5 py-16 sm:py-24 scroll-mt-20">
        <div className="mx-auto max-w-6xl flex flex-col gap-8 sm:gap-12">
          <SectionHead eyebrow="Features" title="Built for Nigerian parties." sub="The things that actually go wrong at our events, handled." />
          <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-paper rounded-[24px] sm:rounded-[28px] p-4 sm:p-7 flex flex-col gap-3 sm:gap-4 min-w-0">
                <span className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-ochre inline-flex items-center justify-center shrink-0" aria-hidden="true">
                  <f.icon className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2} />
                </span>
                <div className="flex flex-col gap-1 sm:gap-2">
                  <h3 className="text-[16px] sm:text-xl font-medium leading-tight tracking-[-0.02em]">{f.title}</h3>
                  <p className="text-[13px] sm:text-[15px] leading-snug sm:leading-relaxed text-brown-soft">{f.body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-4 -mt-2 sm:mt-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="max-sm:w-full text-sm text-brown-soft mr-1">Also included</span>
              {ALSO.map(([label, Icon]) => (
                <span key={label} className="h-10 px-4 rounded-full bg-paper inline-flex items-center gap-2 text-[14px]">
                  <Icon size={16} aria-hidden="true" /> {label}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="max-sm:w-full text-sm text-brown-soft mr-1">Coming soon</span>
              {SOON.map(([label, Icon]) => (
                <span key={label} className="h-10 px-4 rounded-full border-[1.5px] border-dashed border-sand inline-flex items-center gap-2 text-[14px] text-brown/70">
                  <Icon size={16} aria-hidden="true" /> {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- PRICING ---------------- */}
      <Pricing tiers={tiers} settings={settings} session={session} />

      {/* ---------------- FAQ ---------------- */}
      <Faq />

      {/* ---------------- FINAL CTA ---------------- */}
      <section className="px-5 pt-16 sm:pt-24 pb-20 sm:pb-28">
        <div className="relative overflow-hidden mx-auto max-w-6xl bg-ochre text-brown rounded-[36px] sm:rounded-[48px] px-6 py-14 sm:py-24 flex flex-col items-center text-center gap-6">
          <div className="pointer-events-none absolute left-1/2 top-1/2 w-[900px] h-[900px] -translate-x-1/2 -translate-y-1/2 opacity-[0.16] [&_rect]:fill-brown" aria-hidden="true">
            <Sunburst className="w-full h-full" />
          </div>
          <h2 className="relative text-[clamp(48px,7vw,104px)] font-medium tracking-[-0.055em] leading-[0.95]">
            Your party.
            <br />
            Your list.
          </h2>
          <p className="relative text-[17px] sm:text-lg max-w-md">Set up your event in minutes and send invites on WhatsApp today.</p>
          <div className="relative flex flex-col sm:flex-row gap-3 w-full sm:w-auto items-center">
            <Link to={startHref} className="btn-dark btn-lg px-7 w-full sm:w-auto max-w-xs">
              Plan your event <ArrowRight />
            </Link>
            <a href="#pricing" className="btn btn-lg px-7 w-full sm:w-auto max-w-xs border-[1.5px] border-brown hover:bg-brown hover:text-cream">
              See pricing
            </a>
          </div>
        </div>
      </section>

      <Footer startHref={startHref} />
    </div>
  );
}

/** Eyebrow + title + optional line, used by every section. */
function SectionHead({ eyebrow, title, sub, className = "" }) {
  return (
    <div className={`flex flex-col gap-3 max-w-2xl ${className}`}>
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h2 className="land-h2">{title}</h2>
      {sub && <p className="land-sub">{sub}</p>}
    </div>
  );
}

/** Small hook: true once the element has scrolled into view. */
function useInView(options = { threshold: 0.3 }) {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (!("IntersectionObserver" in window)) {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setSeen(true), options);
    io.observe(el);
    return () => io.disconnect();
  }, [seen]); // eslint-disable-line react-hooks/exhaustive-deps
  return [ref, seen];
}

const PAINS = [
  [Utensils, "Food finished before the first dance"],
  [Gift, "Souvenirs gone to strangers"],
  [Users, "Hall over capacity, real guests standing"],
];

/** "Sound familiar?": the gatecrasher problem, shown as a crowd of dots. */
function Problem() {
  const [ref, seen] = useInView();
  return (
    <section ref={ref} className="relative bg-white rounded-t-[36px] sm:rounded-t-[48px] px-5 py-16 sm:py-28">
      <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] items-center gap-10 lg:gap-16">
        <div className="flex flex-col gap-5 sm:gap-6">
          <h2 className="land-h2">Sound familiar?</h2>
          <p className="text-lg sm:text-[19px] leading-relaxed max-w-[500px]">
            You planned for 300. Five hundred showed up. Half of them you’d never met, and nobody at the gate could tell who was invited.
          </p>
          <ul className="flex flex-col gap-2">
            {PAINS.map(([Icon, text]) => (
              <li key={text} className="flex items-center gap-3 text-[16px]">
                <span className="w-9 h-9 shrink-0 rounded-full bg-coral/15 text-[#9A3324] inline-flex items-center justify-center" aria-hidden="true">
                  <Icon size={17} />
                </span>
                {text}
              </li>
            ))}
          </ul>
          <div className="mt-3 sm:mt-5 pt-6 border-t-[1.5px] border-sand max-w-[500px]">
            <p className="text-[clamp(28px,3.2vw,40px)] font-medium tracking-[-0.04em] leading-[1.1]">
              So who stops them? <span className="text-gold-ink">Guestlok.</span>
            </p>
            <p className="mt-3 text-[17px] leading-relaxed text-brown-soft">
              Every guest gets their own QR invite, and each one opens the gate once. Forwarded screenshots and photocopied cards simply don’t work.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:gap-4">
          <CrowdCard
            dark={false}
            title="Without a guest list at the gate"
            big="500"
            bigNote="came · you planned for 300"
            invited={30}
            extra={20}
            seen={seen}
            footer={
              <>
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-coral mr-2 align-middle" aria-hidden="true" />
                200 people you didn’t invite. The <YorubaPhrase /> crowd.
              </>
            }
          />
          <CrowdCard
            dark
            title="With Guestlok"
            big="300"
            bigNote="came · exactly who you invited"
            invited={30}
            extra={0}
            seen={seen}
            footer={
              <>
                <Check size={16} className="inline -mt-0.5 mr-1.5 text-ochre" aria-hidden="true" />
                Everyone else is politely stopped at the gate.
              </>
            }
          />
          <p className="text-xs text-brown-soft px-1">Each dot is 10 people.</p>
        </div>
      </div>
    </section>
  );
}

function CrowdCard({ dark, title, big, bigNote, invited, extra, seen, footer }) {
  const total = invited + extra;
  return (
    <div className={`rounded-[28px] sm:rounded-[32px] p-5 sm:p-7 ${dark ? "bg-brown text-cream" : "bg-paper"}`}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <p className={`text-[15px] ${dark ? "text-sand" : "text-brown-soft"}`}>{title}</p>
        <p className="tabular-nums">
          <span className="text-[34px] sm:text-[40px] font-medium tracking-[-0.04em] leading-none">{big}</span>
          <span className={`ml-2 text-sm ${dark ? "text-sand" : "text-brown-soft"}`}>{bigNote}</span>
        </p>
      </div>
      <div className="mt-4 grid grid-cols-[repeat(10,minmax(0,1fr))] sm:grid-cols-[repeat(25,minmax(0,1fr))] gap-1.5 sm:gap-1" role="img" aria-label={`${invited * 10} invited guests${extra ? ` and ${extra * 10} people who weren’t invited` : ""}`}>
        {Array.from({ length: 50 }, (_, i) => {
          const isGuest = i < invited;
          const isCrasher = i >= invited && i < total;
          const cls = isGuest ? (dark ? "bg-ochre" : "bg-brown") : isCrasher ? "bg-coral" : dark ? "bg-white/10" : "bg-sand/60";
          return (
            <span
              key={i}
              className={`aspect-square rounded-full ${cls} transition-all duration-500`}
              style={{ transitionDelay: seen ? `${i * 18}ms` : "0ms", transform: seen || !(isGuest || isCrasher) ? "scale(1)" : "scale(0)", opacity: seen || !(isGuest || isCrasher) ? 1 : 0 }}
            />
          );
        })}
      </div>
      <p className={`mt-4 text-[15px] ${dark ? "text-cream" : ""}`}>{footer}</p>
    </div>
  );
}

/** Questions: two columns on desktop, help card on the left. */
function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 bg-white rounded-[36px] sm:rounded-[48px] px-5 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl grid gap-8 lg:gap-16 grid-cols-1 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)] items-start">
        <div className="lg:sticky lg:top-8 flex flex-col gap-5">
          <span className="eyebrow">FAQ</span>
          <h2 className="land-h2">Questions hosts ask.</h2>
          <p className="text-lg text-brown-soft max-w-sm">Everything people want to know before their first Guestlok event.</p>
          <div className="mt-2 rounded-[28px] bg-brown text-cream p-6 max-lg:hidden">
            <p className="text-[22px] tracking-[-0.02em] leading-tight">Still not sure?</p>
            <p className="mt-2 text-sand text-[15px]">Tell us about your event and we’ll help you set it up.</p>
            <a href="mailto:hello@guestlok.com?subject=Question%20about%20my%20event" className="mt-5 btn-ochre w-full">
              hello@guestlok.com <ArrowRight />
            </a>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          {FAQ.map((f, i) => (
            <details key={f.q} open={i === 0} className="group rounded-[22px] sm:rounded-[26px] bg-paper open:bg-cream/60 transition-colors">
              <summary className="flex items-center justify-between gap-4 cursor-pointer list-none px-5 sm:px-6 py-4 sm:py-5 text-[17px] sm:text-[19px] font-medium tracking-[-0.01em] [&::-webkit-details-marker]:hidden">
                {f.q}
                <span className="w-9 h-9 shrink-0 rounded-full bg-white group-open:bg-brown group-open:text-cream inline-flex items-center justify-center transition" aria-hidden="true">
                  <Plus size={18} className="transition-transform duration-300 group-open:rotate-45" />
                </span>
              </summary>
              <p className="px-5 sm:px-6 pb-5 sm:pb-6 -mt-1 leading-relaxed text-brown-soft max-w-2xl">{f.a}</p>
            </details>
          ))}

          <div className="lg:hidden mt-3 rounded-[24px] bg-brown text-cream p-5 flex flex-col gap-4">
            <div>
              <p className="text-[20px] tracking-[-0.02em] leading-tight">Still not sure?</p>
              <p className="mt-1 text-sand text-[15px]">Tell us about your event and we’ll help you set it up.</p>
            </div>
            <a href="mailto:hello@guestlok.com?subject=Question%20about%20my%20event" className="btn-ochre">
              hello@guestlok.com <ArrowRight />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

const PLAN_INCLUDES = [
  "Personal QR invite for every guest",
  "Your photo, colours and message",
  "Gate scanner for all your ushers",
  "Name lookup and “Ask the host”",
  "Live dashboard and attendance download",
  "Share the sending with family or your planner",
];

const SENDING = {
  self: { label: "I’ll send them", short: "I send", line: "You send each invite from your own WhatsApp, one tap per guest. Included in every plan." },
  plus: { label: "Guestlok sends them", short: "Guestlok sends", line: "We send every invite at once from the official Guestlok WhatsApp, ticket attached, with Sent · Delivered · Read for each guest." },
};

/** Pricing: pick a headcount and who sends the invites; we point at the right plan and show the cost per guest. */
function Pricing({ tiers, settings, session }) {
  const maxTier = tiers.length ? tiers[tiers.length - 1].max_headcount : 500;
  const [guests, setGuests] = useState(150);
  const [choice, setDelivery] = useState("self");
  const delivery = settings.plus_enabled ? choice : "self";
  const best = useMemo(() => tiers.find((t) => t.max_headcount >= guests) ?? null, [tiers, guests]);
  const tooBig = tiers.length > 0 && !best;
  const price = (t) => planPriceKobo(t, delivery, settings);

  const planHref = (t) => {
    const path = `/app/events/new?plan=${t.id}&guests=${Math.min(guests, t.max_headcount)}&delivery=${delivery}`;
    return session ? path : `/login?next=${encodeURIComponent(path)}`;
  };
  const perGuest = (t, n) => formatNaira(Math.round(price(t) / Math.max(1, n) / 100) * 100);
  const plusPct = Math.round(Number(settings.plus_pct));

  return (
    <section id="pricing" className="scroll-mt-20 px-5 pt-2 sm:pt-6 pb-16 sm:pb-24">
      <div className="mx-auto max-w-6xl flex flex-col gap-8 sm:gap-10">
        <div className="grid gap-6 lg:gap-10 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-end">
          <div className="flex flex-col gap-3">
            <span className="eyebrow">Pricing</span>
            <h2 className="land-h2">Pay once per event.</h2>
            <p className="land-sub max-w-md">
              Priced by headcount. No subscriptions. Every plan has every feature{settings.plus_enabled ? ". You only choose who sends the invites." : "."}
            </p>
          </div>

          {/* Headcount picker */}
          <div className="rounded-[28px] sm:rounded-[32px] bg-brown text-cream p-6 sm:p-7">
            <div className="flex items-end justify-between gap-4">
              <label htmlFor="price-guests" className="text-sand text-[15px] leading-snug">
                How many people are
                <br className="sm:hidden" /> you expecting?
              </label>
              <p className="text-[44px] sm:text-[52px] leading-none tracking-[-0.04em] tabular-nums">
                {guests >= 1000 ? "1,000+" : guests.toLocaleString()}
              </p>
            </div>
            <input
              id="price-guests"
              type="range"
              min={20}
              max={1000}
              step={10}
              value={guests}
              onChange={(e) => setGuests(Number(e.target.value))}
              aria-valuetext={`${guests} guests`}
              className="gl-range gl-range-dark w-full mt-5"
            />
            <div className="mt-2 flex justify-between text-xs text-sand/70">
              <span>20</span>
              <span>Plus-ones count as guests</span>
              <span>1,000+</span>
            </div>
            <p className="mt-5 pt-5 border-t border-white/10 text-[16px] min-h-[48px]" aria-live="polite">
              {tooBig ? (
                <>For more than {maxTier.toLocaleString()} people we’ll set you up personally.</>
              ) : best ? (
                <>
                  <b className="font-medium text-ochre">
                    {best.name}
                    {delivery === "plus" ? " Plus" : ""}
                  </b>{" "}
                  fits {guests.toLocaleString()} guests for <b className="font-medium">{formatNaira(price(best))}</b>. That’s about{" "}
                  <b className="font-medium">{perGuest(best, guests)}</b> per guest.
                </>
              ) : (
                "Loading plans…"
              )}
            </p>
          </div>
        </div>

        {/* Who sends the invites (only while Plus is switched on) */}
        {settings.plus_enabled && (
        <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-5">
          <div role="radiogroup" aria-label="Who sends the invites?" className="grid grid-cols-2 p-[5px] rounded-full bg-white w-full md:w-auto md:inline-grid shrink-0">
            {["self", "plus"].map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={delivery === d}
                onClick={() => setDelivery(d)}
                className={`h-11 px-3 sm:px-5 rounded-full text-[14px] sm:text-[15px] whitespace-nowrap inline-flex items-center justify-center gap-2 transition ${
                  delivery === d ? "bg-brown text-cream" : "text-brown-soft hover:text-brown"
                }`}
              >
                <span className="sm:hidden">{SENDING[d].short}</span>
                <span className="max-sm:hidden">{SENDING[d].label}</span>
                {d === "plus" && <span className={`max-sm:hidden text-[11px] font-medium px-1.5 py-0.5 rounded-full ${delivery === d ? "bg-ochre text-brown" : "bg-tile"}`}>+{plusPct}%</span>}
              </button>
            ))}
          </div>
          <p className="text-[15px] text-brown-soft max-w-xl" aria-live="polite">
            {delivery === "plus" && <b className="font-medium text-brown">+{plusPct}% on any plan. </b>}
            {SENDING[delivery].line}
          </p>
        </div>
        )}

        {/* Plans */}
        <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-3 -mt-2 sm:-mt-4">
          {tiers.map((t) => {
            const on = best?.id === t.id;
            const fits = t.max_headcount >= guests;
            return (
              <div
                key={t.id}
                className={`relative rounded-[24px] sm:rounded-[28px] p-5 sm:p-7 transition-all duration-300 ${
                  on ? "bg-ochre md:-translate-y-2 shadow-[0_20px_40px_rgba(43,27,18,0.12)]" : "bg-white"
                } ${fits ? "" : "opacity-55"}`}
              >
                {/* Phone: compact row. Tablet up: card. */}
                <div className="flex md:flex-col items-center md:items-stretch gap-4 md:gap-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-xl font-medium">
                        {t.name}
                        {delivery === "plus" ? " Plus" : ""}
                      </h3>
                      {on && <span className="text-xs px-2.5 py-1 rounded-full bg-brown text-cream">Best fit</span>}
                    </div>
                    <p className={`mt-1 ${on ? "" : "text-brown-soft"}`}>Up to {t.max_headcount.toLocaleString()} guests</p>
                  </div>
                  <div className="text-right md:text-left md:mt-6">
                    <p className="text-[30px] md:text-[44px] font-medium tracking-[-0.04em] leading-none tabular-nums">{formatNaira(price(t))}</p>
                  </div>
                </div>
                <p className={`mt-2 md:mt-1.5 text-[13px] max-md:text-right ${on ? "text-brown/70" : "text-brown-soft"}`}>
                  {delivery === "plus"
                    ? `${formatNaira(t.price_kobo)} + ${formatNaira(plusExtraKobo(t, settings))} sending (₦${plusPerGuestNaira(t, settings)}/guest)`
                    : `${perGuest(t, t.max_headcount)} per guest when full`}
                </p>
                <Link
                  to={planHref(t)}
                  className={`mt-4 md:mt-7 w-full ${on ? "btn-dark" : "btn-outline"}`}
                  aria-label={`Choose the ${t.name}${delivery === "plus" ? " Plus" : ""} plan`}
                >
                  Choose {t.name}
                  {delivery === "plus" ? " Plus" : ""} <ArrowRight />
                </Link>
              </div>
            );
          })}
        </div>

        {/* What every plan includes + bigger events */}
        <div className="grid gap-3 sm:gap-4 grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="rounded-[24px] sm:rounded-[28px] bg-white p-5 sm:p-7">
            <p className="text-sm text-brown-soft">Every plan includes</p>
            <ul className="mt-4 grid gap-x-6 gap-y-3 grid-cols-1 sm:grid-cols-2">
              {PLAN_INCLUDES.map((item) => (
                <li key={item} className="flex items-start gap-3 text-[15px]">
                  <span className="mt-0.5 w-5 h-5 shrink-0 rounded-full bg-ochre inline-flex items-center justify-center">
                    <Check size={12} strokeWidth={3} aria-hidden="true" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <a
            href="mailto:hello@guestlok.com?subject=Big%20event"
            className={`group rounded-[24px] sm:rounded-[28px] p-5 sm:p-7 flex flex-col justify-between gap-6 transition ${tooBig ? "bg-ochre" : "bg-brown text-cream"}`}
          >
            <div>
              <p className={`text-sm ${tooBig ? "text-brown/70" : "text-sand"}`}>More than {maxTier.toLocaleString()} guests?</p>
              <p className="mt-2 text-[24px] sm:text-[28px] font-medium tracking-[-0.04em] leading-tight">Carnivals, conventions, big owambes. Let’s talk.</p>
            </div>
            <span className="inline-flex items-center gap-2 font-medium">
              hello@guestlok.com <ArrowRight />
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}

function ResultTile({ tone, word, sub, icon: Icon }) {
  return (
    <div
      className={`${tone} rounded-[22px] sm:rounded-[32px] h-[190px] sm:h-[280px] p-4 sm:p-6 flex flex-col justify-between min-w-0`}
    >
      <Icon className="w-8 h-8 sm:w-11 sm:h-11" strokeWidth={2.2} aria-hidden="true" />
      <div>
        <div className="text-[24px] sm:text-[40px] font-medium tracking-[-0.04em] leading-none">
          {word}
        </div>
        <div className="text-[12px] sm:text-[15px] mt-2 leading-snug">{sub}</div>
      </div>
    </div>
  );
}

const FOOTER_COLS = [
  { title: "Product", links: [["How it works", "#how"], ["Features", "#features"], ["Pricing", "#pricing"], ["FAQ", "#faq"]] },
  { title: "Help", links: [["Contact us", "mailto:hello@guestlok.com"], ["Sign in", "/login"], ["My events", "/app"]] },
];

function Footer({ startHref }) {
  return (
    <footer className="bg-brown text-cream rounded-t-[36px] sm:rounded-t-[48px] px-5 sm:px-10 pt-16 sm:pt-20 overflow-hidden">
      <div className="mx-auto max-w-6xl grid gap-12 grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <SunMark size={56} ray="#EEB12F" dot="#2B1B12" disc="#EEB12F" hole="#2B1B12" />
          <h2 className="text-[clamp(34px,4vw,48px)] font-medium tracking-[-0.045em] leading-none">Got a party coming up?</h2>
          <p className="text-sand max-w-sm">
            Weddings, owambes, birthdays, burials, naming ceremonies. If there’s a guest list, we’ll keep the gate.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to={startHref} className="btn-ochre btn-lg px-6">
              Plan your event <ArrowRight />
            </Link>
            <a href="mailto:hello@guestlok.com" className="btn btn-lg px-6 border-[1.5px] border-cream/40 text-cream hover:bg-cream hover:text-brown">
              Talk to us
            </a>
          </div>
        </div>

        <nav aria-label="Footer" className="grid gap-10 grid-cols-2">
          {FOOTER_COLS.map((col) => (
            <div key={col.title} className="flex flex-col gap-3.5">
              <span className="text-[13px] font-medium uppercase tracking-[0.1em] text-ochre">{col.title}</span>
              {col.links.map(([label, href]) =>
                href.startsWith("/") ? (
                  <Link key={label} to={href} className="text-[15px] text-cream/90 hover:text-cream hover:underline underline-offset-4">{label}</Link>
                ) : (
                  <a key={label} href={href} className="text-[15px] text-cream/90 hover:text-cream hover:underline underline-offset-4">{label}</a>
                ),
              )}
            </div>
          ))}
        </nav>
      </div>

      <div className="mx-auto max-w-6xl mt-14 pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-sm text-sand">
        <span className="inline-flex items-center gap-2">
          <svg width="22" height="15" viewBox="0 0 3 2" aria-hidden="true" className="rounded-[3px]">
            <rect width="3" height="2" fill="#fff" />
            <rect width="1" height="2" fill="#008751" />
            <rect x="2" width="1" height="2" fill="#008751" />
          </svg>
          Made in Lagos, for every owambe
        </span>
        <span>©{new Date().getFullYear()} Guestlok. All rights reserved.</span>
      </div>

      <div aria-hidden="true" className="mt-10 -mx-5 h-[0.62em] overflow-hidden text-[clamp(96px,24vw,360px)] leading-[0.74] flex justify-center text-ochre">
        <span className="inline-flex items-baseline font-medium tracking-[-0.065em]">
          <span>guestl</span>
          <KeyholeDisc disc="#EEB12F" hole="#2B1B12" style={{ width: "0.53em", height: "0.53em", margin: "0 0.01em" }} />
          <span>k</span>
        </span>
      </div>
    </footer>
  );
}
