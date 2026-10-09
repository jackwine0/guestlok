import { Check, Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ButtonSpinner, KeyholeDisc, Loader, Wordmark } from "../components/Brand.jsx";
import { MessageScreen } from "../components/Page.jsx";
import { useAuth } from "../lib/auth.jsx";
import { supabase } from "../lib/supabase.js";
import { useTitle } from "../lib/useTitle.js";

/**
 * /reset-password — where the "Reset my password" email lands.
 * The link signs the host in for this one purpose; here they choose the new password.
 */
export default function ResetPassword() {
  useTitle("Choose a new password");
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [waited, setWaited] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  // The session from the email link can take a moment to arrive.
  useEffect(() => {
    const t = setTimeout(() => setWaited(true), 2500);
    return () => clearTimeout(t);
  }, []);

  async function save(e) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirmPw) return setError("The two passwords don’t match.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setError(/same/i.test(error.message) ? "That’s your current password. Choose a different one." : error.message);
      return;
    }
    setDone(true);
    setTimeout(() => navigate("/app", { replace: true }), 1500);
  }

  if (loading || (!session && !waited)) return <Loader fullScreen label="Checking your link" />;

  if (!session)
    return (
      <MessageScreen kicker="Link expired" title="This reset link has expired." body="Reset links work once and only for a short time. Ask for a new one from the sign-in page.">
        <Link to="/login" className="btn-dark">Back to sign in</Link>
      </MessageScreen>
    );

  return (
    <main className="min-h-dvh bg-shell flex flex-col">
      <header className="px-6 pt-6">
        <Link to="/" aria-label="Guestlok home" className="text-[26px]">
          <Wordmark disc="#2B1B12" hole="#EEB12F" />
        </Link>
      </header>
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-[32px] bg-white p-6 sm:p-8">
          {done ? (
            <div className="flex flex-col items-center text-center gap-3 py-4">
              <span className="w-14 h-14 rounded-full bg-leaf text-white inline-flex items-center justify-center">
                <Check size={24} aria-hidden="true" />
              </span>
              <h1 className="hero-title">Password changed</h1>
              <p className="text-brown-soft">Taking you to your events…</p>
            </div>
          ) : (
            <form onSubmit={save} className="flex flex-col gap-5">
              <div>
                <KeyholeDisc disc="#EEB12F" hole="#2B1B12" className="w-12 h-12" />
                <h1 className="mt-4 hero-title">Choose a new password</h1>
                <p className="mt-2 text-brown-soft">For {session.user.email}</p>
              </div>
              <div>
                <label htmlFor="new-pw" className="label">New password</label>
                <div className="relative">
                  <input
                    id="new-pw"
                    type={show ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    autoFocus
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="field pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    aria-label={show ? "Hide password" : "Show password"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full inline-flex items-center justify-center text-brown-soft hover:bg-tile"
                  >
                    {show ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="confirm-pw" className="label">Type it again</label>
                <input
                  id="confirm-pw"
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  className="field"
                />
              </div>
              {error && <p role="alert" className="alert-error">{error}</p>}
              <button type="submit" disabled={busy} className="btn-dark btn-lg">
                {busy && <ButtonSpinner />} Save new password
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
