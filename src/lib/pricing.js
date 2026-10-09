import { useEffect, useState } from "react";
import { supabase } from "./supabase.js";

// Fallback until the Plus migration has been run (matches its defaults).
export const DEFAULT_PRICING = { plus_pct: 30, plus_min_guest_kobo: 3000, extra_invite_kobo: 10000, resend_pct: 10, plus_enabled: false };

/** What Plus adds to a plan, in kobo. Mirrors public.gl_plus_extra_kobo() so the app and checkout agree. */
export function plusExtraKobo(tier, s = DEFAULT_PRICING) {
  if (!tier) return 0;
  const raw = Math.max((tier.price_kobo * Number(s.plus_pct)) / 100, s.plus_min_guest_kobo * tier.max_headcount);
  return Math.ceil(raw / 10000) * 10000; // round up to the next ₦100
}

export function planPriceKobo(tier, delivery, s = DEFAULT_PRICING) {
  if (!tier) return 0;
  return tier.price_kobo + (delivery === "plus" ? plusExtraKobo(tier, s) : 0);
}

/** "+₦45" — Plus cost per guest, for copy. Rounded to the nearest ₦5. */
export function plusPerGuestNaira(tier, s = DEFAULT_PRICING) {
  if (!tier) return 0;
  return Math.round(plusExtraKobo(tier, s) / 100 / tier.max_headcount / 5) * 5;
}

export function plusQuota(headcount, s = DEFAULT_PRICING) {
  return Math.ceil(headcount * (1 + s.resend_pct / 100));
}

/** Tiers + pricing settings, loaded once per page. */
export function usePricing() {
  const [state, setState] = useState({ tiers: [], settings: DEFAULT_PRICING, loaded: false });
  useEffect(() => {
    let alive = true;
    Promise.all([
      supabase.from("tiers").select("*").order("sort"),
      Promise.resolve(supabase.from("pricing_settings").select("*").maybeSingle()).catch(() => ({ data: null })),
    ]).then(([t, s]) => {
      if (!alive) return;
      setState({ tiers: t.data ?? [], settings: { ...DEFAULT_PRICING, ...(s?.data ?? {}) }, loaded: true });
    });
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

export const DELIVERY = {
  self: {
    name: "Standard",
    short: "You send them",
    line: "Send each invite from your own WhatsApp, one tap per guest.",
  },
  plus: {
    name: "Plus",
    short: "Guestlok sends them",
    line: "We send every invite for you from the official Guestlok WhatsApp, with the ticket attached.",
  },
};
