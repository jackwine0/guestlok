import { useEffect, useId, useRef, useState } from "react";

/**
 * "mo gbọ́, mo yà" set as a highlighted coral tag. Hover, focus or tap
 * shows a tiny translation bubble instead of a paragraph of explanation.
 */
export default function YorubaPhrase({ dark = false }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <span ref={ref} className="relative inline-block group align-baseline">
      <button
        type="button"
        aria-describedby={id}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="font-yoruba italic text-[1.04em] leading-none px-2.5 py-1 -my-1 rounded-full bg-coral text-brown inline-block -rotate-2 hover:rotate-0 transition-transform underline decoration-dotted decoration-brown/50 underline-offset-[5px] cursor-help"
      >
        mo gbọ́, mo yà
      </button>
      <span
        role="tooltip"
        id={id}
        className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-max max-w-[230px] rounded-2xl ${dark ? "bg-cream text-brown" : "bg-brown text-cream"} text-[13px] leading-snug px-3.5 py-2.5 text-left shadow-lg transition duration-200 pointer-events-none z-20 ${
          open ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0"
        }`}
      >
        <span className={`block font-mono text-[10px] uppercase tracking-[0.14em] mb-0.5 ${dark ? "text-gold-ink" : "text-ochre"}`}>Yorùbá</span>
        “I heard, so I came.” The uninvited guest.
        <span className={`absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent ${dark ? "border-t-cream" : "border-t-brown"}`} aria-hidden="true" />
      </span>
    </span>
  );
}
