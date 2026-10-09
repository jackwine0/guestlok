import { toInvite } from "./invite.js";
import { supabase } from "./supabase.js";
import { dataUrlToBlob, renderTicketPng } from "./ticketExport.jsx";

const CHUNK = 40;

/** Guests a Plus "Send all" goes to: has a phone, not at the gate yet, never sent (or the last send failed). */
export function plusTargets(guests) {
  return guests.filter((g) => g.phone && !g.checked_in_at && (!g.wa_status || g.wa_status === "failed"));
}

/** Where WhatsApp fetches this guest's ticket image from. Must match the whatsapp-send function. */
function ticketPath(event, guest) {
  return `${event.owner_id}/${event.id}/${guest.token}.png`;
}

async function uploadTicket(event, guest) {
  const png = await renderTicketPng(toInvite(guest, event), { pixelRatio: 1.5 });
  const blob = await dataUrlToBlob(png.dataUrl);
  const { error } = await supabase.storage
    .from("invite-tickets")
    .upload(ticketPath(event, guest), blob, { upsert: true, contentType: "image/png", cacheControl: "60" });
  if (error) throw error;
}

/**
 * Makes each guest's ticket image, then asks the whatsapp-send function to deliver them, in chunks.
 * onProgress({ phase: 'preparing' | 'sending', done, total, sent, failed })
 * Returns { sent, failed, noAllowance, remaining }.
 */
export async function guestlokSend(event, guests, onProgress = () => {}, shouldStop = () => false) {
  const total = guests.length;
  let prepared = 0;
  const totals = { sent: 0, failed: 0, noAllowance: 0, remaining: null };

  for (let i = 0; i < guests.length; i += CHUNK) {
    if (shouldStop()) break;
    const chunk = guests.slice(i, i + CHUNK);

    for (const g of chunk) {
      if (shouldStop()) break;
      try {
        await uploadTicket(event, g);
      } catch (err) {
        // A missing image isn't fatal: the function falls back to the event's cover image.
        console.warn("ticket upload failed", g.id, err);
      }
      prepared++;
      onProgress({ phase: "preparing", done: prepared, total, ...totals });
    }
    if (shouldStop()) break;

    onProgress({ phase: "sending", done: totals.sent + totals.failed, total, ...totals });
    const { data, error } = await supabase.functions.invoke("whatsapp-send", {
      body: { event_id: event.id, guest_ids: chunk.map((g) => g.id) },
    });
    if (error) throw error;
    totals.sent += data.sent ?? 0;
    totals.failed += data.failed ?? 0;
    totals.noAllowance += data.no_allowance ?? 0;
    totals.remaining = data.remaining ?? totals.remaining;
    onProgress({ phase: "sending", done: totals.sent + totals.failed + totals.noAllowance, total, ...totals });
    if ((data.no_allowance ?? 0) > 0) {
      // Out of sends: the rest would be refused too.
      totals.noAllowance += Math.max(0, guests.length - (i + CHUNK));
      break;
    }
  }
  return totals;
}
