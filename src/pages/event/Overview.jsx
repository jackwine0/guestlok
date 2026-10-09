import { ArrowUpRight, Check, Mail, Plus, ScanLine, Send, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { ButtonSpinner, KeyholeDisc } from "../../components/Brand.jsx";
import EndedPanel from "../../components/EndedPanel.jsx";
import { friendlyError } from "../../lib/errors.js";
import { formatEventTime, scannerUrl } from "../../lib/format.js";
import { supabase } from "../../lib/supabase.js";

const HOUR = 3600_000;
const sum = (list) => list.reduce((n, g) => n + g.admits, 0);
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

/** Re-renders every minute so "time to go" and "last 15 minutes" stay fresh. */
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export default function Overview() {
  const { event, setEvent, guests, requests = [], reloadRequests, reloadGuests } = useOutletContext();
  const now = useNow();

  const startsAt = new Date(event.starts_at).getTime();
  const arrivedGuests = guests.filter((g) => g.checked_in_at);
  const invited = sum(guests);
  const arrived = sum(arrivedGuests);
  const onTheDay = event.status === "ended" || now >= startsAt - 4 * HOUR || arrived > 0;

  const withPhone = guests.filter((g) => g.phone);
  const sent = withPhone.filter((g) => g.invite_sent_at).length;
  const unsent = withPhone.filter((g) => !g.invite_sent_at && !g.checked_in_at).length;
  const lastQuarter = sum(arrivedGuests.filter((g) => now - new Date(g.checked_in_at).getTime() < 15 * 60_000));
  const addedToday = sum(guests.filter((g) => now - new Date(g.created_at).getTime() < 24 * HOUR));

  const gauge = onTheDay
    ? { value: pct(arrived, invited), label: "Guests arrived" }
    : { value: pct(invited, event.headcount), label: "Of your plan filled" };

  const days = Math.ceil((startsAt - now) / (24 * HOUR));
  const banner =
    event.status === "ended"
      ? <>This event has ended. <b>{arrived}</b> of {invited} guests came.</>
      : onTheDay
        ? lastQuarter > 0
          ? <><b>{lastQuarter} {lastQuarter === 1 ? "person" : "people"}</b> arrived in the last 15 minutes</>
          : arrived > 0
            ? <>The gate is quiet. <b>{invited - arrived}</b> still expected</>
            : <>It’s the day. <b>{invited}</b> guests expected, gate opens at {formatEventTime(event.starts_at)}</>
        : unsent > 0
          ? <><b>{days} day{days === 1 ? "" : "s"}</b> to go · {unsent} invite{unsent === 1 ? "" : "s"} still to send</>
          : <><b>{days} day{days === 1 ? "" : "s"}</b> to go{guests.length ? " · everyone has their invite" : ""}</>;

  const tiles = onTheDay
    ? [
        { label: event.status === "ended" ? <>Guests<br />who came</> : <>Guests in<br />the hall</>, value: arrived, chip: lastQuarter ? `+${lastQuarter} ↗` : null, chipTone: "up" },
        event.status === "ended"
          ? { label: <>Didn’t<br />come</>, value: Math.max(0, invited - arrived), of: invited, chip: `${pct(arrived, invited)}% came`, chipTone: "dark" }
          : { label: <>Still<br />expected</>, value: Math.max(0, invited - arrived), of: invited, chip: `${pct(arrived, invited)}% in`, chipTone: "dark" },
      ]
    : [
        { label: <>People<br />invited</>, value: invited, of: event.headcount, chip: addedToday ? `+${addedToday} today` : null, chipTone: "up" },
        { label: <>Invites<br />sent</>, value: sent, of: withPhone.length, chip: withPhone.length ? `${pct(sent, withPhone.length)}% ✓` : null, chipTone: "dark" },
      ];

  return (
    <div className="flex flex-col gap-[18px]">
      {event.status === "ended" && <EndedPanel event={event} guests={guests} onEventChange={setEvent} />}
    <div className="grid gap-[18px] grid-cols-1 min-[1180px]:grid-cols-[minmax(0,1.08fr)_minmax(0,1.92fr)] items-stretch">
      {/* Overview */}
      <section className="bento flex flex-col" aria-labelledby="ov-title">
        <h2 id="ov-title" className="page-title pr-16">
          Event overview
        </h2>
        <CornerLink to="guests" label="Open guest list" />
        <div className="mt-7 flex items-center gap-3.5 rounded-[22px] bg-tile px-5 py-4 text-[17px] text-brown-soft [&_b]:font-medium [&_b]:text-gold-ink">
          <SunIcon />
          <span>{banner}</span>
        </div>

        <Gauge value={gauge.value} label={gauge.label} />

        <div className="mt-auto pt-7 grid gap-3 sm:gap-4 grid-cols-2">
          {tiles.map((t, i) => (
            <div key={i} className="rounded-[26px] bg-tile p-4 sm:p-[22px] min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-2 text-[15px] sm:text-[16px] leading-tight text-brown-soft">
                <span>{t.label}</span>
                {t.chip && (
                  <span className={`h-[30px] px-3 rounded-full text-sm font-medium inline-flex items-center whitespace-nowrap ${t.chipTone === "up" ? "bg-ochre text-brown" : "bg-brown text-cream"}`}>
                    {t.chip}
                  </span>
                )}
              </div>
              <p className="bento-num text-[clamp(40px,3.6vw,52px)] mt-5">
                {t.value}
                {t.of != null && <span className="text-[0.45em] text-mute"> / {t.of}</span>}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Right side */}
      <div className="grid gap-[18px] grid-cols-1 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] content-start">
        {event.status !== "ended" && <Actions event={event} unsent={unsent} />}

        {onTheDay ? <ArrivalsCard guests={arrivedGuests} /> : <ReadyCard event={event} guests={guests} unsent={unsent} />}

        <Dial value={pct(sent, withPhone.length)} label="Invites sent" sub={`${sent} of ${withPhone.length}`} />

        {event.status !== "ended" && <GateRequests requests={requests} onDecided={() => { reloadRequests?.(); reloadGuests?.(); }} />}

        <SidesCard guests={guests} onTheDay={onTheDay} total={invited} />
      </div>
    </div>
    </div>
  );
}

/* ------------------------------------------------------------------------- */

function CornerLink({ to, label }) {
  return (
    <Link
      to={to}
      aria-label={label}
      title={label}
      className="absolute top-6 right-6 w-12 h-12 sm:w-14 sm:h-14 rounded-full border-[1.5px] border-tile inline-flex items-center justify-center hover:bg-tile transition"
    >
      <ArrowUpRight size={20} aria-hidden="true" />
    </Link>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 100 100" className="w-[30px] h-[30px] shrink-0" aria-hidden="true">
      {Array.from({ length: 20 }, (_, i) => (
        <rect key={i} x="47.5" y="6" width="5" height="16" rx="2.5" fill="#EEB12F" transform={`rotate(${i * 18} 50 50)`} />
      ))}
      <circle cx="50" cy="50" r="25" fill="#EEB12F" />
      <circle cx="50" cy="45" r="7" fill="#fff" />
      <path d="M46.8 48 L44.2 64 L55.8 64 L53.2 48 Z" fill="#fff" />
    </svg>
  );
}

/** Segmented semicircle: a crowd filling up. */
const SEGS = 16;
const GAUGE_PATHS = (() => {
  const cx = 260, cy = 262, r1 = 150, r2 = 246;
  const p = (r, a) => `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
  return Array.from({ length: SEGS }, (_, i) => {
    const a0 = Math.PI + (i / SEGS) * Math.PI + 0.045;
    const a1 = Math.PI + ((i + 1) / SEGS) * Math.PI - 0.045;
    return `M${p(r1, a0)} L${p(r2, a0)} A${r2} ${r2} 0 0 1 ${p(r2, a1)} L${p(r1, a1)} A${r1} ${r1} 0 0 0 ${p(r1, a0)} Z`;
  });
})();

function Gauge({ value, label }) {
  const on = Math.round((Math.min(100, value) / 100) * SEGS);
  return (
    <div className="relative mx-auto mt-6 max-w-[520px]" role="img" aria-label={`${value}% · ${label}`}>
      <svg viewBox="0 0 520 290" className="w-full block overflow-visible">
        {GAUGE_PATHS.map((d, i) => {
          const c = i < on ? "#EEB12F" : "#EFEBE5";
          return <path key={i} d={d} fill={c} stroke={c} strokeWidth="18" strokeLinejoin="round" className="transition-[fill,stroke] duration-500" />;
        })}
      </svg>
      <div className="absolute inset-x-0 bottom-[4%] text-center">
        <p className="bento-num text-[clamp(44px,5.6vw,76px)]">{value}%</p>
        <p className="mt-1.5 text-[15px] sm:text-[18px] text-brown-soft">{label}</p>
      </div>
    </div>
  );
}

function Actions({ event, unsent }) {
  const pill = "h-[52px] px-[22px] rounded-full inline-flex items-center gap-2.5 text-[16px] whitespace-nowrap transition hover:-translate-y-px";
  return (
    <div className="md:col-span-2 flex flex-wrap items-center gap-2.5">
      <Link to="guests" className={`${pill} bg-brown text-cream`}>
        <Plus size={20} aria-hidden="true" /> Add guests
      </Link>
      {unsent > 0 && (
        <Link to="guests?send=1" className={`${pill} bg-white`}>
          <Send size={18} aria-hidden="true" /> Send {unsent} invite{unsent === 1 ? "" : "s"}
        </Link>
      )}
      <span className="hidden sm:block flex-1" />
      <Link to="invitation" aria-label="Design invitation" title="Design invitation" className={`${pill} bg-white !px-0 w-[52px] justify-center`}>
        <Mail size={20} aria-hidden="true" />
      </Link>
      {event.status === "active" && (
        <a href={scannerUrl(event.id, event.scanner_key)} target="_blank" rel="noreferrer" className={`${pill} bg-ochre font-medium`}>
          <ScanLine size={20} aria-hidden="true" /> Open gate scanner
        </a>
      )}
    </div>
  );
}

/** Arrivals per 15 minutes, from the first scan to now (max 16 bars). */
function ArrivalsCard({ guests }) {
  const buckets = useMemo(() => {
    if (!guests.length) return [];
    const times = guests.map((g) => new Date(g.checked_in_at).getTime());
    const step = 15 * 60_000;
    const first = Math.floor(Math.min(...times) / step) * step;
    const last = Math.max(...times);
    const n = Math.min(16, Math.max(8, Math.floor((last - first) / step) + 1));
    const start = Math.max(first, Math.floor(last / step) * step - (n - 1) * step);
    const out = Array.from({ length: n }, (_, i) => ({ at: start + i * step, count: 0 }));
    for (const g of guests) {
      const i = Math.floor((new Date(g.checked_in_at).getTime() - start) / step);
      if (i >= 0 && i < n) out[i].count += g.admits;
    }
    return out;
  }, [guests]);

  const peakIndex = buckets.reduce((best, b, i) => (b.count > (buckets[best]?.count ?? -1) ? i : best), 0);
  const [hover, setHover] = useState(null);
  const sel = hover ?? peakIndex;
  const max = Math.max(4, ...buckets.map((b) => b.count));
  const latest = [...guests].sort((a, b) => b.checked_in_at.localeCompare(a.checked_in_at)).slice(0, 3);

  return (
    <section className="bento flex flex-col" aria-labelledby="arr-title">
      <div className="flex items-start justify-between gap-3">
        <h2 id="arr-title" className="section-title">Arrivals by time</h2>
        <div className="text-right">
          <p className="bento-num text-[clamp(44px,4.2vw,60px)]">{buckets[peakIndex]?.count ?? 0}</p>
          <p className="text-[15px] text-brown-soft mt-1">peak per 15 min</p>
        </div>
      </div>

      {buckets.length === 0 ? (
        <div className="mt-6 h-[170px] rounded-[22px] bg-tile flex items-center justify-center px-6 text-center text-brown-soft">
          Arrivals appear here, 15 minutes at a time, once your ushers start scanning.
        </div>
      ) : (
        <>
          <div className="relative mt-6 h-[170px] rounded-[22px] bg-tile px-3.5 pt-9 flex items-end gap-1.5" onMouseLeave={() => setHover(null)}>
            {buckets.map((b, i) => (
              <button
                key={b.at}
                type="button"
                aria-label={`${formatEventTime(new Date(b.at).toISOString())}: ${b.count} people`}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                className="relative flex-1 h-full flex items-end justify-center group"
              >
                {i === sel && (
                  <span
                    className="absolute left-1/2 -translate-x-1/2 -translate-y-full -mt-2 bg-brown text-cream text-[13px] px-3 py-1 rounded-full whitespace-nowrap pointer-events-none z-10"
                    style={{ bottom: `calc(${(b.count / max) * 100}% + 8px)` }}
                  >
                    {formatEventTime(new Date(b.at).toISOString())} · {b.count}
                  </span>
                )}
                <i
                  className={`block w-full max-w-4 rounded-t-full transition-[height,background] duration-500 ${i === sel ? "bg-ochre" : "bg-[#DCD6CE] group-hover:bg-mute"}`}
                  style={{ height: `${Math.max(3, (b.count / max) * 100)}%` }}
                />
              </button>
            ))}
          </div>
          <div className="mt-2.5 px-3.5 flex justify-between text-[13px] text-mute">
            <span>{formatEventTime(new Date(buckets[0].at).toISOString())}</span>
            <span>{formatEventTime(new Date(buckets[buckets.length - 1].at).toISOString())}</span>
          </div>
          <ul className="mt-4 flex flex-col gap-2">
            {latest.map((g) => (
              <li key={g.id} className="flex items-center gap-3 text-[15px]">
                <span className="w-8 h-8 rounded-full bg-ochre flex items-center justify-center text-sm font-semibold shrink-0" aria-hidden="true">{g.name[0]?.toUpperCase()}</span>
                <span className="truncate flex-1">{g.name}</span>
                <span className="text-brown-soft tabular-nums">{formatEventTime(g.checked_in_at)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/** Before the day: what's left to do. */
function ReadyCard({ event, guests, unsent }) {
  const designed = !!(event.cover_image_url || event.invite_message || (event.card_theme && event.card_theme !== "ochre"));
  const steps = [
    { done: designed, title: "Design your invitation", to: "invitation", cta: "Design" },
    { done: guests.length > 0, title: "Add your guests", to: "guests", cta: "Add" },
    { done: guests.length > 0 && unsent === 0, title: unsent ? `Send ${unsent} invite${unsent === 1 ? "" : "s"}` : "Send invites", to: "guests?send=1", cta: "Send" },
    { done: false, title: "Brief your ushers", to: "gate", cta: "Open" },
  ];
  const done = steps.filter((s) => s.done).length;
  return (
    <section className="bento flex flex-col" aria-labelledby="ready-title">
      <div className="flex items-start justify-between gap-3">
        <h2 id="ready-title" className="section-title">Get ready</h2>
        <div className="text-right">
          <p className="bento-num text-[clamp(44px,4.2vw,60px)]">{done}<span className="text-[0.45em] text-mute">/4</span></p>
          <p className="text-[15px] text-brown-soft mt-1">steps done</p>
        </div>
      </div>
      <ol className="mt-5 flex flex-col gap-2">
        {steps.map((s, i) => (
          <li key={s.title} className="flex items-center gap-3 rounded-[20px] bg-tile pl-3 pr-2 py-2">
            <span className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-sm font-medium ${s.done ? "bg-ochre" : "bg-white text-brown-soft"}`} aria-label={s.done ? "Done" : `Step ${i + 1}`}>
              {s.done ? <Check size={17} /> : i + 1}
            </span>
            <span className={`flex-1 min-w-0 truncate text-[16px] ${s.done ? "text-brown-soft line-through decoration-mute" : ""}`}>{s.title}</span>
            <Link to={s.to} className="h-10 px-4 rounded-full bg-white text-sm inline-flex items-center gap-1 hover:bg-brown hover:text-white transition">
              {s.cta} <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Dark dial: arc for the done share, dots for what's left. */
function Dial({ value, label, sub }) {
  const R = 74, C = 2 * Math.PI * R, sweep = 0.78;
  const arc = (Math.min(100, value) / 100) * sweep;
  const gap = arc > 0 ? 13 : 0;
  const dots = Math.max(0, Math.floor(((sweep - arc) * 360 - gap) / 13) + 1);
  return (
    <section className="bg-brown text-cream rounded-full aspect-square w-full max-w-[320px] justify-self-center self-center relative" aria-label={`${value}% ${label.toLowerCase()}`}>
      <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full" aria-hidden="true">
        {arc > 0 && (
          <circle cx="100" cy="100" r={R} fill="none" stroke="#EEB12F" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${C * arc} ${C}`} transform="rotate(130 100 100)" />
        )}
        {Array.from({ length: dots }, (_, i) => {
          const a = ((130 + arc * 360 + gap + i * 13) * Math.PI) / 180;
          return <circle key={i} cx={100 + R * Math.cos(a)} cy={100 + R * Math.sin(a)} r="4.5" fill="#fff" opacity=".9" />;
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="bento-num text-[clamp(34px,3vw,46px)]">{value}%</p>
          <p className="mt-2 text-[16px] text-white/80">{label}</p>
          <p className="text-[13px] text-white/50">{sub}</p>
        </div>
      </div>
    </section>
  );
}

/** Someone at the gate who isn't on the list; the usher asked from the scanner. */
function GateRequests({ requests, onDecided }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const req = requests[0];

  async function decide(approve) {
    if (!req) return;
    setBusy(approve ? "yes" : "no");
    setError(null);
    const { error } = await supabase.rpc("gl_decide_request", { p_request: req.id, p_approve: approve });
    setBusy(null);
    if (error) setError(friendlyError(error));
    else onDecided();
  }

  return (
    <section className="relative overflow-hidden rounded-[36px] bg-ochre px-7 sm:px-8 pt-7 sm:pt-8 pb-7 flex flex-col justify-between min-h-[360px]" aria-labelledby="gr-title" aria-live="polite">
      <KeyholeDisc disc="#2B1B12" hole="#EEB12F" className={`absolute -right-10 -top-10 w-[62%] max-w-[260px] opacity-[0.12] ${req ? "gl-bob" : ""}`} />
      <div className="relative">
        <h2 id="gr-title" className="section-title max-w-[60%]">Gate request{requests.length > 1 ? "s" : ""}</h2>
        <p className="mt-2 text-[15px] text-brown/70 max-w-[70%]">
          {req
            ? requests.length > 1
              ? `${requests.length} people waiting at the gate`
              : "Your usher is asking about someone"
            : "Not on the list? Ushers can ask you from the scanner."}
        </p>
      </div>

      <div className="relative mt-10 rounded-[28px] bg-white p-[18px] grid gap-3">
        {req ? (
          <>
            <div className="flex gap-2.5">
              <button type="button" disabled={!!busy} onClick={() => decide(true)} className="flex-1 h-14 rounded-full bg-brown text-cream text-[16px] inline-flex items-center justify-center gap-2 disabled:opacity-60">
                {busy === "yes" ? <ButtonSpinner /> : <Check size={20} strokeWidth={2.4} aria-hidden="true" />} Let in
              </button>
              <button type="button" disabled={!!busy} onClick={() => decide(false)} aria-label={`Decline ${req.name}`} className="w-14 h-14 rounded-full border-[1.5px] border-coral text-coral inline-flex items-center justify-center disabled:opacity-60">
                {busy === "no" ? <ButtonSpinner /> : <X size={20} aria-hidden="true" />}
              </button>
            </div>
            <div className="rounded-[20px] bg-tile px-[18px] py-4">
              <p className="text-[20px] tracking-[-0.02em] break-words">{req.name}</p>
              <p className="text-[15px] text-brown-soft">
                Not on the list · admits {req.admits}
                {req.note ? ` · “${req.note}”` : ""}
              </p>
              <p className="text-[13px] text-mute mt-1">Asked at {formatEventTime(req.created_at)}</p>
            </div>
            {error && <p role="alert" className="text-sm font-medium text-[#9A3324]">{error}</p>}
          </>
        ) : (
          <div className="rounded-[20px] bg-tile px-[18px] py-5 flex items-center gap-3">
            <span className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0"><Check size={18} aria-hidden="true" /></span>
            <div>
              <p className="text-[18px] tracking-[-0.02em]">No one waiting</p>
              <p className="text-sm text-brown-soft">Requests pop up here live.</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/** Guests by side: the four biggest groups, the rest folded into "Others". */
function SidesCard({ guests, onTheDay, total }) {
  const groups = useMemo(() => {
    const map = new Map();
    for (const g of guests) {
      const key = g.side?.trim() || "";
      const cur = map.get(key) ?? { name: key || "No side", people: 0, arrived: 0 };
      cur.people += g.admits;
      if (g.checked_in_at) cur.arrived += g.admits;
      map.set(key, cur);
    }
    const named = [...map.entries()].filter(([k]) => k).map(([, v]) => v).sort((a, b) => b.people - a.people);
    const rest = [...named.slice(3), ...(map.get("") ? [map.get("")] : [])];
    const top = named.slice(0, rest.length ? 3 : 4);
    if (rest.length) {
      top.push(rest.reduce((acc, r) => ({ ...acc, people: acc.people + r.people, arrived: acc.arrived + r.arrived }), { name: named.length > 3 ? "Others" : "No side", people: 0, arrived: 0 }));
    }
    return { cols: top, hasSides: named.length > 0, named: Math.min(top.length, rest.length ? 3 : 4) };
  }, [guests]);

  const max = Math.max(1, ...groups.cols.map((c) => c.people));
  // Highlight the biggest real side (never the folded "Others" column).
  const hi = groups.cols.slice(0, groups.named).reduce((b, c, i) => (c.people > (groups.cols[b]?.people ?? -1) ? i : b), 0);

  return (
    <section className="bento" aria-labelledby="sides-title">
      <h2 id="sides-title" className="section-title pr-16">Guests by side</h2>
      <CornerLink to="guests" label="Edit sides on the guest list" />
      <p className="bento-num text-[clamp(44px,4.2vw,60px)] mt-6">{total}</p>

      {!groups.hasSides ? (
        <div className="mt-5 rounded-[22px] bg-tile p-5 text-[15px] text-brown-soft">
          Give guests a side, like <span className="text-brown">Bride’s family</span> or <span className="text-brown">Work</span>, when you add or import them. You’ll see who’s here from each side.
        </div>
      ) : (
        <div className="mt-6 grid gap-2.5" style={{ gridTemplateColumns: `repeat(${groups.cols.length}, minmax(0, 1fr))` }}>
          {groups.cols.map((c, i) => {
            const isHi = i === hi;
            const h = `${Math.max(8, (c.people / max) * 100)}%`;
            return (
              <div key={c.name} className="min-w-0">
                <p className={`text-[15px] ${isHi ? "text-brown" : "text-mute"}`}>{pct(c.people, total)}%{isHi ? " ↗" : ""}</p>
                <div className="relative mt-3 h-32 rounded-[14px] bg-tile flex items-end">
                  <i className={`block w-full rounded-[12px] transition-[height] duration-700 ${isHi ? "bg-ochre" : "bg-[#DCD6CE]"}`} style={{ height: h }} />
                  <span
                    className={`absolute -left-1.5 text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${isHi ? "bg-brown text-cream" : "bg-ochre text-brown"}`}
                    style={{ bottom: `calc(${h} - 14px)` }}
                  >
                    {onTheDay ? `${c.arrived}/${c.people}` : c.people}
                  </span>
                </div>
                <p className={`mt-2.5 text-[15px] truncate ${isHi ? "text-brown" : "text-mute"}`} title={c.name}>{c.name}</p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
