// face.js: the character.
// A "pose" is just a list of numbers. The animator blends between poses.

// Every pose starts from these defaults (this is the calm face)
const BASE = {
  alpha: 1, scale: 1,                          // visibility and size
  c: 120, t: 30, b: 210,                       // eye shape: corners / top curve / bottom curve
  irisR: 36, irisDx: 0, irisDy: -20,           // iris size and position
  lash: 28, blush: 0,                          // lash length, blush visibility
  bar: 0, o: 0, fang: 0,                       // which mouth shows
  browA: -100, browB: -100,                    // brow edge height at the outer / inner end (-100 = no brow)
  shake: 0,                                    // trembling
};

// ---- Poses. To make a new expression, add a line here. ----
export const PRESETS = {
  hidden:  { ...BASE, alpha: 0, scale: 0.9, t: 120, b: 120, lash: 0 },
  calm:    { ...BASE },
  shy:     { ...BASE, c: 135, t: 70, b: 205, irisR: 30, irisDx: -25, irisDy: -4, lash: 24, blush: 1, bar: 1 },
  shocked: { ...BASE, t: 0, b: 240, irisR: 32, irisDy: 0, lash: 30, o: 1 },
  angry:   { ...BASE, c: 125, t: 50, b: 205, irisR: 28, irisDy: 10, lash: 0, fang: 1, browA: 65, browB: 128, shake: 3 },
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
const mouthFang = document.getElementById("mouthFang");
const browPolys = [document.getElementById("browPolyL"), document.getElementById("browPolyR")];
const browBars = [document.getElementById("browBarL"), document.getElementById("browBarR")];

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

  // Brows: a slanted edge cuts the top of each eye, and a thick black bar sits on that edge.
  // The left eye's outer end is on its left; the right eye is the mirror image.
  const A = p.browA, B = p.browB;
  browPolys[0].setAttribute("points", `-20,${A} 230,${B} 230,400 -20,400`);
  browPolys[1].setAttribute("points", `230,${A} -20,${B} -20,400 230,400`);
  browBars[0].setAttribute("d", `M-8,${A - 9} L208,${B - 9}`);
  browBars[1].setAttribute("d", `M208,${A - 9} L-8,${B - 9}`);
  const browOpacity = Math.max(0, Math.min(1, (A + 100) / 50));
  browBars.forEach((b) => b.setAttribute("opacity", browOpacity));

  blushes.forEach((b) => b.setAttribute("opacity", p.blush));

  mouthBar.setAttribute("opacity", p.bar);
  mouthBar.setAttribute("transform", about(220, 310, 0.6 + 0.4 * p.bar));
  mouthO.setAttribute("opacity", p.o);
  mouthO.setAttribute("transform", about(220, 315, 0.6 + 0.4 * p.o));
  mouthFang.setAttribute("opacity", p.fang);
  mouthFang.setAttribute("transform", about(220, 310, 0.6 + 0.4 * p.fang));

  // Trembling (used by the angry face)
  const now = performance.now();
  const sx = Math.sin(now * 0.09) * p.shake;
  const sy = Math.cos(now * 0.11) * p.shake * 0.6;

  root.setAttribute("opacity", p.alpha);
  root.setAttribute("transform", `translate(${sx} ${sy}) ${about(220, 120, p.scale)}`);
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
    onStart: s.onStart,
  }));
  current = null;
}

export function tick(dt) {
  // Start the next step if nothing is playing
  if (!current && queue.length > 0) {
    const step = queue.shift();
    if (step.onStart) step.onStart();
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

  render();   // always redraw, so wandering irises and trembling show even when nothing is playing
}

render();