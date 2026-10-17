import { removeTicketImages } from "./deleteEvent.js";
import { supabase } from "./supabase.js";

/** How long guests' phone numbers are kept after an event ends. Matches migration 15. */
export const KEEP_PHONES_DAYS = 90;

/**
 * When this event's guest phone numbers are (or were) removed, or null if it hasn't ended.
 * "Ended" is when it was ended, or 24 hours after the start if nobody ended it.
 */
export function phonesRemovedOn(event) {
  if (event.phones_cleared_at) return new Date(event.phones_cleared_at);
  if (event.status !== "ended") return null;
  const ended = event.ended_at ? new Date(event.ended_at).getTime() : new Date(event.starts_at).getTime() + 24 * 3600_000;
  return new Date(ended + KEEP_PHONES_DAYS * 24 * 3600_000);
}

/** Whole days until the numbers go (0 once removed). */
export function daysUntilPhonesRemoved(event, now = Date.now()) {
  const on = phonesRemovedOn(event);
  if (!on || event.phones_cleared_at) return 0;
  return Math.max(0, Math.ceil((on.getTime() - now) / (24 * 3600_000)));
}

/**
 * Clears guest numbers on the host's events that ended over 90 days ago, then removes those
 * events' ticket pictures. Quiet and best effort: fails silently before migration 15.
 */
export async function tidyOldGuestData() {
  try {
    const { data: ids, error } = await supabase.rpc("clear_my_old_guest_data");
    if (error || !ids?.length) return;
    const { data } = await supabase.auth.getSession();
    const owner = data.session?.user?.id;
    if (!owner) return;
    for (const row of ids) {
      const id = typeof row === "string" ? row : row?.clear_my_old_guest_data ?? row?.id;
      if (id) await removeTicketImages(owner, id);
    }
  } catch {
    /* tidy-up only */
  }
}
