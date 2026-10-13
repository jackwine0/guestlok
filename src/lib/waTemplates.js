import { formatEventTime } from "./format.js";

/**
 * Guestlok's WhatsApp message styles for Plus. Each one is a template approved by Meta;
 * the wording here mirrors WhatsApp Manager so the preview is exact, and the variable
 * order mirrors supabase/functions/whatsapp-send (TEMPLATES).
 * Only names listed in pricing_settings.wa_templates are offered to hosts.
 */
export const WA_STYLES = [
  {
    id: "guestlok_invite",
    label: "Simple",
    blurb: "Short and clear. Fits any event.",
    note: false,
    body: (v) =>
      `Hello ${v.name}, your entry pass for ${v.event} has been issued.\n\nDate: ${v.when}\nVenue: ${v.venue}\nAdmits: ${v.admits}\n\nShow the QR code on your pass at the gate. It is valid for one entry only.`,
  },
  {
    id: "guestlok_invite_formal",
    label: "Formal",
    blurb: "Weddings, dinners, corporate events.",
    note: true,
    defaultNote: "We look forward to your presence.",
    body: (v) =>
      `Dear ${v.name},\n\nYour entry pass for ${v.event} has been issued.\n\nDate: ${v.when}\nVenue: ${v.venue}\n\nMessage from your host: ${v.note}\n\nThis pass admits ${v.admits}. Kindly present the QR code at the entrance. It is valid for one entry only.`,
  },
  {
    // The Meta template for this wording is named guestlok_invite_warm (the old Warm text was rejected).
    id: "guestlok_invite_warm",
    label: "Gracious",
    blurb: "Thanksgivings, dedications, burials.",
    note: true,
    defaultNote: "We look forward to sharing this day with you.",
    body: (v) =>
      `Dear ${v.name},\n\nYour entry pass for ${v.event} has been issued.\n\nDate: ${v.when}\nVenue: ${v.venue}\n\nMessage from your host: ${v.note}\n\nYour pass admits ${v.admits}. Please show the QR code at the entrance. It is valid for one entry.`,
  },
];

export const NOTE_MAX = 120;

export function waStyle(id) {
  return WA_STYLES.find((s) => s.id === id) ?? WA_STYLES[0];
}

/** Styles the host can pick: approved by Meta and listed in pricing_settings. */
export function availableStyles(settings) {
  const approved = settings?.wa_templates ?? ["guestlok_invite"];
  return WA_STYLES.filter((s) => approved.includes(s.id));
}

function lagosWhen(iso) {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Lagos" }).format(d);
  return `${date}, ${formatEventTime(iso).replace(" ", "")}`;
}

/** The exact text a guest gets from Guestlok's number. */
export function waPreviewText(styleId, note, event, guest) {
  const style = waStyle(styleId);
  const cleanNote = (note ?? "").replace(/\s+/g, " ").trim().slice(0, NOTE_MAX) || style.defaultNote || "";
  return style.body({
    name: guest.name.split(" ")[0] || guest.name,
    event: event.name,
    when: lagosWhen(event.starts_at),
    venue: event.venue,
    admits: guest.admits === 1 ? "1 person" : `${guest.admits} people`,
    note: cleanNote,
  });
}
