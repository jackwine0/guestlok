import { Download, FileText, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ButtonSpinner, Loader } from "../components/Brand.jsx";
import Modal from "../components/Modal.jsx";
import { MessageScreen } from "../components/Page.jsx";
import { useFeedback } from "../lib/feedback.js";
import { useTitle } from "../lib/useTitle.js";
import TicketCard from "../components/TicketCard.jsx";
import { themeOf } from "../lib/invite.js";
import { supabase } from "../lib/supabase.js";
import {
  dataUrlToBlob,
  pngToPdfBlob,
  renderTicketPng,
  downloadBlob,
  ticketFilename,
} from "../lib/ticketExport.jsx";

// iPhones save downloads to Files, not Photos; there we show the image to long-press instead.
const IS_IOS =
  typeof navigator !== "undefined" &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

export default function Invite() {
  const { token = "" } = useParams();
  const [invite, setInvite] = useState(undefined);
  const [busy, setBusy] = useState(null); // 'png' | 'pdf' | null
  const [error, setError] = useState(null);
  const [photo, setPhoto] = useState(null); // iPhone: { url, blob } shown so they can long-press → Save to Photos
  const { toast } = useFeedback();

  useEffect(() => {
    if (!/^[a-f0-9]{32}$/i.test(token)) {
      setInvite(null);
      return;
    }
    supabase.rpc("get_invite", { p_token: token }).then(({ data, error }) => {
      setInvite(error ? null : (data ?? null));
    });
  }, [token]);

  useTitle(invite ? `${invite.event_name} · Your invite` : "Your invite");
  if (invite === undefined) return <Loader fullScreen label="Opening your invite" />;

  if (invite === null) {
    return (
      <MessageScreen
        kicker="Invite"
        title="This invite isn’t valid."
        body="The link may be incomplete, or the host removed it. Please contact the person who invited you."
      />
    );
  }

  const t = themeOf(invite.card_theme);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(invite.venue)}`;

  async function save(kind) {
    setBusy(kind);
    setError(null);
    try {
      const png = await renderTicketPng(invite);
      if (kind === "png") {
        const blob = await dataUrlToBlob(png.dataUrl);
        if (IS_IOS) setPhoto({ url: png.dataUrl, blob });
        else {
          downloadBlob(blob, ticketFilename(invite, "png"));
          toast("Ticket image saved to your downloads");
        }
      } else {
        downloadBlob(await pngToPdfBlob(png), ticketFilename(invite, "pdf"));
        toast("Ticket PDF saved to your downloads");
      }
    } catch (err) {
      console.error(err);
      setError("Could not create the file. Take a screenshot of this page instead.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-dvh px-4 py-8 sm:py-14 flex flex-col items-center" style={{ background: t.page }}>
      <div className="w-full max-w-md flex flex-col gap-4">
        <TicketCard invite={invite} />

        {!invite.checked_in_at && !invite.event_over && (
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => save("png")} disabled={!!busy} className="btn-dark">
              {busy === "png" ? <ButtonSpinner /> : <Download size={18} aria-hidden="true" />} Save image
            </button>
            <button type="button" onClick={() => save("pdf")} disabled={!!busy} className="btn-light">
              {busy === "pdf" ? <ButtonSpinner /> : <FileText size={18} aria-hidden="true" />} Save PDF
            </button>
          </div>
        )}
        {!invite.event_over && <a href={mapsUrl} target="_blank" rel="noreferrer" className="btn bg-white/70 text-brown hover:bg-white">
          <MapPin size={18} aria-hidden="true" /> Directions to the venue
        </a>}
        {error && <p role="alert" className="text-center font-medium">{error}</p>}
      </div>

      <Modal open={!!photo} onClose={() => setPhoto(null)} title="Save your ticket" description="Press and hold the image, then tap “Save to Photos”." size="sm">
        {photo && (
          <div className="flex flex-col gap-4">
            <img src={photo.url} alt={`Invite for ${invite.guest_name}`} className="w-full max-h-[60dvh] object-contain rounded-2xl bg-tile [-webkit-touch-callout:default]" />
            <button type="button" onClick={() => downloadBlob(photo.blob, ticketFilename(invite, "png"))} className="btn-tile">
              <Download size={17} aria-hidden="true" /> Save to Files instead
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
