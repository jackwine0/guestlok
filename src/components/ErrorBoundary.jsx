import { Component } from "react";
import { EmptyState, MessageScreen } from "./Page.jsx";

const RELOAD_KEY = "gl_chunk_reload";

/** True for "the code for this page couldn't be downloaded" (usually: a new version was just deployed). */
export function isChunkError(err) {
  const msg = String(err?.message ?? err ?? "");
  return /dynamically imported module|Importing a module script failed|error loading dynamically|ChunkLoadError|Unable to preload/i.test(msg);
}

/** Reload once to pick up the new version; never loop. */
export function reloadForNewVersion() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < 10000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    /* storage blocked: still reload once */
  }
  window.location.reload();
  return true;
}

/**
 * Catches render errors so a crash shows a branded screen with a way out
 * instead of a blank white page.
 */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  // Navigating away clears the error (pass the pathname as resetKey).
  componentDidUpdate(prev) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  componentDidCatch(error) {
    if (isChunkError(error)) reloadForNewVersion();
    console.error(error);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const update = isChunkError(error);
    if (this.props.compact) {
      return (
        <EmptyState
          title={update ? "Guestlok was just updated" : "This screen hit a snag"}
          body={update ? "Reload to get the latest version. Nothing you saved is lost." : "Reload to try again. Your events and guests are safe."}
        >
          <button type="button" onClick={() => window.location.reload()} className="btn-dark">
            Reload
          </button>
        </EmptyState>
      );
    }
    return (
      <MessageScreen
        kicker={update ? "New version" : "Something went wrong"}
        title={update ? "Guestlok was just updated." : "This screen hit a snag."}
        body={update ? "Reload to get the latest version. Nothing you saved is lost." : "Reload the page to try again. If it keeps happening, go back to your events."}
      >
        <button type="button" onClick={() => window.location.reload()} className="btn-dark btn-lg">
          Reload
        </button>
        <a href="/app" className="btn btn-lg bg-white/60 text-brown">
          My events
        </a>
      </MessageScreen>
    );
  }
}
