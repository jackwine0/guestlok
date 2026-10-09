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
 * sender-ticket function.
 */
export function prepareTicketPreview(event, guest, { senderToken } = {}) {
  if (!guest?.token) return null;
  const key = designKey(event, guest);
  if (cache.has(key)) return cache.get(key);

  const promise = (async () => {
    const { dataUrl } = await renderTicketJpeg(toInvite(guest, event));
    if (senderToken) {
      const { error } = await supabase.functions.invoke("sender-ticket", {
        body: { token: senderToken, guest_id: guest.id, image: dataUrl },
      });
      if (error) throw error;
      return;
    }
    const path = `${event.owner_id}/${event.id}/${guest.token}-wa.jpg`;
    const { error } = await supabase.storage
      .from("invite-tickets")
      .upload(path, await dataUrlToBlob(dataUrl), { upsert: true, contentType: "image/jpeg", cacheControl: "300" });
    if (error) throw error;
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

/**
 * Opens the WhatsApp chat. If the ticket image is still being prepared, a tab opens right
 * away (so the browser doesn't block it) and moves to WhatsApp once the image is up,
 * or after a few seconds at most.
 */
export function openWhatsApp(href, preparing) {
  if (!preparing || preparing.state !== "pending") {
    window.open(href, "_blank", "noopener");
    return;
  }
  const tab = window.open("", "_blank");
  try {
    tab?.document.write(
      '<meta name="viewport" content="width=device-width,initial-scale=1"><title>Opening WhatsApp…</title>' +
        '<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#2B1B12;color:#F5E7A8;font:16px system-ui,sans-serif">Adding the ticket to the message…</body>',
    );
  } catch {
    /* cross-origin or blocked: fine */
  }
  const go = () => {
    if (tab && !tab.closed) tab.location.href = href;
    else window.location.href = href;
  };
  Promise.race([preparing, new Promise((r) => setTimeout(r, 6000))]).then(go, go);
}
