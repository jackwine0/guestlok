import { formatEventDate, formatEventTime, inviteUrl } from "./format.js";
import { supabase } from "./supabase.js";

/** Colour themes for the invite card. Keep ids in sync with the DB check constraint. */
export const THEMES = {
  ochre: { label: "Ochre", page: "#EEB12F", head: "#2B1B12", headText: "#F5E7A8", soft: "#F7F1E3", ink: "#2B1B12", note: "#F5E7A8" },
  wine: { label: "Wine", page: "#E7C6CB", head: "#5A1A2B", headText: "#F8E4E8", soft: "#FBF1F3", ink: "#3A0F1B", note: "#F3D6DC" },
  emerald: { label: "Emerald", page: "#D4A845", head: "#0F4D3A", headText: "#F3E7C4", soft: "#F5F1E4", ink: "#0C2E24", note: "#EBDDB5" },
  midnight: { label: "Midnight", page: "#C9A24A", head: "#14213D", headText: "#F2E6C9", soft: "#F4F1EA", ink: "#14213D", note: "#E9DFC6" },
  blush: { label: "Blush", page: "#F4C9CF", head: "#7A2E3B", headText: "#FCEBEE", soft: "#FDF4F5", ink: "#4A1A23", note: "#F8DDE1" },
};

export function themeOf(id) {
  return THEMES[id] ?? THEMES.ochre;
}

export const MESSAGE_VARIABLES = [
  ["{first_name}", "Guest’s first name"],
  ["{name}", "Guest’s full name"],
  ["{event}", "Event name"],
  ["{host}", "Hosted by"],
  ["{date}", "Event date"],
  ["{time}", "Start time"],
  ["{venue}", "Venue"],
  ["{admits}", "e.g. “2 people”"],
  ["{link}", "Personal invite link (keep this!)"],
];

export const DEFAULT_MESSAGE = [
  "Hi {first_name}! You’re invited to {event}.",
  "",
  "{date}, {time}",
  "{venue}",
  "",
  "This is your personal invite and it admits {admits}. Show the QR code at the gate:",
  "{link}",
  "",
  "Please don’t forward it, it only works once.",
].join("\n");

/** Build the invite-card data for one guest from the host's event + guest rows. */
export function toInvite(guest, event) {
  return {
    guest_name: guest.name,
    admits: guest.admits,
    token: guest.token,
    checked_in_at: guest.checked_in_at,
    event_name: event.name,
    host_names: event.host_names,
    starts_at: event.starts_at,
    venue: event.venue,
    notes: event.notes,
    card_theme: event.card_theme,
    cover_image_url: event.cover_image_url,
    cover_fit: event.cover_fit,
    cover_position: event.cover_position,
    cover_zoom: event.cover_zoom,
  };
}

/** How the cover photo is framed on the card (defaults match the DB). */
export function coverFrame(invite) {
  return {
    fit: invite.cover_fit === "whole" ? "whole" : "fill",
    position: invite.cover_position || "50% 50%",
    zoom: Math.min(3, Math.max(1, Number(invite.cover_zoom) || 1)),
  };
}

/** Fill a message template for one guest. Unknown {placeholders} are left as typed. */
export function renderMessage(template, { guest, event }) {
  const values = {
    first_name: guest.name.split(" ")[0],
    name: guest.name,
    event: event.name,
    host: event.host_names ?? "",
    date: formatEventDate(event.starts_at),
    time: formatEventTime(event.starts_at),
    venue: event.venue,
    admits: guest.admits === 1 ? "1 person" : `${guest.admits} people`,
    link: inviteUrl(guest.token),
  };
  const text = (template?.trim() ? template : DEFAULT_MESSAGE).replace(/\{(\w+)\}/g, (m, key) =>
    key in values ? values[key] : m,
  );
  // Never send an invite without the link, even if the host deleted {link}.
  return text.includes(values.link) ? text : `${text}\n\n${values.link}`;
}

export async function markInviteSent(guestId) {
  await supabase.from("guests").update({ invite_sent_at: new Date().toISOString() }).eq("id", guestId);
}
