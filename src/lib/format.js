const TZ = "Africa/Lagos";

export function formatEventDate(iso) {
  return new Intl.DateTimeFormat("en-NG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TZ,
  }).format(new Date(iso));
}

export function formatEventTime(iso) {
  return new Intl.DateTimeFormat("en-NG", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: TZ,
  }).format(new Date(iso));
}

export function formatShortDate(iso) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: TZ,
  }).format(new Date(iso));
}

export function formatNaira(kobo) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(kobo / 100);
}

/**
 * Normalise a Nigerian (or international) phone number to digits-only
 * international format, e.g. "0803 123 4567" -> "2348031234567".
 * Returns null when there aren't enough digits to be a phone number.
 */
export function normalizePhone(raw) {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0"))
    digits = "234" + digits.slice(1);
  if (digits.length === 10 && /^[789]/.test(digits)) digits = "234" + digits;
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

// Links that leave the app (invites in WhatsApp, QR codes) always point at the live site,
// even when you're testing on localhost, so WhatsApp can show the ticket preview.
// Set VITE_SITE_URL in .env.local; without it the current address is used.
const SITE_URL = (import.meta.env.VITE_SITE_URL || "").replace(/\/$/, "");

export function inviteUrl(token) {
  return `${SITE_URL || window.location.origin}/i/${token}`;
}

export function scannerUrl(eventId, key) {
  return `${window.location.origin}/scan/${eventId}?k=${key}`;
}

export function whatsappLink(phone, message) {
  const text = encodeURIComponent(message);
  return phone
    ? `https://wa.me/${phone}?text=${text}`
    : `https://wa.me/?text=${text}`;
}

export function inviteMessage(opts) {
  const first = opts.guestName.split(" ")[0];
  const admits =
    opts.admits === 1 ? "admits 1 person" : `admits ${opts.admits} people`;
  return [
    `Hi ${first}! You're invited to ${opts.eventName}.`,
    ``,
    `${formatEventDate(opts.startsAt)}, ${formatEventTime(opts.startsAt)}`,
    `${opts.venue}`,
    ``,
    `This is your personal invite and it ${admits}. Show the QR code at the gate:`,
    inviteUrl(opts.token),
    ``,
    `Please don't forward it, it only works once.`,
  ].join("\n");
}

/** Pull an invite token out of whatever a QR code contains (full URL or raw token). */
export function extractToken(scanned) {
  const text = scanned.trim();
  const match =
    text.match(/\/i\/([a-f0-9]{32})/i) ?? text.match(/^([a-f0-9]{32})$/i);
  return match ? match[1].toLowerCase() : null;
}
