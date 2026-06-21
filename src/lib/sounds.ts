// Lightweight WebAudio beep helpers — no assets, fully offline.
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (Ctor) ctx = new Ctor();
    } catch {
      ctx = null;
    }
  }
  return ctx;
}

function tone(freq: number, duration = 0.18, type: OscillatorType = "sine", volume = 0.18, when = 0) {
  const ac = getCtx();
  if (!ac) return;
  try {
    const start = ac.currentTime + when;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(ac.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  } catch {
    // ignore
  }
}

export const sounds = {
  error: () => {
    tone(380, 0.16, "square", 0.22);
    tone(220, 0.22, "square", 0.22, 0.14);
  },
  warn: () => {
    tone(520, 0.14, "triangle", 0.18);
    tone(520, 0.14, "triangle", 0.18, 0.18);
  },
  success: () => {
    tone(660, 0.12, "sine", 0.18);
    tone(880, 0.16, "sine", 0.18, 0.1);
  },
  click: () => tone(720, 0.05, "sine", 0.1),
};
