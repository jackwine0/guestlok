import { AlertTriangle, Check, Info, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FeedbackContext } from "../lib/feedback.js";
import Modal from "./Modal.jsx";

/** Toasts + confirm/ask dialogs + branded "please fill this field" hints. */
export default function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null); // { kind: 'confirm'|'ask', opts, resolve }
  const idRef = useRef(0);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const toast = useCallback(
    (message, { tone = "success", duration } = {}) => {
      const id = ++idRef.current;
      setToasts((list) => [...list.slice(-2), { id, message, tone }]);
      setTimeout(() => dismiss(id), duration ?? (tone === "error" ? 6000 : 3200));
    },
    [dismiss],
  );

  const confirm = useCallback((opts) => new Promise((resolve) => setDialog({ kind: "confirm", opts, resolve })), []);
  const ask = useCallback((opts) => new Promise((resolve) => setDialog({ kind: "ask", opts, resolve })), []);

  function close(value) {
    dialog?.resolve(value);
    setDialog(null);
  }

  const value = useMemo(() => ({ toast, confirm, ask }), [toast, confirm, ask]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <FieldHints />

      {createPortal(
        <div
          aria-live="polite"
          className="fixed z-[70] left-1/2 -translate-x-1/2 bottom-[max(1.25rem,env(safe-area-inset-bottom))] w-[min(92vw,440px)] flex flex-col items-center gap-2 pointer-events-none"
        >
          {toasts.map((t) => (
            <Toast key={t.id} toast={t} onClose={() => dismiss(t.id)} />
          ))}
        </div>,
        document.body,
      )}

      <Modal
        open={dialog?.kind === "confirm"}
        onClose={() => close(false)}
        title={dialog?.opts.title}
        description={dialog?.opts.body}
        size="sm"
      >
        {dialog?.kind === "confirm" && (
          <ConfirmButtons opts={dialog.opts} onAnswer={close} />
        )}
      </Modal>

      <Modal open={dialog?.kind === "ask"} onClose={() => close(null)} title={dialog?.opts.title} description={dialog?.opts.body} size="sm">
        {dialog?.kind === "ask" && <AskForm opts={dialog.opts} onAnswer={close} />}
      </Modal>
    </FeedbackContext.Provider>
  );
}

function Toast({ toast, onClose }) {
  const Icon = toast.tone === "error" ? AlertTriangle : toast.tone === "info" ? Info : Check;
  const dot = toast.tone === "error" ? "bg-coral text-brown" : toast.tone === "info" ? "bg-cream text-brown" : "bg-leaf text-white";
  return (
    <div
      role={toast.tone === "error" ? "alert" : "status"}
      className="gl-toast pointer-events-auto w-full sm:w-auto max-w-full flex items-center gap-3 rounded-full bg-brown text-cream pl-2 pr-2 py-2 shadow-[0_18px_40px_rgba(28,18,12,0.35)]"
    >
      <span className={`w-9 h-9 shrink-0 rounded-full inline-flex items-center justify-center ${dot}`}>
        <Icon size={17} strokeWidth={2.4} aria-hidden="true" />
      </span>
      <span className="flex-1 min-w-0 text-[15px] leading-snug py-1">{toast.message}</span>
      <button type="button" onClick={onClose} aria-label="Dismiss" className="w-8 h-8 shrink-0 rounded-full inline-flex items-center justify-center text-sand hover:bg-white/10">
        <X size={15} aria-hidden="true" />
      </button>
    </div>
  );
}

function ConfirmButtons({ opts, onAnswer }) {
  const [typed, setTyped] = useState("");
  const needs = opts.typeToConfirm;
  const ok = !needs || typed.trim().toUpperCase() === needs.toUpperCase();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) onAnswer(true);
      }}
      className="flex flex-col gap-5"
    >
      {opts.points && (
        <ul className="flex flex-col gap-2">
          {opts.points.map((p) => (
            <li key={p} className="flex gap-3 rounded-2xl bg-tile px-4 py-3 text-[15px]">
              <span className={`mt-1.5 w-2 h-2 shrink-0 rounded-full ${opts.danger ? "bg-coral" : "bg-ochre"}`} aria-hidden="true" />
              {p}
            </li>
          ))}
        </ul>
      )}
      {needs && (
        <div>
          <label htmlFor="gl-confirm-type" className="label">
            Type <b className="font-mono">{needs}</b> to confirm
          </label>
          <input id="gl-confirm-type" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} className="field" />
        </div>
      )}
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
        <button type="button" onClick={() => onAnswer(false)} className="btn bg-tile hover:bg-sand">
          {opts.cancelLabel ?? "Cancel"}
        </button>
        <button
          type="submit"
          disabled={!ok}
          className={`btn ${opts.danger ? "bg-coral text-brown hover:brightness-95" : "bg-brown text-cream hover:bg-black"}`}
        >
          {opts.confirmLabel ?? "Continue"}
        </button>
      </div>
    </form>
  );
}

