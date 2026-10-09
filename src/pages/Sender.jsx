import { Check, ChevronRight, MessageCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Loader, Wordmark } from "../components/Brand.jsx";
import { MessageScreen } from "../components/Page.jsx";
import { formatEventDate, whatsappLink } from "../lib/format.js";
import { renderMessage } from "../lib/invite.js";
import { supabase } from "../lib/supabase.js";
import { useTitle } from "../lib/useTitle.js";

/**
 * /send/:token — a helper (sister, planner's assistant…) sends their share of the invites
 * from their own WhatsApp. No account needed; the link only covers their guests.
 */
export default function Sender() {
  const { token } = useParams();
  const [data, setData] = useState(undefined); // undefined = loading, null = invalid
  const [skipped, setSkipped] = useState(() => new Set());
  const [tab, setTab] = useState("todo");
  useTitle(data?.event ? `Send invites · ${data.event.name}` : "Send invites");

  useEffect(() => {
    supabase.rpc("sender_queue", { p_token: token }).then(({ data, error }) => setData(error || !data?.event ? null : data));
  }, [token]);

  const guests = useMemo(() => data?.guests ?? [], [data]);
  const todo = guests.filter((g) => !g.invite_sent_at && !g.checked_in_at);
  const done = guests.filter((g) => g.invite_sent_at || g.checked_in_at);
  const next = todo.find((g) => !skipped.has(g.id)) ?? todo[0];

  if (data === undefined) return <Loader fullScreen label="Opening your list" />;
  if (data === null)
    return (
      <MessageScreen
        kicker="Link not working"
        title="This sending link is closed."
        body="The host may have turned it off, or the event is over. Ask them for a new link if you still need to send invites."
      >
        <Link to="/" className="btn-dark">What is Guestlok?</Link>
      </MessageScreen>
    );

  const event = data.event;
  const first = data.label;
  const pct = guests.length ? Math.round((done.length / guests.length) * 100) : 0;

  function send(g) {
    // Mark as sent straight away; WhatsApp opens in a new tab with the message ready.
    supabase.rpc("sender_mark_sent", { p_token: token, p_guest: g.id }).then(() => {});
    setData((d) => ({ ...d, guests: d.guests.map((x) => (x.id === g.id ? { ...x, invite_sent_at: new Date().toISOString() } : x)) }));
  }

  return (
    <main className="min-h-dvh bg-shell">
      <header className="bg-brown text-cream rounded-b-[32px] px-5 pt-5 pb-7">
        <div className="mx-auto max-w-xl">
          <Link to="/" aria-label="Guestlok" className="text-[22px]">
            <Wordmark disc="#EEB12F" hole="#2B1B12" />
          </Link>
          <p className="mt-6 text-sand">Hi {first}, thank you for helping.</p>
          <h1 className="mt-1 text-[32px] sm:text-[40px] tracking-[-0.04em] leading-[1.05]">{event.name}</h1>
          <p className="mt-1 text-sm text-sand">
            {formatEventDate(event.starts_at)} · {event.venue}
            {data.side ? ` · ${data.side}` : ""}
          </p>
          <div className="mt-5 flex items-end justify-between">
            <p className="bento-num text-[40px]">
              {done.length}
              <span className="text-[0.45em] text-sand"> / {guests.length} sent</span>
            </p>
            <p className="text-sm text-sand">{pct}%</p>
          </div>
          <div className="mt-2 h-2.5 rounded-full bg-white/15 overflow-hidden" aria-hidden="true">
            <i className="block h-full rounded-full bg-ochre transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-xl px-4 py-5 flex flex-col gap-4">
        {next ? (
          <section className="rounded-[28px] bg-white p-5" aria-labelledby="next-title">
            <p className="text-sm text-brown-soft">Next up</p>
            <p id="next-title" className="mt-1 text-[24px] tracking-[-0.02em]">{next.name}</p>
            <p className="text-sm text-brown-soft">
              +{next.phone} · admits {next.admits}
            </p>
            <a
              href={whatsappLink(next.phone, renderMessage(event.invite_message, { guest: next, event }))}
              target="_blank"
              rel="noreferrer"
              onClick={() => send(next)}
              className="mt-4 btn-ochre btn-lg w-full"
            >
              <MessageCircle size={19} aria-hidden="true" /> Send on WhatsApp
            </a>
            <button
              type="button"
              onClick={() => setSkipped((s) => new Set(s).add(next.id))}
              className="mt-1.5 btn w-full text-brown-soft hover:text-brown"
            >
              Skip for now <ChevronRight size={16} aria-hidden="true" />
            </button>
            <p className="mt-1 text-xs text-brown-soft text-center">WhatsApp opens with the invite ready. Tap send, then come back here.</p>
          </section>
        ) : (
          <section className="rounded-[28px] bg-leaf text-white p-6 text-center">
            <span className="mx-auto w-12 h-12 rounded-full bg-white/20 inline-flex items-center justify-center">
              <Check size={22} aria-hidden="true" />
            </span>
            <p className="mt-3 text-[24px] tracking-[-0.02em]">All sent. Thank you, {first}!</p>
            <p className="mt-1 text-white/80 text-sm">The host can see the invites went out.</p>
          </section>
        )}

        <section className="rounded-[28px] bg-white overflow-hidden">
          <div role="tablist" className="grid grid-cols-2 p-1.5 m-3 rounded-full bg-tile">
            {[
              ["todo", `To send · ${todo.length}`],
              ["done", `Sent · ${done.length}`],
            ].map(([id, text]) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`h-10 rounded-full text-sm ${tab === id ? "bg-brown text-cream" : "text-brown-soft"}`}
              >
                {text}
              </button>
            ))}
          </div>
          <ul className="divide-y divide-tile">
            {(tab === "todo" ? todo : done).map((g) => (
              <li key={g.id} className="px-5 py-3.5 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate">{g.name}</p>
                  <p className="text-[13px] text-brown-soft truncate">
                    +{g.phone}
                    {g.checked_in_at ? " · arrived" : ""}
                  </p>
                </div>
                <a
                  href={whatsappLink(g.phone, renderMessage(event.invite_message, { guest: g, event }))}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => send(g)}
                  className={`h-10 px-4 shrink-0 rounded-full text-sm font-medium inline-flex items-center gap-1.5 ${tab === "todo" ? "bg-ochre" : "bg-tile"}`}
                >
                  <MessageCircle size={15} aria-hidden="true" /> {tab === "todo" ? "Send" : "Again"}
                </a>
              </li>
            ))}
            {(tab === "todo" ? todo : done).length === 0 && (
              <li className="px-5 py-8 text-center text-brown-soft text-sm">{tab === "todo" ? "Nobody left to send to." : "Nothing sent yet."}</li>
            )}
          </ul>
        </section>

        <p className="text-center text-xs text-brown-soft px-6">
          Each invite is personal and works once at the gate. Please don’t share this page.
        </p>
      </div>
    </main>
  );
}
