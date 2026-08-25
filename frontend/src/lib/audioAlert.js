let audioContext = null;

export function playCheckoutBell() {
  try {
    const AudioCtx =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioCtx) return;

    if (!audioContext) {
      audioContext = new AudioCtx();
    }

    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    const now = audioContext.currentTime;

    // First bell tone
    const osc1 = audioContext.createOscillator();
    const gain1 = audioContext.createGain();

    osc1.type = "sine";
    osc1.frequency.setValueAtTime(1046.5, now);

    gain1.gain.setValueAtTime(0.0001, now);
    gain1.gain.exponentialRampToValueAtTime(0.35, now + 0.01);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);

    osc1.connect(gain1);
    gain1.connect(audioContext.destination);

    osc1.start(now);
    osc1.stop(now + 0.7);

    // Second lower bell tone = Ding-Dong
    const osc2 = audioContext.createOscillator();
    const gain2 = audioContext.createGain();

    osc2.type = "sine";
    osc2.frequency.setValueAtTime(783.99, now + 0.22);

    gain2.gain.setValueAtTime(0.0001, now + 0.22);
    gain2.gain.exponentialRampToValueAtTime(
      0.32,
      now + 0.23
    );
    gain2.gain.exponentialRampToValueAtTime(
      0.0001,
      now + 0.95
    );

    osc2.connect(gain2);
    gain2.connect(audioContext.destination);

    osc2.start(now + 0.22);
    osc2.stop(now + 1.0);
  } catch (error) {
    console.error("Checkout bell error:", error);
  }
}
