import { ArrowUpRight, CalendarDays, MapPin, Plus, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { KeyholeDisc, Loader, SunMark } from "../components/Brand.jsx";
import { formatEventDate, formatEventTime, formatShortDate } from "../lib/format.js";
import { PlusChip, StatusChip } from "../components/Page.jsx";
import { supabase } from "../lib/supabase.js";
import { useTitle } from "../lib/useTitle.js";


const DAY = 24 * 3600_000;

const SHOW = 6; // cards per section at first
const STEP = 12; // then this many more per tap

function totals(e) {
  // From the event_summaries view (migration 13); older setups send the guest rows instead.
  if (e.invited != null) return { invited: e.invited, arrived: e.arrived ?? 0 };
  const list = e.guests ?? [];
  return {
    invited: list.reduce((n, g) => n + g.admits, 0),
    arrived: list.filter((g) => g.checked_in_at).reduce((n, g) => n + g.admits, 0),
  };
}

export default function Dashboard() {
  const [events, setEvents] = useState(null);
  const [error, setError] = useState(null);
  const [now] = useState(() => Date.now());
  const [query, setQuery] = useState("");
  useTitle("My events");

  useEffect(() => {
    // Events end by themselves 24h after they start (fails quietly before migration 5).
    Promise.resolve(supabase.rpc("end_my_overdue_events"))
      .catch(() => null)
      .then(async () => {
        // Totals are added up in the database, so this stays quick with hundreds of events.
        let res = await supabase.from("event_summaries").select("*").order("starts_at", { ascending: true });
        if (res.error) {
          // Before migration 13: fetch the guest rows and add them up here.
          res = await supabase.from("events").select("*, guests(admits, checked_in_at)").order("starts_at", { ascending: true });
        }
        if (res.error) setError(res.error.message);
        setEvents(res.data ?? []);
      });
  }, []);

  if (!events) return <Loader label="Loading your events" />;

  const q = query.trim().toLowerCase();
  const matches = (e) => !q || e.name.toLowerCase().includes(q) || (e.venue ?? "").toLowerCase().includes(q) || (e.host_names ?? "").toLowerCase().includes(q);
  const upcoming = events.filter((e) => new Date(e.starts_at).getTime() >= now - 12 * 3600_000 && e.status !== "ended");
  const t = (e) => new Date(e.starts_at).getTime();
  upcoming.sort((a, b) => t(a) - t(b)); // soonest first
  const past = events.filter((e) => !upcoming.includes(e)).sort((a, b) => t(b) - t(a)); // most recent first
  const [next, ...later] = upcoming;
  const all = events.map(totals);
  const invitedAll = all.reduce((n, t) => n + t.invited, 0);
  const arrivedAll = all.reduce((n, t) => n + t.arrived, 0);

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-end justify-between gap-4 pt-2">
        <h1 className="page-title">My events</h1>
        <Link to="/app/events/new" className="h-[52px] px-[22px] rounded-full bg-brown text-cream inline-flex items-center gap-2.5 text-[16px] hover:-translate-y-px transition">
          <Plus size={20} aria-hidden="true" /> New event
        </Link>
      </div>

      {error && <p role="alert" className="rounded-2xl bg-coral/15 text-[#9A3324] px-5 py-3 font-medium">{error}</p>}

      {events.length === 0 ? (
        <div className="bento flex flex-col items-center text-center gap-5 py-16">
          <SunMark size={110} ray="#EEB12F" />
          <h2 className="hero-title">No events yet</h2>
          <p className="text-brown-soft max-w-sm text-[17px]">
            Your first party is one step away. Set the date, the venue and how many people you’re expecting.
          </p>
          <Link to="/app/events/new" className="h-[52px] px-[22px] rounded-full bg-ochre inline-flex items-center gap-2 font-medium">
            Plan your first event
          </Link>
        </div>
      ) : (
        <>
          <div className="grid gap-[18px] grid-cols-1 min-[1100px]:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            {next ? <NextUp event={next} now={now} /> : <NothingNext />}
            <div className="grid gap-[18px] grid-cols-2 grid-rows-[auto_minmax(0,1fr)]">
              <Stat label={<>Events<br />hosted</>} value={events.length} chip={upcoming.length ? `${upcoming.length} upcoming` : null} />
              <Stat label={<>People<br />invited</>} value={invitedAll} />
              <div className="relative overflow-hidden col-span-2 rounded-[30px] sm:rounded-[36px] bg-brown text-cream px-[22px] sm:px-8 py-6 flex flex-wrap items-end justify-between gap-4">
                <KeyholeDisc disc="#EEB12F" hole="#2B1B12" className="absolute -right-8 -top-8 w-40 h-40 opacity-15" />
                <div className="relative">
                  <p className="text-white/70 text-[16px]">Guests who came</p>
                  <p className="bento-num text-[clamp(44px,4.2vw,60px)] mt-3">{arrivedAll}</p>
                </div>
                <p className="relative text-[15px] text-white/70 max-w-[220px]">
                  Every one of them with a valid QR. <span className="font-yoruba italic text-ochre">Mo gbọ́, mo yà</span> stayed outside.
                </p>
              </div>
            </div>
          </div>

          {/* Lots of events: search, and each section starts short */}
          {events.length > SHOW + 2 && (
            <div className="relative mt-2 max-w-md">
              <label htmlFor="ev-search" className="sr-only">Search your events</label>
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-brown-soft pointer-events-none" aria-hidden="true" />
              <input
                id="ev-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${events.length} events`}
                className="w-full h-12 rounded-full bg-white pl-11 pr-11 text-[16px] outline-none focus:ring-2 focus:ring-brown"
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full hover:bg-tile inline-flex items-center justify-center">
                  <X size={16} aria-hidden="true" />
                </button>
              )}
            </div>
          )}
          {q && !later.some(matches) && !past.some(matches) && (
            <p className="px-1 text-brown-soft">No events match “{query.trim()}”.</p>
          )}
          {later.some(matches) && <EventGrid key={`l${q}`} title="Coming up" events={later.filter(matches)} expanded={!!q} />}
          {past.some(matches) && <EventGrid key={`p${q}`} title="Past" events={past.filter(matches)} expanded={!!q} />}
        </>
      )}
    </div>
  );
}

