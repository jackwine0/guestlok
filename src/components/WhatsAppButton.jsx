import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { openTab } from "../lib/whatsappTicket.js";
import { ButtonSpinner } from "./Brand.jsx";

/**
 * A WhatsApp chat link that first gets the guest's ticket image ready (so it shows in the
 * message), with a spinner on the button meanwhile. If the browser blocks the new tab
 * after the wait, the button turns into "Open chat" and the next tap opens it instantly.
 *
 * prepare(): returns the ticket-upload promise (or null). onOpened(): after the chat opens.
 */
export default function WhatsAppButton({ href, prepare, onOpened, className = "", children, busyLabel = "Adding ticket…", compact = false, ...rest }) {
  const [state, setState] = useState("idle"); // idle | busy | ready

  function open() {
    if (openTab(href)) {
      setState("idle");
      onOpened?.();
      return true;
    }
    setState("ready");
    return false;
  }

  async function onClick(e) {
    e.preventDefault();
    if (state === "busy") return;
    if (state === "ready") {
      open();
      return;
    }
    const preparing = prepare?.();
    if (!preparing || preparing.state !== "pending") {
      open();
      return;
    }
    setState("busy");
    await Promise.race([preparing.catch(() => null), new Promise((r) => setTimeout(r, 6000))]);
    open();
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onPointerDown={() => prepare?.()}
      onClick={onClick}
      {...rest}
      aria-busy={state === "busy"}
      className={`${className} ${state === "busy" ? "opacity-80 cursor-progress" : ""}`}
    >
      {state === "busy" ? (
        <>
          <ButtonSpinner /> {!compact && busyLabel}
        </>
      ) : state === "ready" ? (
        <>
          <ExternalLink size={16} aria-hidden="true" /> {compact ? <span className="sr-only">Open chat</span> : "Open chat"}
        </>
      ) : (
        children
      )}
    </a>
  );
}
