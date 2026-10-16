import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Loader } from "./components/Brand.jsx";
import AppShell from "./components/AppShell.jsx";
import { useAuth } from "./lib/auth.jsx";
import Landing from "./pages/Landing.jsx";
import { EventGate, EventGuests, EventInvitation, EventOverview, EventSettings } from "./pages/event/sections.js";
import { Dashboard, EventDetail, NewEvent } from "./pages/appPages.js";

const Login = lazy(() => import("./pages/Login.jsx"));

const Invite = lazy(() => import("./pages/Invite.jsx"));
const Sender = lazy(() => import("./pages/Sender.jsx"));
const ResetPassword = lazy(() => import("./pages/ResetPassword.jsx"));
const Scanner = lazy(() => import("./pages/Scanner.jsx"));
const NotFound = lazy(() => import("./pages/NotFound.jsx"));
const AppNotFound = lazy(() => import("./pages/AppNotFound.jsx"));
const Account = lazy(() => import("./pages/Account.jsx"));
const Legal = lazy(() => import("./pages/Legal.jsx"));

function RequireAuth({ children }) {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loader fullScreen />;
  if (!session)
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    );
  return <>{children}</>;
}

/** New page → start at the top (tab switches inside an event included). */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <Suspense fallback={<Loader fullScreen />}>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/i/:token" element={<Invite />} />
        <Route path="/send/:token" element={<Sender />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/scan/:eventId" element={<Scanner />} />
        <Route path="/privacy" element={<Legal doc="privacy" />} />
        <Route path="/terms" element={<Legal doc="terms" />} />
        <Route
          path="/app"
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="events/new" element={<NewEvent />} />
          <Route path="account" element={<Account />} />
          <Route path="events/:id" element={<EventDetail />}>
            <Route index element={<EventOverview />} />
            <Route path="guests" element={<EventGuests />} />
            <Route path="invitation" element={<EventInvitation />} />
            <Route path="gate" element={<EventGate />} />
            <Route path="settings" element={<EventSettings />} />
          </Route>
          <Route path="*" element={<AppNotFound />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
