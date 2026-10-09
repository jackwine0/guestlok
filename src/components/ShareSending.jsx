import { Check, Copy, Link2Off, MessageCircle, Plus, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { friendlyError } from "../lib/errors.js";
import { useFeedback } from "../lib/feedback.js";
import { whatsappLink } from "../lib/format.js";
import { senderInviteText, senderScope, senderUrl } from "../lib/senders.js";
import { supabase } from "../lib/supabase.js";
import { ButtonSpinner } from "./Brand.jsx";
import Modal from "./Modal.jsx";

/**
 * "Share the sending": the host gives a helper a private link for one side (or everyone).
 * The helper sends those invites from their own WhatsApp; progress shows up here.
 */
export default function ShareSending({ event, guests, onClose }) {
  const { confirm, toast } = useFeedback();
  const [senders, setSenders] = useState(null);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [side, setSide] = useState("");
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState(null); // id of the link just created
  const sides = useMemo(() => [...new Set(guests.map((g) => g.side?.trim()).filter(Boolean))].sort(), [guests]);

  useEffect(() => {
    supabase
      .from("event_senders")
      .select("*")
      .eq("event_id", event.id)
      .is("revoked_at", null)
      .order("created_at")
      .then(({ data, error }) => {
        if (error) toast(friendlyError(error), { tone: "error" });
        setSenders(data ?? []);
        if (!data?.length) setAdding(true);
      });
  }, [event.id, toast]);

  async function create(e) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase
      .from("event_senders")
      .insert({ event_id: event.id, label: label.trim(), side: side || null })
      .select("*")
      .single();
    setBusy(false);
    if (error) {
      toast(friendlyError(error), { tone: "error" });
      return;
    }
    setSenders((s) => [...(s ?? []), data]);
    setFresh(data.id);
    setAdding(false);
    setLabel("");
    setSide("");
  }

  async function revoke(s) {
    const sure = await confirm({
      title: `Turn off ${s.label}’s link?`,
      body: "The link stops working straight away. Invites they already sent still work.",
      confirmLabel: "Turn off link",
      danger: true,
    });
    if (!sure) return;
    const { error } = await supabase.from("event_senders").update({ revoked_at: new Date().toISOString() }).eq("id", s.id);
    if (error) toast(friendlyError(error), { tone: "error" });
    else setSenders((list) => list.filter((x) => x.id !== s.id));
  }

  async function copy(s) {
    await navigator.clipboard.writeText(senderUrl(s.token));
    toast("Link copied");
  }

  return (
    <Modal open onClose={onClose} title="Share the sending" description="Give a helper a private link. They send their guests’ invites from their own WhatsApp.">
      <div className="flex flex-col gap-5">
        {senders === null ? (
          <p className="text-brown-soft py-6 text-center">Loading…</p>
        ) : (
          senders.length > 0 && (
            <ul className="flex flex-col gap-2.5">
              {senders.map((s) => {
                const scope = senderScope(s, guests);
                const sent = scope.filter((g) => g.invite_sent_at).length;
                const byThem = guests.filter((g) => g.invite_sent_by === s.id).length;
                const pct = scope.length ? Math.round((sent / scope.length) * 100) : 0;
                return (
                  <li key={s.id} className={`rounded-[22px] p-4 ${fresh === s.id ? "bg-ochre" : "bg-tile"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[17px] truncate">{s.label}</p>
                        <p className={`text-sm ${fresh === s.id ? "" : "text-brown-soft"}`}>
                          {s.side ?? "Everyone"} · {sent}/{scope.length} sent{byThem ? ` (${byThem} by them)` : ""}
                        </p>
                      </div>
                      <button type="button" onClick={() => revoke(s)} aria-label={`Turn off ${s.label}’s link`} title="Turn off link" className="h-9 w-9 shrink-0 rounded-full bg-white/70 hover:bg-coral/25 inline-flex items-center justify-center">
                        <Link2Off size={15} aria-hidden="true" />
                      </button>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-white/70 overflow-hidden" aria-hidden="true">
                      <i className="block h-full rounded-full bg-brown" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <a
                        href={whatsappLink(null, senderInviteText(s, event))}
                        target="_blank"
                        rel="noreferrer"
                        className="h-10 rounded-full bg-brown text-cream text-sm inline-flex items-center justify-center gap-1.5"
                      >
                        <MessageCircle size={15} aria-hidden="true" /> Send link
                      </a>
                      <button type="button" onClick={() => copy(s)} className="h-10 rounded-full bg-white text-sm inline-flex items-center justify-center gap-1.5">
                        <Copy size={15} aria-hidden="true" /> Copy link
                      </button>
                    </div>
                    {fresh === s.id && <p className="mt-2 text-sm">Link ready. Send it to {s.label} on WhatsApp.</p>}
                  </li>
                );
              })}
            </ul>
          )
        )}

        {adding ? (
          <form onSubmit={create} className="rounded-[22px] border-[1.5px] border-tile p-4 flex flex-col gap-4">
            <div>
              <label htmlFor="sender-name" className="label">Who’s helping?</label>
              <input id="sender-name" required maxLength={60} autoFocus placeholder="Aunty Funmi" value={label} onChange={(e) => setLabel(e.target.value)} className="field" />
            </div>
            <div>
              <label htmlFor="sender-side" className="label">Which guests?</label>
              <select id="sender-side" value={side} onChange={(e) => setSide(e.target.value)} className="field">
                <option value="">Everyone with a phone number</option>
                {sides.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {sides.length === 0 && <p className="mt-1.5 text-xs text-brown-soft">Tip: give guests a side (e.g. Bride’s family) to split the list between helpers.</p>}
            </div>
            <div className="flex gap-2 justify-end">
              {senders?.length > 0 && (
                <button type="button" onClick={() => setAdding(false)} className="btn bg-tile hover:bg-sand">Cancel</button>
              )}
              <button type="submit" disabled={busy} className="btn-dark">
                {busy ? <ButtonSpinner /> : <Check size={16} aria-hidden="true" />} Create link
              </button>
            </div>
          </form>
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="btn bg-tile hover:bg-sand">
            <Plus size={16} aria-hidden="true" /> Add a helper
          </button>
        )}

        <p className="flex gap-2 text-xs text-brown-soft">
          <Users size={14} className="shrink-0 mt-0.5" aria-hidden="true" />
          Helpers see the names and numbers of their guests only. You can turn a link off at any time.
        </p>
      </div>
    </Modal>
  );
}
