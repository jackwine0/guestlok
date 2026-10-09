import Papa from "papaparse";
import { formatEventTime, formatShortDate } from "./format.js";

/** Download the guest list with who came, as a CSV that opens in Excel / Sheets. */
export function downloadAttendance(event, guests) {
  const rows = [...guests]
    .sort((a, b) => Number(!!b.checked_in_at) - Number(!!a.checked_in_at) || a.name.localeCompare(b.name))
    .map((g) => ({
      Name: g.name,
      Phone: g.phone ? `+${g.phone}` : "",
      Side: g.side ?? "",
      Admits: g.admits,
      Attended: g.checked_in_at ? "Yes" : "No",
      "Arrived at": g.checked_in_at ? `${formatShortDate(g.checked_in_at)} ${formatEventTime(g.checked_in_at)}` : "",
      "Checked in by": g.checked_in_at ? (g.check_in_method === "manual" ? "Name lookup" : "QR scan") : "",
      "Invite sent": g.invite_sent_at ? "Yes" : "No",
    }));
  // BOM so Excel reads Yorùbá / Igbo characters correctly.
  const csv = "﻿" + Papa.unparse(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const slug = event.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "event";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${slug}-attendance.csv`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return rows.length;
}

/** Can the host still reopen this event? (Matches gl_reopen_event in the DB.) */
export function reopenUntil(event) {
  if (event.status !== "ended" || event.ended_by !== "host" || !event.ended_at) return null;
  const until = Math.min(new Date(event.ended_at).getTime() + 3600_000, new Date(event.starts_at).getTime() + 24 * 3600_000);
  return until > Date.now() ? new Date(until) : null;
}
