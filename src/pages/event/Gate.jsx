import { Check, Clock, Copy, ExternalLink, MessageCircle, MessageCircleQuestion, QrCode, ScanLine, Search, ShieldCheck, Smartphone, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Link, useOutletContext } from "react-router-dom";
import { EmptyState } from "../../components/Page.jsx";
import { useFeedback } from "../../lib/feedback.js";
import { scannerUrl, whatsappLink } from "../../lib/format.js";

/** What each scanner screen means, drawn like the real thing. */
const SCREENS = [
  { word: "Valid", icon: Check, cls: "bg-leaf text-white", body: "Let them in. The screen shows their name and how many people the invite admits." },
  { word: "Used", icon: Clock, cls: "bg-coral text-brown", body: "Already scanned. Politely ask for their name and check with the host." },
  { word: "Not invited", icon: X, cls: "bg-cream text-brown", body: "The code isn’t on this list. Tap “Ask the host” if they insist." },
];

const STEPS = [
  [Smartphone, "Open the link", "On any phone with a camera. No app, no login."],
  [QrCode, "Scan each guest", "Point at the QR on their phone or printed ticket."],
  [Search, "No phone? Find by name", "Ask for ID or the last 4 digits of their number first."],
  [MessageCircleQuestion, "Not on the list?", "Send it to the host. They say yes or no from the dashboard."],
];

