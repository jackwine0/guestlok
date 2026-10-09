import { useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { ButtonSpinner } from "../../components/Brand.jsx";
import EndedPanel from "../../components/EndedPanel.jsx";
import PlusPanel from "../../components/PlusPanel.jsx";
import { deleteConfirmOptions, deleteEvent } from "../../lib/deleteEvent.js";
import { friendlyError } from "../../lib/errors.js";
import { useFeedback } from "../../lib/feedback.js";
import { usePricing } from "../../lib/pricing.js";
import { supabase } from "../../lib/supabase.js";

/** Split an ISO time into Lagos-local date + time strings for the inputs. */
function lagosParts(iso) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Lagos",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

export default function Settings() {
  const { event, setEvent, guests } = useOutletContext();
  const initial = lagosParts(event.starts_at);
  const saved = {
    name: event.name,
    host_names: event.host_names ?? "",
    date: initial.date,
    time: initial.time,
    venue: event.venue,
    notes: event.notes ?? "",
  };
  const [form, setForm] = useState(saved);
  const [busy, setBusy] = useState(false);
  const { confirm, toast } = useFeedback();
  const { tiers, settings } = usePricing();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);

  async function removeEvent() {
    const sure = await confirm(deleteConfirmOptions(event, guests.length));
    if (!sure) return;
    setDeleting(true);
    const error = await deleteEvent(event);
    setDeleting(false);
    if (error) toast(friendlyError(error), { tone: "error" });
    else {
      toast(`“${event.name}” deleted`);
      navigate("/app", { replace: true });
    }
  }
  const tier = tiers.find((t) => t.id === event.tier_id);
  const locked = event.status !== "active";
  const dirty = Object.keys(saved).some((k) => saved[k] !== form[k]);
  const people = guests.reduce((n, g) => n + g.admits, 0);
  const usage = event.headcount ? Math.min(100, Math.round((people / event.headcount) * 100)) : 0;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function save(e) {
    e?.preventDefault();
    setBusy(true);
    const { data, error } = await supabase
      .from("events")
      .update({
        name: form.name.trim(),
        host_names: form.host_names.trim() || null,
        starts_at: new Date(`${form.date}T${form.time}:00+01:00`).toISOString(),
        venue: form.venue.trim(),
        notes: form.notes.trim() || null,
      })
      .eq("id", event.id)
      .select("*")
      .single();
    setBusy(false);
    if (error) {
      toast(friendlyError(error), { tone: "error" });
      return;
    }
    setEvent(data);
    const next = lagosParts(data.starts_at);
    setForm({ name: data.name, host_names: data.host_names ?? "", date: next.date, time: next.time, venue: data.venue, notes: data.notes ?? "" });
    toast("Saved. Guests see the new details when they open their invite.");
  }

  async function endEvent() {
    const sure = await confirm({
      title: "End this event?",
      body: "Only do this after the party. It can’t be undone.",
      points: [
        "The gate scanner stops working for every usher.",
        "The guest list is locked. No more adds, removes or invites.",
        "Your numbers stay on the dashboard.",
      ],
      typeToConfirm: "END",
      confirmLabel: "End event",
      danger: true,
    });
    if (!sure) return;
    const { data, error } = await supabase.from("events").update({ status: "ended" }).eq("id", event.id).select("*").single();
    if (error) toast(friendlyError(error), { tone: "error" });
    else {
      setEvent(data);
      toast("Event ended. Thanks for hosting with Guestlok.");
    }
  }

  return (
    <div className="flex flex-col gap-[18px] pb-24">
      <div className="px-1">
        <h2 className="page-title">Settings</h2>
        <p className="page-sub">Event details, your plan, and closing the gate after the party.</p>
      </div>

      <div className="grid gap-[18px] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] items-start">
        <form id="event-details" onSubmit={save} className="bento flex flex-col gap-7">
          <fieldset disabled={locked} className="flex flex-col gap-7 disabled:opacity-60 min-w-0">
            <Group title="The event" hint="Shown at the top of every invite.">
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                <Field id="s-name" label="Event name">
                  <input id="s-name" required minLength={2} maxLength={120} value={form.name} onChange={set("name")} className="field" />
                </Field>
                <Field id="s-host" label="Hosted by" optional>
                  <input id="s-host" maxLength={120} placeholder="The Adeyemi family" value={form.host_names} onChange={set("host_names")} className="field" />
                </Field>
              </div>
            </Group>

            <Group title="When and where" hint="Times are Lagos time (WAT).">
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                <Field id="s-date" label="Date">
                  <input id="s-date" type="date" required value={form.date} onChange={set("date")} className="field" />
                </Field>
                <Field id="s-time" label="Start time">
                  <input id="s-time" type="time" required value={form.time} onChange={set("time")} className="field" />
                </Field>
              </div>
              <Field id="s-venue" label="Venue">
                <input id="s-venue" required minLength={2} maxLength={200} value={form.venue} onChange={set("venue")} className="field" />
              </Field>
            </Group>

            <Group title="Note for guests" hint="Dress code, parking, gate time. Shown on the invite.">
              <Field id="s-notes" label="Note" optional hideLabel>
                <textarea id="s-notes" rows={4} maxLength={1000} placeholder="Colours: royal blue and gold. Gate opens 12 noon." value={form.notes} onChange={set("notes")} className="field h-auto py-3 leading-relaxed" />
              </Field>
              <p className="-mt-2 text-right text-xs text-brown-soft tabular-nums">{form.notes.length}/1000</p>
            </Group>
          </fieldset>
        </form>

        <div className="flex flex-col gap-[18px]">
          <section className="bento" aria-labelledby="plan-title">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="plan-title" className="section-title">Your plan</h3>
                <p className="mt-1 text-brown-soft">{tier?.name ?? event.tier_id}{event.delivery === "plus" ? " Plus" : ""}</p>
              </div>
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-tile">Paid</span>
            </div>
            <p className="bento-num text-[48px] mt-5">
              {people}
              <span className="text-[0.42em] text-mute"> / {event.headcount.toLocaleString()} people</span>
            </p>
            <div className="mt-3 h-3 rounded-full bg-tile overflow-hidden" aria-hidden="true">
              <i className={`block h-full rounded-full ${usage >= 90 ? "bg-coral" : "bg-ochre"}`} style={{ width: `${usage}%` }} />
            </div>
            <p className="mt-2 text-sm text-brown-soft">
              {usage >= 100 ? "Your list is full." : `${(event.headcount - people).toLocaleString()} spaces left`}
            </p>
            <a href="mailto:hello@guestlok.com?subject=Upgrade%20my%20plan" className="mt-5 btn w-full bg-tile hover:bg-sand">Need more space?</a>
          </section>

          {(event.delivery === "plus" || settings.plus_enabled) && <PlusPanel event={event} tier={tier} settings={settings} />}

          {!locked ? (
            <section className="rounded-[30px] sm:rounded-[36px] bg-white p-6 sm:p-8 ring-2 ring-coral/40" aria-labelledby="end-title">
              <h3 id="end-title" className="section-title">End event</h3>
              <p className="mt-2 text-[15px] text-brown-soft">Closes the gate scanner and locks the guest list. If you forget, it ends by itself 24 hours after the start time.</p>
              <button type="button" onClick={endEvent} className="mt-5 btn w-full bg-coral text-brown hover:brightness-95">End event</button>
            </section>
          ) : (
            <EndedPanel compact event={event} guests={guests} onEventChange={setEvent} />
          )}

          <section className="rounded-[30px] sm:rounded-[36px] bg-white p-6 sm:p-8" aria-labelledby="delete-title">
            <h3 id="delete-title" className="section-title">Delete event</h3>
            <p className="mt-2 text-[15px] text-brown-soft">
              Removes the event, guest list and invites for good. Your payment record is kept, but it isn’t refunded.
            </p>
            <button type="button" onClick={removeEvent} disabled={deleting} className="mt-5 btn-danger w-full">
              {deleting && <ButtonSpinner />} Delete event
            </button>
          </section>
        </div>
      </div>

      {/* Save bar */}
      <div
        className={`fixed z-40 left-1/2 lg:left-[calc(50%-199px)] -translate-x-1/2 bottom-[max(1rem,env(safe-area-inset-bottom))] w-[min(94vw,520px)] transition duration-300 ${
          dirty && !locked ? "translate-y-0 opacity-100" : "translate-y-24 opacity-0 pointer-events-none"
        }`}
        aria-hidden={!dirty}
      >
        <div className="flex items-center gap-2 rounded-full bg-brown text-cream pl-5 pr-1.5 py-1.5 shadow-[0_18px_40px_rgba(28,18,12,0.35)]">
          <span className="w-2 h-2 rounded-full bg-ochre shrink-0" aria-hidden="true" />
          <span className="flex-1 text-[15px]">Unsaved changes</span>
          <button type="button" onClick={() => setForm(saved)} tabIndex={dirty ? 0 : -1} className="h-11 px-4 rounded-full text-sm text-sand hover:text-cream">
            Discard
          </button>
          <button type="submit" form="event-details" disabled={busy} tabIndex={dirty ? 0 : -1} className="h-11 px-5 rounded-full bg-ochre text-brown text-sm font-medium inline-flex items-center gap-2">
            {busy && <ButtonSpinner />} Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

function Group({ title, hint, children }) {
  return (
    <div className="grid gap-4 md:grid-cols-[200px_minmax(0,1fr)] md:gap-8">
      <div>
        <h3 className="text-[18px] tracking-[-0.02em]">{title}</h3>
        <p className="mt-1 text-sm text-brown-soft">{hint}</p>
      </div>
      <div className="flex flex-col gap-4 min-w-0">{children}</div>
    </div>
  );
}

function Field({ id, label, optional, hideLabel, children }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={hideLabel ? "sr-only" : "label"}>
        {label} {optional && <span className="font-normal text-brown-soft">(optional)</span>}
      </label>
      {children}
    </div>
  );
}
