import {
  Camera,
  Check,
  Clock,
  Flashlight,
  FlashlightOff,
  MessageCircleQuestion,
  Pause,
  Play,
  QrCode,
  RefreshCw,
  Search,
  Users,
  Volume2,
  VolumeX,
  WifiOff,
  X,
} from "lucide-react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { ButtonSpinner, KeyholeDisc, Loader, Wordmark } from "../components/Brand.jsx";
import { MessageScreen } from "../components/Page.jsx";
import Segmented from "../components/Segmented.jsx";
import { useSwapMotion } from "../lib/tabTransition.js";
import { extractToken, formatEventTime } from "../lib/format.js";
import { supabase } from "../lib/supabase.js";
import { useTitle } from "../lib/useTitle.js";

const SOUND_KEY = "gl_scanner_sound";

/* ------------------------------------------------------------------------- */
/* Small device helpers                                                      */
/* ------------------------------------------------------------------------- */

let audioCtx;
/** Short beeps so ushers don't have to look at the screen for every guest. */
function beep(kind) {
  try {
    audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
    const tones = kind === "valid" ? [[880, 0, 0.12], [1320, 0.12, 0.16]] : [[220, 0, 0.18], [180, 0.22, 0.22]];
    for (const [freq, start, len] of tones) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = kind === "valid" ? "sine" : "square";
      osc.frequency.value = freq;
      const t = audioCtx.currentTime + start;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + len);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + len + 0.02);
    }
  } catch {
    /* no audio: fine */
  }
}

/** Keep the phone screen on while the gate is open. */
function useWakeLock() {
  useEffect(() => {
    let lock = null;
    const grab = async () => {
      try {
        if ("wakeLock" in navigator && document.visibilityState === "visible") lock = await navigator.wakeLock.request("screen");
      } catch {
        /* not supported / denied */
      }
    };
    grab();
    document.addEventListener("visibilitychange", grab);
    return () => {
      document.removeEventListener("visibilitychange", grab);
      lock?.release?.().catch(() => {});
    };
  }, []);
}

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

/* ------------------------------------------------------------------------- */

