import { ArrowRight, Download, Link2, MessageCircle, Minus, MoreHorizontal, Plus, RotateCcw, Search, Send, Share2, Smartphone, Trash2, Upload, UserPlus, Users } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { ButtonSpinner } from "../../components/Brand.jsx";
import GuestImport from "../../components/GuestImport.jsx";
import GuestlokSend from "../../components/GuestlokSend.jsx";
import Modal from "../../components/Modal.jsx";
import SendQueue from "../../components/SendQueue.jsx";
import ShareSending from "../../components/ShareSending.jsx";
import TicketButton from "../../components/TicketButton.jsx";
import Segmented from "../../components/Segmented.jsx";
import WhatsAppButton from "../../components/WhatsAppButton.jsx";
import { useSwapMotion } from "../../lib/tabTransition.js";
import { prepareTicketPreview } from "../../lib/whatsappTicket.js";
import { friendlyError } from "../../lib/errors.js";
import { inviteLink, normalizePhone, whatsappLink } from "../../lib/format.js";
import { downloadAttendance } from "../../lib/attendance.js";
import { useFeedback } from "../../lib/feedback.js";
import { hasInvite, inviteDetail, inviteStatus, needsInvite } from "../../lib/guestStatus.js";
import { canShareFiles } from "../../lib/ticketExport.jsx";
import { markInviteSent, renderMessage } from "../../lib/invite.js";
import { supabase } from "../../lib/supabase.js";

const PAGE = 60;
const FILTERS = [
  ["all", "All"],
  ["expected", "Not arrived"],
  ["arrived", "Arrived"],
  ["unsent", "To send"],
];

