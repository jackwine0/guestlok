// A short two-note chime for "someone is waiting at the gate".
// Browsers only allow sound after the person has tapped the page once, so the
// audio is unlocked on the first tap/click and reused after that.

let ctx = null;

function getContext() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  return ctx;
}

if (typeof window !== "undefined") {
  const unlock = () => {
    const c = getContext();
    if (c?.state === "suspended") c.resume().catch(() => {});
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
}

/** Plays the chime (quietly does nothing if the browser blocks sound). */
export function playChime() {
  try {
    const c = getContext();
    if (!c) return;
    if (c.state === "suspended") c.resume().catch(() => {});
    const start = c.currentTime + 0.02;
    [
      [880, 0],
      [1318.5, 0.16],
    ].forEach(([freq, offset]) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = start + offset;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
      osc.connect(gain).connect(c.destination);
      osc.start(t);
      osc.stop(t + 0.6);
    });
  } catch {
    /* sound is a nice-to-have */
  }
}
