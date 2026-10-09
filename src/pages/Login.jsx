import { ArrowRight, Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ButtonSpinner, Wordmark } from "../components/Brand.jsx";
import { Sunburst } from "../components/HeroStage.jsx";
import { useAuth } from "../lib/auth.jsx";
import { supabase } from "../lib/supabase.js";
import { useTitle } from "../lib/useTitle.js";

const COPY = {
  signup: {
    eyebrow: "Host access",
    title: "Get on the list.",
    sub: "Create your host account. You only pay when you create an event.",
    cta: "Create my host pass",
  },
  signin: {
    eyebrow: "Welcome back",
    title: "Back at the gate.",
    sub: "Sign in to manage your events, guests and ushers.",
    cta: "Open my events",
  },
};

export default function Login() {
  const [params] = useSearchParams();
  const next = params.get("next")?.startsWith("/") ? params.get("next") : "/app";
  const navigate = useNavigate();
  const { session } = useAuth();

  const [mode, setMode] = useState(() =>
    params.get("mode") === "signup" || next.includes("/events/new") ? "signup" : "signin",
  );
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const copy = COPY[mode];
  useTitle(mode === "signup" ? "Create your account" : "Sign in");

  useEffect(() => {
    if (session) navigate(next, { replace: true });
  }, [session, next, navigate]);

  function switchMode(m) {
    setMode(m);
    setError(null);
    setNotice(null);
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${next}`,
            data: { full_name: fullName.trim() },
          },
        });
        if (error) throw error;
        if (!data.session) setNotice("Almost there. Check your email to confirm your account, then sign in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setError(
        /invalid login/i.test(msg)
          ? "That email and password don’t match. Try again or reset your password."
          : /already registered/i.test(msg)
            ? "You already have an account. Sign in instead."
            : msg || "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (!email) {
      setError("Type your email above first, then tap “Forgot password”.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    if (error) setError(error.message);
    else setNotice("Check your inbox. We sent you a link to reset your password.");
  }

  const passName =
    mode === "signup" ? fullName.trim() || "Your name" : email.split("@")[0] || "Host";

  return (
    <div className="min-h-dvh grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] bg-shell">
      {/* Brand side */}
      <aside className="relative overflow-hidden bg-brown text-cream px-5 sm:px-6 pt-5 sm:pt-6 pb-5 sm:pb-6 lg:p-10 flex flex-col max-lg:h-[190px] sm:max-lg:h-[240px]">
        <div
          className="pointer-events-none absolute left-1/2 top-[58%] w-[900px] h-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(238,177,47,.34), rgba(238,177,47,0) 60%)" }}
          aria-hidden="true"
        />
        <div className="pointer-events-none absolute left-1/2 top-[58%] w-[1100px] h-[1100px] -translate-x-1/2 -translate-y-1/2 opacity-[0.12]" aria-hidden="true">
          <Sunburst className="w-full h-full" />
        </div>

        <div className="relative flex items-center justify-between">
          <Link to="/" className="text-[26px] lg:text-[28px]" aria-label="Guestlok home">
            <Wordmark disc="#EEB12F" hole="#2B1B12" />
          </Link>
          <Link to="/" className="relative z-10 text-sm text-sand hover:text-cream">← Back to site</Link>
        </div>

        {/* Phones/tablets: a small tilted pass peeks in from the right. Desktop: centred, full size. */}
        <div className="max-lg:absolute max-lg:right-[-28px] max-lg:top-[64px] sm:max-lg:top-[66px] max-lg:origin-top-right max-lg:scale-[0.44] sm:max-lg:scale-[0.58] lg:relative lg:flex-1 lg:flex lg:items-center lg:justify-center [perspective:1200px]">
          <HostPass name={passName} mode={mode} />
        </div>

        <p className="relative mt-auto text-[28px] sm:text-[34px] lg:text-[clamp(32px,3vw,44px)] font-semibold tracking-[-0.05em] leading-[1]">
          Your party.
          <br />
          <span className="font-serif font-normal italic tracking-[-0.01em] text-ochre">Your list.</span>
        </p>
      </aside>

      {/* Form side */}
      <main className="flex items-start sm:items-center justify-center px-5 pt-6 pb-10 sm:px-10 sm:pt-10">
        <div className="w-full max-w-[420px]">
          <div role="tablist" aria-label="Account" className="inline-flex p-1 rounded-full bg-white border border-sand">
            {[
              ["signup", "Create account"],
              ["signin", "Sign in"],
            ].map(([m, label]) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => switchMode(m)}
                className={`h-10 px-5 rounded-full text-sm font-medium transition ${mode === m ? "bg-brown text-cream" : "text-brown-soft hover:text-brown"}`}
              >
                {label}
              </button>
            ))}
          </div>

          <p className="mt-7 sm:mt-10 eyebrow">{copy.eyebrow}</p>
          <h1 className="mt-2 text-[clamp(40px,5vw,56px)] font-normal tracking-[-0.04em] leading-[0.98]">{copy.title}</h1>
          <p className="mt-3 text-brown-soft text-[17px]">{copy.sub}</p>

          <form onSubmit={submit} className="mt-8 flex flex-col gap-3">
            {mode === "signup" && (
              <Field icon={User} label="Your name" htmlFor="fullName">
                <input id="fullName" required maxLength={80} autoComplete="name" placeholder="Samuel Akande" value={fullName} onChange={(e) => setFullName(e.target.value)} className="peer w-full h-14 bg-transparent pl-12 pr-4 text-[16px] outline-none placeholder:text-brown-soft/50" />
              </Field>
            )}
            <Field icon={Mail} label="Email" htmlFor="email">
              <input id="email" type="email" required autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="peer w-full h-14 bg-transparent pl-12 pr-4 text-[16px] outline-none placeholder:text-brown-soft/50" />
            </Field>
            <Field icon={Lock} label="Password" htmlFor="password">
              <input
                id="password"
                type={showPw ? "text" : "password"}
                required
                minLength={8}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="peer w-full h-14 bg-transparent pl-12 pr-12 text-[16px] outline-none placeholder:text-brown-soft/50"
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                aria-label={showPw ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center text-brown-soft hover:text-brown"
              >
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </Field>

            {mode === "signin" && (
              <button type="button" onClick={resetPassword} className="self-end text-sm text-brown-soft underline underline-offset-4 hover:text-brown">
                Forgot password?
              </button>
            )}

            {error && <p role="alert" className="alert-error">{error}</p>}
            {notice && <p role="status" className="rounded-2xl bg-cream px-4 py-3 text-[15px]">{notice}</p>}

            <button type="submit" disabled={busy} className="mt-3 h-14 rounded-full bg-brown text-cream font-medium text-[16px] inline-flex items-center justify-center gap-2 hover:bg-black transition disabled:opacity-60">
              {busy ? <ButtonSpinner /> : null}
              {copy.cta}
              {!busy && <ArrowRight size={18} aria-hidden="true" />}
            </button>
          </form>

          <p className="mt-6 text-sm text-brown-soft">
            {mode === "signup" ? "Already hosting with us? " : "First time here? "}
            <button type="button" onClick={() => switchMode(mode === "signup" ? "signin" : "signup")} className="font-medium text-brown underline underline-offset-4">
              {mode === "signup" ? "Sign in" : "Create an account"}
            </button>
          </p>
          <p className="mt-10 text-xs text-brown-soft/80">
            By continuing you agree to our Terms and Privacy Policy. Your guests never need an account.
          </p>
        </div>
      </main>
    </div>
  );
}

function Field({ icon: Icon, label, htmlFor, children }) {
  return (
    <div className="relative rounded-2xl bg-white border border-sand focus-within:border-brown focus-within:ring-4 focus-within:ring-ochre/30 transition">
      <label htmlFor={htmlFor} className="sr-only">{label}</label>
      <Icon size={18} aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 text-brown-soft" />
      {children}
    </div>
  );
}

/** The host's own "pass" that personalises as they type. */
function HostPass({ name, mode }) {
  const first = name === "Your name" ? "Host" : name.split(" ")[0];
  return (
    <div className="relative" aria-hidden="true">
      <div className="gl-float w-[260px] sm:w-[300px] bg-white text-brown rounded-[30px] overflow-hidden text-center shadow-[0_40px_90px_rgba(0,0,0,0.45)]">
        <div className="relative h-[84px] bg-gradient-to-br from-ochre to-coral">
          <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="absolute inset-0 w-full h-full opacity-35">
            <path d="M0 40 Q25 10 50 25 T100 15 V40Z" fill="#2B1B12" />
          </svg>
          <span className="absolute left-4 top-4 font-mono text-[10px] uppercase tracking-[0.16em] bg-brown text-cream px-2.5 py-1 rounded-full">Host pass</span>
        </div>
        <div className="bg-brown text-cream px-5 py-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] opacity-70">
            {mode === "signup" ? "Welcome to the list" : "Welcome back"}
          </p>
          <p className="font-serif text-[30px] leading-[1.05] mt-1 break-words min-h-[1.05em]">{name}</p>
        </div>
        <div className="mx-auto mt-5 mb-3 w-[124px] h-[124px] rounded-[18px] bg-paper p-3">
          <QRCodeSVG value="https://guestlok.com" size={100} bgColor="#F7F1E3" fgColor="#2B1B12" level="M" />
        </div>
        <div className="grid grid-cols-2 gap-2 px-5 pb-5 text-[12px]">
          <div className="rounded-2xl bg-paper py-2">Role<b className="block text-[14px]">Host</b></div>
          <div className="rounded-2xl bg-paper py-2">Admits<b className="block text-[14px]">Your list</b></div>
        </div>
      </div>
      <span className="gl-bob absolute -right-10 top-10 rotate-[6deg] bg-leaf text-white text-[15px] font-medium px-4 py-2 rounded-full shadow-lg whitespace-nowrap">
        ✓ Valid · {first}
      </span>
      <span className="max-lg:hidden gl-bob absolute -left-14 bottom-16 -rotate-[6deg] bg-coral text-brown text-[15px] px-4 py-2 rounded-full shadow-lg whitespace-nowrap font-yoruba italic" style={{ animationDelay: "-2s" }}>
        <s>mo gbọ́, mo yà</s>
      </span>
    </div>
  );
}