function AskForm({ opts, onAnswer }) {
  const [value, setValue] = useState(opts.initial ?? "");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onAnswer(value.trim());
      }}
      className="flex flex-col gap-5"
    >
      <div>
        <label htmlFor="gl-ask" className="label">{opts.label}</label>
        <input id="gl-ask" required maxLength={opts.maxLength ?? 80} placeholder={opts.placeholder} value={value} onChange={(e) => setValue(e.target.value)} className="field" />
      </div>
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
        <button type="button" onClick={() => onAnswer(null)} className="btn bg-tile hover:bg-sand">Cancel</button>
        <button type="submit" className="btn-dark">{opts.confirmLabel ?? "Save"}</button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------------- */
/* Branded validation: replaces the browser's grey "Please fill out this     */
/* field" bubble with a Guestlok hint under the first invalid field.         */
/* ------------------------------------------------------------------------- */

function labelFor(el) {
  const text =
    (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent) ||
    el.getAttribute("aria-label") ||
    el.placeholder ||
    "";
  return text.replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

function hintFor(el) {
  const v = el.validity;
  const label = labelFor(el);
  if (v.valueMissing) {
    if (el.tagName === "SELECT") return label ? `Please choose ${label}` : "Please choose an option";
    if (el.type === "checkbox") return "Please tick this box to continue";
    if (el.type === "file") return "Please choose a file";
    if (el.type === "date") return "Please pick a date";
    if (el.type === "time") return "Please pick a time";
    return label ? `Please fill in ${/^(your|the|a|an)\b/.test(label) ? "" : "the "}${label}` : "Please fill in this field";
  }
  if (v.typeMismatch && el.type === "email") return "That email doesn’t look right. Try name@example.com";
  if (v.typeMismatch && el.type === "url") return "That link doesn’t look right. Start it with https://";
  if (v.tooShort) return `Use at least ${el.minLength} characters`;
  if (v.tooLong) return `Keep it under ${el.maxLength} characters`;
  if (v.rangeUnderflow) return `It can’t be less than ${el.min}`;
  if (v.rangeOverflow) return `It can’t be more than ${el.max}`;
  if (v.badInput) return el.type === "date" ? "Please enter a full date" : "Please enter a valid value";
  if (v.patternMismatch) return el.title || "That doesn’t look right";
  return el.validationMessage || "Please check this field";
}

function FieldHints() {
  const [hint, setHint] = useState(null); // { el, text, rect }
  const batch = useRef(false);

  useEffect(() => {
    function onInvalid(e) {
      const el = e.target;
      if (!(el instanceof HTMLElement) || el.closest("[data-native-validation]")) return;
      e.preventDefault();
      el.setAttribute("data-gl-invalid", "");
      // A submit fires one "invalid" per bad field; only point at the first.
      if (batch.current) return;
      batch.current = true;
      setTimeout(() => (batch.current = false), 0);
      el.focus({ preventScroll: true });
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      setHint({ el, text: hintFor(el), rect: el.getBoundingClientRect() });
    }
    function onFix(e) {
      const el = e.target;
      if (el instanceof HTMLElement && el.hasAttribute("data-gl-invalid") && (!el.checkValidity || el.checkValidity())) {
        el.removeAttribute("data-gl-invalid");
        setHint((h) => (h?.el === el ? null : h));
      }
    }
    document.addEventListener("invalid", onInvalid, true);
    document.addEventListener("input", onFix, true);
    document.addEventListener("change", onFix, true);
    return () => {
      document.removeEventListener("invalid", onInvalid, true);
      document.removeEventListener("input", onFix, true);
      document.removeEventListener("change", onFix, true);
    };
  }, []);

  // Follow the field while the page scrolls; hide after a while or when it leaves.
  useEffect(() => {
    if (!hint) return;
    let raf = 0;
    const track = () => {
      if (!hint.el.isConnected) return setHint(null);
      const r = hint.el.getBoundingClientRect();
      setHint((h) => (h && (h.rect.top !== r.top || h.rect.left !== r.left || h.rect.width !== r.width) ? { ...h, rect: r } : h));
      raf = requestAnimationFrame(track);
    };
    raf = requestAnimationFrame(track);
    const t = setTimeout(() => setHint(null), 6000);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [hint?.el, hint?.text]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!hint) return null;
  const { rect } = hint;
  const below = rect.bottom + 54 < window.innerHeight;
  return createPortal(
    <div
      role="alert"
      className="gl-hint fixed z-[80] max-w-[min(340px,90vw)] pointer-events-none"
      style={{
        left: Math.max(12, Math.min(rect.left, window.innerWidth - 352)),
        top: below ? rect.bottom + 8 : undefined,
        bottom: below ? undefined : window.innerHeight - rect.top + 8,
      }}
    >
      <div className="relative flex items-center gap-2.5 rounded-2xl bg-brown text-cream pl-2 pr-4 py-2 text-[14px] ring-1 ring-cream/15 shadow-[0_12px_30px_rgba(28,18,12,0.3)]">
        <span className={`absolute left-5 w-3 h-3 rotate-45 bg-brown ${below ? "-top-1.5" : "-bottom-1.5"}`} aria-hidden="true" />
        <span className="relative w-7 h-7 shrink-0 rounded-full bg-coral text-brown inline-flex items-center justify-center">
          <AlertTriangle size={14} strokeWidth={2.4} aria-hidden="true" />
        </span>
        <span className="relative">{hint.text}</span>
      </div>
    </div>,
    document.body,
  );
}
