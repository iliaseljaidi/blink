// audio.js: all the sounds. Nothing plays until startAudio() runs (browsers need a click first).
let enabled = false;

// Longest each one-shot may play (seconds). Longer files get a quick fade-out there.
const MAX = {
  "eyes-open": 1.2,
  "eyes-shut": 0.8,
  "gasp-shocked": 1.5,
  "shy-eep": 1.5,
  "angry-growl": 2,
  "burst-pop": 1.2,
};

// Some files start with silence. Skip this many seconds at the start.
const SKIP = {
  "angry-growl": 0.5,
  "shy-eep": 0.5,
};

const path = (name) => `sound-effects/${name}.mp3`;

// Smoothly change a sound's volume over `secs` seconds
function fade(a, to, secs, done) {
  clearInterval(a._fade);
  const from = a.volume;
  const steps = Math.max(1, Math.round(secs * 30));
  let i = 0;
  a._fade = setInterval(() => {
    i++;
    a.volume = Math.min(1, Math.max(0, from + (to - from) * (i / steps)));
    if (i >= steps) { clearInterval(a._fade); if (done) done(); }
  }, 33);
}

export function startAudio() {
  enabled = true;
  for (const name of Object.keys(MAX)) new Audio(path(name)).load();   // warm up so they play instantly
}

// A one-shot sound
// A one-shot sound
export function sfx(name, volume = 0.8, max = MAX[name] || 2) {
  if (!enabled) return;
  const a = new Audio(path(name));
  a.volume = volume;
  const skip = SKIP[name] || 0;
  if (skip) a.addEventListener("loadedmetadata", () => { a.currentTime = skip; }, { once: true });
  a.play().catch(() => {});
  setTimeout(() => fade(a, 0, 0.15, () => a.pause()), Math.max(0, max * 1000 - 150));
}

// Looping sounds (ambient, heartbeat): fade in when switched on, fade out when off
const loops = {};
export function loopOn(name, volume = 0.5) {
  if (!enabled) return;
  let a = loops[name];
  if (!a) { a = loops[name] = new Audio(path(name)); a.loop = true; a.volume = 0; }
  if (a._on) return;
  a._on = true;
  a.play().catch(() => {});
  fade(a, volume, 1.5);
}
export function loopOff(name) {
  const a = loops[name];
  if (!a || !a._on) return;
  a._on = false;
  fade(a, 0, 0.5, () => { if (!a._on) a.pause(); });
}