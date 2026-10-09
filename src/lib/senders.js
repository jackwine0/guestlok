/** Public link a helper opens to send their share of the invites. */
export function senderUrl(token) {
  return `${window.location.origin}/send/${token}`;
}

/** Guests a sender link covers: has a phone, and is on that side (or any side when side is null). */
export function senderScope(sender, guests) {
  return guests.filter((g) => g.phone && (!sender.side || g.side === sender.side));
}

/** Message the host forwards to the helper on WhatsApp. */
export function senderInviteText(sender, event) {
  const who = sender.side ? `the ${sender.side} guests` : "the guests";
  return [
    `Hi ${sender.label}, can you help me send the invites for ${event.name}?`,
    "",
    `Open this link on your phone. It lists ${who} with their personal invites, and each one opens WhatsApp with the message ready, so you just tap send:`,
    senderUrl(sender.token),
    "",
    "Please don’t share this link. Thank you!",
  ].join("\n");
}
