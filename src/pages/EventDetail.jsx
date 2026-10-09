import { ArrowLeft, LayoutGrid, Mail, ScanLine, Settings, Users } from "lucide-react";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Loader } from "../components/Brand.jsx";
import FlowSteps from "../components/FlowSteps.jsx";
import { EmptyState, StatusChip } from "../components/Page.jsx";
import PaymentCard from "../components/PaymentCard.jsx";
import WelcomeModal from "../components/WelcomeModal.jsx";
import { playChime } from "../lib/chime.js";
import { useFeedback } from "../lib/feedback.js";
import { formatEventTime, formatShortDate } from "../lib/format.js";
import { supabase } from "../lib/supabase.js";
import { useTitle } from "../lib/useTitle.js";
import { preloadSections } from "./event/sections.js";
import { useSlidingPill } from "../lib/tabTransition.js";


const SECTION_TITLES = { guests: "Guests", invitation: "Invitation", gate: "Gate", settings: "Settings" };

/**
 * Event layout: loads the event + guests once (with live updates from the gate)
 * and shares them with the section pages through the router outlet.
 */
export default function EventDetail() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const [event, setEvent] = useState(null);
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [payNotice, setPayNotice] = useState(null);
  const [welcome, setWelcome] = useState(false);
  const [requests, setRequests] = useState([]);
  const { toast } = useFeedback();
  const navigate = useNavigate();
  const location = useLocation();
  const pathnameRef = useRef(location.pathname);
  pathnameRef.current = location.pathname;

  const loadEvent = useCallback(async () => {
    if (!id) return;
    await Promise.resolve(supabase.rpc("end_my_overdue_events")).catch(() => null);
    const { data, error } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
    if (error || !data) {
      setNotFound(true);
      return;
    }
    setEvent(data);
  }, [id]);

  const loadGuests = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from("guests").select("*").eq("event_id", id).order("name");
    setGuests(data ?? []);
  }, [id]);

  // People an usher asked about at the gate (needs migration 3; empty if not run yet).
  const loadRequests = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("gate_requests")
      .select("*")
      .eq("event_id", id)
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    setRequests(data ?? []);
  }, [id]);

  useEffect(preloadSections, []);

  useEffect(() => {
    Promise.all([loadEvent(), loadGuests(), loadRequests()]).finally(() => setLoading(false));
  }, [loadEvent, loadGuests, loadRequests]);

  // Returning from Paystack: ?reference=GL-...
  useEffect(() => {
    const reference = params.get("reference");
    if (!reference) return;
    setVerifying(true);
    supabase.functions
      .invoke("paystack-verify", { body: { reference } })
      .then(async ({ data, error }) => {
        const extra = /^GL-(UPGRADE|TOPUP)-/.test(reference);
        if (error) setPayNotice("We couldn’t confirm your payment yet. If you were charged, refresh this page in a minute.");
        else if (data?.status === "upgraded" || (extra && data?.status === "already_active" && reference.startsWith("GL-UPGRADE-")))
          setPayNotice("You’re on Plus. Go to Guests and tap “Send all”: Guestlok sends every invite for you.");
        else if (data?.status === "topped_up" || (extra && data?.status === "already_active"))
          setPayNotice("Extra invites added. You can keep sending from the Guests page.");
        else if (data?.status === "activated" || data?.status === "already_active")
          setWelcome(true);
        else if (data?.status === "pending") setPayNotice("Your payment is still processing. Refresh in a minute.");
        else setPayNotice("The payment didn’t go through and you weren’t charged. You can try again below.");
        await loadEvent();
      })
      .finally(() => {
        setVerifying(false);
        params.delete("reference");
        params.delete("trxref");
        setParams(params, { replace: true });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live updates from the gate. Phones drop the live connection when the screen
  // sleeps or the app is in the background, so we also refresh when the page comes
  // back, when the connection returns, and every 20s as a safety net.
  const [reconnect, setReconnect] = useState(0);
  useEffect(() => {
    if (!id) return;
    let wasDown = false;
    let retry = null;
    const channel = supabase
      .channel(`event-${id}-${reconnect}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "guests", filter: `event_id=eq.${id}` }, (payload) => {
        setGuests((current) => {
          if (payload.eventType === "DELETE") return current.filter((g) => g.id !== payload.old.id);
          const row = payload.new;
          const exists = current.some((g) => g.id === row.id);
          const next = exists ? current.map((g) => (g.id === row.id ? row : g)) : [...current, row];
          return next.sort((a, b) => a.name.localeCompare(b.name));
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "gate_requests", filter: `event_id=eq.${id}` }, () => {
        loadRequests();
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          if (wasDown) {
            loadGuests();
            loadRequests();
          }
          wasDown = false;
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          wasDown = true;
          clearTimeout(retry);
          if (status !== "CLOSED") retry = setTimeout(() => setReconnect((n) => n + 1), 4000);
        }
      });
    return () => {
      clearTimeout(retry);
      supabase.removeChannel(channel);
    };
  }, [id, reconnect, loadGuests, loadRequests]);

  useEffect(() => {
    if (!id) return;
    let last = 0;
    const refresh = () => {
      if (document.visibilityState !== "visible" || Date.now() - last < 2000) return;
      last = Date.now();
      loadGuests();
      loadRequests();
    };
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") loadRequests();
    }, 20000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    return () => {
      clearInterval(poll);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [id, loadGuests, loadRequests]);

  // Tell the host when someone new is waiting at the gate, wherever they are in the event.
  const seenRequests = useRef(null);
  useEffect(() => {
    const ids = new Set(requests.map((r) => r.id));
    const seen = seenRequests.current;
    seenRequests.current = ids;
    if (!seen || loading) return;
    const fresh = requests.filter((r) => !seen.has(r.id));
    if (!fresh.length) return;
    navigator.vibrate?.([120, 60, 120]);
    playChime();
    const who = fresh.length === 1 ? `${fresh[0].name || "Someone"} is` : `${fresh.length} people are`;
    toast(`${who} asking to come in at the gate`, {
      tone: "info",
      duration: 9000,
      action: pathnameRef.current.endsWith(id) ? null : { label: "View", onClick: () => navigate(`/app/events/${id}`) },
    });
  }, [requests, loading, id, toast, navigate]);

  const { pathname } = location;
  const section = SECTION_TITLES[pathname.split("/").pop()] ?? (event?.status === "draft" ? "Checkout" : "Overview");
  useTitle(section, event?.name);

  if (loading || verifying) return <Loader label={verifying ? "Confirming your payment" : "Loading event"} />;
  if (notFound || !event) {
    return (
      <EmptyState title="Event not found" body="It may have been deleted, or the link belongs to another account.">
        <Link to="/app" className="btn-dark">Back to my events</Link>
      </EmptyState>
    );
  }

  const live = event.status !== "draft";

  return (
    <div className="flex flex-col gap-[18px]">
      {/* Phones: five equal tabs stick under the top bar; the event pill scrolls away. */}
      {live && (
        <div className="sm:hidden sticky top-[76px] z-20 -mx-4 px-4 pb-2 bg-shell/95 backdrop-blur supports-[backdrop-filter]:bg-shell/80">
          <PhoneNav guests={guests} requests={requests.length} />
        </div>
      )}

      {/* Section tabs + event pill. Sticks under the top bar from tablet up. */}
      <div className="sm:sticky sm:top-[76px] z-20 -mx-4 sm:-mx-7 px-4 sm:px-7 sm:pb-3 sm:bg-shell/95 sm:backdrop-blur sm:supports-[backdrop-filter]:bg-shell/80">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {live ? (
            <div className="max-sm:hidden max-w-full">
              <SectionNav guests={guests} requests={requests.length} />
            </div>
          ) : (
            <FlowSteps current={2} />
          )}
          <span className="hidden md:block flex-1" />
          <div className="flex items-center gap-2 min-w-0 max-w-full">
            <Link
              to="/app"
              aria-label="Back to my events"
              className="h-11 w-11 sm:h-12 sm:w-12 shrink-0 rounded-full bg-white inline-flex items-center justify-center hover:-translate-y-px transition"
            >
              <ArrowLeft size={18} aria-hidden="true" />
            </Link>
            <div className="h-11 sm:h-12 min-w-0 pl-4 sm:pl-5 pr-2 rounded-full bg-white inline-flex items-center gap-3">
              <span className="min-w-0">
                <span className="block truncate text-[15px] leading-tight">{event.name}</span>
                <span className="block truncate text-xs text-brown-soft leading-tight">
                  {formatShortDate(event.starts_at)} · {formatEventTime(event.starts_at)} · {event.venue}
                </span>
              </span>
              <StatusChip status={event.status} className="shrink-0" />
            </div>
          </div>
        </div>
      </div>

      {payNotice && live && <p role="status" className="bg-white rounded-[24px] px-6 py-4 font-medium">{payNotice}</p>}
      {live ? (
        <Suspense fallback={<Loader label="Loading" />}>
          <div key={pathname} className="gl-tab-in flex flex-col gap-[18px]">
            <Outlet context={{ event, setEvent, guests, reloadGuests: loadGuests, requests, reloadRequests: loadRequests }} />
          </div>
        </Suspense>
      ) : (
        <PaymentCard event={event} onEventChange={setEvent} notice={payNotice} showSteps={false} />
      )}
      {live && <WelcomeModal open={welcome} onClose={() => setWelcome(false)} event={event} />}
    </div>
  );
}

const EASE = "duration-[420ms] ease-[cubic-bezier(.3,1.25,.45,1)]";

function SectionNav({ guests, requests }) {
  const { pathname } = useLocation();
  const trackRef = useRef(null);
  const pill = useSlidingPill(trackRef, pathname);
  const items = [
    { to: "", end: true, label: "Overview", badge: requests || null, alert: true },
    { to: "guests", label: "Guests", badge: guests.length || null },
    { to: "invitation", label: "Invitation" },
    { to: "gate", label: "Gate" },
    { to: "settings", label: "Settings" },
  ];
  return (
    <nav aria-label="Event sections" className="max-w-full overflow-x-auto [scrollbar-width:none] rounded-full">
      <ul ref={trackRef} className="relative isolate inline-flex gap-1 p-[5px] rounded-full bg-white">
        <li aria-hidden="true" className={`absolute left-0 top-0 -z-10 rounded-full bg-brown transition-[transform,width] ${EASE}`} style={pill} />
        {items.map(({ to, end, label, badge, alert }) => (
          <li key={label} className="shrink-0">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `h-[42px] px-[18px] rounded-full inline-flex items-center gap-2 text-[15px] transition-colors duration-300 ${
                  isActive ? "text-cream" : "text-brown-soft hover:text-brown"
                }`
              }
            >
              {label}
              {badge != null && (
                <span
                  className={`min-w-[22px] h-[22px] px-1.5 rounded-full text-xs font-medium tabular-nums inline-flex items-center justify-center ${
                    alert ? "bg-coral text-white" : "bg-ochre text-brown"
                  }`}
                  aria-label={alert ? `${badge} waiting at the gate` : `${badge} guests`}
                >
                  {badge}
                </span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

const PHONE_ITEMS = [
  { to: "", end: true, label: "Overview", icon: LayoutGrid, key: "requests", alert: true },
  { to: "guests", label: "Guests", icon: Users, key: "guests" },
  { to: "invitation", label: "Invite", icon: Mail },
  { to: "gate", label: "Gate", icon: ScanLine },
  { to: "settings", label: "Settings", icon: Settings },
];
const GROW = 3; // the active tab is this many times wider than the others

/**
 * Phones: icon tabs; the active one widens to show its label. Widths animate with
 * flex-grow and the pill moves with the same timing, so both stay in step.
 */
function PhoneNav({ guests, requests }) {
  const { pathname } = useLocation();
  const base = pathname.replace(/\/$/, "");
  const last = base.split("/").pop();
  const active = Math.max(0, PHONE_ITEMS.findIndex((it) => it.to === last));
  const counts = { requests: requests || null, guests: guests.length || null };
  const gap = 4;
  const units = PHONE_ITEMS.length - 1 + GROW;
  return (
    <nav aria-label="Event sections" className="p-[5px] rounded-full bg-white">
      <ul className="relative isolate flex gap-1">
        <li
          aria-hidden="true"
          className={`absolute inset-y-0 left-0 -z-10 rounded-full bg-brown transition-transform motion-reduce:transition-none ${EASE}`}
          style={{
            width: `calc((100% - ${gap * (PHONE_ITEMS.length - 1)}px) * ${GROW / units})`,
            transform: `translateX(calc(${active} * (100% / ${GROW} + ${gap}px)))`,
          }}
        />
        {PHONE_ITEMS.map(({ to, end, label, icon: Icon, key, alert }, i) => {
          const badge = key ? counts[key] : null;
          const on = i === active;
          return (
            <li
              key={label}
              className={`min-w-0 basis-0 transition-[flex-grow] motion-reduce:transition-none ${EASE}`}
              style={{ flexGrow: on ? GROW : 1 }}
            >
              <NavLink
                to={to}
                end={end}
                aria-label={label}
                className={`h-11 w-full rounded-full flex items-center justify-center text-[15px] max-[359px]:text-[14px] select-none [-webkit-tap-highlight-color:transparent] transition-[color,transform] duration-200 active:scale-[0.94] ${
                  on ? "text-cream" : "text-brown-soft"
                }`}
              >
                <span className="relative shrink-0">
                  <Icon size={20} aria-hidden="true" />
                  {badge != null && !on && (
                    <span
                      className={`absolute -top-2 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-medium tabular-nums inline-flex items-center justify-center ring-2 ring-white ${
                        alert ? "bg-coral text-white" : "bg-ochre text-brown"
                      }`}
                      aria-label={alert ? `${badge} waiting at the gate` : `${badge} guests`}
                    >
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </span>
                <span
                  className={`overflow-hidden whitespace-nowrap inline-flex items-center gap-1.5 transition-[max-width,opacity,margin] duration-300 ${
                    on ? "max-w-[120px] opacity-100 ml-2" : "max-w-0 opacity-0 ml-0"
                  }`}
                >
                  <span aria-hidden="true">{label}</span>
                  {badge != null && on && (
                    <span
                      className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-medium tabular-nums inline-flex items-center justify-center ${
                        alert ? "bg-coral text-white" : "bg-ochre text-brown"
                      }`}
                      aria-label={alert ? `${badge} waiting at the gate` : `${badge} guests`}
                    >
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
