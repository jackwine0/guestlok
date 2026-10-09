import { Download, RotateCcw } from "lucide-react";
import { useState } from "react";
import { downloadAttendance, reopenUntil } from "../lib/attendance.js";
import { friendlyError } from "../lib/errors.js";
import { useFeedback } from "../lib/feedback.js";
import { formatEventTime, formatShortDate } from "../lib/format.js";
import { supabase } from "../lib/supabase.js";
import { ButtonSpinner, KeyholeDisc } from "./Brand.jsx";

/** Shown on an ended event: the outcome, the CSV, and "reopen" if it was a mistake. */
export default function EndedPanel({ event, guests, onEventChange, className = "", compact = false }) {
  const { confirm, toast } = useFeedback();
  const [busy, setBusy] = useState(false);
  const invited = guests.reduce((n, g) => n + g.admits, 0);
  const came = guests.filter((g) => g.checked_in_at).reduce((n, g) => n + g.admits, 0);
  const until = reopenUntil(event);
  const how = event.ended_by === "auto" ? "automatically, 24 hours after the start" : "by you";

  async function reopen() {
    const sure = await confirm({
      title: "Reopen this event?",
      body: "The gate scanner works again and you can edit the guest list. Your ushers can keep using the same link.",
      confirmLabel: "Reopen event",
    });
    if (!sure) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("gl_reopen_event", { p_event: event.id });
    setBusy(false);
    if (error) toast(friendlyError(error), { tone: "error" });
    else {
      onEventChange(data);
      toast("Event reopened. The gate is open again.");
    }
  }

  function download() {
    const n = downloadAttendance(event, guests);
    toast(`Downloaded ${n} guest${n === 1 ? "" : "s"}`);
  }

  return (
    <section className={`relative overflow-hidden rounded-[30px] sm:rounded-[36px] bg-brown text-cream p-6 sm:p-8 ${className}`} aria-labelledby="ended-title">
      <KeyholeDisc disc="#EEB12F" hole="#2B1B12" className="absolute -right-10 -top-10 w-44 h-44 opacity-15" />
      <div className={`relative flex flex-col gap-6 ${compact ? "" : "lg:flex-row lg:items-end lg:justify-between"}`}>
        <div>
          <p className="text-sand text-sm">
            Ended {how}
            {event.ended_at ? ` · ${formatShortDate(event.ended_at)}, ${formatEventTime(event.ended_at)}` : ""}
          </p>
          <h2 id="ended-title" className={`mt-2 ${compact ? "text-[32px] font-normal tracking-[-0.04em] leading-[1.05]" : "hero-title"}`}>
            {came} of {invited} guests came
          </h2>
          <p className="mt-2 text-sand max-w-lg">The gate is closed and the list is locked. Everything stays here for your records.</p>
        </div>
        <div className={`flex flex-col gap-2.5 shrink-0 ${compact ? "" : "sm:flex-row"}`}>
          <button type="button" onClick={download} disabled={!guests.length} className="h-[52px] px-6 rounded-full bg-ochre text-brown font-medium inline-flex items-center justify-center gap-2 hover:brightness-95 disabled:opacity-50">
            <Download size={18} aria-hidden="true" /> Download attendance
          </button>
          {until && (
            <button type="button" onClick={reopen} disabled={busy} className="h-[52px] px-6 rounded-full border-[1.5px] border-cream/40 inline-flex items-center justify-center gap-2 hover:bg-cream hover:text-brown transition">
              {busy ? <ButtonSpinner /> : <RotateCcw size={17} aria-hidden="true" />} Reopen
            </button>
          )}
        </div>
      </div>
      {until && (
        <p className="relative mt-4 text-sm text-sand">Ended by mistake? You can reopen it until {formatEventTime(until.toISOString())}.</p>
      )}
    </section>
  );
}
