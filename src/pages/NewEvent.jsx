import { ArrowLeft, ArrowRight, CalendarDays, Check, Clock, Lock, MapPin, Pencil, Send, ShieldCheck, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader } from "../components/Brand.jsx";
import DeliveryPicker from "../components/DeliveryPicker.jsx";
import FlowSteps from "../components/FlowSteps.jsx";
import TicketCard from "../components/TicketCard.jsx";
import { friendlyError, functionError } from "../lib/errors.js";
import { useFeedback } from "../lib/feedback.js";
import { formatEventDate, formatEventTime, formatNaira } from "../lib/format.js";
import { toInvite } from "../lib/invite.js";
import { unlocks } from "../lib/plans.js";
import { DELIVERY, planPriceKobo, usePricing } from "../lib/pricing.js";
import { supabase } from "../lib/supabase.js";
import { useTitle } from "../lib/useTitle.js";

const DRAFT_KEY = "gl_new_event_draft";
const EMPTY = { name: "", hostNames: "", date: "", time: "12:00", venue: "", notes: "", expected: 150, tierId: "", delivery: "self" };
const OCCASIONS = [
  ["Wedding", "Tolu & Chidi’s Wedding"],
  ["Birthday", "Mum’s 60th Birthday"],
  ["Burial", "Celebration of Life: Pa Adeyemi"],
  ["Naming", "Baby Okafor’s Naming"],
  ["Corporate", "Acme End of Year Party"],
];

function loadDraft() {
  let draft = EMPTY;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) draft = { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    /* private mode */
  }
  // Coming from the pricing section: ?plan=owambe&guests=240
  const q = new URLSearchParams(window.location.search);
  const guests = Number(q.get("guests"));
  if (q.get("plan")) draft = { ...draft, tierId: q.get("plan") };
  if (guests > 0) draft = { ...draft, expected: Math.min(5000, Math.round(guests)) };
  if (q.get("delivery") === "plus" || q.get("delivery") === "self") draft = { ...draft, delivery: q.get("delivery") };
  return draft;
}

