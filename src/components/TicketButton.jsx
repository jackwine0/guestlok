import { ImageDown, Share2 } from "lucide-react";
import { useState } from "react";
import { toInvite } from "../lib/invite.js";
import {
  canShareFiles,
  dataUrlToBlob,
  renderTicketPng,
  shareOrDownload,
  ticketFilename,
} from "../lib/ticketExport.jsx";
import { ButtonSpinner } from "./Brand.jsx";

/**
 * Makes the guest's ticket as a PNG.
 * Phones: opens the share sheet (pick WhatsApp → the guest's chat) with the message attached.
 * Desktop: downloads the image.
 */
export default function TicketButton({ guest, event, message, onShared, className = "", label }) {
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(null); // blob waiting for a fresh tap
  const [error, setError] = useState(null);
  const share = canShareFiles();
  const filename = ticketFilename(toInvite(guest, event), "png");

  async function run() {
    setError(null);
    try {
      let blob = pending;
      if (!blob) {
        setBusy(true);
        const png = await renderTicketPng(toInvite(guest, event));
        blob = await dataUrlToBlob(png.dataUrl);
        setBusy(false);
      }
      const result = await shareOrDownload(blob, filename, message);
      if (result === "needs-tap") {
        setPending(blob);
        return;
      }
      setPending(null);
      if (result === "shared" || result === "downloaded") onShared?.(result);
    } catch (err) {
      console.error(err);
      setBusy(false);
      setError("Could not create the ticket.");
    }
  }

  const text = pending ? "Tap to share" : label ?? (share ? "Send ticket" : "Ticket");

  return (
    <>
      <button
        type="button"
        onClick={run}
        disabled={busy}
        title={share ? "Share the ticket image (e.g. to WhatsApp)" : "Download the ticket image"}
        className={className || "h-10 px-4 rounded-full bg-tile hover:bg-sand text-sm font-medium inline-flex items-center gap-1.5"}
      >
        {busy ? <ButtonSpinner /> : share ? <Share2 size={15} aria-hidden="true" /> : <ImageDown size={15} aria-hidden="true" />}
        {text}
      </button>
      {error && (
        <span role="alert" className="text-xs text-[#9A3324] font-medium self-center">
          {error}
        </span>
      )}
    </>
  );
}
