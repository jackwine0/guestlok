import { createElement, lazy, useState } from "react";

/**
 * React.lazy suspends once on first render even when the code is already
 * downloaded, which flashes the "Loading" fallback. This wrapper renders the
 * real component directly once preload() has finished.
 */
function lazyWithPreload(factory) {
  let Loaded = null;
  let pending = null;
  const load = () => {
    if (!pending) {
      pending = factory()
        .then((m) => {
          Loaded = m.default;
          return m;
        })
        .catch((err) => {
          pending = null;
          throw err;
        });
    }
    return pending;
  };
  const Lazy = lazy(load);
  function Section(props) {
    // Pick once per mount so the component never swaps type (and loses state) mid-life.
    const [Comp] = useState(() => Loaded ?? Lazy);
    return createElement(Comp, props);
  }
  Section.preload = () => load().catch(() => null);
  return Section;
}

export const EventOverview = lazyWithPreload(() => import("./Overview.jsx"));
export const EventGuests = lazyWithPreload(() => import("./Guests.jsx"));
export const EventInvitation = lazyWithPreload(() => import("./Invitation.jsx"));
export const EventGate = lazyWithPreload(() => import("./Gate.jsx"));
export const EventSettings = lazyWithPreload(() => import("./Settings.jsx"));

let started = false;
/** Fetch every section's code in the background so tab switches never wait. */
export function preloadSections() {
  if (started) return;
  started = true;
  const run = () =>
    Promise.all([EventOverview, EventGuests, EventInvitation, EventGate, EventSettings].map((s) => s.preload()));
  if ("requestIdleCallback" in window) window.requestIdleCallback(run, { timeout: 1200 });
  else setTimeout(run, 300);
}