/** Three-step wizard: details → guests & plan → review, then straight to Paystack. */
export default function NewEvent() {
  const navigate = useNavigate();
  const { toast } = useFeedback();
  const { tiers, settings } = usePricing();
  const [form, setForm] = useState(loadDraft);
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState(null); // 'creating' | 'paying'
  const [error, setError] = useState(null);
  const topRef = useRef(null);
  useTitle("New event");

  // Keep what they typed if they refresh or come back later.
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    } catch {
      /* private mode */
    }
  }, [form]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  // The smallest plan that fits the expected headcount.
  const recommended = useMemo(
    () => tiers.find((t) => t.max_headcount >= form.expected) ?? tiers[tiers.length - 1],
    [tiers, form.expected],
  );
  const tier = tiers.find((t) => t.id === form.tierId) ?? recommended;
  const tooSmall = tier && tier.max_headcount < form.expected;
  const maxTier = tiers.length ? tiers[tiers.length - 1].max_headcount : 500;
  const delivery = form.delivery === "plus" ? "plus" : "self";
  const total = planPriceKobo(tier, delivery, settings);

  const startsAt = (() => {
    if (!form.date) return null;
    const d = new Date(`${form.date}T${form.time || "12:00"}:00+01:00`);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  })();

  function go(n) {
    setError(null);
    setStep(n);
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function nextFromDetails(e) {
    e.preventDefault();
    if (startsAt && new Date(startsAt).getTime() < Date.now() - 3600_000) {
      setError("That date and time has already passed. Pick a time in the future.");
      return;
    }
    go(1);
  }

  async function createAndPay() {
    if (!tier) return;
    setError(null);
    setPhase("creating");
    const { data, error } = await supabase
      .from("events")
      .insert({
        name: form.name.trim(),
        host_names: form.hostNames.trim() || null,
        starts_at: startsAt,
        venue: form.venue.trim(),
        notes: form.notes.trim() || null,
        tier_id: tier.id,
        delivery,
      })
      .select("id")
      .single();
    if (error || !data) {
      setPhase(null);
      setError(friendlyError(error ?? "Could not create the event."));
      return;
    }
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }

    setPhase("paying");
    const { data: pay, error: payErr } = await supabase.functions.invoke("paystack-init", { body: { event_id: data.id, delivery } });
    if (payErr || !pay?.authorization_url) {
      // The event is saved as a draft; they can pay from its page.
      toast(await functionError(payErr, "Your event is saved, but we couldn’t open Paystack. Try paying again."), { tone: "error" });
      navigate(`/app/events/${data.id}`);
      return;
    }
    window.location.href = pay.authorization_url;
  }

  const preview = toInvite(
    { name: "Adaeze Okafor", admits: 2, token: "0".repeat(32), checked_in_at: null },
    {
      name: form.name.trim() || "Your event name",
      host_names: form.hostNames.trim() || null,
      starts_at: startsAt ?? new Date(Date.now() + 30 * 864e5).toISOString(),
      venue: form.venue.trim() || "Venue",
      notes: form.notes.trim() || null,
      card_theme: "ochre",
      cover_image_url: null,
    },
  );

  if (phase) {
    return (
      <div className="min-h-[60dvh] flex flex-col items-center justify-center gap-3 text-center">
        <Loader label={phase === "creating" ? "Saving your event" : "Opening Paystack"} />
        <p className="text-brown-soft max-w-sm">
          {phase === "paying" ? "You’ll come straight back here after paying. Don’t close this tab." : "One moment…"}
        </p>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div ref={topRef} className="flex flex-col gap-[18px] scroll-mt-28">
      <FlowSteps current={step} />

      <div className="grid gap-[18px] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] items-start">
        <div className="min-w-0 flex flex-col gap-[18px]">
          {/* ---------------- Step 1: details ---------------- */}
          {step === 0 && (
            <form onSubmit={nextFromDetails} className="bento flex flex-col gap-7">
              <Header kicker="Step 1 of 3" title="Tell us about your event" sub="This is what your guests see on their invite. You can change it later." />

              <div>
                <p className="label">What’s the occasion?</p>
                <div className="flex flex-wrap gap-2">
                  {OCCASIONS.map(([label, example]) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, occasion: f.occasion === label ? "" : label }))}
                      aria-pressed={form.occasion === label}
                      className={`h-10 px-4 rounded-full text-sm transition ${form.occasion === label ? "bg-brown text-cream" : "bg-tile hover:bg-sand"}`}
                      title={`e.g. ${example}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                <div>
                  <label htmlFor="name" className="label">Event name</label>
                  <input
                    id="name"
                    required
                    minLength={2}
                    maxLength={120}
                    autoFocus
                    placeholder={OCCASIONS.find(([o]) => o === form.occasion)?.[1] ?? "Tolu & Chidi’s Wedding"}
                    value={form.name}
                    onChange={set("name")}
                    className="field"
                  />
                </div>
                <div>
                  <label htmlFor="hosts" className="label">
                    Hosted by <span className="text-brown-soft font-normal">(optional)</span>
                  </label>
                  <input id="hosts" maxLength={120} placeholder="The Adeyemi family" value={form.hostNames} onChange={set("hostNames")} className="field" />
                </div>
                <div>
                  <label htmlFor="date" className="label">Date</label>
                  <input id="date" type="date" required min={today} value={form.date} onChange={set("date")} className="field" />
                </div>
                <div>
                  <label htmlFor="time" className="label">Start time <span className="text-brown-soft font-normal">(Lagos)</span></label>
                  <input id="time" type="time" required value={form.time} onChange={set("time")} className="field" />
                </div>
              </div>

              <div>
                <label htmlFor="venue" className="label">Venue</label>
                <input id="venue" required minLength={2} maxLength={200} placeholder="Eko Hotel, Victoria Island" value={form.venue} onChange={set("venue")} className="field" />
              </div>

              <div>
                <label htmlFor="notes" className="label">
                  Note for guests <span className="text-brown-soft font-normal">(optional)</span>
                </label>
                <textarea id="notes" maxLength={1000} rows={3} placeholder="Colours: royal blue and gold. Strictly by invitation." value={form.notes} onChange={set("notes")} className="field h-auto py-3 leading-relaxed" />
              </div>

              {error && <ErrorNote>{error}</ErrorNote>}
              <Nav onBack={() => navigate("/app")} backLabel="Cancel" nextLabel="Continue" />
            </form>
          )}

          {/* ---------------- Step 2: guests & plan ---------------- */}
          {step === 1 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                go(2);
              }}
              className="bento flex flex-col gap-7"
            >
              <Header kicker="Step 2 of 3" title="How many people are you expecting?" sub="Count everyone, plus-ones included. We’ll suggest the right plan." />

              <div className="rounded-[26px] bg-tile p-5 sm:p-6">
                <div className="flex items-end justify-between gap-4">
                  <label htmlFor="expected" className="text-brown-soft">Expected guests</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={5000}
                      aria-label="Expected guests"
                      value={form.expected}
                      onChange={(e) => setForm((f) => ({ ...f, expected: Math.max(1, Math.min(5000, Number(e.target.value) || 1)), tierId: "" }))}
                      className="w-28 h-14 rounded-2xl bg-white px-3 text-right bento-num text-[34px] outline-none focus:ring-2 focus:ring-brown"
                    />
                  </div>
                </div>
                <input
                  id="expected"
                  type="range"
                  min={10}
                  max={Math.max(maxTier, 100)}
                  step={10}
                  value={Math.min(form.expected, Math.max(maxTier, 100))}
                  onChange={(e) => setForm((f) => ({ ...f, expected: Number(e.target.value), tierId: "" }))}
                  className="gl-range w-full mt-5 !bg-white"
                />
                <div className="mt-2 flex justify-between text-xs text-mute">
                  <span>10</span>
                  <span>{Math.max(maxTier, 100)}+</span>
                </div>
              </div>

              <fieldset>
                <legend className="label">Choose a plan</legend>
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
                  {tiers.map((t) => {
                    const selected = tier?.id === t.id;
                    const isRec = recommended?.id === t.id;
                    const fits = t.max_headcount >= form.expected;
                    return (
                      <label
                        key={t.id}
                        className={`relative cursor-pointer rounded-[26px] p-5 flex flex-col gap-1 transition ring-2 ${
                          selected ? "bg-ochre ring-brown" : "bg-tile ring-transparent hover:ring-sand"
                        } ${fits ? "" : "opacity-60"}`}
                      >
                        <input type="radio" name="tier" value={t.id} checked={selected} onChange={() => setForm((f) => ({ ...f, tierId: t.id }))} className="sr-only" />
                        {isRec && (
                          <span className={`absolute right-3 top-3 text-[11px] font-medium px-2 py-0.5 rounded-full ${selected ? "bg-brown text-cream" : "bg-ochre"}`}>Best fit</span>
                        )}
                        <span className="text-[18px]">{t.name}</span>
                        <span className={`text-sm ${selected ? "" : "text-brown-soft"}`}>Up to {t.max_headcount.toLocaleString()} people</span>
                        <span className="bento-num text-[32px] mt-3">{formatNaira(t.price_kobo)}</span>
                        <span className={`text-xs ${selected ? "text-brown/70" : "text-mute"}`}>one-off, this event</span>
                      </label>
                    );
                  })}
                </div>
                {tooSmall && (
                  <p className="mt-3 rounded-2xl bg-cream px-4 py-3 text-sm">
                    {tier.name} covers {tier.max_headcount.toLocaleString()} people, fewer than the {form.expected.toLocaleString()} you expect.
                    {form.expected > maxTier ? " For bigger events, email hello@guestlok.com." : " Pick a bigger plan so nobody is turned away."}
                  </p>
                )}
                <p className="mt-3 text-sm text-brown-soft">Every plan has the same features. Only the headcount changes.</p>
              </fieldset>

              <DeliveryPicker tier={tier} settings={settings} value={delivery} onChange={(d) => setForm((f) => ({ ...f, delivery: d }))} />

              <Nav onBack={() => go(0)} nextLabel="Review" disabled={!tier} />
            </form>
          )}

          {/* ---------------- Step 3: review & pay ---------------- */}
          {step === 2 && tier && (
            <div className="bento flex flex-col gap-7">
              <Header kicker="Step 3 of 3" title="Check and pay" sub="One payment for this event. Then you’ll design the invite and add guests." />

              <div className="rounded-[26px] bg-tile divide-y divide-white">
                <Summary icon={Pencil} label="Event" value={form.name.trim()} sub={form.hostNames.trim() ? `Hosted by ${form.hostNames.trim()}` : null} onEdit={() => go(0)} />
                <Summary icon={CalendarDays} label="Date" value={startsAt ? formatEventDate(startsAt) : "—"} onEdit={() => go(0)} />
                <Summary icon={Clock} label="Time" value={startsAt ? `${formatEventTime(startsAt)} (Lagos)` : "—"} onEdit={() => go(0)} />
                <Summary icon={MapPin} label="Venue" value={form.venue.trim()} onEdit={() => go(0)} />
                <Summary icon={Users} label="Plan" value={`${tier.name} · up to ${tier.max_headcount.toLocaleString()} people`} onEdit={() => go(1)} />
                <Summary icon={Send} label="Invites" value={`${DELIVERY[delivery].name}: ${DELIVERY[delivery].short}`} sub={DELIVERY[delivery].line} onEdit={() => go(1)} />
              </div>

              {error && <ErrorNote>{error}</ErrorNote>}

              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
                <button type="button" onClick={() => go(1)} className="btn bg-tile hover:bg-sand">
                  <ArrowLeft size={17} aria-hidden="true" /> Back
                </button>
                <button type="button" onClick={createAndPay} className="h-[56px] px-7 rounded-full bg-brown text-cream text-[16px] inline-flex items-center justify-center gap-2 hover:bg-black transition">
                  <Lock size={17} aria-hidden="true" /> Pay {formatNaira(total)} with Paystack
                </button>
              </div>
              <p className="-mt-3 flex items-center gap-2 text-sm text-brown-soft sm:justify-end">
                <ShieldCheck size={16} aria-hidden="true" /> Card, bank transfer or USSD. Secured by Paystack.
              </p>
            </div>
          )}
        </div>

        {/* Right column: changes with the step */}
        <aside className="flex flex-col gap-[18px]">
          {step === 2 && tier ? (
            <div className="rounded-[36px] bg-brown text-cream p-6 sm:p-7">
              <p className="text-sand">Total today</p>
              <p className="bento-num text-[56px] mt-2">{formatNaira(total)}</p>
              <p className="text-sm text-sand mt-1">
                {tier.name}
                {delivery === "plus" ? " Plus" : ""} · one-off
              </p>
              {delivery === "plus" && (
                <p className="mt-3 text-sm text-sand tabular-nums">
                  {formatNaira(tier.price_kobo)} plan + {formatNaira(total - tier.price_kobo)} Guestlok sends
                </p>
              )}
              <ul className="mt-6 flex flex-col gap-2.5">
                {unlocks(delivery).map((u) => (
                  <li key={u} className="flex items-start gap-3 text-[15px]">
                    <span className="mt-0.5 w-5 h-5 shrink-0 rounded-full bg-ochre text-brown inline-flex items-center justify-center">
                      <Check size={12} strokeWidth={3} aria-hidden="true" />
                    </span>
                    {u}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className={`rounded-[36px] bg-ochre p-4 ${step === 2 ? "" : "max-lg:hidden"}`}>
            <p className="px-2 pt-1 pb-3 text-sm">What your guests will see</p>
            <TicketCard invite={preview} sample />
          </div>
          <p className={`px-2 text-sm text-brown-soft ${step === 2 ? "" : "max-lg:hidden"}`}>Add a cover photo, colours and your own WhatsApp message after paying.</p>
        </aside>
      </div>
    </div>
  );
}

function Header({ kicker, title, sub }) {
  return (
    <div>
      <p className="eyebrow">{kicker}</p>
      <h1 className="mt-2 hero-title">{title}</h1>
      <p className="mt-2 text-brown-soft text-[16px]">{sub}</p>
    </div>
  );
}

function Nav({ onBack, backLabel = "Back", nextLabel, disabled }) {
  return (
    <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
      <button type="button" onClick={onBack} className="btn bg-tile hover:bg-sand">
        <ArrowLeft size={17} aria-hidden="true" /> {backLabel}
      </button>
      <button type="submit" disabled={disabled} className="h-[52px] px-7 rounded-full bg-brown text-cream inline-flex items-center justify-center gap-2 hover:bg-black transition disabled:opacity-50">
        {nextLabel} <ArrowRight size={17} aria-hidden="true" />
      </button>
    </div>
  );
}

function Summary({ icon: Icon, label, value, sub, onEdit }) {
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <span className="w-10 h-10 shrink-0 rounded-full bg-white inline-flex items-center justify-center" aria-hidden="true">
        <Icon size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-brown-soft">{label}</p>
        <p className="text-[16px] break-words">{value}</p>
        {sub && <p className="text-sm text-brown-soft">{sub}</p>}
      </div>
      <button type="button" onClick={onEdit} className="h-9 px-3.5 shrink-0 rounded-full bg-white text-sm hover:bg-sand" aria-label={`Change ${label.toLowerCase()}`}>
        Change
      </button>
    </div>
  );
}

function ErrorNote({ children }) {
  return <p role="alert" className="alert-error">{children}</p>;
}
