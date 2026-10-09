import { LogOut } from "lucide-react";
import { Suspense } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";
import { useFeedback } from "../lib/feedback.js";
import { supabase } from "../lib/supabase.js";
import { Loader, Wordmark } from "./Brand.jsx";

/** Signed-in layout: warm grey canvas, white bento cards, pill controls. */
export default function AppShell() {
  const { session } = useAuth();
  const navigate = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    navigate("/");
  }

  return (
    <div className="min-h-dvh flex flex-col bg-shell">
      <header className="sticky top-0 z-30 bg-shell/95 backdrop-blur supports-[backdrop-filter]:bg-shell/80">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-7 h-[76px] flex items-center gap-2 sm:gap-3">
          <Link to="/app" aria-label="Guestlok dashboard" className="text-[28px] mr-1 sm:mr-3">
            <Wordmark hole="#EEB12F" />
          </Link>
          <NavLink
            to="/app"
            end
            className={({ isActive }) =>
              `hidden sm:inline-flex h-12 items-center px-5 rounded-full text-[15px] transition ${
                isActive ? "bg-brown text-cream" : "bg-white hover:-translate-y-px"
              }`
            }
          >
            My events
          </NavLink>
          <span className="flex-1" />
          <NameBadge user={session?.user} />
          <button
            type="button"
            onClick={signOut}
            aria-label="Sign out"
            title="Sign out"
            className="h-12 w-12 rounded-full bg-white inline-flex items-center justify-center hover:-translate-y-px transition"
          >
            <LogOut size={18} aria-hidden="true" />
          </button>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-[1440px] px-4 sm:px-7 pt-2 pb-12">
        <Suspense fallback={<Loader />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}

function NameBadge({ user }) {
  const fullName = user?.user_metadata?.full_name?.trim();
  const { ask, toast } = useFeedback();

  async function addName() {
    const name = await ask({
      title: "What should we call you?",
      body: "Shown in your dashboard. Guests see the host names you set on each event.",
      label: "Your name",
      placeholder: "Samuel Akande",
    });
    if (!name) return;
    const { error } = await supabase.auth.updateUser({ data: { full_name: name.slice(0, 80) } });
    toast(error ? "Couldn’t save your name. Try again." : `Nice to meet you, ${name.split(" ")[0]}`, { tone: error ? "error" : "success" });
  }

  if (!fullName) {
    return (
      <button type="button" onClick={addName} className="h-12 px-5 rounded-full bg-white text-[15px] underline underline-offset-4">
        Add your name
      </button>
    );
  }

  return (
    <span className="h-12 pl-1.5 pr-1.5 sm:pr-5 rounded-full bg-white inline-flex items-center gap-2.5" title={user.email}>
      <span className="w-9 h-9 rounded-full bg-ochre flex items-center justify-center text-[15px] font-semibold" aria-hidden="true">
        {fullName[0].toUpperCase()}
      </span>
      <span className="hidden sm:inline text-[15px] truncate max-w-[140px]">{fullName.split(" ")[0]}</span>
      <span className="sr-only sm:hidden">{fullName}</span>
    </span>
  );
}