export default function Scanner() {
  const { eventId = "" } = useParams();
  const [params] = useSearchParams();
  const key = params.get("k") ?? "";

  const [info, setInfo] = useState(undefined);
  const [tab, setTab] = useState("scan");
  const modeMotion = useSwapMotion(tab === "scan" ? 0 : 1);
  const [result, setResult] = useState(null);
  const [asking, setAsking] = useState(null); // { name } while asking the host
  const [recent, setRecent] = useState([]);
  const [sound, setSound] = useState(() => {
    try {
      return localStorage.getItem(SOUND_KEY) !== "off";
    } catch {
      return true;
    }
  });
  const online = useOnline();
  useWakeLock();

  const refreshInfo = useCallback(async () => {
    const { data, error } = await supabase.rpc("scanner_event", { p_event: eventId, p_key: key });
    // Keep the last good numbers on a network blip; only close on a clear "no".
    if (error) setInfo((cur) => (cur === undefined ? null : cur));
    else setInfo(data ?? null);
  }, [eventId, key]);

  useEffect(() => {
    refreshInfo();
    const t = setInterval(refreshInfo, 20_000);
    return () => clearInterval(t);
  }, [refreshInfo]);

  const soundRef = useRef(sound);
  soundRef.current = sound;

  const showResult = useCallback(
    (res) => {
      setResult(res);
      const good = res.result === "valid";
      if ("vibrate" in navigator) navigator.vibrate(good ? 80 : [120, 80, 120]);
      if (soundRef.current) beep(good ? "valid" : "bad");
      if (res.result === "invalid_key") {
        setInfo(null);
        return;
      }
      setRecent((list) => [{ ...res, at: Date.now() }, ...list].slice(0, 30));
      refreshInfo();
    },
    [refreshInfo],
  );

  function toggleSound() {
    setSound((s) => {
      const next = !s;
      try {
        localStorage.setItem(SOUND_KEY, next ? "on" : "off");
      } catch {
        /* ignore */
      }
      if (next) beep("valid");
      return next;
    });
  }

  useTitle(info?.event_name ? `Gate · ${info.event_name}` : "Gate scanner");
  if (info === undefined) return <Loader fullScreen label="Opening the gate" />;

  if (info === null) {
    return (
      <MessageScreen
        tone="dark"
        kicker="Gate scanner"
        title="Scanner closed."
        body="This link is invalid, or the event has ended. Ask the host for the current scanner link."
      />
    );
  }

  const pct = info.invited_people ? Math.min(1, info.arrived_people / info.invited_people) : 0;

  const modeSwitch = (
    <Segmented
      tone="dark"
      size="lg"
      fill
      label="Check-in mode"
      value={tab}
      onChange={setTab}
      options={[
        { value: "scan", label: "Scan QR", icon: QrCode },
        { value: "find", label: "Find by name", icon: Search },
      ]}
      className="flex-1 [&>button]:!h-12"
    />
  );
  const soundButton = (
    <button
      type="button"
      onClick={toggleSound}
      aria-pressed={sound}
      aria-label={sound ? "Mute scan sounds" : "Turn scan sounds on"}
      title={sound ? "Sounds on" : "Sounds off"}
      className="w-11 h-11 shrink-0 rounded-full bg-white/10 inline-flex items-center justify-center"
    >
      {sound ? <Volume2 size={19} aria-hidden="true" /> : <VolumeX size={19} aria-hidden="true" />}
    </button>
  );
  const offline = !online && (
    <p role="status" className="rounded-full bg-coral text-brown px-4 py-2 text-sm font-medium inline-flex items-center gap-2">
      <WifiOff size={16} aria-hidden="true" /> No internet. Scans can’t be checked until you’re back online.
    </p>
  );

  return (
    <div className="h-dvh bg-brown text-cream overflow-hidden">
      <div className="mx-auto h-full w-full max-w-md md:max-w-2xl lg:max-w-[1280px] flex flex-col lg:flex-row lg:gap-5 lg:p-5">
        {/* ---------- Main column: camera / name search ---------- */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col">
          {/* Phone top bar */}
          <header className="lg:hidden px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 flex items-center gap-3">
            <CountRing pct={pct} />
            <div className="min-w-0 flex-1">
              <p className="text-[22px] leading-none tabular-nums">
                {info.arrived_people}
                <span className="text-sand text-[15px]"> / {info.invited_people} in</span>
              </p>
              <p className="truncate text-[13px] text-sand mt-1">{info.event_name}</p>
            </div>
            {soundButton}
          </header>

          {offline && <div className="mx-4 mb-2 lg:mx-0 lg:mb-3">{offline}</div>}

          <main key={tab} className={`flex-1 min-h-0 px-3 lg:px-0 flex flex-col ${modeMotion}`}>
            {tab === "scan" ? (
              <ScanTab
                key={tab}
                eventId={eventId}
                scannerKey={key}
                paused={!!result || !!asking}
                onResult={showResult}
                onCameraFail={() => setTab("find")}
              />
            ) : (
              <div className="flex-1 min-h-0 flex flex-col lg:rounded-[32px] lg:bg-white/[0.04] lg:p-6">
                <FindTab eventId={eventId} scannerKey={key} onResult={showResult} onAsk={(name) => setAsking({ name })} />
              </div>
            )}
          </main>

          {/* Phone dock */}
          <footer className="lg:hidden px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex flex-col gap-3">
            {recent.length > 0 && <RecentStrip items={recent.slice(0, 6)} />}
            <div className="flex items-center gap-2">
              {modeSwitch}
              <button
                type="button"
                onClick={() => setAsking({ name: "" })}
                aria-label="Ask the host about someone not on the list"
                title="Ask the host"
                className="w-14 h-14 shrink-0 rounded-full bg-white/10 inline-flex items-center justify-center"
              >
                <MessageCircleQuestion size={21} aria-hidden="true" />
              </button>
            </div>
          </footer>
        </div>

        {/* ---------- Side panel (tablet / desktop) ---------- */}
        <aside className="hidden lg:flex w-[360px] xl:w-[400px] shrink-0 min-h-0 flex-col gap-4">
          <div className="rounded-[32px] bg-white/[0.06] p-6">
            <div className="flex items-center justify-between gap-3">
              <Wordmark disc="#EEB12F" hole="#2B1B12" className="text-[24px] text-ochre" />
              {soundButton}
            </div>
            <p className="mt-5 text-sand text-sm truncate">{info.event_name}</p>
            <div className="mt-3 flex items-center gap-4">
              <CountRing pct={pct} size={84} />
              <div>
                <p className="text-[52px] leading-none tracking-[-0.04em] tabular-nums">{info.arrived_people}</p>
                <p className="mt-1 text-sand">of {info.invited_people} guests in</p>
              </div>
            </div>
            <div className="mt-5 h-2 rounded-full bg-white/10 overflow-hidden" aria-hidden="true">
              <i className="block h-full rounded-full bg-ochre transition-[width] duration-700" style={{ width: `${pct * 100}%` }} />
            </div>
            <p className="mt-2 text-xs text-sand">{Math.max(0, info.invited_people - info.arrived_people)} still expected</p>
          </div>

          <div className="flex flex-col gap-2.5">
            <div className="flex">{modeSwitch}</div>
            <button type="button" onClick={() => setAsking({ name: "" })} className="h-12 rounded-full bg-white/10 hover:bg-white/15 inline-flex items-center justify-center gap-2 text-[15px] transition">
              <MessageCircleQuestion size={18} aria-hidden="true" /> Not on the list? Ask the host
            </button>
          </div>

          <div className="flex-1 min-h-0 rounded-[32px] bg-white/[0.06] p-5 flex flex-col">
            <p className="text-sm text-sand">Recent at this device</p>
            {recent.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 text-sand py-6">
                <QrCode size={28} aria-hidden="true" />
                <p className="text-[15px]">Scans appear here as guests arrive.</p>
              </div>
            ) : (
              <ul className="mt-3 flex-1 min-h-0 overflow-y-auto -mx-1 px-1 flex flex-col gap-1.5 [scrollbar-width:thin]">
                {recent.map((r) => {
                  const st = RECENT_STYLE[r.result] ?? RECENT_STYLE.not_invited;
                  return (
                    <li key={r.at} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 hover:bg-white/[0.05]">
                      <span className={`w-2.5 h-2.5 shrink-0 rounded-full ${st.dot}`} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px]">{r.guest_name ?? "Unknown code"}</span>
                        <span className="block text-xs text-sand">
                          {st.label}
                          {r.result === "valid" && r.admits ? ` · admits ${r.admits}` : ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm text-sand tabular-nums">{formatEventTime(new Date(r.at).toISOString())}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
      </div>

      {result && (
        <ResultOverlay
          result={result}
          onClose={() => setResult(null)}
          onAsk={() => {
            setResult(null);
            setAsking({ name: "" });
          }}
        />
      )}
      {asking && (
        <AskHost
          eventId={eventId}
          scannerKey={key}
          initialName={asking.name}
          onClose={() => {
            setAsking(null);
            refreshInfo();
          }}
        />
      )}
    </div>
  );
}

/** Little progress ring with the keyhole in the middle. */
function CountRing({ pct, size = 48 }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 48 48" className="w-full h-full -rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="4" />
        <circle cx="24" cy="24" r={r} fill="none" stroke="#EEB12F" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} className="transition-[stroke-dasharray] duration-700" />
      </svg>
      <KeyholeDisc className="absolute inset-[27%]" disc="#EEB12F" hole="#2B1B12" />
    </div>
  );
}

const RECENT_STYLE = {
  valid: { dot: "bg-leaf", label: "In" },
  used: { dot: "bg-coral", label: "Used" },
  not_invited: { dot: "bg-cream", label: "Not invited" },
};

function RecentStrip({ items }) {
  return (
    <div>
      <p className="px-1 mb-1.5 text-xs text-sand">Recent at this phone</p>
      <ul className="flex gap-2 overflow-x-auto [scrollbar-width:none] -mx-3 px-3">
        {items.map((r) => {
          const s = RECENT_STYLE[r.result] ?? RECENT_STYLE.not_invited;
          return (
            <li key={r.at} className="shrink-0 max-w-[200px] h-10 pl-2.5 pr-3.5 rounded-full bg-white/10 inline-flex items-center gap-2 text-sm">
              <span className={`w-2.5 h-2.5 shrink-0 rounded-full ${s.dot}`} aria-hidden="true" />
              <span className="truncate">{r.guest_name ?? s.label}</span>
              <span className="shrink-0 text-sand tabular-nums">{formatEventTime(new Date(r.at).toISOString())}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Camera                                                                    */
/* ------------------------------------------------------------------------- */

function ScanTab({ eventId, scannerKey, paused, onResult, onCameraFail }) {
  const containerRef = useRef(null);
  const readerRef = useRef(null);
  const busyRef = useRef(false);
  const pausedRef = useRef(paused);
  const lastRef = useRef(null);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState("starting"); // starting | ready | error
  const [checking, setChecking] = useState(false);
  const [torch, setTorch] = useState({ supported: false, on: false });
  const [held, setHeld] = useState(false); // usher tapped Pause

  pausedRef.current = paused || held;

  // When a result screen closes, ignore the same code for 8 more seconds,
  // so a guest still holding their phone up isn't scanned again as "Used".
  useEffect(() => {
    if (!paused && lastRef.current) lastRef.current.at = Date.now();
  }, [paused]);

  // Latest decode handler, so the camera effect never needs to restart.
  const onDecodeRef = useRef(null);
  onDecodeRef.current = async (data) => {
    if (busyRef.current || pausedRef.current) return;
    const token = extractToken(data);
    const now = Date.now();
    // Ignore the same code held in front of the camera for a few seconds.
    if (token && lastRef.current?.token === token && now - lastRef.current.at < 8000) return;
    busyRef.current = true;
    setChecking(true);
    try {
      if (!token) {
        onResult({ result: "not_invited" });
        return;
      }
      lastRef.current = { token, at: now };
      const { data: res, error } = await supabase.rpc("scanner_check_in", { p_event: eventId, p_key: scannerKey, p_token: token });
      onResult(error ? { result: "not_invited" } : res);
    } finally {
      busyRef.current = false;
      setChecking(false);
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    setState("starting");

    // A fresh element per mount avoids clashes when React mounts twice in dev.
    const el = document.createElement("div");
    el.id = `gl-reader-${Math.random().toString(36).slice(2)}`;
    el.className = "gl-reader absolute inset-0";
    container.prepend(el);

    let unmounted = false;
    let resizeObs = null;
    const reader = new Html5Qrcode(el.id, { formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE], verbose: false });
    readerRef.current = reader;

    const starting = reader
      .start({ facingMode: "environment" }, { fps: 10, disableFlip: true }, (text) => onDecodeRef.current?.(text), () => {})
      .then(() => {
        if (unmounted) return;
        setState("ready");
        // Fill the frame like a camera app (scale only; the decoder still sees the full image).
        const video = el.querySelector("video");
        const fit = () => {
          if (!video || !video.clientWidth || !video.clientHeight) return;
          const k = Math.max(1, container.clientHeight / video.clientHeight, container.clientWidth / video.clientWidth);
          video.style.transform = `scale(${k})`;
        };
        for (const ev of ["loadedmetadata", "playing", "resize"]) video?.addEventListener(ev, fit);
        fit();
        setTimeout(fit, 300);
        setTimeout(fit, 1200);
        resizeObs = new ResizeObserver(fit);
        resizeObs.observe(container);
        try {
          const caps = reader.getRunningTrackCapabilities?.();
          setTorch({ supported: !!caps?.torch, on: false });
        } catch {
          /* no torch info */
        }
      })
      .catch(() => {
        if (!unmounted) setState("error");
      });

    return () => {
      unmounted = true;
      resizeObs?.disconnect();
      readerRef.current = null;
      starting.finally(async () => {
        try {
          if (reader.isScanning) await reader.stop();
          reader.clear();
        } catch {
          /* already stopped */
        }
        el.remove();
      });
    };
  }, [attempt]);

  // Pause freezes the camera and stops reading codes until the usher taps Resume.
  function togglePause() {
    const reader = readerRef.current;
    const next = !held;
    setHeld(next);
    try {
      if (next) {
        if (torch.on) toggleTorch();
        reader?.pause(true);
      } else reader?.resume();
    } catch {
      /* camera not running yet; the ref above still blocks decoding */
    }
  }

  async function toggleTorch() {
    const next = !torch.on;
    try {
      await readerRef.current?.applyVideoConstraints({ advanced: [{ torch: next }] });
      setTorch((t) => ({ ...t, on: next }));
    } catch {
      setTorch({ supported: false, on: false });
    }
  }

  return (
    <div ref={containerRef} className="relative flex-1 min-h-[300px] rounded-[32px] overflow-hidden bg-black">
      {/* Viewfinder: dimmed surround, ochre corners, glowing line */}
      {state !== "error" && !held && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className={`relative w-[72%] max-w-[290px] md:max-w-[380px] aspect-square rounded-[28px] shadow-[0_0_0_9999px_rgba(20,12,8,0.55)] transition ${checking ? "scale-[0.97]" : ""}`}>
            {["left-0 top-0 border-l-4 border-t-4 rounded-tl-[28px]", "right-0 top-0 border-r-4 border-t-4 rounded-tr-[28px]", "left-0 bottom-0 border-l-4 border-b-4 rounded-bl-[28px]", "right-0 bottom-0 border-r-4 border-b-4 rounded-br-[28px]"].map((c) => (
              <span key={c} className={`absolute w-12 h-12 ${checking ? "border-cream" : "border-ochre"} transition-colors ${c}`} />
            ))}
            {state === "ready" && !checking && (
              <span className="gl-scan absolute left-5 right-5 h-[3px] rounded-full bg-ochre shadow-[0_0_18px_4px_rgba(238,177,47,0.55)]" />
            )}
          </div>
          <p className="mt-5 h-9 px-4 rounded-full bg-black/45 backdrop-blur text-[14px] inline-flex items-center gap-2">
            {state === "starting" ? (
              <>
                <ButtonSpinner /> Opening camera…
              </>
            ) : checking ? (
              <>
                <ButtonSpinner /> Checking the list…
              </>
            ) : (
              "Hold the QR code inside the square"
            )}
          </p>
        </div>
      )}

      {state === "ready" && !held && (
        <button
          type="button"
          onClick={togglePause}
          aria-label="Pause scanning"
          className="absolute left-4 top-4 z-10 h-12 pl-4 pr-5 rounded-full inline-flex items-center gap-2 text-[15px] font-medium backdrop-blur transition bg-black/45 text-cream"
        >
          <Pause size={18} aria-hidden="true" /> Pause
        </button>
      )}

      {held && state === "ready" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center bg-[#1F140D]/80 backdrop-blur-sm">
          <span className="w-16 h-16 rounded-full bg-white/10 inline-flex items-center justify-center">
            <Pause size={26} aria-hidden="true" />
          </span>
          <p className="text-[22px] tracking-[-0.02em]">Scanning paused</p>
          <p className="text-sand text-[15px] max-w-xs">No codes are read while paused. Tap resume when the next guest is ready.</p>
          <button type="button" onClick={togglePause} className="btn-ochre btn-lg mt-1">
            <Play size={17} aria-hidden="true" /> Resume scanning
          </button>
        </div>
      )}

      {state === "ready" && torch.supported && !held && (
        <button
          type="button"
          onClick={toggleTorch}
          aria-pressed={torch.on}
          aria-label={torch.on ? "Turn torch off" : "Turn torch on"}
          className={`absolute right-4 top-4 w-12 h-12 rounded-full inline-flex items-center justify-center backdrop-blur transition ${torch.on ? "bg-ochre text-brown" : "bg-black/45 text-cream"}`}
        >
          {torch.on ? <Flashlight size={20} aria-hidden="true" /> : <FlashlightOff size={20} aria-hidden="true" />}
        </button>
      )}

      {state === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center bg-[#1F140D]">
          <span className="w-16 h-16 rounded-full bg-white/10 inline-flex items-center justify-center">
            <Camera size={26} aria-hidden="true" />
          </span>
          <p className="text-[22px] tracking-[-0.02em]">Camera is off</p>
          <p className="text-sand text-[15px] max-w-xs">Allow camera access in your browser settings, then try again. You can still check people in by name.</p>
          <div className="flex flex-col w-full max-w-xs gap-2.5 mt-1">
            <button type="button" onClick={() => setAttempt((n) => n + 1)} className="btn-ochre btn-lg">
              <RefreshCw size={17} aria-hidden="true" /> Try again
            </button>
            <button type="button" onClick={onCameraFail} className="btn btn-lg bg-white/10 text-cream">
              <Search size={17} aria-hidden="true" /> Find by name
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Find by name                                                              */
/* ------------------------------------------------------------------------- */

function FindTab({ eventId, scannerKey, onResult, onAsk }) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState([]);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const search = useCallback(
    async (q) => {
      if (q.trim().length < 2) {
        setRows([]);
        return;
      }
      setSearching(true);
      const { data } = await supabase.rpc("scanner_search", { p_event: eventId, p_key: scannerKey, p_query: q });
      setRows(data ?? []);
      setSearching(false);
    },
    [eventId, scannerKey],
  );

  useEffect(() => {
    const t = setTimeout(() => search(query), 300);
    return () => clearTimeout(t);
  }, [query, search]);

  async function checkIn(row) {
    setBusyId(row.id);
    const { data, error } = await supabase.rpc("scanner_manual_check_in", { p_event: eventId, p_key: scannerKey, p_guest: row.id });
    setBusyId(null);
    onResult(error ? { result: "not_invited" } : data);
    search(query);
  }

  const typed = query.trim().length >= 2;

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      <div className="relative">
        <label htmlFor="lookup" className="sr-only">Guest name</label>
        <Search size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-brown-soft pointer-events-none" aria-hidden="true" />
        <input
          id="lookup"
          type="search"
          autoFocus
          autoComplete="off"
          placeholder="Type the guest’s name"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full h-14 rounded-full bg-cream text-brown pl-14 pr-5 text-lg outline-none placeholder:text-brown-soft focus:ring-4 focus:ring-ochre/40"
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1 flex flex-col gap-2">
        {!typed && (
          <div className="rounded-[24px] bg-white/[0.06] p-5 text-sand text-[15px] flex gap-3">
            <Users size={20} className="shrink-0 mt-0.5" aria-hidden="true" />
            <p>For guests without their phone. Ask for ID or the last 4 digits of their number before you check them in.</p>
          </div>
        )}
        {searching && rows.length === 0 && <p className="px-2 text-sand">Searching…</p>}

        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.id} className="rounded-[24px] bg-white/[0.08] p-3 pl-4 flex items-center gap-3">
              <span className={`w-11 h-11 shrink-0 rounded-full inline-flex items-center justify-center text-sm font-medium ${r.checked_in_at ? "bg-white/10" : "bg-ochre text-brown"}`} aria-hidden="true">
                {r.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[17px] truncate">{r.name}</p>
                <p className="text-[13px] text-sand">
                  Admits {r.admits}
                  {r.phone_last4 && ` · phone ends ${r.phone_last4}`}
                </p>
              </div>
              {r.checked_in_at ? (
                <span className="shrink-0 text-[13px] px-3 py-1.5 rounded-full bg-coral text-brown font-medium">In {formatEventTime(r.checked_in_at)}</span>
              ) : (
                <button type="button" disabled={busyId === r.id} onClick={() => checkIn(r)} className="shrink-0 btn-ochre h-11 px-5">
                  {busyId === r.id ? <ButtonSpinner /> : <Check size={17} aria-hidden="true" />} Check in
                </button>
              )}
            </li>
          ))}
        </ul>

        {!searching && typed && rows.length === 0 && (
          <div className="rounded-[24px] bg-white/[0.06] p-5 flex flex-col gap-3">
            <p className="text-[17px]">Nobody called “{query.trim()}” on the list.</p>
            <p className="text-sand text-[15px]">Check the spelling, or try their surname. If they insist they were invited, ask the host.</p>
            <button type="button" onClick={() => onAsk(query.trim())} className="btn-ochre self-start">
              <MessageCircleQuestion size={18} aria-hidden="true" /> Ask the host
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Result screens                                                            */
/* ------------------------------------------------------------------------- */

const VIEWS = {
  valid: { bg: "bg-leaf text-white", icon: Check, kicker: "Valid", word: "Let them in", ms: 2600 },
  used: { bg: "bg-coral text-brown", icon: Clock, kicker: "Already used", word: "Stop", ms: 5000 },
  not_invited: { bg: "bg-cream text-brown", icon: X, kicker: "Not on the list", word: "Not invited", ms: 0 },
  inactive: { bg: "bg-cream text-brown", icon: X, kicker: "Gate closed", word: "Scanner closed", ms: 5000 },
};

function ResultOverlay({ result, onClose, onAsk }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const view = VIEWS[result.result] ?? VIEWS.not_invited;
  const Icon = view.icon;

  useEffect(() => {
    // "Not invited" waits for the usher: they may want to ask the host.
    if (!view.ms) return;
    const t = setTimeout(() => closeRef.current(), view.ms);
    return () => clearTimeout(t);
  }, [result, view.ms]);

  const name = result.guest_name;
  const admits = result.admits ?? 0;

  const body = (
    <>
      <div className="flex items-center gap-3">
        <span className="w-14 h-14 rounded-full bg-black/10 inline-flex items-center justify-center">
          <Icon size={30} strokeWidth={2.6} aria-hidden="true" />
        </span>
        <span className="font-mono text-sm uppercase tracking-[0.16em]">{view.kicker}</span>
      </div>

      <div className="flex-1 flex flex-col justify-center py-6">
        {result.result === "valid" && name ? (
          <>
            <p className="font-serif text-[clamp(48px,11vw,128px)] leading-[0.98] break-words">{name}</p>
            <div className="mt-6 flex items-center gap-4">
              <span className="text-[56px] leading-none tracking-[-0.04em] tabular-nums">{admits}</span>
              <div>
                <p className="text-lg leading-tight">{admits === 1 ? "person" : "people"}</p>
                <div className="mt-1.5 flex flex-wrap gap-1" aria-hidden="true">
                  {Array.from({ length: Math.min(admits, 10) }, (_, i) => (
                    <span key={i} className="w-3.5 h-3.5 rounded-full bg-white" />
                  ))}
                </div>
              </div>
            </div>
            {admits > 1 && <p className="mt-4 text-lg opacity-90">Let all {admits} in together.</p>}
          </>
        ) : result.result === "used" ? (
          <>
            <p className="text-[clamp(64px,20vw,140px)] tracking-[-0.05em] leading-[0.9]">{view.word}</p>
            <p className="mt-5 text-xl">
              {name ? <b className="font-medium">{name}</b> : "This invite"} was already scanned
              {result.checked_in_at ? ` at ${formatEventTime(result.checked_in_at)}` : ""}.
            </p>
            <p className="mt-2 text-lg opacity-80">Someone may have forwarded the invite. Ask for their name and check with the host.</p>
          </>
        ) : (
          <>
            <p className="text-[clamp(56px,17vw,120px)] tracking-[-0.05em] leading-[0.92]">{view.word}</p>
            <p className="mt-5 text-xl">{result.result === "not_invited" ? "This code isn’t on the guest list." : "Ask the host for a new link."}</p>
          </>
        )}
      </div>
    </>
  );

  if (result.result === "not_invited") {
    return (
      <div role="alertdialog" aria-live="assertive" aria-label="Not invited" className={`gl-fade fixed inset-0 z-50 ${view.bg} flex flex-col px-7 md:px-[max(3rem,calc((100vw-52rem)/2))] pt-[max(2rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]`}>
        {body}
        <div className="grid gap-2.5">
          <button type="button" onClick={onClose} className="btn-dark btn-lg h-14">
            <QrCode size={18} aria-hidden="true" /> Scan next guest
          </button>
          <button type="button" onClick={onAsk} className="btn-outline btn-lg h-14">
            <MessageCircleQuestion size={18} aria-hidden="true" /> They insist? Ask the host
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClose}
      aria-live="assertive"
      className={`gl-fade fixed inset-0 z-50 ${view.bg} flex flex-col px-7 md:px-[max(3rem,calc((100vw-52rem)/2))] pt-[max(2rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] text-left`}
    >
      {body}
      <div className="w-full">
        <div className="h-1.5 rounded-full bg-black/15 overflow-hidden" aria-hidden="true">
          <div key={`${result.result}-${name}`} className="h-full bg-current gl-countdown" style={{ animationDuration: `${view.ms}ms` }} />
        </div>
        <p className="mt-3 text-sm opacity-80">Tap anywhere to scan the next guest</p>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------------- */
/* Ask the host                                                              */
/* ------------------------------------------------------------------------- */

/** Usher asks the host about someone who isn't on the list, then waits for a yes or no. */
function AskHost({ eventId, scannerKey, initialName, onClose }) {
  const [name, setName] = useState(initialName);
  const [admits, setAdmits] = useState(1);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [requestId, setRequestId] = useState(null);
  const [answer, setAnswer] = useState(null); // 'approved' | 'declined'

  useEffect(() => {
    if (!requestId || answer) return;
    const poll = async () => {
      const { data } = await supabase.rpc("scanner_request_status", { p_event: eventId, p_key: scannerKey, p_request: requestId });
      if (data?.result === "approved" || data?.result === "declined") {
        setAnswer(data.result);
        if ("vibrate" in navigator) navigator.vibrate(data.result === "approved" ? 80 : [120, 80, 120]);
        beep(data.result === "approved" ? "valid" : "bad");
      }
    };
    const t = setInterval(poll, 3000);
    return () => clearInterval(t);
  }, [requestId, answer, eventId, scannerKey]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.rpc("scanner_request", { p_event: eventId, p_key: scannerKey, p_name: name, p_note: note, p_admits: admits });
    setBusy(false);
    if (error) {
      setError("Couldn’t reach the host. Check your connection and try again.");
      return;
    }
    if (data?.result === "sent") setRequestId(data.id);
    else if (data?.result === "too_many") setError("The host already has a lot of requests waiting. Try again in a minute.");
    else if (data?.result === "invalid_key") setError("This scanner link is closed.");
    else setError("Type the person’s name first.");
  }

  if (answer) {
    const yes = answer === "approved";
    return (
      <button type="button" onClick={onClose} aria-live="assertive" className={`gl-fade fixed inset-0 z-50 flex flex-col px-7 md:px-[max(3rem,calc((100vw-52rem)/2))] pt-[max(2rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] text-left ${yes ? "bg-leaf text-white" : "bg-coral text-brown"}`}>
        <div className="flex items-center gap-3">
          <span className="w-14 h-14 rounded-full bg-black/10 inline-flex items-center justify-center">
            {yes ? <Check size={30} strokeWidth={2.6} aria-hidden="true" /> : <X size={30} strokeWidth={2.6} aria-hidden="true" />}
          </span>
          <span className="font-mono text-sm uppercase tracking-[0.16em]">The host answered</span>
        </div>
        <div className="flex-1 flex flex-col justify-center">
          <p className="text-[clamp(56px,17vw,120px)] tracking-[-0.05em] leading-[0.92]">{yes ? "Let in" : "Host said no"}</p>
          <p className="mt-5 text-xl">
            {yes ? `${name}, admits ${admits}. They’re on the list now.` : `Politely let ${name} know they can’t come in.`}
          </p>
        </div>
        <p className="text-sm opacity-80">Tap anywhere to go back to the gate</p>
      </button>
    );
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="ask-title" className="gl-fade fixed inset-0 z-50 bg-brown text-cream overflow-y-auto">
      <div className="mx-auto max-w-md min-h-full flex flex-col px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between">
          <h2 id="ask-title" className="hero-title">Ask the host</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center">
            <X size={20} />
          </button>
        </div>

        {requestId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-5">
            <div className="relative">
              <span className="absolute inset-0 rounded-full bg-ochre/30 animate-ping" aria-hidden="true" />
              <KeyholeDisc className="relative w-20 h-20" disc="#EEB12F" hole="#2B1B12" />
            </div>
            <p className="text-[26px] tracking-[-0.02em]">Waiting for the host…</p>
            <p className="text-sand max-w-xs">Ask {name} to wait by the side. This screen changes the moment the host answers.</p>
            <button type="button" onClick={onClose} className="btn bg-white/10 text-cream mt-4">Back to scanning</button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
            <p className="text-sand">The host sees this on their dashboard and says yes or no. Only send it if the person insists they were invited.</p>
            <div>
              <label htmlFor="ask-name" className="block text-sm mb-1.5 text-sand">Their name</label>
              <input id="ask-name" required maxLength={120} autoFocus value={name} onChange={(e) => setName(e.target.value)} className="w-full h-14 rounded-2xl bg-cream text-brown px-5 text-lg outline-none focus:ring-4 focus:ring-ochre/40" />
            </div>
            <div>
              <span id="ask-admits-label" className="block text-sm mb-1.5 text-sand">How many people</span>
              <div className="flex gap-1.5" role="radiogroup" aria-labelledby="ask-admits-label">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={admits === n}
                    onClick={() => setAdmits(n)}
                    className={`flex-1 h-12 rounded-2xl text-lg tabular-nums transition ${admits === n ? "bg-ochre text-brown font-medium" : "bg-white/10"}`}
                  >
                    {n}
                    {n === 5 ? "+" : ""}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="ask-note" className="block text-sm mb-1.5 text-sand">What they said <span className="opacity-70">(optional)</span></label>
              <input id="ask-note" maxLength={200} placeholder="“I’m the bride’s aunt”" value={note} onChange={(e) => setNote(e.target.value)} className="w-full h-14 rounded-2xl bg-cream text-brown px-5 text-lg outline-none placeholder:text-brown-soft focus:ring-4 focus:ring-ochre/40" />
            </div>
            {error && <p role="alert" className="rounded-2xl bg-coral text-brown px-4 py-3 font-medium">{error}</p>}
            <button type="submit" disabled={busy} className="btn-ochre btn-lg h-14 mt-2">
              {busy ? <ButtonSpinner /> : <MessageCircleQuestion size={18} aria-hidden="true" />} Send to host
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
