import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * Accessible modal. Bottom sheet on phones, centred card on larger screens.
 * Escape and the backdrop close it; focus moves in and returns on close.
 */
export default function Modal({ open, onClose, title, description, children, size = "md", tone = "light", dismissible = true }) {
  const panelRef = useRef(null);
  const titleId = useId();
  const descId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    html.style.overflow = "hidden";

    const panel = panelRef.current;
    const focusables = () =>
      [...panel.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(
        (el) => !el.disabled && el.offsetParent !== null,
      );
    // Focus the first form field, else the first button.
    requestAnimationFrame(() => {
      const list = focusables();
      (list.find((el) => /INPUT|SELECT|TEXTAREA/.test(el.tagName)) ?? list[0] ?? panel)?.focus();
    });

    function onKey(e) {
      if (e.key === "Escape" && dismissible) {
        e.stopPropagation();
        closeRef.current?.();
      }
      if (e.key === "Tab") {
        const list = focusables();
        if (!list.length) return;
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      html.style.overflow = prevOverflow;
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [open, dismissible]);

  if (!open) return null;

  const width = { sm: "sm:max-w-[440px]", md: "sm:max-w-[560px]", lg: "sm:max-w-[760px]" }[size];
  const dark = tone === "dark";

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-6">
      <div
        className="gl-fade absolute inset-0 bg-brown/55 backdrop-blur-[2px]"
        onClick={dismissible ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={`gl-rise relative w-full ${width} max-h-[92dvh] overflow-y-auto overscroll-contain gl-noscrollbar rounded-t-[32px] sm:rounded-[36px] px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:p-8 outline-none shadow-[0_30px_80px_rgba(28,18,12,0.35)] ${
          dark ? "bg-brown text-cream" : "bg-white text-brown"
        }`}
      >
        <div className="sm:hidden mx-auto -mt-2 mb-4 h-1.5 w-12 rounded-full bg-current opacity-15" aria-hidden="true" />
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-[26px] sm:text-[30px] font-normal tracking-[-0.035em] leading-[1.1]">
              {title}
            </h2>
            {description && (
              <p id={descId} className={`mt-2 text-[15px] ${dark ? "text-sand" : "text-brown-soft"}`}>
                {description}
              </p>
            )}
          </div>
          {dismissible && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className={`shrink-0 w-11 h-11 rounded-full inline-flex items-center justify-center transition ${dark ? "bg-white/10 hover:bg-white/20" : "bg-tile hover:bg-sand"}`}
            >
              <X size={18} aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
