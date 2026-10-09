import { QRCodeSVG } from "qrcode.react";
import { forwardRef } from "react";
import { formatEventDate, formatEventTime, inviteUrl } from "../lib/format.js";
import { coverFrame, themeOf } from "../lib/invite.js";
import { Wordmark } from "./Brand.jsx";

/**
 * The invite card. Used on the guest's invite page, in the host's preview,
 * and rendered off-screen to export PNG / PDF tickets.
 *
 * `invite` has the same shape as the get_invite() response.
 * Set `exportMode` for a fixed-width card (what gets saved as an image).
 */
const TicketCard = forwardRef(function TicketCard({ invite, exportMode = false, sample = false }, ref) {
  const t = themeOf(invite.card_theme);
  const firstName = invite.guest_name.split(" ")[0];
  const checkedIn = !!invite.checked_in_at && !exportMode;
  const over = !!invite.event_over && !exportMode;

  return (
    <div
      ref={ref}
      style={{ background: t.page, color: t.ink, width: exportMode ? 400 : undefined }}
      className={`font-sans flex flex-col gap-4 ${exportMode ? "p-5" : "w-full"}`}
    >
      <div className="text-center text-xl" style={{ color: t.ink }}>
        <Wordmark disc={t.ink} hole={t.page} />
      </div>

      <article className="bg-white rounded-[32px] overflow-hidden">
        {invite.cover_image_url && <Cover invite={invite} />}

        <div className="px-7 pt-7 pb-6 text-center flex flex-col gap-2" style={{ background: t.head, color: t.headText }}>
          <p className="font-mono text-xs uppercase tracking-[0.12em] opacity-80">You’re invited, {firstName}</p>
          <h1 className="font-serif text-[40px] leading-[1.04] break-words">{invite.event_name}</h1>
          {invite.host_names && <p className="opacity-80">Hosted by {invite.host_names}</p>}
        </div>

        <div className="px-6 py-6 flex flex-col items-center gap-5">
          {checkedIn ? (
            <div className="w-full rounded-3xl bg-leaf text-white p-6 text-center">
              <p className="text-3xl font-medium tracking-tight">{over ? "Thanks for coming" : "You’re in"}</p>
              <p className="mt-1">
                Checked in at {formatEventTime(invite.checked_in_at)}.{over ? " We hope you had a great time." : " Enjoy the party!"}
              </p>
            </div>
          ) : over ? (
            <div className="w-full rounded-3xl p-6 text-center" style={{ background: t.soft }}>
              <p className="text-3xl font-medium tracking-tight">This event has ended</p>
              <p className="mt-1 opacity-75">The gate is closed, so this invite no longer works.</p>
            </div>
          ) : (
            <>
              <div className="p-4 rounded-3xl" style={{ background: t.soft }}>
                <QRCodeSVG
                  value={sample ? "https://guestlok.app/sample" : inviteUrl(invite.token)}
                  size={exportMode ? 220 : 232}
                  level="M"
                  bgColor={t.soft}
                  fgColor={t.ink}
                  title={`Invite QR code for ${invite.guest_name}`}
                />
              </div>
              <p className="text-center text-[14px] max-w-[280px] opacity-75">
                Show this at the gate. It works once, so please don’t forward it.
              </p>
            </>
          )}

          <div className="w-full grid grid-cols-2 gap-3 text-center">
            <div className="rounded-2xl p-4" style={{ background: t.soft }}>
              <p className="text-sm opacity-70">Guest</p>
              <p className="font-medium break-words">{invite.guest_name}</p>
            </div>
            <div className="rounded-2xl p-4" style={{ background: t.soft }}>
              <p className="text-sm opacity-70">Admits</p>
              <p className="font-medium">
                {invite.admits} {invite.admits === 1 ? "person" : "people"}
              </p>
            </div>
          </div>

          <dl className="w-full flex flex-col gap-3 text-[15px]">
            <Row label="Date" value={formatEventDate(invite.starts_at)} />
            <Row label="Time" value={formatEventTime(invite.starts_at)} />
            <Row label="Venue" value={invite.venue} />
          </dl>

          {invite.notes && (
            <p className="w-full rounded-2xl p-4 text-[15px] whitespace-pre-line" style={{ background: t.note }}>
              {invite.notes}
            </p>
          )}
        </div>
      </article>

      <p className="text-center text-xs opacity-80">Only invited guests get in · guestlok</p>
    </div>
  );
});

/** Cover photo, framed the way the host set it up in the invitation editor. */
export function Cover({ invite, className = "" }) {
  const f = coverFrame(invite);
  if (f.fit === "whole") {
    return <img src={invite.cover_image_url} alt="" crossOrigin="anonymous" draggable={false} className={`block w-full h-auto max-h-[640px] object-contain ${className}`} />;
  }
  return (
    <div className={`w-full aspect-[4/3] overflow-hidden ${className}`}>
      <img
        src={invite.cover_image_url}
        alt=""
        crossOrigin="anonymous"
        draggable={false}
        className="block w-full h-full object-cover select-none"
        style={{ objectPosition: f.position, transform: `scale(${f.zoom})`, transformOrigin: f.position }}
      />
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4 border-t border-black/10 pt-3">
      <dt className="opacity-70">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

export default TicketCard;
