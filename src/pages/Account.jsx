import { ArrowUpRight, ChevronDown, LogOut, Mail, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ButtonSpinner } from "../components/Brand.jsx";
import { useAuth } from "../lib/auth.jsx";
import { friendlyError, functionError } from "../lib/errors.js";
import { useFeedback } from "../lib/feedback.js";
import { formatNaira, formatShortDate } from "../lib/format.js";
import { supabase } from "../lib/supabase.js";
import { useTitle } from "../lib/useTitle.js";

const KIND = { plan: "Plan", upgrade: "Plus upgrade", topup: "Extra sends" };
const FIRST_PAGE = 5;
const MORE = 10;

/** The host's own account: who they are, how they sign in, what they've paid, and leaving. */
export default function Account() {
  useTitle("Your account");
  const { session } = useAuth();
  const user = session?.user;
  const navigate = useNavigate();
  const { toast, confirm } = useFeedback();
  const [stats, setStats] = useState(null); // { events, paidKobo, payments }

  useEffect(() => {
    let alive = true;
    Promise.all([
      supabase.from("events").select("id", { count: "exact", head: true }),
      supabase.from("payments").select("amount_kobo").eq("status", "success"),
    ]).then(([ev, pay]) => {
      if (!alive) return;
      const rows = pay.data ?? [];
      setStats({ events: ev.count ?? 0, paidKobo: rows.reduce((n, r) => n + r.amount_kobo, 0), payments: rows.length });
    });
    return () => {
      alive = false;
    };
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    navigate("/");
  }

  async function deleteAccount() {
    const sure = await confirm({
      title: "Delete your account?",
      body: "This can’t be undone, and payments are not refunded.",
      points: [
        "All your events, guest lists, check-ins and helper links are deleted.",
        "Every invite you sent stops working.",
        "Your photos and ticket images are removed from our servers.",
        "We keep a record of past payments (amount, date, reference) for our accounts, no longer linked to you.",
      ],
      typeToConfirm: "DELETE",
      confirmLabel: "Delete my account",
      danger: true,
    });
    if (!sure) return;
    const { error } = await supabase.functions.invoke("delete-account", { body: { confirm: "DELETE" } });
    if (error) {
      toast(await functionError(error, "We couldn’t delete your account. Please try again."), { tone: "error" });
      return;
    }
    await supabase.auth.signOut({ scope: "local" }).catch(() => null);
    navigate("/", { replace: true });
    toast("Your account has been deleted. Thanks for hosting with Guestlok.");
  }

  if (!user) return null;
  const name = user.user_metadata?.full_name?.trim() || "";
  const joined = user.created_at ? new Date(user.created_at) : null;
  const since = joined && !Number.isNaN(joined.getTime()) ? new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(joined) : null;

  return (
    <div className="flex flex-col gap-[18px] pb-12">
      {/* Who you are, at a glance */}
      <section className="bento !p-5 sm:!p-7 grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center" aria-label="Your account">
        <div className="flex items-center gap-4 min-w-0">
          <span className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-full bg-ochre inline-flex items-center justify-center text-[28px] sm:text-[34px] font-medium" aria-hidden="true">
            {(name || user.email || "?")[0].toUpperCase()}
          </span>
          <div className="min-w-0">
            <h1 className="text-[28px] sm:text-[36px] tracking-[-0.035em] leading-tight truncate">{name || "Your account"}</h1>
            <p className="text-brown-soft truncate">{user.email}</p>
            {since && <p className="text-sm text-mute">Hosting with Guestlok since {since}</p>}
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-2.5 md:w-[340px]">
          <div className="rounded-[20px] bg-tile px-4 py-3">
            <dt className="text-[13px] text-brown-soft">Events</dt>
            <dd className="bento-num text-[30px] mt-1">{stats ? stats.events : "–"}</dd>
          </div>
          <div className="rounded-[20px] bg-tile px-4 py-3">
            <dt className="text-[13px] text-brown-soft">Total paid</dt>
            <dd className="bento-num text-[30px] mt-1 truncate">{stats ? formatNaira(stats.paidKobo) : "–"}</dd>
          </div>
        </dl>
      </section>

      {/* Desktop: payments on the left, settings on the right. Phones: sign-in, payments, help, delete. */}
      <div className="grid gap-[18px] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] items-start">
        <section className="bento lg:col-start-2 lg:row-start-1 !py-2 sm:!py-3" aria-labelledby="signin-title">
          <h2 id="signin-title" className="sr-only">Sign-in details</h2>
          <SignInDetails user={user} />
        </section>

        <div className="lg:col-start-1 lg:row-start-1 lg:row-span-3 min-w-0">
          <Payments count={stats?.payments} />
        </div>

        <section className="bento flex flex-col gap-3 lg:col-start-2 lg:row-start-2" aria-labelledby="help-title">
          <h2 id="help-title" className="text-[18px] tracking-[-0.02em]">Help</h2>
          <a href="mailto:hello@guestlok.com" className="flex items-center gap-3 rounded-[18px] bg-tile hover:bg-sand px-4 py-3 transition">
            <Mail size={18} aria-hidden="true" className="shrink-0" />
            <span className="min-w-0">
              <span className="block text-[15px]">hello@guestlok.com</span>
              <span className="block text-[13px] text-brown-soft">Questions, refunds, bigger events</span>
            </span>
          </a>
          <div className="flex items-center justify-between gap-3 px-1">
            <span className="flex gap-4 text-sm">
              <Link to="/privacy" className="underline underline-offset-4 decoration-brown/30 hover:decoration-brown">Privacy</Link>
              <Link to="/terms" className="underline underline-offset-4 decoration-brown/30 hover:decoration-brown">Terms</Link>
            </span>
            <button type="button" onClick={signOut} className="h-10 px-4 rounded-full bg-tile hover:bg-sand text-sm inline-flex items-center gap-2">
              <LogOut size={15} aria-hidden="true" /> Sign out
            </button>
          </div>
        </section>

        <section className="rounded-[28px] border-[1.5px] border-coral/40 p-5 flex flex-col gap-3 lg:col-start-2 lg:row-start-3" aria-labelledby="leave-title">
          <div>
            <h2 id="leave-title" className="text-[18px] tracking-[-0.02em]">Delete my account</h2>
            <p className="mt-1 text-sm text-brown-soft">
              Removes your login, events, guest lists and photos for good. Download any attendance lists you want first.
            </p>
          </div>
          <button type="button" onClick={deleteAccount} className="btn-danger h-11 self-start">
            <Trash2 size={16} aria-hidden="true" /> Delete account
          </button>
        </section>
      </div>
    </div>
  );
}

/** Name, email and password as compact rows; each opens its own small form in place. */
function SignInDetails({ user }) {
  const [open, setOpen] = useState(null); // 'name' | 'email' | 'password'
  const toggle = (k) => setOpen((o) => (o === k ? null : k));
  const close = () => setOpen(null);
  const name = user.user_metadata?.full_name?.trim();

  return (
    <ul className="divide-y divide-tile">
      <Row label="Name" value={name || "Not set"} action={name ? "Edit" : "Add"} open={open === "name"} onToggle={() => toggle("name")}>
        <NameForm user={user} onDone={close} />
      </Row>
      <Row
        label="Email"
        value={user.email}
        note={user.new_email ? `Confirm ${user.new_email} from that inbox to finish the change.` : null}
        action="Change"
        open={open === "email"}
        onToggle={() => toggle("email")}
      >
        <EmailForm user={user} onDone={close} />
      </Row>
      <Row label="Password" value="••••••••" action="Change" open={open === "password"} onToggle={() => toggle("password")}>
        <PasswordForm onDone={close} />
      </Row>
    </ul>
  );
}

function Row({ label, value, note, action, open, onToggle, children }) {
  return (
    <li className="py-3.5">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-brown-soft">{label}</p>
          <p className="text-[16px] truncate">{value}</p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className={`h-9 px-3.5 shrink-0 rounded-full text-sm inline-flex items-center gap-1 transition ${open ? "bg-brown text-cream" : "bg-tile hover:bg-sand"}`}
        >
          {open ? "Cancel" : action}
          {!open && <ChevronDown size={14} aria-hidden="true" />}
        </button>
      </div>
      {note && !open && <p className="mt-2 text-[13px] rounded-xl bg-cream px-3 py-2">{note}</p>}
      {open && <div className="gl-fade mt-3">{children}</div>}
    </li>
  );
}

function NameForm({ user, onDone }) {
  const { toast } = useFeedback();
  const [name, setName] = useState(user.user_metadata?.full_name ?? "");
  const [busy, setBusy] = useState(false);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ data: { full_name: name.trim().slice(0, 80) } });
    setBusy(false);
    if (error) return toast(friendlyError(error), { tone: "error" });
    toast("Name saved");
    onDone();
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-2.5">
      <label htmlFor="acc-name" className="sr-only">Your name</label>
      <input id="acc-name" autoFocus required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Samuel Akande" className="field" />
      <p className="text-xs text-brown-soft">Shown in your dashboard. Guests see the host names you set on each event.</p>
      <button type="submit" disabled={busy} className="btn-dark h-11 self-start">
        {busy && <ButtonSpinner />} Save name
      </button>
    </form>
  );
}

