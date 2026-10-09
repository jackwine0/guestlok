import { supabase } from "./supabase.js";

/**
 * Permanently deletes an event: its guests, gate requests and sender links go with it
 * (database cascade); payment records are kept for accounts. Uploaded cover photos and
 * ticket images are cleaned up first, best effort.
 */
export async function deleteEvent(event) {
  const owner = event.owner_id;
  try {
    const { data: covers } = await supabase.storage.from("invite-covers").list(owner, { limit: 100, search: event.id });
    const coverPaths = (covers ?? []).filter((f) => f.name.startsWith(event.id)).map((f) => `${owner}/${f.name}`);
    if (coverPaths.length) await supabase.storage.from("invite-covers").remove(coverPaths);

    const folder = `${owner}/${event.id}`;
    const { data: tickets } = await supabase.storage.from("invite-tickets").list(folder, { limit: 1000 });
    const ticketPaths = (tickets ?? []).map((f) => `${folder}/${f.name}`);
    if (ticketPaths.length) await supabase.storage.from("invite-tickets").remove(ticketPaths);
  } catch {
    /* files are tidy-up only; never block the delete */
  }
  const { error } = await supabase.from("events").delete().eq("id", event.id);
  return error ?? null;
}

/** The confirm-dialog options for deleting this event. */
export function deleteConfirmOptions(event, guestCount = 0) {
  if (event.status === "draft") {
    return {
      title: "Delete this event?",
      body: `“${event.name}” hasn’t been paid for yet. Deleting it removes it for good.`,
      confirmLabel: "Delete event",
      danger: true,
    };
  }
  const live = event.status === "active";
  return {
    title: `Delete “${event.name}”?`,
    body: "This can’t be undone, and the payment is not refunded.",
    points: [
      `The guest list${guestCount ? ` (${guestCount} guest${guestCount === 1 ? "" : "s"})` : ""}, check-ins and helper links are deleted.`,
      live ? "Every invite stops working, so guests will be turned back at the gate." : "Old invite links stop working.",
      "Download the attendance list first if you want to keep a copy.",
    ],
    typeToConfirm: "DELETE",
    confirmLabel: "Delete forever",
    danger: true,
  };
}
