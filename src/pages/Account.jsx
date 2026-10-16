import { ExternalLink, KeyRound, LogOut, Mail, Receipt, Trash2, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ButtonSpinner } from "../components/Brand.jsx";
import { useAuth } from "../lib/auth.jsx";
import { friendlyError, functionError } from "../lib/errors.js";
import { useFeedback } from "../lib/feedback.js";
import { formatNaira, formatShortDate } from "../lib/format.js";
import { supabase } from "../lib/supabase.js";
import { useTitle } from "../lib/useTitle.js";

const KIND = { plan: "Plan", upgrade: "Upgrade to Plus", topup: "Extra Guestlok sends" };

/** The host's own account: who they are, how they sign in, what they've paid, and leaving. */
export default function Account() {
  useTitle("Your account");
  const { session } = useAuth();
  const user = session?.user;
  const navigate = useNavigate();
  const { toast, confirm } = useFeedback();

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

  return (
    <div className="flex flex-col gap-[18px] pb-12">
      <div className="px-1">
        <h1 className="page-title">Your account</h1>
        <p className="page-sub">Your details, how you sign in, and what you’ve paid.</p>
      </div>

      <div className="grid gap-[18px] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] items-start">
        {/* Desktop: details + delete on the left, payments + help on the right. Phones: delete last. */}
          <section className="bento flex flex-col gap-8 min-w-0 lg:col-start-1 lg:row-start-1" aria-label="Your details">
            <NameForm user={user} />
            <div className="h-px bg-tile" aria-hidden="true" />
            <EmailForm user={user} />
            <div className="h-px bg-tile" aria-hidden="true" />
            <PasswordForm />
          </section>

          <section className="bento !py-2 sm:!py-3 order-last lg:order-none lg:col-start-1 lg:row-start-2" aria-labelledby="leave-title">
            <h2 id="leave-title" className="sr-only">Delete your account</h2>
            <div className="py-5 sm:py-6 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
              <div className="min-w-0 flex-1">
                <p className="text-[18px] tracking-[-0.02em]">Delete my account</p>
                <p className="mt-1 text-[15px] text-brown-soft max-w-2xl">
                  Removes your login, events, guest lists and photos for good. Download any attendance lists you want to keep first.
                </p>
              </div>
              <button type="button" onClick={deleteAccount} className="btn-danger w-full sm:w-auto shrink-0">
                <Trash2 size={16} aria-hidden="true" /> Delete account
              </button>
            </div>
          </section>

        <div className="flex flex-col gap-[18px] lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <Payments />

          <section className="bento flex flex-col gap-4" aria-labelledby="help-title">
            <h2 id="help-title" className="section-title">Help</h2>
            <a href="mailto:hello@guestlok.com" className="flex items-center gap-3 rounded-[18px] bg-tile hover:bg-sand px-4 py-3 transition">
              <Mail size={18} aria-hidden="true" className="shrink-0" />
              <span className="min-w-0">
                <span className="block text-[15px]">hello@guestlok.com</span>
                <span className="block text-[13px] text-brown-soft">Questions, refunds, bigger events</span>
              </span>
            </a>
            <div className="flex flex-wrap gap-x-5 gap-y-2 px-1 text-sm">
              <Link to="/privacy" className="underline underline-offset-4 decoration-brown/30 hover:decoration-brown">Privacy policy</Link>
              <Link to="/terms" className="underline underline-offset-4 decoration-brown/30 hover:decoration-brown">Terms</Link>
            </div>
            <button type="button" onClick={signOut} className="btn bg-tile hover:bg-sand w-full">
              <LogOut size={17} aria-hidden="true" /> Sign out
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}

function Group({ icon: Icon, title, hint, children }) {
  return (
    <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)] md:gap-8">
      <div className="flex gap-3">
        <span className="w-9 h-9 shrink-0 rounded-full bg-tile inline-flex items-center justify-center" aria-hidden="true">
          <Icon size={17} />
        </span>
        <div>
          <h2 className="text-[18px] tracking-[-0.02em]">{title}</h2>
          <p className="mt-1 text-sm text-brown-soft">{hint}</p>
        </div>
      </div>
      <div className="flex flex-col gap-3 min-w-0">{children}</div>
    </div>
  );
}

function NameForm({ user }) {
  const { toast } = useFeedback();
  const saved = user.user_metadata?.full_name ?? "";
  const [name, setName] = useState(saved);
  const [busy, setBusy] = useState(false);
  useEffect(() => setName(saved), [saved]);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ data: { full_name: name.trim().slice(0, 80) } });
    setBusy(false);
    toast(error ? friendlyError(error) : "Name saved", error ? { tone: "error" } : undefined);
  }

  return (
    <form onSubmit={save}>
      <Group icon={UserRound} title="Your name" hint="Shown in your dashboard. Guests see the host names you set on each event.">
        <label htmlFor="acc-name" className="sr-only">Your name</label>
        <div className="flex flex-col sm:flex-row gap-2.5">
          <input id="acc-name" required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Samuel Akande" className="field sm:flex-1" />
          <button type="submit" disabled={busy || name.trim() === saved} className="btn-dark shrink-0 disabled:opacity-40">
            {busy && <ButtonSpinner />} Save
          </button>
        </div>
      </Group>
    </form>
  );
}

