import { Check, Crop, Eye, ImagePlus, Maximize, Move, RotateCcw, Trash2, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../lib/auth.jsx";
import { friendlyError } from "../lib/errors.js";
import { useFeedback } from "../lib/feedback.js";
import { DEFAULT_MESSAGE, MESSAGE_VARIABLES, THEMES, coverFrame, renderMessage, toInvite } from "../lib/invite.js";
import { supabase } from "../lib/supabase.js";
import { useSwapMotion } from "../lib/tabTransition.js";
import { usePricing } from "../lib/pricing.js";
import { NOTE_MAX, WA_STYLES, availableStyles, waPreviewText, waStyle } from "../lib/waTemplates.js";
import { useUnsavedGuard } from "../lib/useUnsavedGuard.js";
import { ButtonSpinner } from "./Brand.jsx";
import Modal from "./Modal.jsx";
import Segmented from "./Segmented.jsx";
import TicketCard from "./TicketCard.jsx";

const SAMPLE_GUEST = { name: "Adaeze Okafor", admits: 2, token: "0".repeat(32), checked_in_at: null };
const MAX_SIDE = 1600;
const DEFAULT_FRAME = { fit: "fill", position: "50% 50%", zoom: 1 };

/** Shrink big phone photos before upload (max 1600px, JPEG). */
async function prepareImage(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 900_000) return file;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
  return new File([blob], "cover.jpg", { type: "image/jpeg" });
}

const sameFrame = (a, b) => a.fit === b.fit && a.position === b.position && Number(a.zoom) === Number(b.zoom);

