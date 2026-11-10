// Simple Web Audio beep — no external asset needed.
// Plays a short two-tone chirp used for New Order alerts on Admin & Delivery dashboards.

let ctx = null;
function getCtx() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return ctx;
}

function tone(freq = 880, startAt = 0, duration = 0.18, gainValue = 0.25) {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime + startAt;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(gainValue, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(gain).connect(c.destination);
  osc.start(now);
  osc.stop(now + duration + 0.05);
}

export function playAlert() {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") {
    c.resume().catch(() => {});
  }
  // Two-tone chirp, repeated once
  tone(880, 0, 0.18, 0.3);
  tone(1175, 0.2, 0.22, 0.3);
  tone(880, 0.55, 0.18, 0.25);
  tone(1175, 0.75, 0.22, 0.25);
}
