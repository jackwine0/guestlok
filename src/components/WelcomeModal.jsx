import { ArrowRight, Mail, ScanLine, Send, UserPlus } from "lucide-react";
import { Link } from "react-router-dom";
import { SunMark } from "./Brand.jsx";
import Modal from "./Modal.jsx";

const NEXT = [
  [Mail, "Design your invitation", "Cover photo, colours and your WhatsApp message.", "invitation"],
  [UserPlus, "Add your guests", "One by one or import a CSV. Set plus-ones and sides.", "guests"],
  [Send, "Send invites", "Each guest gets their own QR on WhatsApp.", "guests?send=1"],
  [ScanLine, "Brief your ushers", "Share the gate scanner link before the day.", "gate"],
];

/** Shown once, straight after Paystack confirms the payment. */
export default function WelcomeModal({ open, onClose, event }) {
  return (
    <Modal open={open} onClose={onClose} title="You’re live" size="md">
      <div className="-mt-4 flex flex-col gap-6">
        <div className="flex items-center gap-4 rounded-[24px] bg-ochre p-4">
          <SunMark size={56} ray="#2B1B12" animated />
          <p className="text-[15px]">
            Payment confirmed for <b className="font-medium">{event.name}</b>. Your list holds up to {event.headcount.toLocaleString()} people.
          </p>
        </div>

        <div>
          <p className="text-sm text-brown-soft mb-2">Here’s what to do next</p>
          <ol className="flex flex-col gap-2">
            {NEXT.map(([Icon, title, body, to], i) => (
              <li key={title}>
                <Link to={to} onClick={onClose} className="group flex items-center gap-3 rounded-[20px] bg-tile hover:bg-sand px-4 py-3 transition">
                  <span className="w-10 h-10 shrink-0 rounded-full bg-white inline-flex items-center justify-center" aria-hidden="true">
                    <Icon size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px]"><span className="text-mute mr-1">{i + 1}.</span>{title}</span>
                    <span className="block text-sm text-brown-soft">{body}</span>
                  </span>
                  <ArrowRight size={17} className="shrink-0 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
          <button type="button" onClick={onClose} className="btn bg-tile hover:bg-sand">Go to overview</button>
          <Link to="invitation" onClick={onClose} className="btn-dark">
            Start with the invitation <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </Modal>
  );
}
