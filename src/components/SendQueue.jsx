import { Check, ChevronRight, MessageCircle } from "lucide-react";
import { ButtonSpinner } from "./Brand.jsx";
import { useEffect, useMemo, useState } from "react";
import { whatsappLink } from "../lib/format.js";
import { markInviteSent, renderMessage } from "../lib/invite.js";
import { prepareTicketPreview } from "../lib/whatsappTicket.js";
import WhatsAppButton from "./WhatsAppButton.jsx";
import Modal from "./Modal.jsx";

/**
 * "Send to all": walks the host through every guest, one tap each.
 * WhatsApp doesn't allow apps to bulk-send from a normal number, so each send
 * opens the chat with the message ready and the host taps Send.
 */
export default function SendQueue({ event, guests, onClose, onShare }) {
  const [includeSent, setIncludeSent] = useState(false);
  // Freeze the list when the queue opens so it doesn't jump as guests get marked sent.
  const [snapshot] = useState(() => guests);
  const [side, setSide] = useState("");
  const sides = useMemo(() => [...new Set(snapshot.map((g) => g.side?.trim()).filter(Boolean))].sort(), [snapshot]);
  const queue = useMemo(
    () => snapshot.filter((g) => g.phone && !g.checked_in_at && (includeSent || !g.invite_sent_at) && (!side || g.side === side)),
    [snapshot, includeSent, side],
  );
  const noPhone = snapshot.filter((g) => !g.phone).length;
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(() => new Set());

  useEffect(() => setIndex(0), [includeSent, side]);

  // Get this guest's and the next guest's ticket image ready while the host reads.
  useEffect(() => {
    if (queue[index]) prepareTicketPreview(event, queue[index]);
    if (queue[index + 1]) prepareTicketPreview(event, queue[index + 1]);
  }, [queue, index, event]);

  const guest = queue[index];
  const finished = index >= queue.length;

  // The ticket picture the guest will see in the message.
  const [preview, setPreview] = useState(null); // { id, url } | { id, failed }
  useEffect(() => {
    if (!guest) return;
    let alive = true;
    prepareTicketPreview(event, guest)
      ?.then((url) => alive && setPreview({ id: guest.id, url }))
      .catch(() => alive && setPreview({ id: guest.id, failed: true }));
    return () => {
      alive = false;
    };
  }, [guest, event]);
  const shown = preview?.id === guest?.id ? preview : null;
  const message = guest ? renderMessage(event.invite_message, { guest, event }) : "";

  function sent() {
    if (!guest) return;
    markInviteSent(guest.id);
    setDone((d) => new Set(d).add(guest.id));
    setIndex((i) => i + 1);
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Send invites"
      description={queue.length === 0 ? "Nobody left to send to." : `${Math.min(index + 1, queue.length)} of ${queue.length} · ${done.size} sent`}
    >
      <div className="flex flex-col gap-6">
        <div className="h-2 rounded-full bg-tile overflow-hidden" aria-hidden="true">
          <div className="h-full bg-ochre transition-all" style={{ width: `${queue.length ? (Math.min(index, queue.length) / queue.length) * 100 : 100}%` }} />
        </div>

        {finished ? (
          <div className="flex flex-col items-center text-center gap-3 py-6">
            <span className="w-14 h-14 rounded-full bg-leaf text-white inline-flex items-center justify-center"><Check size={24} aria-hidden="true" /></span>
            <p className="hero-title">All done</p>
            <p className="text-brown-soft">
              {done.size} invite{done.size === 1 ? "" : "s"} sent.
              {noPhone > 0 && ` ${noPhone} guest${noPhone === 1 ? " has" : "s have"} no phone number. Use “Copy link” or “Ticket” for them.`}
            </p>
            <button type="button" onClick={onClose} className="btn-dark mt-2">Close</button>
          </div>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[20px] tracking-[-0.02em] truncate">{guest.name}</p>
              <p className="shrink-0 text-sm text-brown-soft">+{guest.phone}</p>
            </div>

            {/* What the guest gets: one WhatsApp message with their ticket on top */}
            <div className="rounded-[24px] bg-[#E6DDD2] p-3 sm:p-4">
              <div className="ml-auto max-w-[92%] rounded-[18px] rounded-tr-md bg-[#DCF8C6] p-1.5 shadow-sm">
                <div className="relative h-[150px] rounded-[14px] overflow-hidden bg-white/60 flex items-center justify-center">
                  {shown?.url ? (
                    <img src={shown.url} alt={`Ticket for ${guest.name}`} className="w-full h-full object-cover object-center" />
                  ) : shown?.failed ? (
                    <span className="px-4 text-center text-xs text-brown-soft">Ticket picture couldn’t be added. The message still has their ticket link.</span>
                  ) : (
                    <span className="inline-flex items-center gap-2 text-xs text-brown-soft">
                      <ButtonSpinner /> Adding their ticket…
                    </span>
                  )}
                </div>
                <p className="px-2 pt-2 pb-1 text-[13px] leading-relaxed whitespace-pre-line line-clamp-5">{message}</p>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <WhatsAppButton
                key={guest.id}
                href={whatsappLink(guest.phone, message)}
                prepare={() => prepareTicketPreview(event, guest)}
                onOpened={sent}
                className="btn-ochre btn-lg"
              >
                <MessageCircle size={20} aria-hidden="true" /> Send to {guest.name.split(" ")[0]} on WhatsApp
              </WhatsAppButton>
              <button type="button" onClick={() => setIndex((i) => i + 1)} className="btn text-brown-soft hover:text-brown">
                Skip <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>

            <p className="text-xs text-brown-soft">
              WhatsApp opens with the message and ticket ready. Wait a second for the ticket to appear, tap send, then come back here for the next guest.
            </p>
          </>
        )}

        {queue.length > 15 && !finished && onShare && (
          <button type="button" onClick={onShare} className="rounded-[20px] bg-brown text-cream px-4 py-3 text-sm flex items-center justify-between gap-3 text-left hover:bg-black transition">
            <span>
              <b className="font-medium">{queue.length - index} to go?</b> Share the list with family or your planner and send together.
            </span>
            <span className="shrink-0 text-ochre font-medium">Share →</span>
          </button>
        )}

        {sides.length > 0 && (
          <div className="flex items-center gap-2.5 text-sm">
            <label htmlFor="queue-side" className="shrink-0 text-brown-soft">Send to</label>
            <select id="queue-side" value={side} onChange={(e) => setSide(e.target.value)} className="field h-11 text-sm">
              <option value="">Everyone</option>
              {sides.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        )}

        <label className="flex items-center gap-2.5 text-sm">
          <input type="checkbox" checked={includeSent} onChange={(e) => setIncludeSent(e.target.checked)} className="w-4 h-4 accent-brown" />
          Include guests who were already sent an invite
        </label>
      </div>
    </Modal>
  );
}