function EmailForm({ user, onDone }) {
  const { toast } = useFeedback();
  const [email, setEmail] = useState(user.email ?? "");
  const [busy, setBusy] = useState(false);
  const changed = email.trim().toLowerCase() !== (user.email ?? "").toLowerCase();

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ email: email.trim() }, { emailRedirectTo: `${window.location.origin}/app/account` });
    setBusy(false);
    if (error) return toast(friendlyError(error), { tone: "error" });
    toast("Check your inbox. Your email changes once you tap the confirmation link.", { tone: "info" });
    onDone();
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-2.5">
      <label htmlFor="acc-email" className="sr-only">New email</label>
      <input id="acc-email" autoFocus type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field" />
      <p className="text-xs text-brown-soft">You sign in with this, and receipts go here. We’ll send a link to confirm it.</p>
      <button type="submit" disabled={busy || !changed} className="btn-dark h-11 self-start disabled:opacity-40">
        {busy && <ButtonSpinner />} Send confirmation
      </button>
    </form>
  );
}

function PasswordForm({ onDone }) {
  const { toast } = useFeedback();
  const [pw, setPw] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function save(e) {
    e.preventDefault();
    setError(null);
    if (pw.length < 8) return setError("Use at least 8 characters.");
    if (pw !== again) return setError("The two passwords don’t match.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) {
      setError(
        /reauth|recent/i.test(error.message)
          ? "For your safety, sign out and use “Forgot password” on the sign-in page to set a new one."
          : friendlyError(error),
      );
      return;
    }
    toast("Password changed");
    onDone();
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-2.5">
      <div>
        <label htmlFor="acc-pw" className="label">New password</label>
        <input id="acc-pw" autoFocus type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} className="field" />
      </div>
      <div>
        <label htmlFor="acc-pw2" className="label">Type it again</label>
        <input id="acc-pw2" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} className="field" />
      </div>
      <p className="text-xs text-brown-soft">At least 8 characters. Only ever signed in with a link? This sets your first password.</p>
      {error && <p role="alert" className="alert-error">{error}</p>}
      <button type="submit" disabled={busy || !pw} className="btn-dark h-11 self-start disabled:opacity-40">
        {busy && <ButtonSpinner />} Change password
      </button>
    </form>
  );
}

