import { LogOut } from "lucide-react";
import { Suspense, useEffect } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";
import { supabase } from "../lib/supabase.js";
import { preloadAppPages } from "../pages/appPages.js";
import { Loader, Wordmark } from "./Brand.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";

/** Signed-in layout: warm grey canvas, white bento cards, pill controls. */
export default function AppShell() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  useEffect(preloadAppPages, []);

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
      <main className="flex-1 mx-auto w-full max-w-[1440px] px-4 sm:px-7 pt-2 pb-12 [overflow-x:clip]">
        <ErrorBoundary compact resetKey={pathname}>
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  );
}

function NameBadge({ user }) {
  const fullName = user?.user_metadata?.full_name?.trim();
  if (!fullName) {
    return (
      <Link to="/app/account" className="h-12 px-5 rounded-full bg-white text-[15px] inline-flex items-center underline underline-offset-4">
        Your account
      </Link>
    );
  }

  return (
    <NavLink
      to="/app/account"
      aria-label={`Your account (${fullName})`}
      title="Your account"
      className={({ isActive }) =>
        `h-12 pl-1.5 pr-1.5 sm:pr-5 rounded-full inline-flex items-center gap-2.5 transition hover:-translate-y-px ${isActive ? "bg-brown text-cream" : "bg-white"}`
      }
    >
      <span className="w-9 h-9 rounded-full bg-ochre flex items-center justify-center text-[15px] font-semibold" aria-hidden="true">
        {fullName[0].toUpperCase()}
      </span>
      <span className="hidden sm:inline text-[15px] truncate max-w-[140px]">{fullName.split(" ")[0]}</span>
      <span className="sr-only sm:hidden">{fullName}</span>
    </NavLink>
  );
}

/** While a page's code arrives: the same loader the page shows for its data, so it reads as one wait. */
function PageSkeleton() {
  return <Loader label="One moment" />;
}
