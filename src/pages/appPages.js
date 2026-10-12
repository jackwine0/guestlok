import { lazyWithPreload, preloadSections } from "./event/sections.js";

// The signed-in pages. Preloadable, so once the app is up they're fetched in the
// background and "New event" or an event opens without a loading screen.
export const Dashboard = lazyWithPreload(() => import("./Dashboard.jsx"));
export const NewEvent = lazyWithPreload(() => import("./NewEvent.jsx"));
export const EventDetail = lazyWithPreload(() => import("./EventDetail.jsx"));

let started = false;
export function preloadAppPages() {
  if (started) return;
  started = true;
  const run = () => {
    [Dashboard, NewEvent, EventDetail].forEach((p) => p.preload());
    preloadSections();
  };
  if ("requestIdleCallback" in window) window.requestIdleCallback(run, { timeout: 2500 });
  else setTimeout(run, 800);
}
