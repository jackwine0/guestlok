import { Check, Crop, ImagePlus, Maximize, Move, RotateCcw, Trash2, ZoomIn, ZoomOut } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useAuth } from "../lib/auth.jsx";
import { friendlyError } from "../lib/errors.js";
import { useFeedback } from "../lib/feedback.js";
import { DEFAULT_MESSAGE, MESSAGE_VARIABLES, THEMES, coverFrame, renderMessage, toInvite } from "../lib/invite.js";
import { supabase } from "../lib/supabase.js";
import { useSwapMotion } from "../lib/tabTransition.js";
import { ButtonSpinner } from "./Brand.jsx";
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

  const [message, setMessage] = useState(savedMessage);
  const [theme, setTheme] = useState(savedTheme);
  const [frame, setFrame] = useState(savedFrame);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [view, setView] = useState("card");
  const previewMotion = useSwapMotion(view === "card" ? 0 : 1);
  const textRef = useRef(null);
  const fileRef = useRef(null);

  const dirty = message !== savedMessage || theme !== savedTheme || (canFrame && !sameFrame(frame, savedFrame));
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
    const ok = await update(fields);
    setSaving(false);
    if (ok) toast("Invitation saved. New invites use it straight away.");
  }

  function discard() {
    setMessage(savedMessage);
    setTheme(savedTheme);
    setFrame(savedFrame);
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

  return (
    <section className="flex flex-col gap-[18px] pb-24">
      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <h2 className="page-title">Invitation</h2>
          <p className="page-sub">The card your guests open, and the WhatsApp message that brings it.</p>
        </div>
      </div>

      <div className="grid gap-[18px] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px] items-start">
        <div className="flex flex-col gap-[18px] min-w-0">
          {/* 1 · Cover photo */}
          <div className="bento flex flex-col gap-5">
            <StepHead n={1} title="Cover photo" hint="The celebrants, the couple or your flyer. It sits at the top of every invite." />

            <input
              ref={fileRef}
              id="cover"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => e.target.files?.[0] && uploadCover(e.target.files[0])}
            />

            {!event.cover_image_url ? (
              <label
                htmlFor="cover"
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className={`flex flex-col items-center justify-center gap-2 rounded-[28px] border-2 border-dashed px-6 py-12 text-center cursor-pointer transition ${
                  dragOver ? "border-brown bg-cream" : "border-sand bg-tile hover:border-brown-soft"
                }`}
              >
                <span className="w-14 h-14 rounded-full bg-white inline-flex items-center justify-center">
                  {uploading ? <ButtonSpinner /> : <ImagePlus size={24} aria-hidden="true" />}
                </span>
                <span className="text-[17px]">{uploading ? "Uploading…" : "Drop a photo here, or tap to choose"}</span>
                <span className="text-sm text-brown-soft">JPG, PNG or WebP · we shrink big phone photos for you</span>
              </label>
            ) : (
              <div className="grid gap-5 grid-cols-1 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] items-start">
                <CoverAdjuster src={event.cover_image_url} frame={frame} onChange={setFrame} disabled={!canFrame} />
                <div className="flex flex-col gap-5">

                {canFrame ? (
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-3">
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
                          <input
                            id="zoom"
                            type="range"
                            min={1}
                            max={3}
                            step={0.01}
                            value={frame.zoom}
                            onChange={(e) => setFrame((f) => ({ ...f, zoom: Number(e.target.value) }))}
                            className="gl-range flex-1"
                          />
                          <button type="button" aria-label="Zoom in" onClick={() => setFrame((f) => ({ ...f, zoom: Math.min(3, +(f.zoom + 0.1).toFixed(2)) }))} className="w-10 h-10 shrink-0 rounded-full bg-tile hover:bg-sand inline-flex items-center justify-center">
                            <ZoomIn size={16} aria-hidden="true" />
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-brown-soft">
                      {frame.fit === "fill"
                        ? "Drag the photo to move it, zoom to get closer. Use “Whole photo” for flyers so nothing is cut off."
                        : "The full photo shows at its own shape, nothing cropped. Good for flyers and portrait photos."}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm rounded-2xl bg-cream px-4 py-3">
                    To move, zoom or fit the photo, run the <code>cover_adjust</code> migration in Supabase first.
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  <label htmlFor="cover" className="btn h-11 bg-tile hover:bg-sand cursor-pointer">
                    {uploading ? <ButtonSpinner /> : <ImagePlus size={17} aria-hidden="true" />} Change photo
                  </label>
                  {canFrame && !sameFrame(frame, { ...DEFAULT_FRAME, fit: frame.fit }) && (
                    <button type="button" onClick={() => setFrame((f) => ({ ...DEFAULT_FRAME, fit: f.fit }))} className="btn h-11 bg-tile hover:bg-sand">
                      <RotateCcw size={16} aria-hidden="true" /> Reset framing
                    </button>
                  )}
                  <button type="button" onClick={removeCover} className="btn h-11 text-brown-soft hover:text-[#9A3324] hover:bg-coral/10">
                    <Trash2 size={17} aria-hidden="true" /> Remove
                  </button>
                </div>
                </div>
              </div>
            )}
          </div>

          {/* 2 · Colours */}
          <div className="bento flex flex-col gap-5">
            <StepHead n={2} title="Card colours" hint="Pick the one that matches your aso ebi or décor." />
            <div className="grid gap-3 grid-cols-3 sm:grid-cols-5" role="radiogroup" aria-label="Card colours">
              {Object.entries(THEMES).map(([id, t]) => {
                const on = theme === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setTheme(id)}
                    className={`group relative rounded-[22px] p-2 text-left transition ${on ? "bg-brown text-cream" : "bg-tile hover:bg-sand"}`}
                  >
                    <span className="block rounded-[16px] p-2.5 aspect-[4/5]" style={{ background: t.page }} aria-hidden="true">
                      <span className="flex h-full flex-col rounded-[10px] overflow-hidden bg-white">
                        <span className="h-[38%]" style={{ background: t.head }} />
                        <span className="flex-1 flex items-center justify-center">
                          <span className="w-1/2 aspect-square rounded-[4px]" style={{ background: t.soft, boxShadow: `inset 0 0 0 3px ${t.ink}22` }} />
                        </span>
                      </span>
                    </span>
                    <span className="mt-2 mb-0.5 px-1 flex items-center justify-between text-sm">
                      {t.label}
                      {on && <Check size={15} aria-hidden="true" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3 · Message */}
          <div className="bento flex flex-col gap-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <StepHead n={3} title="WhatsApp message" hint="Sent with each guest’s personal link." />
              <button type="button" onClick={() => setMessage(DEFAULT_MESSAGE)} disabled={message === DEFAULT_MESSAGE} className="h-10 px-4 rounded-full bg-tile hover:bg-sand text-sm inline-flex items-center gap-1.5 disabled:opacity-40">
                <RotateCcw size={14} aria-hidden="true" /> Reset
              </button>
            </div>
            <div>
              <label htmlFor="msg" className="sr-only">Message template</label>
              <textarea
                id="msg"
                ref={textRef}
                rows={9}
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
        </div>

        {/* Live preview */}
        <aside className="rounded-[36px] bg-brown p-4 sm:p-5 flex flex-col gap-4" aria-label="Preview">
          <div className="flex items-center justify-between gap-3 px-1">
            <p className="text-cream text-[15px]">Preview</p>
            <Segmented
              tone="dark"
              size="sm"
              label="Preview"
              value={view}
              onChange={setView}
              options={[
                { value: "card", label: "Invite" },
                { value: "chat", label: "WhatsApp" },
              ]}
            />
          </div>
          <div key={view} className={`rounded-[28px] overflow-hidden ${previewMotion}`}>
            {view === "card" ? (
              <div className="p-4" style={{ background: THEMES[theme].page }}>
                <TicketCard invite={toInvite(SAMPLE_GUEST, previewEvent)} sample />
              </div>
            ) : (
              <div className="bg-[#E6DDD4] p-4 min-h-[420px] flex flex-col justify-end">
                <div className="ml-auto max-w-[92%] rounded-2xl rounded-tr-sm bg-[#D9FDD3] text-[#111B21] p-1.5 shadow-sm">
                  <div className="rounded-xl bg-white/60 overflow-hidden mb-1.5 flex">
                    <span className="w-1 shrink-0" style={{ background: THEMES[theme].head }} />
                    <span className="px-3 py-2 min-w-0">
                      <span className="block text-[13px] font-medium truncate">{event.name}</span>
                      <span className="block text-xs opacity-60">guestlok.app · Your personal invite</span>
                    </span>
                  </div>
                  <p className="px-2.5 pb-1.5 text-[14px] leading-relaxed whitespace-pre-line break-words">{previewText}</p>
                  <p className="px-2.5 pb-1 text-right text-[11px] opacity-50">12:04 ✓✓</p>
                </div>
              </div>
            )}
          </div>
          <p className="px-1 text-xs text-sand">Sample guest: Adaeze Okafor, admits 2.</p>
        </aside>
      </div>

      {/* Save bar: appears only when something changed */}
      <div
        className={`fixed z-40 left-1/2 lg:left-[calc(50%-219px)] -translate-x-1/2 bottom-[max(1rem,env(safe-area-inset-bottom))] w-[min(94vw,560px)] transition duration-300 ${
          dirty ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0 invisible pointer-events-none"
        }`}
        aria-hidden={!dirty}
      >
        <div className="flex items-center gap-2 rounded-full bg-brown text-cream pl-5 pr-1.5 py-1.5 shadow-[0_18px_40px_rgba(28,18,12,0.35)]">
          <span className="w-2 h-2 rounded-full bg-ochre shrink-0" aria-hidden="true" />
          <span className="flex-1 text-[15px]">Unsaved changes</span>
          <button type="button" onClick={discard} tabIndex={dirty ? 0 : -1} className="h-11 px-4 rounded-full text-sm text-sand hover:text-cream">
            Discard
          </button>
          <button type="button" onClick={save} disabled={saving} tabIndex={dirty ? 0 : -1} className="h-11 px-5 rounded-full bg-ochre text-brown text-sm font-medium inline-flex items-center gap-2">
            {saving && <ButtonSpinner />} Save invitation
          </button>
        </div>
      </div>
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
