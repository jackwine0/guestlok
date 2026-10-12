import { BadgeCheck, Check, Send, Smartphone } from "lucide-react";
import { formatNaira } from "../lib/format.js";
import { DEFAULT_PRICING, plusExtraKobo, plusPerGuestNaira } from "../lib/pricing.js";

/**
 * Standard vs Plus: who sends the invites. Used in the new-event wizard and the draft checkout.
 * value: 'self' | 'plus'
 */
export default function DeliveryPicker({ tier, settings = DEFAULT_PRICING, value, onChange, name = "delivery" }) {
  const extra = plusExtraKobo(tier, settings);
  const perGuest = plusPerGuestNaira(tier, settings);
  const options = [
    {
      id: "self",
      icon: Smartphone,
      title: "I’ll send them",
      badge: "Standard",
      price: "Included",
      points: ["Every feature included", "You send from your own WhatsApp, one tap per guest", "Family or your planner can help"],
    },
    {
      id: "plus",
      icon: Send,
      title: "Guestlok sends them",
      badge: "Plus",
      price: tier ? `+${formatNaira(extra)}` : "Plus",
      priceNote: perGuest ? `about ₦${perGuest} a guest` : null,
      points: ["Everything in Standard", "We send all invites at once from Guestlok’s WhatsApp", "Ticket picture + “View my ticket” button", "Sent · Delivered · Read for each guest"],
    },
  ];

  return (
    <fieldset>
      <legend className="label">Who sends the invites?</legend>
      <p className="-mt-1 mb-3 text-sm text-brown-soft">Both include every feature. With Plus, Guestlok also sends the invites for you.</p>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
        {options.map((o) => {
          const selected = value === o.id;
          return (
            <label
              key={o.id}
              className={`relative cursor-pointer rounded-[26px] p-5 flex flex-col gap-3 transition ring-2 ${
                selected ? (o.id === "plus" ? "bg-brown text-cream ring-brown" : "bg-ochre ring-brown") : "bg-tile ring-transparent hover:ring-sand"
              }`}
            >
              <input type="radio" name={name} value={o.id} checked={selected} onChange={() => onChange(o.id)} className="sr-only" />
              <div className="flex items-start justify-between gap-3">
                <span
                  className={`w-10 h-10 rounded-full inline-flex items-center justify-center shrink-0 ${
                    selected ? (o.id === "plus" ? "bg-ochre text-brown" : "bg-brown text-cream") : "bg-white"
                  }`}
                  aria-hidden="true"
                >
                  <o.icon size={18} />
                </span>
                <span className="text-right">
                  <span className="block text-[17px] font-medium tabular-nums">{o.price}</span>
                  {o.priceNote && <span className={`block text-xs ${selected ? "text-sand" : "text-brown-soft"}`}>{o.priceNote}</span>}
                </span>
              </div>
              <span className="flex items-center gap-2 text-[18px] tracking-[-0.02em]">
                {o.title}
                {o.badge && (
                  <span
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                      o.id === "plus" ? (selected ? "bg-ochre text-brown" : "bg-brown text-cream") : selected ? "bg-brown text-cream" : "bg-white"
                    }`}
                  >
                    {o.badge}
                  </span>
                )}
              </span>
              <ul className="flex flex-col gap-1.5">
                {o.points.map((p) => (
                  <li key={p} className={`flex items-start gap-2 text-sm leading-snug ${selected ? "" : "text-brown-soft"}`}>
                    <Check size={14} strokeWidth={2.6} className={`mt-0.5 shrink-0 ${selected && o.id === "plus" ? "text-ochre" : ""}`} aria-hidden="true" /> {p}
                  </li>
                ))}
              </ul>
              {selected && (
                <BadgeCheck size={18} className={`absolute right-4 bottom-4 ${o.id === "plus" ? "text-ochre" : ""}`} aria-hidden="true" />
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