export default function InvitationEditor({ event, onSaved }) {
  const { session } = useAuth();
  const { toast, confirm } = useFeedback();
  const savedMessage = event.invite_message ?? DEFAULT_MESSAGE;
  const savedTheme = event.card_theme ?? "ochre";
  const savedFrame = coverFrame(event);
  // Framing needs migration 4; until then the controls explain why they're off.
  const canFrame = "cover_fit" in event;

  // Plus: the Guestlok message style + host note (needs migration 11).
  const plus = event.delivery === "plus";
  const canStyle = plus && "wa_template" in event;
  const savedStyle = event.wa_template ?? "guestlok_invite";
  const savedNote = event.wa_note ?? "";
  const { settings } = usePricing();
  const styles = availableStyles(settings);
  const [style, setStyle] = useState(savedStyle);
  const [note, setNote] = useState(savedNote);
  const styleSpec = waStyle(style);

  const [message, setMessage] = useState(savedMessage);
  const [theme, setTheme] = useState(savedTheme);
  const [frame, setFrame] = useState(savedFrame);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [view, setView] = useState("card"); // preview: 'card' | 'guestlok' | 'own'
  const [msgTab, setMsgTab] = useState("guestlok"); // Plus: which message is being edited
  const [showPreview, setShowPreview] = useState(false); // phones
  // Preview swaps with a quick cross-fade (a slide plus the panel resizing felt like a double step).
  const previewMotion = "gl-fade";
  const msgMotion = useSwapMotion(msgTab === "guestlok" ? 0 : 1);
  const textRef = useRef(null);
  const previewRef = useRef(null);
  const lastView = useRef(view);

  // Switching the preview back to the full ticket: bring its top into view (it scrolls with the page).
  useEffect(() => {
    const was = lastView.current;
    lastView.current = view;
    if (view !== "card" || was === "card") return;
    requestAnimationFrame(() => {
      const el = previewRef.current;
      if (!el || el.offsetParent === null) return; // hidden on phones
      const top = el.getBoundingClientRect().top;
      if (top < 150) glideTo(window.scrollY + top - 150);
    });
  }, [view]);
  const fileRef = useRef(null);

  const dirty =
    message !== savedMessage ||
    theme !== savedTheme ||
    (canFrame && !sameFrame(frame, savedFrame)) ||
    (canStyle && (style !== savedStyle || note !== savedNote));
  const previewEvent = {
    ...event,
    card_theme: theme,
    cover_fit: frame.fit,
    cover_position: frame.position,
    cover_zoom: frame.zoom,
  };
  const previewText = useMemo(
    () => renderMessage(message, { guest: SAMPLE_GUEST, event: previewEvent }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [message, theme, event],
  );

  async function update(fields) {
    const { data, error } = await supabase.from("events").update(fields).eq("id", event.id).select("*").single();
    if (error) {
      toast(friendlyError(error), { tone: "error" });
      return null;
    }
    onSaved(data);
    return data;
  }

  async function save() {
    setSaving(true);
    const clean = message.trim() === DEFAULT_MESSAGE.trim() ? null : message;
    const fields = { invite_message: clean, card_theme: theme };
    if (canFrame) Object.assign(fields, { cover_fit: frame.fit, cover_position: frame.position, cover_zoom: frame.zoom });
    if (canStyle) Object.assign(fields, { wa_template: style, wa_note: note.replace(/\s+/g, " ").trim().slice(0, NOTE_MAX) || null });
    const ok = await update(fields);
    setSaving(false);
    if (ok) toast("Invitation saved. New invites use it straight away.");
    return !!ok;
  }

  useUnsavedGuard(dirty, save, { what: "the invitation" });

  function discard() {
    setMessage(savedMessage);
    setTheme(savedTheme);
    setFrame(savedFrame);
    setStyle(savedStyle);
    setNote(savedNote);
  }

  function insertVariable(token) {
    const el = textRef.current;
    if (!el) return;
    const start = el.selectionStart ?? message.length;
    const end = el.selectionEnd ?? message.length;
    const next = message.slice(0, start) + token + message.slice(end);
    setMessage(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + token.length;
    });
  }

  async function uploadCover(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      toast("Use a JPG, PNG or WebP photo.", { tone: "error" });
      return;
    }
    setUploading(true);
    try {
      const prepared = await prepareImage(file);
      if (prepared.size > 5 * 1024 * 1024) throw new Error("That photo is too large (max 5 MB).");
      const ext = prepared.type === "image/png" ? "png" : prepared.type === "image/webp" ? "webp" : "jpg";
      const path = `${session.user.id}/${event.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("invite-covers")
        .upload(path, prepared, { contentType: prepared.type, cacheControl: "31536000" });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("invite-covers").getPublicUrl(path);
      const oldPath = storagePath(event.cover_image_url);
      // Portrait photos (flyers) default to "whole" so nothing gets cut off.
      const bmp = await createImageBitmap(prepared);
      const fresh = { ...DEFAULT_FRAME, fit: bmp.height > bmp.width * 1.05 ? "whole" : "fill" };
      const fields = { cover_image_url: data.publicUrl };
      if (canFrame) Object.assign(fields, { cover_fit: fresh.fit, cover_position: fresh.position, cover_zoom: fresh.zoom });
      const saved = await update(fields);
      if (saved) {
        setFrame(fresh);
        toast(fresh.fit === "whole" ? "Photo added. Showing the whole photo." : "Photo added. Drag it to frame the faces.");
        if (oldPath) await supabase.storage.from("invite-covers").remove([oldPath]);
      }
    } catch (err) {
      toast(friendlyError(err), { tone: "error" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeCover() {
    const sure = await confirm({
      title: "Remove the cover photo?",
      body: "Invites will show just the event name and colours. You can add a photo again any time.",
      confirmLabel: "Remove photo",
      danger: true,
    });
    if (!sure) return;
    const oldPath = storagePath(event.cover_image_url);
    const ok = await update({ cover_image_url: null });
    if (ok) {
      toast("Photo removed");
      if (oldPath) await supabase.storage.from("invite-covers").remove([oldPath]);
    }
  }

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) uploadCover(f);
  };

  const coverBlock = !event.cover_image_url ? (
    <label
      htmlFor="cover"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className={`flex flex-col items-center justify-center gap-2 rounded-[24px] border-2 border-dashed px-6 py-10 text-center cursor-pointer transition ${
        dragOver ? "border-brown bg-cream" : "border-sand bg-tile hover:border-brown-soft"
      }`}
    >
      <span className="w-14 h-14 rounded-full bg-white inline-flex items-center justify-center">
        {uploading ? <ButtonSpinner /> : <ImagePlus size={24} aria-hidden="true" />}
      </span>
      <span className="text-[17px]">{uploading ? "Uploading…" : "Drop a photo here, or tap to choose"}</span>
      <span className="text-sm text-brown-soft">Optional · JPG, PNG or WebP · we shrink big phone photos for you</span>
    </label>
  ) : (
    <div className="grid gap-5 grid-cols-1 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-start">
      <CoverAdjuster src={event.cover_image_url} frame={frame} onChange={setFrame} disabled={!canFrame} />
      <div className="flex flex-col gap-4">
        {canFrame ? (
          <>
            <Segmented
              role="group"
              label="How the photo fits"
              value={frame.fit}
              onChange={(id) => setFrame((f) => ({ ...f, fit: id }))}
              options={[
                { value: "fill", label: "Fill frame", icon: Crop },
                { value: "whole", label: "Whole photo", icon: Maximize },
              ]}
              className="self-start"
            />
            {frame.fit === "fill" && (
              <div className="flex items-center gap-2 w-full">
                <button type="button" aria-label="Zoom out" onClick={() => setFrame((f) => ({ ...f, zoom: Math.max(1, +(f.zoom - 0.1).toFixed(2)) }))} className="w-10 h-10 shrink-0 rounded-full bg-tile hover:bg-sand inline-flex items-center justify-center">
                  <ZoomOut size={16} aria-hidden="true" />
                </button>
                <label htmlFor="zoom" className="sr-only">Zoom</label>
                <input id="zoom" type="range" min={1} max={3} step={0.01} value={frame.zoom} onChange={(e) => setFrame((f) => ({ ...f, zoom: Number(e.target.value) }))} className="gl-range flex-1" />
                <button type="button" aria-label="Zoom in" onClick={() => setFrame((f) => ({ ...f, zoom: Math.min(3, +(f.zoom + 0.1).toFixed(2)) }))} className="w-10 h-10 shrink-0 rounded-full bg-tile hover:bg-sand inline-flex items-center justify-center">
                  <ZoomIn size={16} aria-hidden="true" />
                </button>
              </div>
            )}
            <p className="text-sm text-brown-soft">
              {frame.fit === "fill"
                ? "Drag the photo to move it, zoom to get closer. Flyers look best as “Whole photo”."
                : "The full photo at its own shape, nothing cropped. Good for flyers and portrait photos."}
            </p>
          </>
        ) : (
          <p className="text-sm rounded-2xl bg-cream px-4 py-3">
            To move, zoom or fit the photo, run the <code>cover_adjust</code> migration in Supabase first.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <label htmlFor="cover" className="btn h-10 px-4 text-sm bg-tile hover:bg-sand cursor-pointer">
            {uploading ? <ButtonSpinner /> : <ImagePlus size={16} aria-hidden="true" />} Change
          </label>
          {canFrame && !sameFrame(frame, { ...DEFAULT_FRAME, fit: frame.fit }) && (
            <button type="button" onClick={() => setFrame((f) => ({ ...DEFAULT_FRAME, fit: f.fit }))} className="btn h-10 px-4 text-sm bg-tile hover:bg-sand">
              <RotateCcw size={15} aria-hidden="true" /> Reset framing
            </button>
          )}
          <button type="button" onClick={removeCover} className="btn h-10 px-4 text-sm text-brown-soft hover:text-[#9A3324] hover:bg-coral/10">
            <Trash2 size={15} aria-hidden="true" /> Remove
          </button>
        </div>
      </div>
    </div>
  );

  const ownMessage = (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="msg" className="text-sm text-brown-soft">
          {canStyle ? "Used when you or a helper send from your own WhatsApp." : "Sent with each guest’s personal link, from your WhatsApp."}
        </label>
        <button type="button" onClick={() => setMessage(DEFAULT_MESSAGE)} disabled={message === DEFAULT_MESSAGE} className="h-9 px-3.5 shrink-0 rounded-full bg-tile hover:bg-sand text-sm inline-flex items-center gap-1.5 disabled:opacity-40">
          <RotateCcw size={14} aria-hidden="true" /> Reset
        </button>
      </div>
      <div>
        <textarea
          id="msg"
          ref={textRef}
          rows={8}
          maxLength={1000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="field h-auto py-3.5 leading-relaxed text-[15px] rounded-[20px] bg-tile border-transparent focus:bg-white"
        />
        <p className="mt-1.5 text-right text-xs text-brown-soft tabular-nums">{message.length}/1000</p>
      </div>
      <div>
        <p className="text-sm text-brown-soft mb-2">Tap to insert. Each guest gets their own details.</p>
        <div className="flex flex-wrap gap-1.5">
          {MESSAGE_VARIABLES.map(([token, hint]) => (
            <button key={token} type="button" title={hint} onClick={() => insertVariable(token)} className="h-8 px-3 rounded-full bg-tile hover:bg-ochre text-xs font-mono transition">
              {token}
            </button>
          ))}
        </div>
        {!message.includes("{link}") && (
          <p className="mt-3 text-sm bg-cream rounded-2xl px-4 py-3">
            No <code>{"{link}"}</code> in your message, so we’ll add the invite link at the end.
          </p>
        )}
      </div>
    </div>
  );

  const guestlokMessage = canStyle && (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-brown-soft">
        WhatsApp only lets Guestlok’s number send approved wording, so you pick a style and add a short note.
      </p>
      <div className="grid gap-2.5 grid-cols-1 sm:grid-cols-2" role="radiogroup" aria-label="Message style">
        {styles.map((st) => {
          const on = style === st.id;
          return (
            <button
              key={st.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setStyle(st.id)}
              className={`text-left rounded-[20px] px-4 py-3.5 transition ${on ? "bg-brown text-cream" : "bg-tile hover:bg-sand"}`}
            >
              <span className="flex items-center justify-between gap-2 text-[16px]">
                {st.label}
                {on && <Check size={16} aria-hidden="true" />}
              </span>
              <span className={`block text-[13px] ${on ? "text-sand" : "text-brown-soft"}`}>{st.blurb}</span>
            </button>
          );
        })}
      </div>
      {styles.length < WA_STYLES.length && <p className="-mt-1 text-xs text-brown-soft">More styles appear here once WhatsApp approves them.</p>}
      <div>
        <label htmlFor="wa-note" className="label">
          Your note <span className="font-normal text-brown-soft">(optional)</span>
        </label>
        <input
          id="wa-note"
          maxLength={NOTE_MAX}
          disabled={!styleSpec.note}
          placeholder={styleSpec.note ? styleSpec.defaultNote : "The Simple style has no note. Pick another style to add one."}
          value={styleSpec.note ? note : ""}
          onChange={(e) => setNote(e.target.value)}
          className="field disabled:opacity-60"
        />
        <p className="mt-1.5 flex justify-between gap-3 text-xs text-brown-soft">
          <span>Dress code, gate time, colours. One line.</span>
          <span className="tabular-nums">{note.length}/{NOTE_MAX}</span>
        </p>
      </div>
    </div>
  );

  // Safari doesn't focus buttons on click, so both focus and click switch the preview.
  // The Guestlok/your-phone switch sets the view itself, so it doesn't flash the old one first.
  const showMessage = (e) => {
    if (!e.target.closest?.("[data-msg-switch]")) setView(canStyle ? msgTab : "own");
  };

  const previewOptions = [
    { value: "card", label: "Ticket" },
    ...(canStyle ? [{ value: "guestlok", label: "Guestlok msg" }] : []),
    { value: "own", label: canStyle ? "Your msg" : "WhatsApp" },
  ];
  const preview = (
    <PreviewPanel
      view={view}
      onView={setView}
      options={previewOptions}
      motion={previewMotion}
      event={event}
      previewEvent={previewEvent}
      theme={theme}
      ownText={previewText}
      guestlokText={canStyle ? waPreviewText(style, note, previewEvent, SAMPLE_GUEST) : ""}
    />
  );

  return (
    <section className="flex flex-col gap-[18px] max-lg:pb-28">
      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <h2 className="page-title">Invitation</h2>
          <p className="page-sub">Design the ticket your guests show at the gate, and the WhatsApp message that brings it.</p>
        </div>
        <span
          role="status"
          className={`h-9 px-3.5 rounded-full text-sm inline-flex items-center gap-2 ${dirty ? "bg-ochre text-brown font-medium" : "bg-white text-brown-soft"}`}
        >
          <span className={`w-2 h-2 rounded-full ${dirty ? "bg-brown" : "bg-leaf"}`} aria-hidden="true" />
          {dirty ? "Unsaved changes" : "All changes saved"}
        </span>
      </div>

      <input ref={fileRef} id="cover" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && uploadCover(e.target.files[0])} />

      <div className="grid gap-[18px] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] items-start">
        {/* lg:pb lives inside the grid so the sticky preview has room at the end of the page */}
        <div className="flex flex-col gap-[18px] min-w-0 lg:pb-28">
          {/* 1 · The ticket */}
          <div className="bento flex flex-col gap-6" onFocusCapture={() => setView("card")} onClickCapture={() => setView("card")}>
            <StepHead n={1} title="The ticket" hint="What each guest opens and shows at the gate. Same design for everyone, with their own name and QR." />
            <div className="flex flex-col gap-3">
              <h4 className="text-[16px] font-medium">Cover photo</h4>
              {coverBlock}
            </div>
            <div className="h-px bg-tile" aria-hidden="true" />
            <div className="flex flex-col gap-3">
              <h4 className="text-[16px] font-medium">Colours <span className="font-normal text-brown-soft text-sm">· match your aso ebi or décor</span></h4>
              <div className="grid gap-2.5 grid-cols-5 max-w-[520px]" role="radiogroup" aria-label="Ticket colours">
                {Object.entries(THEMES).map(([id, t]) => {
                  const on = theme === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={t.label}
                      onClick={() => setTheme(id)}
                      className={`rounded-[18px] p-1.5 sm:p-2 text-left transition ring-2 ${on ? "ring-brown bg-white" : "ring-transparent bg-tile hover:bg-sand"}`}
                    >
                      <span className="block rounded-[12px] p-1.5 aspect-square" style={{ background: t.page }} aria-hidden="true">
                        <span className="flex h-full flex-col rounded-[7px] overflow-hidden bg-white">
                          <span className="h-[42%]" style={{ background: t.head }} />
                          <span className="flex-1" style={{ background: t.soft }} />
                        </span>
                      </span>
                      <span className="mt-1.5 px-0.5 flex items-center justify-between gap-1 text-xs sm:text-sm">
                        <span className="truncate">{t.label}</span>
                        {on && <Check size={14} className="shrink-0" aria-hidden="true" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 2 · The message */}
          <div
            className="bento flex flex-col gap-5"
            onFocusCapture={showMessage}
            onClickCapture={showMessage}
          >
            <StepHead
              n={2}
              title="The WhatsApp message"
              hint={canStyle ? "Plus sends from Guestlok’s WhatsApp, and you can still send from your own phone. Set up both." : "The text that goes with each guest’s invite link."}
            />
            {canStyle && (
              <div data-msg-switch className="self-start">
              <Segmented
                label="Which message"
                value={msgTab}
                onChange={(v) => {
                  setMsgTab(v);
                  setView(v);
                }}
                options={[
                  { value: "guestlok", label: "Sent by Guestlok" },
                  { value: "own", label: "From your phone" },
                ]}
              />
              </div>
            )}
            <div key={canStyle ? msgTab : "own"} className={msgMotion}>
              {canStyle && msgTab === "guestlok" ? guestlokMessage : ownMessage}
            </div>
          </div>
        </div>

        {/* Live preview: stays in view on desktop; a button opens it on phones */}
        {/* The full ticket is taller than the screen, so it scrolls with the page; the shorter message previews stay in view. */}
        <div ref={previewRef} className={`max-lg:hidden ${view === "card" ? "" : "lg:sticky lg:top-[150px]"}`}>{preview}</div>
      </div>

      <Modal open={showPreview} onClose={() => setShowPreview(false)} title="Preview" description="Sample guest: Adaeze Okafor, admits 2." size="md">
        {preview}
      </Modal>

      {/* Bottom bar: save when something changed; preview button on phones.
          Portaled: the tab's slide-in animation would otherwise trap "fixed" inside the page. */}
      {createPortal(
      <div className="fixed z-40 left-1/2 lg:left-[calc(50%-209px)] -translate-x-1/2 bottom-[max(1rem,env(safe-area-inset-bottom))] w-[min(94vw,560px)] pointer-events-none">
        {dirty ? (
          <div className="gl-tab-in pointer-events-auto flex items-center gap-1.5 rounded-full bg-brown text-cream pl-4 sm:pl-5 pr-1.5 py-1.5 shadow-[0_18px_40px_rgba(28,18,12,0.35)]">
            <span className="w-2 h-2 rounded-full bg-ochre shrink-0" aria-hidden="true" />
            <span className="flex-1 min-w-0 truncate text-[15px]">Unsaved changes</span>
            <button type="button" onClick={() => setShowPreview(true)} aria-label="Preview" className="lg:hidden h-11 w-11 shrink-0 rounded-full text-sand hover:text-cream inline-flex items-center justify-center">
              <Eye size={18} aria-hidden="true" />
            </button>
            <button type="button" onClick={discard} className="h-11 px-3 sm:px-4 shrink-0 rounded-full text-sm text-sand hover:text-cream">
              Discard
            </button>
            <button type="button" onClick={save} disabled={saving} className="h-11 px-4 sm:px-5 shrink-0 rounded-full bg-ochre text-brown text-sm font-medium inline-flex items-center gap-2">
              {saving && <ButtonSpinner />} Save
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            className="lg:hidden pointer-events-auto mx-auto flex h-12 px-5 rounded-full bg-brown text-cream items-center gap-2 shadow-[0_18px_40px_rgba(28,18,12,0.3)]"
          >
            <Eye size={18} aria-hidden="true" /> Preview
          </button>
        )}
      </div>,
      document.body,
      )}
    </section>
  );
}

function StepHead({ n, title, hint }) {
  return (
    <div className="flex items-start gap-3.5">
      <span className="w-9 h-9 shrink-0 rounded-full bg-ochre inline-flex items-center justify-center text-sm font-medium">{n}</span>
      <div>
        <h3 className="section-title leading-tight">{title}</h3>
        <p className="mt-1 text-[15px] text-brown-soft">{hint}</p>
      </div>
    </div>
  );
}

/** The ticket, the Guestlok message and the host's own message, as guests will see them. */
function PreviewPanel({ view, onView, options, motion, event, previewEvent, theme, ownText, guestlokText }) {
  const current = options.some((o) => o.value === view) ? view : "card";
  return (
    <aside className="rounded-[32px] bg-brown p-3 sm:p-4 flex flex-col gap-3" aria-label="Preview">
      <Segmented tone="dark" size="sm" label="Preview" value={current} onChange={onView} options={options} className="self-center" />
      <div className="rounded-[24px] overflow-hidden">
        <div key={current} className={motion}>
          {current === "card" && (
            <div className="p-4" style={{ background: THEMES[theme].page }}>
              <TicketCard invite={toInvite(SAMPLE_GUEST, previewEvent)} sample />
            </div>
          )}
          {current === "guestlok" && (
            <div className="bg-[#E6DDD4] p-3.5 flex flex-col justify-end">
              <div className="mr-auto max-w-[94%] rounded-2xl rounded-tl-sm bg-white text-[#111B21] p-1.5 shadow-sm">
                <div className="rounded-xl overflow-hidden mb-1.5 h-[110px] flex items-center justify-center" style={{ background: THEMES[theme].page }}>
                  <div className="w-[62%] scale-[0.55] origin-center pointer-events-none">
                    <TicketCard invite={toInvite(SAMPLE_GUEST, previewEvent)} sample />
                  </div>
                </div>
                <p className="px-2.5 pb-1 text-[13.5px] leading-snug whitespace-pre-line break-words">{guestlokText}</p>
                <p className="px-2.5 pb-1.5 text-[12px] opacity-50">Sent by Guestlok for your host</p>
                <div className="border-t border-black/10 py-2 text-center text-[14px] text-[#027EB5] font-medium">View my ticket</div>
              </div>
              <p className="mt-2 text-center text-[11px] text-brown-soft">From Guestlok’s WhatsApp · the picture is each guest’s own ticket</p>
            </div>
          )}
          {current === "own" && (
            <div className="bg-[#E6DDD4] p-3.5 min-h-[300px] flex flex-col justify-end">
              <div className="ml-auto max-w-[92%] rounded-2xl rounded-tr-sm bg-[#D9FDD3] text-[#111B21] p-1.5 shadow-sm">
                <div className="rounded-xl bg-white/60 overflow-hidden mb-1.5 flex">
                  <span className="w-1 shrink-0" style={{ background: THEMES[theme].head }} />
                  <span className="px-3 py-2 min-w-0">
                    <span className="block text-[13px] font-medium truncate">{event.name}</span>
                    <span className="block text-xs opacity-60">guestlok · Your personal invite</span>
                  </span>
                </div>
                <p className="px-2.5 pb-1.5 text-[14px] leading-relaxed whitespace-pre-line break-words">{ownText}</p>
                <p className="px-2.5 pb-1 text-right text-[11px] opacity-50">12:04 ✓✓</p>
              </div>
              <p className="mt-2 text-center text-[11px] text-brown-soft">From your WhatsApp</p>
            </div>
          )}
        </div>
      </div>
      <p className="px-1 text-xs text-sand text-center">Sample guest: Adaeze Okafor, admits 2.</p>
    </aside>
  );
}

/** A gentle scroll (the browser's "smooth" is too quick for a long jump). Instant with reduced motion. */
function glideTo(target, ms = 750) {
  const start = window.scrollY;
  const dist = target - start;
  if (Math.abs(dist) < 2) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    window.scrollTo(0, target);
    return;
  }
  const t0 = performance.now();
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  let cancelled = false;
  const stop = () => (cancelled = true);
  // If the person scrolls or taps meanwhile, let them take over.
  window.addEventListener("wheel", stop, { once: true, passive: true });
  window.addEventListener("touchstart", stop, { once: true, passive: true });
  const step = (now) => {
    if (cancelled) return;
    const t = Math.min(1, (now - t0) / ms);
    window.scrollTo(0, start + dist * ease(t));
    if (t < 1) requestAnimationFrame(step);
    else {
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
    }
  };
  requestAnimationFrame(step);
}

/**
 * The cover photo in the card's 4:3 frame. Drag (mouse, finger or arrow keys)
 * to move the focal point; zoom comes from the slider. In "whole" mode it just
 * shows the full photo.
 */
function CoverAdjuster({ src, frame, onChange, disabled }) {
  const boxRef = useRef(null);
  const drag = useRef(null);
  const [x, y] = frame.position.split(" ").map((v) => parseFloat(v));

  const setPos = (nx, ny) => {
    const clamp = (v) => Math.round(Math.min(100, Math.max(0, v)) * 10) / 10;
    onChange((f) => ({ ...f, position: `${clamp(nx)}% ${clamp(ny)}%` }));
  };

  if (frame.fit === "whole") {
    return (
      <div className="rounded-[24px] bg-tile p-3 flex justify-center">
        <img src={src} alt="Cover photo" className="block max-h-[380px] w-auto max-w-full rounded-[16px]" />
      </div>
    );
  }

  return (
    <div
      ref={boxRef}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label="Photo position. Drag or use arrow keys."
      aria-valuetext={`${Math.round(x)}% across, ${Math.round(y)}% down`}
      aria-valuenow={Math.round(x)}
      aria-disabled={disabled}
      onPointerDown={(e) => {
        if (disabled) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { px: e.clientX, py: e.clientY, x, y };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const r = boxRef.current.getBoundingClientRect();
        // Moving the photo right means looking further left in it.
        const k = 140 / frame.zoom;
        setPos(d.x - ((e.clientX - d.px) / r.width) * k, d.y - ((e.clientY - d.py) / r.height) * k);
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
      onKeyDown={(e) => {
        if (disabled) return;
        const step = e.shiftKey ? 10 : 2;
        const moves = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
        const m = moves[e.key];
        if (!m) return;
        e.preventDefault();
        setPos(x + m[0], y + m[1]);
      }}
      className={`group relative w-full aspect-[4/3] overflow-hidden rounded-[24px] bg-tile touch-none select-none ${disabled ? "" : "cursor-grab active:cursor-grabbing"}`}
    >
      <img
        src={src}
        alt="Cover photo"
        draggable={false}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        style={{ objectPosition: frame.position, transform: `scale(${frame.zoom})`, transformOrigin: frame.position }}
      />
      {!disabled && (
        <>
          {/* Rule-of-thirds guide while adjusting */}
          <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 group-active:opacity-100 transition" aria-hidden="true">
            <div className="absolute inset-y-0 left-1/3 w-px bg-white/60" />
            <div className="absolute inset-y-0 left-2/3 w-px bg-white/60" />
            <div className="absolute inset-x-0 top-1/3 h-px bg-white/60" />
            <div className="absolute inset-x-0 top-2/3 h-px bg-white/60" />
          </div>
          <span className="absolute left-3 bottom-3 h-9 px-3.5 rounded-full bg-brown/80 text-cream text-xs inline-flex items-center gap-1.5 pointer-events-none backdrop-blur">
            <Move size={14} aria-hidden="true" /> Drag to adjust
          </span>
        </>
      )}
    </div>
  );
}

function storagePath(publicUrl) {
  if (!publicUrl) return null;
  const marker = "/storage/v1/object/public/invite-covers/";
  const i = publicUrl.indexOf(marker);
  return i === -1 ? null : decodeURIComponent(publicUrl.slice(i + marker.length));
}
