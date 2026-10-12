import { ChartColumn, MessageCircleQuestion, Palette, QrCode, ScanLine, Send, Smartphone } from "lucide-react";

/**
 * What a plan gets you, in plain words: one list used by the landing page, the new-event
 * wizard and checkout, so hosts read the same thing everywhere.
 * Every plan has every feature; the plan size only sets how many people you can invite.
 */
export const FEATURES = [
  {
    id: "qr",
    icon: QrCode,
    title: "A personal QR invite for every guest",
    what: "Each guest gets their own ticket with their name and how many people it admits. The code opens the gate once, so a forwarded invite shows “Used”.",
  },
  {
    id: "design",
    icon: Palette,
    title: "Your invite, your style",
    what: "Add a cover photo, pick the colours and write the message your guests receive.",
  },
  {
    id: "send",
    icon: Smartphone,
    title: "Send on WhatsApp from your phone",
    what: "One tap per guest opens WhatsApp with their invite and ticket ready. Family or your planner can help through a private sending link.",
  },
  {
    id: "gate",
    icon: ScanLine,
    title: "Gate scanner for your ushers",
    what: "Ushers open one link on any phone and scan. They see Valid, Used or Not invited, and can find guests by name if a phone dies.",
  },
  {
    id: "ask",
    icon: MessageCircleQuestion,
    title: "Ask the host",
    what: "Someone not on the list insists? The usher sends you a request and you tap yes or no from your dashboard.",
  },
  {
    id: "live",
    icon: ChartColumn,
    title: "Live arrivals, then attendance",
    what: "Watch guests arrive as the gate scans, and download the attendance list after the event.",
  },
];

export const PLUS_FEATURE = {
  id: "plus",
  icon: Send,
  title: "Guestlok sends every invite for you",
  what: "One tap sends all your invites from the official Guestlok WhatsApp, with the ticket picture and a “View my ticket” button. You see Sent, Delivered and Read for each guest, and can still send from your own phone whenever you like.",
};

/** Features for a delivery choice: Plus is everything in Standard, with Guestlok sending on top. */
export function featuresFor(delivery = "self") {
  return delivery === "plus" ? [PLUS_FEATURE, ...FEATURES] : FEATURES;
}