export default function Guests() {
  const { event, setEvent, guests, reloadGuests: reload } = useOutletContext();
  const plus = event.delivery === "plus";
  const [sendOnly, setSendOnly] = useState(null); // Plus: Guestlok sends to one guest
  const [sheetId, setSheetId] = useState(null); // the guest whose sheet (⋯) is open
  const [sharing, setSharing] = useState(false);
  const [params, setParams] = useSearchParams();
  const [panel, setPanel] = useState(null); // 'add' | 'import' | null
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sideFilter, setSideFilter] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [sending, setSending] = useState(() => params.get("send") === "1");
  const [mode, setMode] = useState(null); // Plus: 'guestlok' | 'phone', picked when they tap Send all
  const { toast, confirm } = useFeedback();

  // Data protection: the first time a host adds guests to an event, they confirm they may
  // share these contacts with us. Saved on the event (migration 14), so it's asked once.
  async function openPanel(kind) {
    const key = `gl_consent_${event.id}`;
    let agreed = !!event.guest_consent_at;
    try {
      agreed ||= localStorage.getItem(key) === "1";
    } catch {
      /* storage blocked */
    }
    if (!agreed) {
      const ok = await confirm({
        title: "Before you add guests",
        body: "Guestlok keeps each guest’s name and WhatsApp number so we can deliver their invite and check them in at the gate.",
        points: [
          "These are people you’re inviting, who’d expect to hear from you about this event.",
          "You have their permission to share their name and number with Guestlok for it.",
          "We only use them for this event, never for marketing. You can delete them any time.",
        ],
        confirmLabel: "I have their permission",
        cancelLabel: "Not now",
      });
      if (!ok) return;
      try {
        localStorage.setItem(key, "1");
      } catch {
        /* storage blocked */
      }
      if ("guest_consent_at" in event) {
        const { data } = await supabase.from("events").update({ guest_consent_at: new Date().toISOString() }).eq("id", event.id).select("*").single();
        if (data) setEvent(data);
      }
    }
    setPanel(kind);
  }

  function closeQueue() {
    setSending(false);
    setMode(null);
    if (params.has("send")) {
      params.delete("send");
      setParams(params, { replace: true });
    }
  }

  const locked = event.status !== "active";
  const people = guests.reduce((s, g) => s + g.admits, 0);
  const arrived = guests.filter((g) => g.checked_in_at).reduce((s, g) => s + g.admits, 0);
  const unsent = guests.filter(needsInvite).length;
  const noPhone = guests.filter((g) => !g.phone).length;
  const left = Math.max(0, event.headcount - people);
  const sides = useMemo(() => [...new Set(guests.map((g) => g.side?.trim()).filter(Boolean))].sort(), [guests]);

  const counts = useMemo(
    () => ({
      all: guests.length,
      expected: guests.filter((g) => !g.checked_in_at).length,
      arrived: guests.filter((g) => g.checked_in_at).length,
      unsent: guests.filter(needsInvite).length,
    }),
    [guests],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    return guests.filter((g) => {
      if (q && !g.name.toLowerCase().includes(q) && !(digits && (g.phone ?? "").includes(digits)) && !(g.side ?? "").toLowerCase().includes(q)) return false;
      if (sideFilter && g.side !== sideFilter) return false;
      if (filter === "arrived") return !!g.checked_in_at;
      if (filter === "expected") return !g.checked_in_at;
      if (filter === "unsent") return needsInvite(g);
      return true;
    });
  }, [guests, query, filter, sideFilter]);

  const listMotion = useSwapMotion(FILTERS.findIndex(([k]) => k === filter));
  const flash = (msg, tone) => toast(msg, tone ? { tone } : undefined);
  const stats = [
    { label: "On the list", value: people, of: event.headcount, bar: event.headcount ? people / event.headcount : 0, sub: `${guests.length} invite${guests.length === 1 ? "" : "s"} · ${left} spaces left` },
    { label: "Arrived", value: arrived, of: people, bar: people ? arrived / people : 0, sub: "scanned at the gate" },
    locked
      ? { label: "Didn’t come", value: Math.max(0, people - arrived), sub: "invited but never scanned" }
      : {
          label: "Invites to send",
          value: unsent,
          sub: unsent ? (plus ? "tap Send all and choose who sends" : "tap Send all to go through them") : "everyone with a number has theirs",
          tone: unsent ? "ochre" : null,
        },
    { label: "No phone", value: noPhone, sub: noPhone ? "share their ticket yourself from ⋯" : "all guests have a number" },
  ];

  return (
    <section className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-end justify-between gap-4 px-1">
        <div>
          <h2 className="page-title">Guests</h2>
          <p className="page-sub">Everyone on your list, their invite and whether they’ve arrived.</p>
        </div>
        {locked && guests.length > 0 && (
          <button type="button" onClick={() => flash(`Downloaded ${downloadAttendance(event, guests)} guests`)} className="h-[52px] px-5 rounded-full bg-ochre font-medium inline-flex items-center justify-center gap-2 w-full sm:w-auto">
            <Download size={18} aria-hidden="true" /> Download attendance
          </button>
        )}
        {!locked && (
          <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2 w-full xl:w-auto [&>button]:whitespace-nowrap">
            <button type="button" aria-haspopup="dialog" onClick={() => openPanel("add")} className="h-[52px] px-3 sm:px-5 rounded-full bg-brown text-cream inline-flex items-center justify-center gap-2 whitespace-nowrap hover:-translate-y-px transition">
              <UserPlus size={18} aria-hidden="true" /> Add guest
            </button>
            <button type="button" aria-haspopup="dialog" onClick={() => openPanel("import")} className="h-[52px] px-3 sm:px-5 rounded-full bg-white inline-flex items-center justify-center gap-2 whitespace-nowrap hover:-translate-y-px transition">
              <Upload size={18} aria-hidden="true" className="shrink-0" /> <span>Import<span className="md:max-lg:hidden"> CSV</span></span>
            </button>
            {guests.length > 0 && (
              <button
                type="button"
                onClick={() => flash(`Downloaded ${downloadAttendance(event, guests)} guests`)}
                aria-label="Download guest list as CSV"
                title="Download CSV"
                className="max-md:hidden h-[52px] w-[52px] rounded-full bg-white inline-flex items-center justify-center hover:-translate-y-px transition"
              >
                <Download size={18} aria-hidden="true" />
              </button>
            )}
            {guests.length > 0 && (
              <button
                type="button"
                onClick={() => setSharing(true)}
                aria-haspopup="dialog"
                className="h-[52px] px-3 sm:px-5 rounded-full bg-white inline-flex items-center justify-center gap-2 whitespace-nowrap hover:-translate-y-px transition"
              >
                <Share2 size={18} aria-hidden="true" className="shrink-0" /> <span>Share<span className="max-[359px]:hidden"> sending</span></span>
              </button>
            )}
            {guests.length > 0 && (
              <button type="button" onClick={() => setSending(true)} className={`md:ml-auto xl:ml-0 h-[52px] px-3 sm:px-5 rounded-full bg-ochre font-medium inline-flex items-center justify-center gap-2 hover:-translate-y-px transition`}>
                <Send size={18} aria-hidden="true" /> Send all{unsent > 0 ? ` (${unsent})` : ""}
              </button>
            )}
          </div>
        )}
      </div>

      {sending && plus && !mode && (
        <SendChooser
          event={event}
          unsent={unsent}
          onPick={setMode}
          onClose={closeQueue}
        />
      )}
      {sending && (!plus || mode === "phone") && (
        <SendQueue
          event={event}
          guests={guests}
          onClose={closeQueue}
          onShare={() => {
            closeQueue();
            setSharing(true);
          }}
        />
      )}
      {sharing && <ShareSending event={event} guests={guests} onClose={() => setSharing(false)} />}
      {(sending && plus && mode === "guestlok") || sendOnly ? (
        <GuestlokSend
          event={event}
          guests={guests}
          only={sendOnly ? [sendOnly] : undefined}
          onEventChange={setEvent}
          onDone={reload}
          onClose={() => {
            setSendOnly(null);
            closeQueue();
          }}
        />
      ) : null}

      {/* Numbers */}
      <div className="grid gap-3 sm:gap-[18px] grid-cols-2 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className={`rounded-[26px] sm:rounded-[30px] p-4 sm:p-6 min-w-0 ${s.tone === "ochre" ? "bg-ochre" : "bg-white"}`}>
            <p className={`text-[14px] sm:text-[15px] ${s.tone === "ochre" ? "" : "text-brown-soft"}`}>{s.label}</p>
            <p className="bento-num text-[clamp(34px,3.6vw,48px)] mt-2 sm:mt-3">
              {s.value}
              {s.of != null && <span className="text-[0.45em] text-mute"> / {s.of}</span>}
            </p>
            {s.bar != null && (
              <div className="mt-3 h-2 rounded-full bg-tile overflow-hidden" aria-hidden="true">
                <i className="block h-full rounded-full bg-ochre" style={{ width: `${Math.min(100, s.bar * 100)}%` }} />
              </div>
            )}
            <p className={`mt-2 text-[13px] leading-snug ${s.tone === "ochre" ? "text-brown/70" : "text-brown-soft"}`}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* List */}
      <div className="bento !p-0 overflow-hidden">
        <div className="p-4 sm:p-6 flex flex-col gap-3 border-b border-tile">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1 min-w-0">
              <label htmlFor="search" className="sr-only">Search guests</label>
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-brown-soft pointer-events-none" aria-hidden="true" />
              <input
                id="search"
                type="search"
                placeholder="Search name, phone or side"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setLimit(PAGE);
                }}
                className="w-full h-12 rounded-full bg-tile pl-11 pr-4 text-[16px] outline-none focus:bg-white focus:ring-2 focus:ring-brown"
              />
            </div>
            {sides.length > 0 && (
              <>
                <label htmlFor="side-filter" className="sr-only">Filter by side</label>
                <select
                  id="side-filter"
                  value={sideFilter}
                  onChange={(e) => setSideFilter(e.target.value)}
                  className="h-12 md:w-56 rounded-full bg-tile px-5 text-[15px] outline-none focus:ring-2 focus:ring-brown"
                >
                  <option value="">All sides</option>
                  {sides.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </>
            )}
          </div>
          <div>
            <Segmented
              role="group"
              label="Filter guests"
              grid2
              value={filter}
              onChange={(key) => {
                setFilter(key);
                setLimit(PAGE);
              }}
              options={FILTERS.map(([key, label]) => ({ value: key, label, count: counts[key] }))}
            />
          </div>
        </div>

        {guests.length === 0 ? (
          <div className="px-6 py-14 flex flex-col items-center text-center gap-3">
            <span className="w-14 h-14 rounded-full bg-tile inline-flex items-center justify-center"><Users size={24} aria-hidden="true" /></span>
            <p className="text-[20px] tracking-[-0.02em]">No guests yet</p>
            <p className="text-brown-soft max-w-sm">Add people one by one, or import a CSV from Google Sheets or Excel.</p>
            {!locked && (
              <button type="button" onClick={() => openPanel("add")} className="mt-2 btn-dark">
                <UserPlus size={17} aria-hidden="true" /> Add your first guest
              </button>
            )}
          </div>
        ) : shown.length === 0 ? (
          <p className="px-6 py-10 text-center text-brown-soft">No guests match. Try a different search or filter.</p>
        ) : (
          <>
            {/* Column labels (desktop only) */}
            <div className="hidden lg:grid grid-cols-[minmax(0,1.6fr)_72px_minmax(0,1fr)_206px] gap-4 px-6 py-3 text-[13px] text-mute border-b border-tile">
              <span>Guest</span>
              <span>Admits</span>
              <span>Status</span>
              <span className="text-right pr-1">Invite</span>
            </div>
            <ul key={filter} className={`divide-y divide-tile ${listMotion}`}>
              {shown.slice(0, limit).map((g) => (
                <GuestRow key={g.id} guest={g} event={event} locked={locked} plus={plus} onGuestlokSend={setSendOnly} onMore={setSheetId} onToast={flash} />
              ))}
            </ul>
            {shown.length > limit && (
              <div className="p-4 flex justify-center border-t border-tile">
                <button type="button" onClick={() => setLimit((n) => n + PAGE)} className="btn h-11 bg-tile hover:bg-sand">
                  Show more ({shown.length - limit} left)
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {sheetId && guests.some((g) => g.id === sheetId) && (
        <GuestSheet
          guest={guests.find((g) => g.id === sheetId)}
          event={event}
          locked={locked}
          plus={plus}
          onGuestlokSend={setSendOnly}
          onToast={flash}
          onClose={() => setSheetId(null)}
        />
      )}

      <Modal open={!locked && panel === "add"} onClose={() => setPanel(null)} title="Add a guest" description={`${left} of ${event.headcount} spaces left on your plan. Only add people who expect to hear from you about this event.`}>
        <AddGuest
          eventId={event.id}
          sides={sides}
          spacesLeft={left}
          onAdded={(n) => {
            flash(`${n} is on the list`);
            reload();
          }}
          onDone={() => setPanel(null)}
        />
      </Modal>

      <Modal open={!locked && panel === "import"} onClose={() => setPanel(null)} title="Import guests" description="Upload a CSV from Google Sheets or Excel. We’ll show you a preview first. Only include people who expect to hear from you about this event." size="lg">
        <GuestImport
          eventId={event.id}
          onDone={(n) => {
            flash(`${n} guests imported`);
            reload();
            setPanel(null);
          }}
        />
      </Modal>
    </section>
  );
}

function AddGuest({ eventId, sides, spacesLeft, onAdded, onDone }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [admits, setAdmits] = useState(1);
  const [side, setSide] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [added, setAdded] = useState(0);
  const nameRef = useRef(null);
  const phoneRef = useRef(null);
  const max = Math.max(1, Math.min(10, spacesLeft));

  async function submit(e) {
    e.preventDefault();
    setError(null);
    const normalized = phone.trim() ? normalizePhone(phone) : null;
    if (phone.trim() && !normalized) {
      setError("That number looks wrong. Use a format like 0803 123 4567.");
      phoneRef.current?.focus();
      return;
    }
    if (admits > spacesLeft) {
      setError(spacesLeft ? `Only ${spacesLeft} space${spacesLeft === 1 ? "" : "s"} left on your plan.` : "Your plan is full. Remove someone or upgrade to add more.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("guests").insert({
      event_id: eventId,
      name: name.trim(),
      phone: normalized,
      admits,
      // Only sent when filled, so this still works before migration 3 is run.
      ...(side.trim() ? { side: side.trim().slice(0, 40) } : {}),
    });
    setBusy(false);
    if (error) {
      setError(friendlyError(error));
      return;
    }
    onAdded(name.trim());
    setAdded((n) => n + 1);
    // Keep the side and the popup open: hosts usually add a family in one go.
    setName("");
    setPhone("");
    setAdmits(1);
    nameRef.current?.focus();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div>
        <label htmlFor="g-name" className="label">Full name</label>
        <input ref={nameRef} id="g-name" required maxLength={120} autoComplete="off" placeholder="Adaeze Okafor" value={name} onChange={(e) => setName(e.target.value)} className="field" />
      </div>

      <div>
        <label htmlFor="g-phone" className="label">
          WhatsApp number <span className="font-normal text-brown-soft">(to send their invite)</span>
        </label>
        <input ref={phoneRef} id="g-phone" type="tel" inputMode="tel" autoComplete="off" placeholder="0803 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} className="field" />
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <label htmlFor="g-side" className="label">
            Side <span className="font-normal text-brown-soft">(optional)</span>
          </label>
          <input id="g-side" list="g-side-options" maxLength={40} placeholder="Bride’s family" value={side} onChange={(e) => setSide(e.target.value)} className="field" />
          <datalist id="g-side-options">
            {sides.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          {sides.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {sides.slice(0, 6).map((s) => (
                <button key={s} type="button" onClick={() => setSide(s)} className={`h-8 px-3 rounded-full text-xs transition ${side === s ? "bg-brown text-cream" : "bg-tile hover:bg-sand"}`}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <span className="label" id="g-admits-label">Admits</span>
          <div className="h-12 inline-flex items-center gap-1 rounded-full bg-tile p-1" role="group" aria-labelledby="g-admits-label">
            <button type="button" onClick={() => setAdmits((n) => Math.max(1, n - 1))} disabled={admits <= 1} aria-label="One fewer person" className="w-10 h-10 rounded-full bg-white inline-flex items-center justify-center disabled:opacity-40">
              <Minus size={16} aria-hidden="true" />
            </button>
            <output aria-live="polite" className="w-10 text-center text-lg tabular-nums">{admits}</output>
            <button type="button" onClick={() => setAdmits((n) => Math.min(max, n + 1))} disabled={admits >= max} aria-label="One more person" className="w-10 h-10 rounded-full bg-white inline-flex items-center justify-center disabled:opacity-40">
              <Plus size={16} aria-hidden="true" />
            </button>
          </div>
          <p className="mt-1.5 text-xs text-brown-soft">{admits === 1 ? "Just them" : `Them + ${admits - 1}`}</p>
        </div>
      </div>

      {error && (
        <p role="alert" className="alert-error">{error}</p>
      )}

      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
        <p className="text-sm text-brown-soft text-center sm:text-left">
          {added > 0 ? `${added} added so far` : "Press Enter to add and keep going."}
        </p>
        <div className="flex flex-col-reverse sm:flex-row gap-2.5">
          <button type="button" onClick={onDone} className="btn bg-tile hover:bg-sand">
            {added > 0 ? "Done" : "Cancel"}
          </button>
          <button type="submit" disabled={busy || spacesLeft === 0} className="btn-dark">
            {busy ? <ButtonSpinner /> : <UserPlus size={17} aria-hidden="true" />} Add to list
          </button>
        </div>
      </div>
    </form>
  );
}

/** One row: who, admits, status, and one main action. Everything else is in the guest's sheet (⋯). */
function GuestRow({ guest, event, locked, plus, onGuestlokSend, onMore, onToast }) {
  const message = renderMessage(event.invite_message, { guest, event });
  const status = inviteStatus(guest);
  // The row shows a button only when there's something to do; resending lives in the sheet.
  const canSend = !locked && needsInvite(guest);
  const shareTicket = !locked && !guest.phone && !guest.checked_in_at && !hasInvite(guest);
  const hasMain = canSend || shareTicket;
  const sendLabel = status.key === "failed" ? "Try again" : "Send";
  const main =
    "flex-1 min-w-0 lg:flex-none lg:w-[150px] h-10 px-4 rounded-full bg-ochre hover:brightness-95 text-sm font-medium inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition [&_svg]:shrink-0";
  const more = (
    <button
      type="button"
      onClick={() => onMore(guest.id)}
      aria-haspopup="dialog"
      aria-label={`More for ${guest.name}`}
      title="More"
      className="h-10 w-10 shrink-0 rounded-full bg-tile hover:bg-sand inline-flex items-center justify-center transition"
    >
      <MoreHorizontal size={18} aria-hidden="true" />
    </button>
  );
  const initials = guest.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <li className="px-4 sm:px-6 py-4 grid gap-3 grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1.6fr)_72px_minmax(0,1fr)_206px] lg:gap-4 items-center hover:bg-[#FBFAF7]">
      {/* Who */}
      <div className="flex items-center gap-3 min-w-0">
        <span className={`w-11 h-11 shrink-0 rounded-full inline-flex items-center justify-center text-sm font-medium ${guest.checked_in_at ? "bg-ochre" : "bg-tile"}`} aria-hidden="true">
          {initials}
        </span>
        <div className="min-w-0">
          <p className="text-[16px] truncate">{guest.name}</p>
          <p className="text-[13px] text-brown-soft truncate">
            {guest.phone ? `+${guest.phone}` : "No phone"}
            <span className="lg:hidden"> · admits {guest.admits}</span>
            {guest.side && <span> · {guest.side}</span>}
          </p>
        </div>
      </div>

      {/* Admits (desktop) */}
      <p className="hidden lg:block tabular-nums text-[16px]">{guest.admits}</p>

      {/* Status: top-right on phones (with ⋯ when there's nothing to do), own column on desktop */}
      <div className="justify-self-end lg:justify-self-start flex items-center gap-2">
        <span className={`inline-flex whitespace-nowrap text-xs sm:text-[13px] font-medium px-2.5 py-1 rounded-full ${status.cls}`}>{status.text}</span>
        {!hasMain && <span className="lg:hidden">{more}</span>}
      </div>

      {/* Actions: the one thing to do for this guest, plus their sheet */}
      <div className={`col-span-2 lg:col-span-1 flex items-center gap-1.5 lg:justify-end ${hasMain ? "" : "max-lg:hidden"}`}>
        {canSend && plus && (
          <button type="button" onClick={() => onGuestlokSend(guest)} className={main} aria-label={`${sendLabel}: Guestlok sends ${guest.name} their invite`}>
            <Send size={15} aria-hidden="true" /> {sendLabel}
          </button>
        )}
        {canSend && !plus && (
          <WhatsAppButton
            href={whatsappLink(guest.phone, message)}
            prepare={() => prepareTicketPreview(event, guest)}
            onOpened={() => markInviteSent(guest.id)}
            busyLabel="Adding ticket…"
            aria-label={`${sendLabel} ${guest.name}’s invite on WhatsApp`}
            className={main}
          >
            <MessageCircle size={15} aria-hidden="true" /> {sendLabel}
          </WhatsAppButton>
        )}
        {shareTicket && (
          <TicketButton
            guest={guest}
            event={event}
            message={message}
            onShared={() => {
              markInviteSent(guest.id);
              onToast("Ticket ready to share");
            }}
            label={canShareFiles() ? "Share ticket" : "Save ticket"}
            className="flex-1 min-w-0 lg:flex-none lg:w-[150px] h-10 px-4 rounded-full bg-tile hover:bg-sand text-sm font-medium inline-flex items-center justify-center gap-1.5 whitespace-nowrap [&_svg]:shrink-0"
          />
        )}
        {more}
      </div>
    </li>
  );
}

/** Everything you can do for one guest, with their invite status in plain words. */
function GuestSheet({ guest, event, locked, plus, onGuestlokSend, onToast, onClose }) {
  const { confirm } = useFeedback();
  const message = renderMessage(event.invite_message, { guest, event });
  const status = inviteStatus(guest);
  const canSend = !locked && !!guest.phone && !guest.checked_in_at;
  const fresh = !hasInvite(guest);
  const item = "w-full min-h-[56px] px-4 py-3 rounded-[18px] bg-tile hover:bg-sand text-left inline-flex items-center gap-3 transition [&_svg]:shrink-0";
  const sub = "block text-[13px] text-brown-soft font-normal";

  async function copyLink() {
    await navigator.clipboard.writeText(inviteLink(guest));
    onToast("Invite link copied");
    onClose();
  }

  async function undoCheckIn() {
    const sure = await confirm({
      title: `Undo check-in for ${guest.name}?`,
      body: "Their QR code will work again at the gate. Use this if someone was scanned by mistake.",
      confirmLabel: "Undo check-in",
    });
    if (!sure) return;
    const { error } = await supabase.from("guests").update({ checked_in_at: null }).eq("id", guest.id);
    onToast(error ? friendlyError(error) : "Check-in undone", error ? "error" : undefined);
    if (!error) onClose();
  }

  async function remove() {
    const sure = await confirm({
      title: `Remove ${guest.name}?`,
      body: hasInvite(guest)
        ? "Their invite was already sent. The QR will stop working, so they’ll be turned back at the gate."
        : "They’ll come off the list and free up their space on your plan.",
      confirmLabel: "Remove guest",
      danger: true,
    });
    if (!sure) return;
    const { error } = await supabase.from("guests").delete().eq("id", guest.id);
    onToast(error ? friendlyError(error) : `${guest.name} removed`, error ? "error" : undefined);
    if (!error) onClose();
  }

  const details = [guest.phone ? `+${guest.phone}` : "No phone", `admits ${guest.admits}`, guest.side].filter(Boolean).join(" · ");

  return (
    <Modal open onClose={onClose} title={guest.name} description={details} size="sm">
      <div className="flex flex-col gap-4">
        <div className="rounded-[18px] border-[1.5px] border-tile px-4 py-3 flex items-start gap-3">
          <span className={`mt-0.5 inline-flex whitespace-nowrap text-xs font-medium px-2.5 py-1 rounded-full ${status.cls}`}>{status.text}</span>
          <p className="text-sm text-brown-soft leading-relaxed">{inviteDetail(guest)}</p>
        </div>

        <div className="flex flex-col gap-2">
          {canSend && plus && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onGuestlokSend(guest);
              }}
              className={item}
            >
              <Send size={18} aria-hidden="true" />
              <span>
                {fresh ? "Send with Guestlok" : "Resend with Guestlok"}
                <span className={sub}>From Guestlok’s WhatsApp. Uses 1 of your Plus sends.</span>
              </span>
            </button>
          )}
          {canSend && (
            <WhatsAppButton
              href={whatsappLink(guest.phone, message)}
              prepare={() => prepareTicketPreview(event, guest)}
              onOpened={() => {
                markInviteSent(guest.id);
                onClose();
              }}
              busyLabel="Adding ticket…"
              className={item}
            >
              <MessageCircle size={18} aria-hidden="true" />
              <span>
                {fresh ? "Send from my WhatsApp" : "Resend from my WhatsApp"}
                <span className={sub}>Opens a chat with their invite ready.{plus ? " Free." : ""}</span>
              </span>
            </WhatsAppButton>
          )}
          {!locked && (
            <TicketButton
              guest={guest}
              event={event}
              message={message}
              onShared={() => {
                markInviteSent(guest.id);
                onClose();
              }}
              label={
                <span>
                  {canShareFiles() ? "Share their ticket" : "Download their ticket"}
                  <span className={sub}>The QR card as a picture, to send any way you like.</span>
                </span>
              }
              className={item}
            />
          )}
          <button type="button" onClick={copyLink} className={item}>
            <Link2 size={18} aria-hidden="true" />
            <span>
              Copy invite link
              <span className={sub}>Opens their ticket. Works in SMS, email or any chat.</span>
            </span>
          </button>
          {guest.checked_in_at && !locked && (
            <button type="button" onClick={undoCheckIn} className={item}>
              <RotateCcw size={18} aria-hidden="true" />
              <span>
                Undo check-in
                <span className={sub}>If they were scanned by mistake.</span>
              </span>
            </button>
          )}
          {!locked && (
            <button type="button" onClick={remove} className={`${item} !bg-transparent hover:!bg-coral/15 text-[#9A3324]`}>
              <Trash2 size={18} aria-hidden="true" /> Remove from the list
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

/** Plus: who sends this round? Guestlok's number, or the host's own phone (free, as on Standard). */
function SendChooser({ event, unsent, onPick, onClose }) {
  const left = Math.max(0, (event.wa_quota ?? 0) - (event.wa_sent ?? 0));
  const options = [
    {
      id: "guestlok",
      icon: Send,
      title: "Guestlok sends them",
      body: `All ${unsent} at once from the official Guestlok WhatsApp, with the ticket picture and a “View my ticket” button. You see Sent, Delivered and Read for each guest.`,
      note: `Uses your Plus sends · ${left.toLocaleString()} left`,
      dark: true,
    },
    {
      id: "phone",
      icon: Smartphone,
      title: "Send from my phone",
      body: `Go through the ${unsent} one by one, one tap each, from your own WhatsApp. Good for close family who expect a message from you.`,
      note: "Free · doesn’t use your Plus sends",
    },
  ];
  return (
    <Modal open onClose={onClose} title="Who should send them?" description="Your Plus plan can do both. Pick one for this round.">
      <div className="flex flex-col gap-3">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onPick(o.id)}
            className={`group text-left rounded-[24px] p-5 flex gap-4 items-start transition hover:-translate-y-px ${o.dark ? "bg-brown text-cream" : "bg-tile hover:bg-sand"}`}
          >
            <span className={`w-10 h-10 shrink-0 rounded-full inline-flex items-center justify-center ${o.dark ? "bg-ochre text-brown" : "bg-white"}`} aria-hidden="true">
              <o.icon size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2 text-[17px] tracking-[-0.01em]">
                {o.title} <ArrowRight size={17} aria-hidden="true" className="shrink-0 transition group-hover:translate-x-0.5" />
              </span>
              <span className={`mt-1 block text-sm leading-relaxed ${o.dark ? "text-sand" : "text-brown-soft"}`}>{o.body}</span>
              <span className={`mt-2 inline-block text-xs font-medium px-2.5 py-1 rounded-full ${o.dark ? "bg-white/10" : "bg-white"}`}>{o.note}</span>
            </span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