function EmailForm({ user }) {
  const { toast } = useFeedback();
  const [email, setEmail] = useState(user.email ?? "");
  const [busy, setBusy] = useState(false);
  const pending = user.new_email;
  const changed = email.trim().toLowerCase() !== (user.email ?? "").toLowerCase();

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser(
      { email: email.trim() },
      { emailRedirectTo: `${window.location.origin}/app/account` },
    );
    setBusy(false);
    if (error) toast(friendlyError(error), { tone: "error" });
    else toast("Check your inbox. Your email changes once you tap the confirmation link.", { tone: "info" });
  }

  return (
    <form onSubmit={save}>
      <Group icon={Mail} title="Email" hint="You sign in with this, and receipts go here.">
        <label htmlFor="acc-email" className="sr-only">Email</label>
        <div className="flex flex-col sm:flex-row gap-2.5">
          <input id="acc-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field sm:flex-1" />
          <button type="submit" disabled={busy || !changed} className="btn-dark shrink-0 disabled:opacity-40">
            {busy && <ButtonSpinner />} Change
          </button>
        </div>
        {pending && (
          <p className="text-sm rounded-2xl bg-cream px-4 py-3">
            Waiting for you to confirm <b className="font-medium">{pending}</b>. Check that inbox for the link.
          </p>
        )}
      </Group>
    </form>
  );
}

function PasswordForm() {
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
    setPw("");
    setAgain("");
    toast("Password changed");
  }

  return (
    <form onSubmit={save}>
      <Group icon={KeyRound} title="Password" hint="At least 8 characters. Signed in with a link only? Set one here.">
        <div className="grid gap-2.5 sm:grid-cols-2">
          <div>
            <label htmlFor="acc-pw" className="label">New password</label>
            <input id="acc-pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} className="field" />
          </div>
          <div>
            <label htmlFor="acc-pw2" className="label">Type it again</label>
            <input id="acc-pw2" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} className="field" />
          </div>
        </div>
        {error && <p role="alert" className="alert-error">{error}</p>}
        <button type="submit" disabled={busy || !pw} className="btn-dark self-start disabled:opacity-40">
          {busy && <ButtonSpinner />} Change password
        </button>
      </Group>
    </form>
  );
}

function Payments() {
  const [rows, setRows] = useState(undefined);

  useEffect(() => {
    let alive = true;
    supabase
      .from("payments")
      .select("id, reference, amount_kobo, status, kind, created_at, paid_at, event_id, event_name, tier_id, events(name)")
      .eq("status", "success")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => alive && setRows(data ?? []));
    return () => {
      alive = false;
    };
  }, []);

  const total = (rows ?? []).reduce((n, r) => n + r.amount_kobo, 0);

  return (
    <section className="bento flex flex-col gap-4" aria-labelledby="pay-title">
      <div className="flex items-start justify-between gap-3">
        <h2 id="pay-title" className="section-title">Payments</h2>
        {rows?.length > 0 && <span className="text-sm text-brown-soft tabular-nums">{formatNaira(total)} total</span>}
      </div>
      {rows === undefined ? (
        <div className="flex flex-col gap-2 animate-pulse motion-reduce:animate-none" aria-busy="true" aria-label="Loading payments">
          {[0, 1].map((i) => (
            <div key={i} className="h-[64px] rounded-[18px] bg-tile" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-[18px] bg-tile px-4 py-4 text-sm text-brown-soft">No payments yet. They show here once you pay for an event.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => {
            const name = r.events?.name ?? r.event_name ?? "Deleted event";
            return (
              <li key={r.id} className="rounded-[18px] bg-tile px-4 py-3 flex items-start gap-3">
                <Receipt size={17} aria-hidden="true" className="mt-0.5 shrink-0 text-brown-soft" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[15px] truncate">
                      {r.event_id ? (
                        <Link to={`/app/events/${r.event_id}`} className="hover:underline underline-offset-4">
                          {name}
                        </Link>
                      ) : (
                        name
                      )}
                    </p>
                    <p className="text-[15px] tabular-nums shrink-0">{formatNaira(r.amount_kobo)}</p>
                  </div>
                  <p className="text-[13px] text-brown-soft">
                    {KIND[r.kind] ?? "Plan"} · {formatShortDate(r.paid_at ?? r.created_at)}
                  </p>
                  <p className="text-[12px] text-mute font-mono truncate" title="Paystack reference">
                    {r.reference}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-brown-soft flex items-center gap-1.5">
        <ExternalLink size={12} aria-hidden="true" /> Paystack also emails a receipt for every payment.
      </p>
    </section>
  );
}
