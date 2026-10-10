import { toInvite } from "./invite.js";
import { supabase } from "./supabase.js";
import { dataUrlToBlob, renderTicketJpeg } from "./ticketExport.jsx";

// WhatsApp can't attach a file to a wa.me chat link, but it does show a big preview of
// the first link in the message. Each guest's invite link (/i/<token>) answers WhatsApp
// with that guest's ticket image (middleware.js), so we put the image in place just
// before the chat opens.

const cache = new Map(); // design key → promise (with .state)

function designKey(event, guest) {
  return [
    guest.id, guest.token, guest.name, guest.admits,
    event.name, event.host_names, event.starts_at, event.venue, event.notes,
    event.card_theme, event.cover_image_url, event.cover_fit, event.cover_position, event.cover_zoom,
  ].join("|");
}

/**
 * Makes and uploads this guest's ticket image (once per design). Safe to call early to get
 * a head start. Pass { senderToken } on the helper page, where uploads go through the
 * sender-ticket function. Resolves to the image (data URL) once it's uploaded.
 */
export function prepareTicketPreview(event, guest, { senderToken } = {}) {
  if (!guest?.token) return null;
  const key = designKey(event, guest);
  if (cache.has(key)) return cache.get(key);

  const promise = (async () => {
    const invite = toInvite(guest, event);
    // If the cover photo can't be loaded, still send a ticket (without the photo).
    const { dataUrl } = await renderTicketJpeg(invite).catch(() => renderTicketJpeg({ ...invite, cover_image_url: null }));
    if (senderToken) {
      const { error } = await supabase.functions.invoke("sender-ticket", {
        body: { token: senderToken, guest_id: guest.id, image: dataUrl },
      });
      if (error) throw error;
      return dataUrl;
    }
    const path = `${event.owner_id}/${event.id}/${guest.token}-wa.jpg`;
    const { error } = await supabase.storage
      .from("invite-tickets")
      .upload(path, await dataUrlToBlob(dataUrl), { upsert: true, contentType: "image/jpeg", cacheControl: "300" });
    if (error) throw error;
    return dataUrl;
  })();

  promise.state = "pending";
  promise.then(
    () => (promise.state = "done"),
    (err) => {
      promise.state = "failed";
      cache.delete(key);
      console.warn("Ticket preview upload failed", err);
    },
  );
  cache.set(key, promise);
  return promise;
}

/** Opens a link in a new tab. Returns false when the browser blocked it. */
export function openTab(href) {
  const tab = window.open(href, "_blank");
  if (!tab) return false;
  try {
    tab.opener = null;
  } catch {
    /* ignore */
  }
  return true;
}