function NextUp({ event, now }) {
  const { invited, arrived } = totals(event);
  const days = Math.ceil((new Date(event.starts_at).getTime() - now) / DAY);
  const segs = 24;
  const fill = event.headcount ? Math.round((invited / event.headcount) * segs) : 0;
  const when = days > 1 ? `${days} days` : days === 1 ? "Tomorrow" : "Today";

  return (
    <Link to={`/app/events/${event.id}`} className="bento group flex flex-col gap-6 hover:-translate-y-0.5 transition">
      <span className="absolute top-5 right-5 sm:top-6 sm:right-6 w-12 h-12 sm:w-14 sm:h-14 rounded-full border-[1.5px] border-tile inline-flex items-center justify-center group-hover:bg-ochre group-hover:border-ochre transition">
        <ArrowUpRight size={22} aria-hidden="true" />
      </span>
      <div className="flex items-center gap-2 pr-16">
        <span className="text-[15px] text-brown-soft">Next up</span>
        <StatusChip status={event.status} />
        <PlusChip event={event} />
      </div>
      <h2 className="text-[34px] sm:text-[48px] font-normal tracking-[-0.04em] leading-[1.02] pr-12 break-words">{event.name}</h2>
      <div className="flex flex-wrap gap-2 text-[15px]">
        <span className="h-10 px-4 rounded-full bg-tile inline-flex items-center gap-2 whitespace-nowrap">
          <CalendarDays size={16} aria-hidden="true" />
          <span className="sm:hidden">{formatShortDate(event.starts_at)}</span>
          <span className="max-sm:hidden">{formatEventDate(event.starts_at)}</span> · {formatEventTime(event.starts_at)}
        </span>
        <span className="h-10 px-4 rounded-full bg-tile inline-flex items-center gap-2 max-w-full">
          <MapPin size={16} aria-hidden="true" className="shrink-0" /> <span className="truncate">{event.venue}</span>
        </span>
      </div>

      <div className="mt-auto grid gap-4 grid-cols-1 sm:grid-cols-[auto_minmax(0,1fr)] items-end">
        <div className="rounded-[26px] bg-ochre px-6 py-5">
          <p className="text-[15px]">{days > 1 ? "To go" : "It’s on"}</p>
          <p className="bento-num text-[clamp(44px,5vw,64px)] mt-2">{when}</p>
        </div>
        {event.status === "draft" ? (
          <div className="rounded-[26px] bg-tile px-6 py-5 text-[16px] text-brown-soft">
            Pay for a plan to start adding guests and sending invites.
          </div>
        ) : (
          <div className="rounded-[26px] bg-tile px-6 py-5">
            <div className="flex justify-between text-[15px] text-brown-soft">
              <span>{arrived > 0 ? `${arrived} arrived` : "On the list"}</span>
              <span>
                <b className="font-medium text-brown">{invited}</b> / {event.headcount}
              </span>
            </div>
            <div className="mt-4 flex gap-1" aria-hidden="true">
              {Array.from({ length: segs }, (_, i) => (
                <i key={i} className={`h-8 flex-1 rounded-full ${i < fill ? "bg-ochre" : "bg-[#E2DCD3]"}`} />
              ))}
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}

function NothingNext() {
  return (
    <div className="bento flex flex-col justify-center gap-4">
      <h2 className="hero-title">Nothing coming up</h2>
      <p className="text-brown-soft text-[17px]">Plan the next one and we’ll keep the gate.</p>
      <Link to="/app/events/new" className="self-start h-[52px] px-[22px] rounded-full bg-ochre inline-flex items-center gap-2 font-medium">
        <Plus size={18} aria-hidden="true" /> New event
      </Link>
    </div>
  );
}

function Stat({ label, value, chip }) {
  return (
    <div className="min-w-0 rounded-[30px] sm:rounded-[36px] bg-white px-5 sm:px-6 py-5 sm:py-6">
      <div className="flex flex-wrap items-start justify-between gap-2 text-[15px] sm:text-[16px] leading-tight text-brown-soft">
        <span>{label}</span>
        {chip && <span className="h-[28px] sm:h-[30px] px-3 rounded-full bg-ochre text-brown text-sm font-medium inline-flex items-center whitespace-nowrap">{chip}</span>}
      </div>
      <p className="bento-num text-[clamp(40px,4.2vw,60px)] mt-5 sm:mt-6">{value}</p>
    </div>
  );
}

/** A section of event cards that starts short and grows a step at a time; controls sit at the bottom. */
function EventGrid({ title, events, expanded = false }) {
  const [limit, setLimit] = useState(expanded ? Infinity : SHOW);
  const headRef = useRef(null);
  const shown = events.slice(0, limit);
  const left = events.length - shown.length;

  function fold() {
    setLimit(SHOW);
    // Back to the heading, so you're not left at the bottom of a much shorter page.
    requestAnimationFrame(() => headRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  return (
    <section className="flex flex-col gap-3 mt-4">
      <h2 ref={headRef} className="section-title px-1 scroll-mt-24">
        {title} <span className="text-brown-soft text-[0.7em]">{events.length}</span>
      </h2>
      <div className="grid gap-[18px] grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))]">
        {shown.map((e) => {
          const { invited, arrived } = totals(e);
          const share = e.status === "ended" ? (invited ? arrived / invited : 0) : e.headcount ? invited / e.headcount : 0;
          return (
            <Link key={e.id} to={`/app/events/${e.id}`} className="group rounded-[30px] sm:rounded-[32px] bg-white p-[22px] sm:p-6 flex flex-col gap-4 hover:-translate-y-0.5 transition">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <StatusChip status={e.status} />
                  <PlusChip event={e} />
                </span>
                <span className="w-10 h-10 rounded-full border-[1.5px] border-tile inline-flex items-center justify-center group-hover:bg-ochre group-hover:border-ochre transition">
                  <ArrowUpRight size={18} aria-hidden="true" />
                </span>
              </div>
              <h3 className="text-[26px] font-normal tracking-[-0.03em] leading-tight break-words">{e.name}</h3>
              <p className="text-[15px] text-brown-soft truncate">
                {formatShortDate(e.starts_at)} · {e.venue}
              </p>
              {e.status === "draft" && <p className="mt-auto text-[15px] font-medium text-gold-ink">Finish checkout to unlock guests →</p>}
              {e.status !== "draft" && (
                <div className="mt-auto">
                  <div className="flex justify-between text-sm text-brown-soft">
                    <span>{e.status === "ended" ? "Came" : "Invited"}</span>
                    <span className="tabular-nums">
                      {e.status === "ended" ? `${arrived} / ${invited}` : `${invited} / ${e.headcount}`}
                    </span>
                  </div>
                  <div className="mt-2 h-2.5 rounded-full bg-tile overflow-hidden">
                    <i className="block h-full rounded-full bg-ochre" style={{ width: `${Math.min(100, share * 100)}%` }} />
                  </div>
                </div>
              )}
            </Link>
          );
        })}
      </div>
      {(left > 0 || shown.length > SHOW) && (
        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
          {left > 0 && (
            <button type="button" onClick={() => setLimit((n) => n + STEP)} className="h-12 px-6 rounded-full bg-white hover:bg-sand text-[15px] inline-flex items-center gap-2 transition">
              Show {Math.min(STEP, left)} more <span className="text-brown-soft">· {left} left</span>
            </button>
          )}
          {shown.length > SHOW && !expanded && (
            <button type="button" onClick={fold} className="h-12 px-5 rounded-full text-[15px] text-brown-soft hover:text-brown hover:bg-white transition">
              Show fewer
            </button>
          )}
        </div>
      )}
    </section>
  );
}
