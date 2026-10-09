import { Check, Send, TriangleAlert } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { functionError } from "../lib/errors.js";
import { useFeedback } from "../lib/feedback.js";
import { guestlokSend, plusTargets } from "../lib/guestlokSend.js";
import { supabase } from "../lib/supabase.js";
import { ButtonSpinner } from "./Brand.jsx";
import Modal from "./Modal.jsx";

/**
 * Plus "Send all": Guestlok sends every invite from its WhatsApp number.
 * `only` = send to these guests (a single resend from the guest list).
 */
export default function GuestlokSend({ event, guests, only, onClose, onEventChange, onDone }) {
  const { toast } = useFeedback();
  const [snapshot] = useState(() => only ?? plusTargets(guests));
  const left = Math.max(event.wa_quota - event.wa_sent, 0);
  const queue = useMemo(() => snapshot.slice(0, left), [snapshot, left]);
  const overflow = snapshot.length - queue.length;
  const noPhone = guests.filter((g) => !g.phone).length;
  const [state, setState] = useState("ready"); // ready | running | done
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const stop = useRef(false);

  async function run() {
    stop.current = false;
    setState("running");
    try {
      const totals = await guestlokSend(event, queue, setProgress, () => stop.current);
      setResult(totals);
    } catch (err) {
      toast(await functionError(err, "Sending stopped. Check your connection and try again."), { tone: "error" });
      setResult(null);
    }
    // Refresh the allowance shown elsewhere.
    const { data } = await supabase.from("events").select("wa_quota, wa_sent").eq("id", event.id).single();
    if (data) onEventChange?.({ ...event, ...data });
    onDone?.();
    setState("done");
  }

  const pct = progress ? Math.round((progress.done / Math.max(progress.total, 1)) * 100) : 0;
  const label =
    only?.length === 1 ? `Send to ${only[0].name.split(" ")[0]}` : `Send ${queue.length.toLocaleString()} invite${queue.length === 1 ? "" : "s"}`;

  return (
    <Modal
      open
      onClose={state === "running" ? () => {} : onClose}
      title={only?.length === 1 ? "Send this invite" : "Guestlok sends your invites"}
      description="From the official Guestlok WhatsApp, with each guest’s ticket attached."
    >
      <div className="flex flex-col gap-5">
        {state === "ready" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[22px] bg-tile p-4">
                <p className="text-sm text-brown-soft">To send now</p>
                <p className="bento-num text-[40px] mt-1">{queue.length}</p>
              </div>
              <div className="rounded-[22px] bg-tile p-4">
                <p className="text-sm text-brown-soft">Sends left</p>
                <p className="bento-num text-[40px] mt-1">{left}</p>
              </div>
            </div>

            {snapshot.length === 0 && (
              <p className="alert-info">Everyone with a phone number already has their invite. Guests without a number can use their ticket or link.</p>
            )}
            {overflow > 0 && (
              <p className="flex gap-2.5 rounded-2xl bg-coral/15 text-[#7A2A1E] px-4 py-3 text-sm">
                <TriangleAlert size={18} className="shrink-0" aria-hidden="true" />
                {overflow} guest{overflow === 1 ? "" : "s"} won’t get one yet: you’re out of sends. Add more in Settings, then send again.
              </p>
            )}

            <ul className="flex flex-col gap-2 text-sm text-brown-soft">
              <li className="flex gap-2"><Check size={16} className="shrink-0 text-leaf" aria-hidden="true" /> Each guest gets their own ticket and a “View my ticket” button.</li>
              <li className="flex gap-2"><Check size={16} className="shrink-0 text-leaf" aria-hidden="true" /> You’ll see Sent, Delivered and Read for every guest.</li>
              <li className="flex gap-2"><Check size={16} className="shrink-0 text-leaf" aria-hidden="true" /> If one doesn’t deliver, the send is given back and you can retry.</li>
              {noPhone > 0 && !only && <li className="flex gap-2"><Check size={16} className="shrink-0 text-leaf" aria-hidden="true" /> {noPhone} guest{noPhone === 1 ? " has" : "s have"} no number. Share their ticket or link yourself.</li>}
            </ul>

            <button type="button" onClick={run} disabled={queue.length === 0} className="btn-ochre btn-lg">
              <Send size={18} aria-hidden="true" /> {label}
            </button>
          </>
        )}

        {state === "running" && (
          <div className="flex flex-col gap-4 py-2" role="status" aria-live="polite">
            <p className="text-[18px] tracking-[-0.01em] inline-flex items-center gap-2">
              <ButtonSpinner />
              {progress?.phase === "sending" ? "Sending on WhatsApp…" : "Preparing tickets…"}
            </p>
            <div className="h-3 rounded-full bg-tile overflow-hidden" aria-hidden="true">
              <div className="h-full bg-ochre transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-sm text-brown-soft tabular-nums">
              {progress ? `${progress.done} of ${progress.total}` : "Starting"} · {progress?.sent ?? 0} sent
              {progress?.failed ? ` · ${progress.failed} failed` : ""}
            </p>
            <p className="text-sm text-brown-soft">Keep this page open until it finishes.</p>
            <button
              type="button"
              onClick={() => {
                stop.current = true;
              }}
              className="btn bg-tile hover:bg-sand self-start"
            >
              Stop after this batch
            </button>
          </div>
        )}

        {state === "done" && (
          <div className="flex flex-col items-center text-center gap-3 py-4">
            <span className={`w-14 h-14 rounded-full inline-flex items-center justify-center ${result?.sent ? "bg-leaf text-white" : "bg-tile"}`}>
              {result?.sent ? <Check size={24} aria-hidden="true" /> : <TriangleAlert size={22} aria-hidden="true" />}
            </span>
            <p className="hero-title">{result?.sent ? `${result.sent} sent` : "Nothing sent"}</p>
            <p className="text-brown-soft max-w-sm">
              {result?.failed ? `${result.failed} didn’t go through (wrong or non-WhatsApp number). Check the number, then tap Send again on that guest. ` : ""}
              {result?.noAllowance ? `${result.noAllowance} waiting: add more sends in Settings. ` : ""}
              {result?.sent ? "Delivery ticks appear on the guest list as WhatsApp confirms them." : ""}
            </p>
            <button type="button" onClick={onClose} className="btn-dark mt-2">Done</button>
          </div>
        )}
      </div>
    </Modal>
  );
}
