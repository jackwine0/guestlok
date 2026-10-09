import { CalendarDays, Check, Clock, Lock, MapPin, Pencil, ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { friendlyError, functionError } from "../lib/errors.js";
import { useFeedback } from "../lib/feedback.js";
import { formatEventDate, formatEventTime, formatNaira } from "../lib/format.js";
import { unlocks } from "../lib/plans.js";
import { planPriceKobo, usePricing } from "../lib/pricing.js";
import { supabase } from "../lib/supabase.js";
import { ButtonSpinner } from "./Brand.jsx";
import DeliveryPicker from "./DeliveryPicker.jsx";
import FlowSteps from "./FlowSteps.jsx";
import Modal from "./Modal.jsx";

function lagosParts(iso) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/** Checkout for an event that hasn't been paid for yet (status = draft). */
export default function PaymentCard({ event, onEventChange, notice, showSteps = true }) {
  const navigate = useNavigate();
  const { confirm, toast } = useFeedback();
  const { tiers, settings } = usePricing();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  const tier = tiers.find((t) => t.id === event.tier_id);
  const delivery = event.delivery === "plus" ? "plus" : "self";
  const total = planPriceKobo(tier, delivery, settings);

  async function changeDelivery(d) {
    if (d === delivery) return;
    onEventChange({ ...event, delivery: d }); // feels instant; saved below
    const { data, error } = await supabase.from("events").update({ delivery: d }).eq("id", event.id).select("*").single();
    if (error) {
      onEventChange(event);
      toast(friendlyError(error), { tone: "error" });
    } else onEventChange(data);
  }

  async function changeTier(tierId) {
    if (tierId === event.tier_id) return;
    const { data, error } = await supabase.from("events").update({ tier_id: tierId }).eq("id", event.id).select("*").single();
    if (error) toast(friendlyError(error), { tone: "error" });
    else onEventChange(data);
  }

  async function pay() {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("paystack-init", { body: { event_id: event.id, delivery } });
    if (error || !data?.authorization_url) {
      setBusy(false);
      toast(await functionError(error, "Could not open Paystack. Please try again."), { tone: "error" });
      return;
    }
    window.location.href = data.authorization_url;
  }

  async function deleteDraft() {
    const sure = await confirm({
      title: "Delete this event?",
      body: `“${event.name}” hasn’t been paid for yet. Deleting it removes it for good.`,
      confirmLabel: "Delete event",
      danger: true,
    });
    if (!sure) return;
    const { error } = await supabase.from("events").delete().eq("id", event.id);
    if (error) toast(friendlyError(error), { tone: "error" });
    else {
      toast("Event deleted");
      navigate("/app");
    }
  }

  return (
    <div className="flex flex-col gap-[18px]">
      {showSteps && <FlowSteps current={2} />}

      {notice && (
        <p role="status" className="rounded-[24px] bg-cream px-6 py-4 font-medium">{notice}</p>
      )}

      <div className="grid gap-[18px] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] items-start">
        <div className="bento flex flex-col gap-7 min-w-0">
          <div>
            <p className="eyebrow">Almost there</p>
            <h2 className="mt-2 hero-title">Pay to unlock your guest list</h2>
            <p className="mt-2 text-brown-soft text-[16px]">Your event is saved. Once you pay, you can design the invite, add guests and send invites.</p>
          </div>

          <div className="rounded-[26px] bg-tile">
            <div className="flex items-center justify-between gap-3 px-5 pt-4">
              <p className="text-[13px] text-brown-soft">Your event</p>
              <button type="button" onClick={() => setEditing(true)} className="h-9 px-3.5 rounded-full bg-white text-sm inline-flex items-center gap-1.5 hover:bg-sand">
                <Pencil size={14} aria-hidden="true" /> Edit details
              </button>
            </div>
            <div className="px-5 pb-5 pt-1">
              <p className="text-[22px] tracking-[-0.02em] break-words">{event.name}</p>
              {event.host_names && <p className="text-brown-soft">Hosted by {event.host_names}</p>}
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <span className="h-9 px-3.5 rounded-full bg-white inline-flex items-center gap-2"><CalendarDays size={15} aria-hidden="true" />{formatEventDate(event.starts_at)}</span>
                <span className="h-9 px-3.5 rounded-full bg-white inline-flex items-center gap-2"><Clock size={15} aria-hidden="true" />{formatEventTime(event.starts_at)}</span>
                <span className="h-9 px-3.5 rounded-full bg-white inline-flex items-center gap-2 max-w-full"><MapPin size={15} aria-hidden="true" className="shrink-0" /><span className="truncate">{event.venue}</span></span>
              </div>
            </div>
          </div>

          <fieldset>
            <legend className="label">Plan</legend>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-3" role="radiogroup" aria-label="Plan">
              {tiers.map((t) => {
                const on = t.id === event.tier_id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => changeTier(t.id)}
                    className={`rounded-[22px] p-4 text-left ring-2 transition ${on ? "bg-ochre ring-brown" : "bg-tile ring-transparent hover:ring-sand"}`}
                  >
                    <span className="flex items-center justify-between">
                      <span className="text-[17px]">{t.name}</span>
                      {on && <Check size={16} aria-hidden="true" />}
                    </span>
                    <span className={`block text-sm ${on ? "" : "text-brown-soft"}`}>Up to {t.max_headcount.toLocaleString()} people</span>
                    <span className="block bento-num text-[26px] mt-2">{formatNaira(t.price_kobo)}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <DeliveryPicker tier={tier} settings={settings} value={delivery} onChange={changeDelivery} />

          <button type="button" onClick={deleteDraft} className="self-start inline-flex items-center gap-2 text-sm text-brown-soft hover:text-[#9A3324]">
            <Trash2 size={15} aria-hidden="true" /> Delete this draft
          </button>
        </div>

        <aside className="rounded-[36px] bg-brown text-cream p-6 sm:p-7 flex flex-col gap-6">
          <div>
            <p className="text-sand">Total today</p>
            <p className="bento-num text-[56px] mt-2">{tier ? formatNaira(total) : "—"}</p>
            <p className="text-sm text-sand mt-1">
              {tier ? `${tier.name}${delivery === "plus" ? " Plus" : ""} · one-off, this event only` : "Loading plans…"}
            </p>
            {tier && delivery === "plus" && (
              <p className="mt-2 text-sm text-sand tabular-nums">
                {formatNaira(tier.price_kobo)} plan + {formatNaira(total - tier.price_kobo)} Guestlok sends
              </p>
            )}
          </div>
          <ul className="flex flex-col gap-2.5">
            {unlocks(delivery).map((u) => (
              <li key={u} className="flex items-start gap-3 text-[15px]">
                <span className="mt-0.5 w-5 h-5 shrink-0 rounded-full bg-ochre text-brown inline-flex items-center justify-center">
                  <Check size={12} strokeWidth={3} aria-hidden="true" />
                </span>
                {u}
              </li>
            ))}
          </ul>
          <button type="button" onClick={pay} disabled={busy || !tier} className="h-[56px] rounded-full bg-ochre text-brown text-[16px] font-medium inline-flex items-center justify-center gap-2 hover:brightness-95 disabled:opacity-60">
            {busy ? <ButtonSpinner /> : <Lock size={17} aria-hidden="true" />} Pay {tier ? formatNaira(total) : ""}
          </button>
          <p className="-mt-2 flex items-center justify-center gap-2 text-sm text-sand">
            <ShieldCheck size={16} aria-hidden="true" /> Card, transfer or USSD via Paystack
          </p>
        </aside>
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title="Edit event details" description="Guests see these on their invite.">
        <EditDetails
          event={event}
          onSaved={(data) => {
            onEventChange(data);
            setEditing(false);
            toast("Details updated");
          }}
          onCancel={() => setEditing(false)}
        />
      </Modal>
    </div>
  );
}

function EditDetails({ event, onSaved, onCancel }) {
  const start = lagosParts(event.starts_at);
  const [form, setForm] = useState({ name: event.name, host_names: event.host_names ?? "", date: start.date, time: start.time, venue: event.venue });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error } = await supabase
      .from("events")
      .update({
        name: form.name.trim(),
        host_names: form.host_names.trim() || null,
        starts_at: new Date(`${form.date}T${form.time}:00+01:00`).toISOString(),
        venue: form.venue.trim(),
      })
      .eq("id", event.id)
      .select("*")
      .single();
    setBusy(false);
    if (error) setError(friendlyError(error));
    else onSaved(data);
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <div>
        <label htmlFor="e-name" className="label">Event name</label>
        <input id="e-name" required minLength={2} maxLength={120} value={form.name} onChange={set("name")} className="field" />
      </div>
      <div>
        <label htmlFor="e-host" className="label">Hosted by <span className="font-normal text-brown-soft">(optional)</span></label>
        <input id="e-host" maxLength={120} value={form.host_names} onChange={set("host_names")} className="field" />
      </div>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        <div>
          <label htmlFor="e-date" className="label">Date</label>
          <input id="e-date" type="date" required value={form.date} onChange={set("date")} className="field" />
        </div>
        <div>
          <label htmlFor="e-time" className="label">Start time</label>
          <input id="e-time" type="time" required value={form.time} onChange={set("time")} className="field" />
        </div>
      </div>
      <div>
        <label htmlFor="e-venue" className="label">Venue</label>
        <input id="e-venue" required minLength={2} maxLength={200} value={form.venue} onChange={set("venue")} className="field" />
      </div>
      {error && <p role="alert" className="alert-error">{error}</p>}
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-2">
        <button type="button" onClick={onCancel} className="btn bg-tile hover:bg-sand">Cancel</button>
        <button type="submit" disabled={busy} className="btn-dark">{busy && <ButtonSpinner />} Save details</button>
      </div>
    </form>
  );
}
