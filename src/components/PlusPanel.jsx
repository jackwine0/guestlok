import { Plus as PlusIcon, Send, Smartphone } from "lucide-react";
import { useState } from "react";
import { useFeedback } from "../lib/feedback.js";
import { formatNaira } from "../lib/format.js";
import { DEFAULT_PRICING, plusExtraKobo, plusPerGuestNaira } from "../lib/pricing.js";
import { startExtraPayment } from "../lib/payments.js";
import { ButtonSpinner } from "./Brand.jsx";

const TOPUPS = [50, 100, 200];

/**
 * "How invites go out" card for a paid event.
 * Standard → offer the upgrade. Plus → show the WhatsApp allowance and top-ups.
 */
export default function PlusPanel({ event, tier, settings = DEFAULT_PRICING, compact = false }) {
  const { toast } = useFeedback();
  const [busy, setBusy] = useState(null);
  const locked = event.status !== "active";

  async function go(key, body) {
    setBusy(key);
    const ok = await startExtraPayment(event, body, toast);
    if (!ok) setBusy(null);
  }

  if (event.delivery !== "plus") {
    const extra = plusExtraKobo(tier, settings);
    const perGuest = plusPerGuestNaira(tier, settings);
    return (
      <section className={compact ? "" : "bento"} aria-labelledby="invites-title">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="invites-title" className="section-title">Sending invites</h3>
            <p className="mt-1 text-brown-soft text-[15px]">Standard: you send each invite from your own WhatsApp.</p>
          </div>
          <span className="w-10 h-10 shrink-0 rounded-full bg-tile inline-flex items-center justify-center" aria-hidden="true">
            <Smartphone size={18} />
          </span>
        </div>
        {!locked && tier && (
          <div className="mt-5 rounded-[24px] bg-brown text-cream p-5">
            <p className="text-[17px] tracking-[-0.01em]">Let Guestlok send them</p>
            <p className="mt-1 text-sm text-sand">
              Every invite goes out in one tap from the official Guestlok WhatsApp, with the ticket attached and delivery ticks for each guest.
            </p>
            <button type="button" onClick={() => go("upgrade", { kind: "upgrade" })} disabled={!!busy} className="mt-4 btn-ochre w-full">
              {busy === "upgrade" ? <ButtonSpinner /> : <Send size={16} aria-hidden="true" />} Upgrade to Plus · {formatNaira(extra)}
            </button>
            {perGuest > 0 && <p className="mt-2 text-center text-xs text-sand">About ₦{perGuest} a guest. One-off, this event.</p>}
          </div>
        )}
      </section>
    );
  }

  const left = Math.max(event.wa_quota - event.wa_sent, 0);
  const used = event.wa_quota ? Math.min(100, Math.round((event.wa_sent / event.wa_quota) * 100)) : 0;
  return (
    <section className={compact ? "" : "bento"} aria-labelledby="invites-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id="invites-title" className="section-title">Guestlok sends</h3>
          <p className="mt-1 text-brown-soft text-[15px]">Plus: invites go out from the official Guestlok WhatsApp.</p>
        </div>
        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-brown text-cream">Plus</span>
      </div>
      <p className="bento-num text-[44px] mt-5">
        {left.toLocaleString()}
        <span className="text-[0.42em] text-mute"> sends left</span>
      </p>
      <div className="mt-3 h-3 rounded-full bg-tile overflow-hidden" aria-hidden="true">
        <i className={`block h-full rounded-full ${used >= 90 ? "bg-coral" : "bg-ochre"}`} style={{ width: `${used}%` }} />
      </div>
      <p className="mt-2 text-sm text-brown-soft">
        {event.wa_sent.toLocaleString()} of {event.wa_quota.toLocaleString()} used. Failed sends are given back.
      </p>
      {!locked && (
        <div className="mt-5">
          <p className="text-sm text-brown-soft mb-2">Need more? {formatNaira(settings.extra_invite_kobo)} per invite.</p>
          <div className="grid grid-cols-3 gap-2">
            {TOPUPS.map((n) => (
              <button
                key={n}
                type="button"
                disabled={!!busy}
                onClick={() => go(`top${n}`, { kind: "topup", invites: n })}
                className="h-12 rounded-full bg-tile hover:bg-sand text-sm inline-flex items-center justify-center gap-1 disabled:opacity-60"
              >
                {busy === `top${n}` ? <ButtonSpinner /> : <PlusIcon size={14} aria-hidden="true" />}
                {n}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
