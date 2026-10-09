import { toJpeg, toPng } from "html-to-image";
import { createRoot } from "react-dom/client";
import TicketCard from "../components/TicketCard.jsx";

function slug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "guest";
}

export function ticketFilename(invite, ext) {
  return `${slug(invite.event_name)}-${slug(invite.guest_name)}-invite.${ext}`;
}

async function waitForImages(node) {
  const imgs = Array.from(node.querySelectorAll("img"));
  await Promise.all(
    imgs.map((img) =>
      img.complete && img.naturalWidth
        ? null
        : new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
          }),
    ),
  );
  if (document.fonts?.ready) await document.fonts.ready;
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}

/** Render a ticket off-screen and return it as a PNG data URL plus its size. */
export function renderTicketPng(invite, { pixelRatio = 2 } = {}) {
  return renderTicket(invite, (node) => toPng(node, { pixelRatio, cacheBust: true }));
}

/** Smaller JPEG version (for WhatsApp's link preview, which wants a light image). */
export function renderTicketJpeg(invite, { pixelRatio = 1.5, quality = 0.86 } = {}) {
  return renderTicket(invite, (node) => toJpeg(node, { pixelRatio, quality, cacheBust: true, backgroundColor: "#ffffff" }));
}

async function renderTicket(invite, encode) {
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = "position:fixed;left:-10000px;top:0;pointer-events:none;";
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    let node = null;
    await new Promise((resolve) => {
      root.render(
        <TicketCard
          exportMode
          invite={{ ...invite, checked_in_at: null }}
          ref={(el) => {
            if (el && !node) {
              node = el;
              resolve();
            }
          }}
        />,
      );
    });
    await waitForImages(node);
    const dataUrl = await encode(node);
    return { dataUrl, width: node.offsetWidth, height: node.offsetHeight };
  } finally {
    root.unmount();
    host.remove();
  }
}

export async function dataUrlToBlob(dataUrl) {
  return (await fetch(dataUrl)).blob();
}

export async function pngToPdfBlob({ dataUrl, width, height }) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "px", format: [width, height], orientation: height >= width ? "portrait" : "landscape", hotfixes: ["px_scaling"] });
  pdf.addImage(dataUrl, "PNG", 0, 0, width, height);
  return pdf.output("blob");
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function canShareFiles() {
  try {
    const probe = new File([new Blob(["x"], { type: "image/png" })], "x.png", { type: "image/png" });
    return !!navigator.canShare?.({ files: [probe] });
  } catch {
    return false;
  }
}

/**
 * Opens the phone's share sheet with the file (pick WhatsApp → a chat).
 * Returns 'shared', 'cancelled', or 'needs-tap' when the browser wants a fresh tap.
 * Falls back to downloading when sharing files isn't supported (most desktops).
 */
export async function shareOrDownload(blob, filename, text) {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return "shared";
    } catch (err) {
      if (err?.name === "AbortError") return "cancelled";
      if (err?.name === "NotAllowedError") return "needs-tap";
      throw err;
    }
  }
  downloadBlob(blob, filename);
  return "downloaded";
}