export default function Gate() {
  const { event, guests, requests = [] } = useOutletContext();
  const { toast } = useFeedback();
  const url = scannerUrl(event.id, event.scanner_key);
  const message = `You’re on the gate for ${event.name}. Open this scanner on your phone and scan each guest’s QR code:\n${url}\n\nGreen = let them in. Red = stop. Don’t share this link.`;
  const invited = guests.reduce((s, g) => s + g.admits, 0);
  const inGuests = guests.filter((g) => g.checked_in_at);
  const arrived = inGuests.reduce((s, g) => s + g.admits, 0);
  const byQr = inGuests.filter((g) => g.check_in_method === "qr").length;
  const byName = inGuests.length - byQr;
  const pct = invited ? Math.round((arrived / invited) * 100) : 0;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast("Scanner link copied. Only share it with your ushers.");
    } catch {
      toast("Couldn’t copy. Long-press the link to copy it.", { tone: "error" });
    }
  }

  if (event.status !== "active") {
    return (
      <EmptyState icon={ScanLine} title="The gate is closed" body="This event has ended, so the scanner link no longer works. Your attendance numbers are on the overview.">
        <Link to=".." relative="path" className="btn-dark">See who came</Link>
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="px-1">
        <h2 className="page-title">Gate</h2>
        <p className="page-sub">Hand the scanner to your ushers and watch arrivals come in.</p>
      </div>

      <div className="grid gap-[18px] grid-cols-1 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        {/* Scanner link */}
        <section className="relative overflow-hidden rounded-[30px] sm:rounded-[36px] bg-brown text-cream p-6 sm:p-8 grid gap-7 md:grid-cols-[minmax(0,1fr)_auto] items-center" aria-labelledby="scanner-title">
          <div className="pointer-events-none absolute -left-24 -bottom-24 w-72 h-72 rounded-full bg-ochre/15 blur-2xl" aria-hidden="true" />
          <div className="relative flex flex-col gap-5 min-w-0">
            <span className="self-start h-8 px-3 rounded-full bg-white/10 text-sm inline-flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-leaf shadow-[0_0_0_4px_rgba(47,143,91,0.25)]" aria-hidden="true" /> Gate open
            </span>
            <div>
              <h3 id="scanner-title" className="hero-title">Gate scanner</h3>
              <p className="mt-2 text-sand max-w-md">A private link for your ushers. Several phones can use it at the same time.</p>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-white/10 pl-4 pr-1.5 py-1.5 min-w-0">
              <span className="flex-1 min-w-0 truncate font-mono text-[13px] text-sand" title={url}>{url.replace(/^https?:\/\//, "")}</span>
              <button type="button" onClick={copy} className="h-10 px-4 shrink-0 rounded-full bg-cream text-brown text-sm font-medium inline-flex items-center gap-1.5">
                <Copy size={15} aria-hidden="true" /> Copy
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <a href={whatsappLink(null, message)} target="_blank" rel="noreferrer" className="h-[52px] rounded-full bg-ochre text-brown font-medium inline-flex items-center justify-center gap-2 hover:brightness-95">
                <MessageCircle size={18} aria-hidden="true" /> Send to ushers
              </a>
              <a href={url} target="_blank" rel="noreferrer" className="h-[52px] rounded-full border-[1.5px] border-cream/40 inline-flex items-center justify-center gap-2 hover:bg-cream hover:text-brown transition">
                <ExternalLink size={18} aria-hidden="true" /> Open scanner
              </a>
            </div>
          </div>
          <figure className="relative flex flex-col items-center gap-3">
            <div className="bg-cream p-4 rounded-[28px]">
              <QRCodeSVG value={url} size={176} bgColor="#F5E7A8" fgColor="#2B1B12" level="M" title="QR code that opens the gate scanner" />
            </div>
            <figcaption className="text-sm text-sand text-center max-w-[210px]">Ushers scan this with their camera to open the scanner</figcaption>
          </figure>
        </section>

        {/* Live numbers */}
        <div className="grid gap-[18px] grid-cols-1 content-start">
          <section className="bento" aria-labelledby="live-title">
            <div className="flex items-center justify-between gap-3">
              <h3 id="live-title" className="section-title">At the gate</h3>
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-tile">Live</span>
            </div>
            <p className="bento-num text-[clamp(48px,5vw,64px)] mt-4">
              {arrived}
              <span className="text-[0.4em] text-mute"> / {invited} in</span>
            </p>
            <div className="mt-4 flex gap-1" aria-hidden="true">
              {Array.from({ length: 20 }, (_, i) => (
                <i key={i} className={`h-7 flex-1 rounded-full ${i < Math.round(pct / 5) ? "bg-ochre" : "bg-tile"}`} />
              ))}
            </div>
            <p className="mt-2 text-sm text-brown-soft">{pct}% of guests have arrived</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-[20px] bg-tile p-4">
                <p className="text-[13px] text-brown-soft">Scanned QR</p>
                <p className="bento-num text-[32px] mt-1">{byQr}</p>
              </div>
              <div className="rounded-[20px] bg-tile p-4">
                <p className="text-[13px] text-brown-soft">Found by name</p>
                <p className="bento-num text-[32px] mt-1">{byName}</p>
              </div>
            </div>
          </section>
          {requests.length > 0 && (
            <Link to=".." relative="path" className="rounded-[26px] bg-coral text-brown p-5 flex items-center justify-between gap-3 hover:brightness-95">
              <span>
                <span className="block font-medium">{requests.length} waiting at the gate</span>
                <span className="text-sm text-brown/75">Answer them on the overview</span>
              </span>
              <MessageCircleQuestion size={22} aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>

      {/* Usher briefing */}
      <section className="bento" aria-labelledby="brief-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 id="brief-title" className="section-title sm:text-[28px]">Usher briefing</h3>
            <p className="mt-1 text-brown-soft">Two minutes with your ushers before the gate opens. This is all they need.</p>
          </div>
          <a href={whatsappLink(null, `${message}\n\nWhat the screens mean:\n✅ Valid: let them in\n🟠 Used: already scanned, check with the host\n⛔ Not invited: don’t let them in. Tap “Ask the host” if they insist.`)} target="_blank" rel="noreferrer" className="h-11 px-4 rounded-full bg-tile hover:bg-sand text-sm inline-flex items-center gap-2">
            <MessageCircle size={16} aria-hidden="true" /> Send briefing
          </a>
        </div>

        <div className="mt-6 grid gap-3 grid-cols-1 sm:grid-cols-3">
          {SCREENS.map(({ word, icon: Icon, cls, body }) => (
            <div key={word} className="rounded-[26px] bg-tile p-3 flex flex-col gap-3">
              <div className={`rounded-[20px] h-32 sm:h-36 p-4 flex flex-col justify-between ${cls}`} aria-hidden="true">
                <Icon size={26} strokeWidth={2.4} />
                <p className="text-[30px] font-medium tracking-[-0.05em] leading-none">{word}</p>
              </div>
              <p className="px-1 pb-1 text-[15px] text-brown-soft">
                <b className="font-medium text-brown">{word}.</b> {body}
              </p>
            </div>
          ))}
        </div>

        <ol className="mt-6 grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          {STEPS.map(([Icon, title, body], i) => (
            <li key={title} className="rounded-[22px] border-[1.5px] border-tile p-4 flex gap-3">
              <span className="w-10 h-10 shrink-0 rounded-full bg-ochre inline-flex items-center justify-center" aria-hidden="true">
                <Icon size={18} />
              </span>
              <div className="min-w-0">
                <p className="text-[15px]"><span className="text-mute mr-1">{i + 1}.</span>{title}</p>
                <p className="text-sm text-brown-soft mt-0.5">{body}</p>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-5 flex items-start gap-2 text-sm text-brown-soft">
          <ShieldCheck size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          Each QR works once. If someone forwards their invite, the second person sees “Used” at the gate.
        </p>
      </section>
    </div>
  );
}