/** Newest first, a few at a time: the list never loads (or shows) everything at once. */
function Payments({ count }) {
  const [rows, setRows] = useState(undefined);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (from, size) => {
    const { data } = await supabase
      .from("payments")
      .select("id, reference, amount_kobo, kind, created_at, paid_at, event_id, event_name, events(name)")
      .eq("status", "success")
      .order("created_at", { ascending: false })
      .range(from, from + size - 1);
    return data ?? [];
  }, []);

  useEffect(() => {
    let alive = true;
    load(0, FIRST_PAGE).then((data) => alive && setRows(data));
    return () => {
      alive = false;
    };
  }, [load]);

  async function more() {
    setBusy(true);
    const next = await load(rows.length, MORE);
    setRows((r) => [...r, ...next]);
    setBusy(false);
  }

  const left = count != null && rows ? Math.max(0, count - rows.length) : 0;

  return (
    <section className="bento !p-0 overflow-hidden" aria-labelledby="pay-title">
      <div className="px-5 sm:px-7 pt-5 sm:pt-7 pb-4 flex items-end justify-between gap-3">
        <div>
          <h2 id="pay-title" className="section-title">Payments</h2>
          <p className="mt-1 text-sm text-brown-soft">Newest first. Paystack also emails a receipt for each one.</p>
        </div>
        {count > 0 && <span className="text-sm text-brown-soft shrink-0">{count} in total</span>}
      </div>

      {rows === undefined ? (
        <div className="px-5 sm:px-7 pb-6 flex flex-col gap-2 animate-pulse motion-reduce:animate-none" aria-busy="true" aria-label="Loading payments">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 rounded-2xl bg-tile" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="mx-5 sm:mx-7 mb-6 rounded-[18px] bg-tile px-4 py-4 text-sm text-brown-soft">
          No payments yet. They show here once you pay for an event.
        </p>
      ) : (
        <>
          {/* Column labels (tablet up) */}
          <div className="hidden sm:grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_96px_110px] gap-4 px-7 py-2.5 text-[13px] text-mute border-y border-tile">
            <span>Event</span>
            <span>Type</span>
            <span>Date</span>
            <span className="text-right">Amount</span>
          </div>
          <ul className="divide-y divide-tile">
            {rows.map((r) => {
              const name = r.events?.name ?? r.event_name ?? "Deleted event";
              return (
                <li key={r.id} className="px-5 sm:px-7 py-3.5 grid gap-x-4 gap-y-0.5 grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_96px_110px] sm:items-center">
                  <div className="min-w-0">
                    {r.event_id ? (
                      <Link to={`/app/events/${r.event_id}`} className="group inline-flex items-center gap-1 max-w-full text-[15px] hover:underline underline-offset-4">
                        <span className="truncate">{name}</span>
                        <ArrowUpRight size={13} aria-hidden="true" className="shrink-0 opacity-50 group-hover:opacity-100" />
                      </Link>
                    ) : (
                      <span className="block text-[15px] truncate text-brown-soft">{name}</span>
                    )}
                    <span className="block text-[12px] text-mute font-mono truncate" title="Paystack reference">{r.reference}</span>
                  </div>
                  <p className="text-[15px] tabular-nums text-right sm:hidden">{formatNaira(r.amount_kobo)}</p>
                  <p className="text-[13px] text-brown-soft sm:text-[14px] sm:text-brown col-span-2 sm:col-span-1">
                    {KIND[r.kind] ?? "Plan"}
                    <span className="sm:hidden"> · {formatShortDate(r.paid_at ?? r.created_at)}</span>
                  </p>
                  <p className="hidden sm:block text-[14px] text-brown-soft">{formatShortDate(r.paid_at ?? r.created_at)}</p>
                  <p className="hidden sm:block text-[15px] tabular-nums text-right">{formatNaira(r.amount_kobo)}</p>
                </li>
              );
            })}
          </ul>
          {left > 0 && (
            <div className="p-4 border-t border-tile flex justify-center">
              <button type="button" onClick={more} disabled={busy} className="h-11 px-5 rounded-full bg-tile hover:bg-sand text-sm inline-flex items-center gap-2">
                {busy && <ButtonSpinner />} Show {Math.min(MORE, left)} more <span className="text-brown-soft">({left} left)</span>
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
