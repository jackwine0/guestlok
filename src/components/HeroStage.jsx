import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";

/** Slowly turning ochre sunburst behind the hero (decorative). */
export function Sunburst({ className = "" }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={`gl-spin pointer-events-none ${className}`}>
      {Array.from({ length: 36 }, (_, i) => (
        <rect key={i} x="49.4" y="0" width="1.2" height="22" rx="0.6" fill="#EEB12F" transform={`rotate(${i * 10} 50 50)`} />
      ))}
    </svg>
  );
}

function ArrivalsSticker() {
  const [n, setN] = useState(212);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setN((v) => (v < 299 ? v + 1 : v)), 1500);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="flex items-center gap-3">
      <span className="text-[26px] font-semibold tracking-[-0.04em] tabular-nums leading-none">{n}</span>
      <span className="text-left text-[13px] leading-tight text-brown-soft">
        of 300
        <br />
        arrived
      </span>
    </span>
  );
}

const STICKERS = [
  { id: "valid", cls: "bg-leaf text-white rotate-[6deg]", pos: "left-1/2 ml-[150px] top-[36px] max-sm:-ml-[10px] max-sm:-top-[22px]", delay: "0s", body: "✓ Valid · Admits 2" },
  { id: "sent", cls: "bg-cream text-brown -rotate-[8deg]", pos: "left-1/2 -ml-[330px] top-[130px] max-sm:-ml-[168px] max-sm:top-[300px]", delay: "-1.5s", body: "Sent on WhatsApp" },
  { id: "count", cls: "bg-white text-brown rotate-[4deg]", pos: "left-1/2 ml-[175px] top-[250px] max-sm:hidden", delay: "-3s", body: <ArrivalsSticker /> },
  { id: "crash", cls: "bg-coral text-brown -rotate-[5deg] font-yoruba italic", pos: "left-1/2 -ml-[300px] top-[330px] max-sm:hidden", delay: "-2s", body: <s className="decoration-2">mo gbọ́, mo yà</s> },
];

/** The floating invite card with stickers around it. */
export default function HeroStage() {
  return (
    <div className="relative z-10 h-[470px] sm:h-[500px] [perspective:1400px]" aria-hidden="true">
      <div className="gl-float absolute left-1/2 top-0 w-[300px] sm:w-[320px] -ml-[150px] sm:-ml-[160px] z-10 bg-white text-brown rounded-[32px] overflow-hidden text-center shadow-[0_50px_100px_rgba(0,0,0,0.45)]">
        <div className="relative h-[110px] bg-gradient-to-br from-ochre to-coral">
          <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="absolute inset-0 w-full h-full opacity-35">
            <path d="M0 40 Q25 10 50 25 T100 15 V40Z" fill="#2B1B12" />
          </svg>
        </div>
        <div className="bg-brown text-cream px-5 py-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] opacity-70">You’re invited, Adaeze</p>
          <p className="font-serif text-[34px] leading-[1.02] mt-1.5">Tolu &amp; Chidi’s Wedding</p>
        </div>
        <div className="mx-auto mt-5 mb-3 w-[150px] h-[150px] rounded-[20px] bg-paper p-3.5">
          <QRCodeSVG value="https://guestlok.com" size={122} bgColor="#F7F1E3" fgColor="#2B1B12" level="M" />
        </div>
        <div className="grid grid-cols-2 gap-2 px-5 pb-6 text-[13px]">
          <div className="rounded-2xl bg-paper py-2">Admits<b className="block text-[15px]">2 people</b></div>
          <div className="rounded-2xl bg-paper py-2">Date<b className="block text-[15px]">Sat, 12 Dec</b></div>
        </div>
      </div>

      {STICKERS.map((s) => (
        <span key={s.id} className={`absolute z-20 ${s.pos}`}>
          <span
            className={`gl-bob inline-flex items-center px-3.5 py-2 sm:px-[18px] sm:py-2.5 rounded-full text-[15px] sm:text-[17px] font-medium whitespace-nowrap shadow-[0_14px_30px_rgba(0,0,0,0.25)] ${s.cls}`}
            style={{ animationDelay: s.delay }}
          >
            {s.body}
          </span>
        </span>
      ))}
    </div>
  );
}
