/** What paying for a plan unlocks. Shown on the wizard and the draft checkout. */
export function unlocks(delivery = "self") {
  return [
    "Personal QR invite for every guest",
    delivery === "plus" ? "Guestlok sends every invite on WhatsApp for you" : "Send on WhatsApp from your phone, one tap each",
    "Gate scanner for all your ushers",
    "Live arrivals on your dashboard",
  ];
}

export const UNLOCKS = unlocks("self");
