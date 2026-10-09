import { Download, Link2, MessageCircle, Minus, Plus, RotateCcw, Search, Send, Trash2, Upload, UserPlus, Users } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { ButtonSpinner } from "../../components/Brand.jsx";
import GuestImport from "../../components/GuestImport.jsx";
import GuestlokSend from "../../components/GuestlokSend.jsx";
import Modal from "../../components/Modal.jsx";
import SendQueue from "../../components/SendQueue.jsx";
import TicketButton from "../../components/TicketButton.jsx";
import { friendlyError } from "../../lib/errors.js";
import { formatEventTime, inviteUrl, normalizePhone, whatsappLink } from "../../lib/format.js";
import { downloadAttendance } from "../../lib/attendance.js";
import { useFeedback } from "../../lib/feedback.js";
import { plusTargets } from "../../lib/guestlokSend.js";
import { markInviteSent, renderMessage } from "../../lib/invite.js";
import { supabase } from "../../lib/supabase.js";

const PAGE = 60;
const FILTERS = [
  ["all", "All"],
  ["expected", "Not arrived"],
  ["arrived", "Arrived"],
  ["unsent", "Not sent"],
];

export default function Guests() {
  const { event, setEvent, guests, reloadGuests: reload } = useOutletContext();
  const plus = event.delivery === "plus";
  const [sendOnly, setSendOnly] = useState(null); // Plus: resend to one guest
  const [params, setParams] = useSearchParams();
  const [panel, setPanel] = useState(null); // 'add' | 'import' | null
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sideFilter, setSideFilter] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [sending, setSending] = useState(() => params.get("send") === "1");
  const { toast } = useFeedback();

  function closeQueue() {
    setSending(false);
    if (params.has("send")) {
      params.delete("send");
      setParams(params, { replace: true });
    }
  }

  const locked = event.status !== "active";
  const people = guests.reduce((s, g) => s + g.admits, 0);
  const arrived = guests.filter((g) => g.checked_in_at).reduce((s, g) => s + g.admits, 0);
  const unsent = plus ? plusTargets(guests).length : guests.filter((g) => g.phone && !g.invite_sent_at && !g.checked_in_at).length;
  const noPhone = guests.filter((g) => !g.phone).length;
  const left = Math.max(0, event.headcount - people);
  const sides = useMemo(() => [...new Set(guests.map((g) => g.side?.trim()).filter(Boolean))].sort(), [guests]);

  const counts = useMemo(
    () => ({
      all: guests.length,
      expected: guests.filter((g) => !g.checked_in_at).length,
      arrived: guests.filter((g) => g.checked_in_at).length,
      unsent: guests.filter((g) => !g.invite_sent_at).length,
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
      if (filter === "unsent") return !g.invite_sent_at;
      return true;
    });
  }, [guests, query, filter, sideFilter]);

  const flash = (msg, tone) => toast(msg, tone ? { tone } : undefined);
  const stats = [
    { label: "On the list", value: people, of: event.headcount, bar: event.headcount ? people / event.headcount : 0, sub: `${guests.length} invite${guests.length === 1 ? "" : "s"} · ${left} spaces left` },
    { label: "Arrived", value: arrived, of: people, bar: people ? arrived / people : 0, sub: "scanned at the gate" },
    locked
      ? { label: "Didn’t come", value: Math.max(0, people - arrived), sub: "invited but never scanned" }
      : {
          label: "Invites to send",
          value: unsent,
          sub: unsent ? (plus ? "tap Send all and Guestlok sends them" : "tap Send all to go through them") : "everyone with a number has theirs",
          tone: unsent ? "ochre" : null,
        },
    { label: "No phone", value: noPhone, sub: noPhone ? "use their ticket or link instead" : "all guests have a number" },
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
          <div className="grid grid-cols-2 sm:flex gap-2 w-full sm:w-auto">
            <button type="button" aria-haspopup="dialog" onClick={() => setPanel("add")} className="h-[52px] px-3 sm:px-5 rounded-full bg-brown text-cream inline-flex items-center justify-center gap-2 whitespace-nowrap hover:-translate-y-px transition">
              <UserPlus size={18} aria-hidden="true" /> Add guest
            </button>
            <button type="button" aria-haspopup="dialog" onClick={() => setPanel("import")} className="h-[52px] px-3 sm:px-5 rounded-full bg-white inline-flex items-center justify-center gap-2 whitespace-nowrap hover:-translate-y-px transition">
              <Upload size={18} aria-hidden="true" /> Import CSV
            </button>
            {guests.length > 0 && (
              <button
                type="button"
                onClick={() => flash(`Downloaded ${downloadAttendance(event, guests)} guests`)}
                aria-label="Download guest list as CSV"
                title="Download CSV"
                className="max-sm:hidden h-[52px] w-[52px] rounded-full bg-white inline-flex items-center justify-center hover:-translate-y-px transition"
              >
                <Download size={18} aria-hidden="true" />
              </button>
            )}
            {guests.length > 0 && (
              <button type="button" onClick={() => setSending(true)} className="col-span-2 h-[52px] px-5 rounded-full bg-ochre font-medium inline-flex items-center justify-center gap-2 hover:-translate-y-px transition">
                <Send size={18} aria-hidden="true" /> Send all{unsent > 0 ? ` (${unsent})` : ""}
              </button>
            )}
          </div>
        )}
      </div>

      {sending && !plus && <SendQueue event={event} guests={guests} onClose={closeQueue} />}
      {(sending && plus) || sendOnly ? (
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
      <div className="grid gap-3 sm:gap-[18px] grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className={`rounded-[26px] sm:rounded-[30px] p-4 sm:p-6 min-w-0 ${s.tone === "ochre" ? "bg-ochre" : "bg-white"}`}>
            <p className={`text-[14px] sm:text-[15px] ${s.tone === "ochre" ? "" : "text-brown-soft"}`}>{s.label}</p>
            <p className="bento-num text-[clamp(34px,4vw,48px)] mt-2 sm:mt-3">
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
          <div className="-mx-4 sm:mx-0 px-4 sm:px-0 overflow-x-auto [scrollbar-width:none]">
            <div className="inline-flex gap-1 p-1 rounded-full bg-tile" role="group" aria-label="Filter guests">
              {FILTERS.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={filter === key}
                  onClick={() => {
                    setFilter(key);
                    setLimit(PAGE);
                  }}
                  className={`h-10 px-4 rounded-full text-sm whitespace-nowrap inline-flex items-center gap-2 transition ${filter === key ? "bg-brown text-cream" : "text-brown-soft hover:text-brown"}`}
                >
                  {label}
                  <span className={`text-xs tabular-nums ${filter === key ? "text-white/70" : "text-mute"}`}>{counts[key]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {guests.length === 0 ? (
          <div className="px-6 py-14 flex flex-col items-center text-center gap-3">
            <span className="w-14 h-14 rounded-full bg-tile inline-flex items-center justify-center"><Users size={24} aria-hidden="true" /></span>
            <p className="text-[20px] tracking-[-0.02em]">No guests yet</p>
            <p className="text-brown-soft max-w-sm">Add people one by one, or import a CSV from Google Sheets or Excel.</p>
            {!locked && (
              <button type="button" onClick={() => setPanel("add")} className="mt-2 btn-dark">
                <UserPlus size={17} aria-hidden="true" /> Add your first guest
              </button>
            )}
          </div>
        ) : shown.length === 0 ? (
          <p className="px-6 py-10 text-center text-brown-soft">No guests match. Try a different search or filter.</p>
        ) : (
          <>
            {/* Column labels (desktop only) */}
            <div className="hidden lg:grid grid-cols-[minmax(0,1.6fr)_72px_minmax(0,1fr)_372px] gap-4 px-6 py-3 text-[13px] text-mute border-b border-tile">
              <span>Guest</span>
              <span>Admits</span>
              <span>Status</span>
              <span className="text-right pr-1">Actions</span>
            </div>
            <ul className="divide-y divide-tile">
              {shown.slice(0, limit).map((g) => (
                <GuestRow key={g.id} guest={g} event={event} locked={locked} onToast={flash} onGuestlokSend={plus ? setSendOnly : null} />
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

      <Modal open={!locked && panel === "add"} onClose={() => setPanel(null)} title="Add a guest" description={`${left} of ${event.headcount} spaces left on your plan.`}>
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

      <Modal open={!locked && panel === "import"} onClose={() => setPanel(null)} title="Import guests" description="Upload a CSV from Google Sheets or Excel. We’ll show you a preview first." size="lg">
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

const WA_STATUS = {
  queued: { text: "Sending…", cls: "bg-cream" },
  sent: { text: "Sent ✓", cls: "bg-cream" },
  delivered: { text: "Delivered ✓✓", cls: "bg-cream" },
  read: { text: "Read ✓✓", cls: "bg-[#DCEFE3] text-[#1F6B3F]" },
  failed: { text: "Didn’t deliver", cls: "bg-coral/20 text-[#7A2A1E]" },
};

function GuestRow({ guest, event, locked, onToast, onGuestlokSend }) {
  const { confirm } = useFeedback();
  const message = renderMessage(event.invite_message, { guest, event });

  function markSent() {
    // Fire-and-forget: the WhatsApp tab opens immediately.
    markInviteSent(guest.id);
  }

  async function copyLink() {
    await navigator.clipboard.writeText(inviteUrl(guest.token));
    onToast("Invite link copied");
  }

  async function undoCheckIn() {
    const sure = await confirm({
      title: `Undo check-in for ${guest.name}?`,
      body: "Their QR code will work again at the gate. Use this if someone was scanned by mistake.",
      confirmLabel: "Undo check-in",
    });
    if (!sure) return;
    const { error } = await supabase
      .from("guests")
      .update({ checked_in_at: null })
      .eq("id", guest.id);
    onToast(error ? friendlyError(error) : "Check-in undone", error ? "error" : undefined);
  }

  async function remove() {
    const sure = await confirm({
      title: `Remove ${guest.name}?`,
      body: guest.invite_sent_at
        ? "Their invite was already sent. The QR will stop working, so they’ll be turned back at the gate."
        : "They’ll come off the list and free up their space on your plan.",
      confirmLabel: "Remove guest",
      danger: true,
    });
    if (!sure) return;
    const { error } = await supabase.from("guests").delete().eq("id", guest.id);
    onToast(error ? friendlyError(error) : `${guest.name} removed`, error ? "error" : undefined);
  }

  const initials = guest.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const status = guest.checked_in_at
    ? { text: `Arrived ${formatEventTime(guest.checked_in_at)}`, cls: "bg-leaf text-white" }
    : onGuestlokSend && guest.wa_status && WA_STATUS[guest.wa_status]
      ? WA_STATUS[guest.wa_status]
      : guest.invite_sent_at
      ? { text: "Invite sent", cls: "bg-cream" }
      : guest.phone
        ? { text: "Not sent", cls: "bg-tile text-brown-soft" }
        : { text: "No phone", cls: "bg-tile text-brown-soft" };
  const icon = "h-10 w-10 shrink-0 rounded-full bg-tile hover:bg-sand inline-flex items-center justify-center transition";

  return (
    <li className="px-4 sm:px-6 py-4 grid gap-3 grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1.6fr)_72px_minmax(0,1fr)_372px] lg:gap-4 items-center hover:bg-[#FBFAF7]">
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

      {/* Status: top-right on phones, own column on desktop */}
      <div className="justify-self-end lg:justify-self-start">
        <span className={`inline-flex whitespace-nowrap text-xs sm:text-[13px] font-medium px-2.5 py-1 rounded-full ${status.cls}`}>{status.text}</span>
      </div>

      {/* Actions: full row on phones */}
      <div className="col-span-2 lg:col-span-1 flex items-center gap-1.5 lg:justify-end">
        {!locked && guest.phone && onGuestlokSend && !guest.checked_in_at && (
          <button
            type="button"
            onClick={() => onGuestlokSend(guest)}
            title={guest.wa_error ?? undefined}
            className="flex-1 min-w-0 lg:flex-none h-10 px-4 rounded-full bg-ochre text-sm font-medium inline-flex items-center justify-center gap-1.5 hover:brightness-95"
          >
            <Send size={15} aria-hidden="true" /> {guest.wa_status && guest.wa_status !== "failed" ? "Resend" : guest.wa_status === "failed" ? "Retry" : "Send"}
          </button>
        )}
        {!locked && guest.phone && !onGuestlokSend && (
          <a
            href={whatsappLink(guest.phone, message)}
            target="_blank"
            rel="noreferrer"
            onClick={markSent}
            className="flex-1 min-w-0 lg:flex-none h-10 px-4 rounded-full bg-ochre text-sm font-medium inline-flex items-center justify-center gap-1.5 hover:brightness-95"
          >
            <MessageCircle size={15} aria-hidden="true" /> WhatsApp
          </a>
        )}
        {!locked && (
          <TicketButton
            guest={guest}
            event={event}
            message={message}
            onShared={markSent}
            label={<span className={guest.phone ? "max-sm:sr-only" : ""}>Ticket</span>}
            className={`${guest.phone ? "max-sm:w-10 max-sm:px-0 sm:px-4" : "flex-1 lg:flex-none px-4"} h-10 shrink-0 rounded-full bg-tile hover:bg-sand text-sm font-medium inline-flex items-center justify-center gap-1.5`}
          />
        )}
        <button type="button" onClick={copyLink} aria-label={`Copy invite link for ${guest.name}`} title="Copy invite link" className={icon}>
          <Link2 size={16} aria-hidden="true" />
        </button>
        {guest.checked_in_at && !locked && (
          <button type="button" onClick={undoCheckIn} aria-label={`Undo check-in for ${guest.name}`} title="Undo check-in" className={icon}>
            <RotateCcw size={16} aria-hidden="true" />
          </button>
        )}
        {!locked && (
          <button type="button" onClick={remove} aria-label={`Remove ${guest.name}`} title="Remove guest" className={`${icon} hover:!bg-coral/25`}>
            <Trash2 size={16} aria-hidden="true" />
          </button>
        )}
      </div>
    </li>
  );
}
