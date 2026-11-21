// face.js: the character.
// A "pose" is just a list of numbers. The animator blends between poses.

// ---- Poses. To make a new expression, add a line here. ----
export const PRESETS = {
  //          visible  size   eye shape: corners / top / bottom   iris: size, x, y      lashes  blush  mouths
  hidden:  { alpha: 0, scale: 0.9, c: 120, t: 120, b: 120, irisR: 36, irisDx: 0,   irisDy: -20, lash: 0,  blush: 0, bar: 0, o: 0 },
  calm:    { alpha: 1, scale: 1,   c: 120, t: 30,  b: 210, irisR: 36, irisDx: 0,   irisDy: -20, lash: 28, blush: 0, bar: 0, o: 0 },
  shy:     { alpha: 1, scale: 1,   c: 135, t: 70,  b: 205, irisR: 30, irisDx: -25, irisDy: -4,  lash: 24, blush: 1, bar: 1, o: 0 },
  shocked: { alpha: 1, scale: 1,   c: 120, t: 0,   b: 240, irisR: 32, irisDx: 0,   irisDy: 0,   lash: 30, blush: 0, bar: 0, o: 1 },
};

// The current pose (starts hidden). The animator changes these numbers over time.
const pose = { ...PRESETS.hidden };

// Extra offset for the irises wandering around (set from scene.js)
export const wander = { x: 0, y: 0 };

// ---- Draw the current pose onto the SVG ----
const eyeShapes = document.querySelectorAll(".eye-shape");
const irises = document.querySelectorAll(".iris");
const lashes = document.querySelectorAll(".lashes");
const blushes = document.querySelectorAll(".blush");
const root = document.getElementById("char");
const mouthBar = document.getElementById("mouthBar");
const mouthO = document.getElementById("mouthO");

const about = (x, y, s) => `translate(${x} ${y}) scale(${s}) translate(${-x} ${-y})`;

function render() {
  const p = pose;

  // Eye outline: two curves, top and bottom, sharing the same corners
  const d = `M10,${p.c} Q105,${p.t} 200,${p.c} Q105,${p.b} 10,${p.c} Z`;
  eyeShapes.forEach((s) => s.setAttribute("d", d));

  const topMid = 0.5 * p.c + 0.5 * p.t;
  const botMid = 0.5 * p.c + 0.5 * p.b;
  const centre = (topMid + botMid) / 2;

  irises.forEach((i) => {
    i.setAttribute("cx", 105 + p.irisDx + wander.x);
    i.setAttribute("cy", centre + p.irisDy + wander.y);
    i.setAttribute("r", p.irisR);
  });

  // Lashes sit on the top curve and follow it as the eye opens and closes
  const side = 0.625 * p.c + 0.375 * p.t;
  const L = p.lash;
  const lashD = `M57,${side} L47,${side - L} M105,${topMid} L105,${topMid - L * 1.1} M153,${side} L163,${side - L}`;
  lashes.forEach((l) => {
    l.setAttribute("d", lashD);
    l.setAttribute("opacity", Math.min(1, L / 10));
  });

  blushes.forEach((b) => b.setAttribute("opacity", p.blush));

  mouthBar.setAttribute("opacity", p.bar);
  mouthBar.setAttribute("transform", about(220, 310, 0.6 + 0.4 * p.bar));
  mouthO.setAttribute("opacity", p.o);
  mouthO.setAttribute("transform", about(220, 315, 0.6 + 0.4 * p.o));

  root.setAttribute("opacity", p.alpha);
  root.setAttribute("transform", about(220, 120, p.scale));
}

// ---- The animator ----
const EASE = {
  linear: (k) => k,
  in: (k) => k * k,
  out: (k) => 1 - (1 - k) * (1 - k),
  inOut: (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2),
  back: (k) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); }, // overshoots, bouncy
};

let queue = [];       // keyframe steps waiting to play
let current = null;   // the step playing right now

// play([...steps]). Each step is one of:
//   { to: "shy", dur: 0.3, ease: "back" }              go to a preset
//   { to: "shocked", with: { scale: 1.15 }, dur: 0.1 }  preset with some numbers changed
//   { hold: 1.5 }                                       wait
// dur: 0 is a hard cut (a pure "frame"). Starting a new play() blends from wherever the face is now.
export function play(steps) {
  queue = steps.map((s) => ({
    target: s.hold !== undefined ? {} : { ...(typeof s.to === "string" ? PRESETS[s.to] : s.to), ...s.with },
    dur: s.hold !== undefined ? s.hold : (s.dur ?? 0.3),
    ease: EASE[s.ease || "inOut"],
  }));
  current = null;
}

export function tick(dt) {
  // Start the next step if nothing is playing
  if (!current && queue.length > 0) {
    const step = queue.shift();
    current = { from: { ...pose }, to: step.target, dur: step.dur, ease: step.ease, time: 0 };
  }

  // Blend towards the step's target pose
  if (current) {
    current.time += dt;
    const k = current.dur <= 0 ? 1 : Math.min(1, current.time / current.dur);
    const e = current.ease(k);
    for (const key in current.to) {
      pose[key] = current.from[key] + (current.to[key] - current.from[key]) * e;
    }
    if (k >= 1) current = null;
  }

  render();   // always redraw, so the wandering irises show even when no animation is playing
}