import { formatEventTime } from "./format.js";

// One meaning of "sent" for the whole app: the guest has their invite, however it went
// (Guestlok's WhatsApp on Plus, the host's own WhatsApp, a helper's link, or a shared ticket).

const ms = (iso) => (iso ? new Date(iso).getTime() : 0);

/** Guestlok's last attempt failed and nobody has sent it another way since. */
export function didntDeliver(g) {
  return g.wa_status === "failed" && (!g.invite_sent_at || ms(g.wa_updated_at) >= ms(g.invite_sent_at));
}

export function hasInvite(g) {
  return !!g.invite_sent_at && !didntDeliver(g);
}

/** Still needs their invite: has a number, not at the gate yet, and doesn't have it. */
export function needsInvite(g) {
  return !!g.phone && !g.checked_in_at && !hasInvite(g);
}

const DELIVERY = {
  delivered: "Delivered ✓✓",
  read: "Read ✓✓",
};

/** The one status chip a guest row shows. */
export function inviteStatus(g) {
  if (g.checked_in_at) return { key: "arrived", text: `Arrived ${formatEventTime(g.checked_in_at)}`, cls: "bg-leaf text-white" };
  if (didntDeliver(g)) return { key: "failed", text: "Didn’t deliver", cls: "bg-coral/20 text-[#7A2A1E]" };
  if (hasInvite(g)) {
    if (g.wa_status === "read") return { key: "sent", text: DELIVERY.read, cls: "bg-[#DCEFE3] text-[#1F6B3F]" };
    if (g.wa_status === "delivered") return { key: "sent", text: DELIVERY.delivered, cls: "bg-cream" };
    return { key: "sent", text: "Sent ✓", cls: "bg-cream" };
  }
  if (g.wa_status === "queued") return { key: "sending", text: "Sending…", cls: "bg-cream" };
  if (!g.phone) return { key: "nophone", text: "No phone", cls: "bg-tile text-brown-soft" };
  return { key: "unsent", text: "Not sent", cls: "bg-tile text-brown-soft" };
}

/** Plain-words line for the guest's sheet: how they got it. */
export function inviteDetail(g) {
  if (g.checked_in_at) return "Scanned in at the gate.";
  if (didntDeliver(g)) return g.wa_error ? `WhatsApp couldn’t deliver it: ${g.wa_error}` : "WhatsApp couldn’t deliver it. Check the number, or send it another way.";
  if (hasInvite(g)) {
    const byGuestlok = g.wa_status && g.wa_sent_at && ms(g.wa_sent_at) >= ms(g.invite_sent_at) - 60_000;
    if (!byGuestlok) return "They have their invite, sent by you or a helper.";
    if (g.wa_status === "read") return "Guestlok sent it on WhatsApp and they’ve opened it.";
    if (g.wa_status === "delivered") return "Guestlok sent it on WhatsApp. It’s on their phone.";
    return "Guestlok sent it on WhatsApp. Ticks update when it reaches their phone.";
  }
  if (!g.phone) return "No phone number. Save their ticket and share it, or copy their link.";
  return "Not sent yet.";
}
