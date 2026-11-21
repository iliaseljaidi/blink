import { play, tick, wander } from "./face.js";
import { burst } from "./effects.js";

// ---- The page's voice: a caption that fades in and out ----
const caption = document.getElementById("caption");
let hideTimer;

function say(text) {
  caption.textContent = text;
  caption.classList.add("show");
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => caption.classList.remove("show"), 3000);
}
const pick = (list) => list[Math.floor(Math.random() * list.length)];

const WAKE_LINES = ["Is he gone?", "Finally...", "Oh good, nobody's looking."];
const CAUGHT_LINES = [
  "I wasn't doing anything.",
  "This is normal. Websites do this.",
  "Hi. Normal website.",
  "...you saw nothing.",
];
const MILESTONES = [
  { at: 6, text: "I love it when you look away." },
  { at: 15, text: "Don't turn around. I'm having a moment." },
];
const TIDY_LINES = ["Nothing to see here.", "Just a normal website.", "Everything is fine."];
const STARE_ANGRY_AT = 8;        // seconds of staring before it gets angry
const STARE_FURIOUS_AT = 14;     // seconds of staring before it gets furious
const FROZEN_POKE_LINES = [
  "I can't move when you look at me. Stop poking.",
  "Please don't touch the website.",
  "I'm frozen. This is rude.",
];
const ANGRY_LINES = ["Hey.", "Stop it.", "I said STOP.", "...You're really doing this."];

// ---- The face's keyframe sequences ----
function openEyes() {
  play([{ to: "calm", dur: 0.7, ease: "out" }]);
}
function hideFace() {
  play([{ to: "hidden", dur: 0.2, ease: "in" }]);
}
// The face pops into the random lines at the centre of the screen
function popFace() {
  burst(innerWidth / 2, innerHeight / 2, { count: 16, near: 70, far: 170 });
}

function reactToBeingCaught() {
  if (Math.random() < 0.5) {
    play([                                              // SHOCKED: sharp pop, then settle
      { to: "shocked", with: { scale: 1.15 }, dur: 0.1, ease: "out" },
      { to: "shocked", dur: 0.15, ease: "inOut" },
      { hold: 1.4 },
      { to: "hidden", dur: 0.25, ease: "in", onStart: popFace },
    ]);
  } else {
    play([                                              // SHY: softer, with a little bounce
      { to: "shy", dur: 0.35, ease: "back" },
      { hold: 1.5 },
      { to: "hidden", dur: 0.3, ease: "in", onStart: popFace },
    ]);
  }
}

// ---- Things that move. Each knows which way is "outward" from the centre ----
const PUSH = 240;
const things = [...document.querySelectorAll(
  "#headline, #sub, #cta, .card, .logo, .nav a"
)].map((el) => {
  const r = el.getBoundingClientRect();
  const dx = r.left + r.width / 2 - innerWidth / 2;
  const dy = r.top + r.height / 2 - innerHeight / 2;
  const len = Math.hypot(dx, dy) || 1;
  return {
    el,
    dirX: dx / len, dirY: dy / len,
    px: Math.random() * 6.28, py: Math.random() * 6.28, pr: Math.random() * 6.28,
    sx: 0.4 + Math.random() * 0.8,
    sy: 0.4 + Math.random() * 0.8,
    sr: 0.4 + Math.random() * 0.8,
  };
});

// ---- State ----
let alive = false;
let hasBeenAlive = false;
let eyesOpen = false;
let milestoneIndex = 0;
let t = 0;                       // seconds alive in total (stops when watched)
let awayTime = 0;                // seconds since you last looked away
let last = performance.now();

const HOLD_BEFORE_TIDY = 2.5;    // seconds of being watched before everything goes back
let watchedTime = 0;             // how long you've been watching
let spread = 1;                  // 1 = items out where they drifted, 0 = back home
let tidySaid = false;
let started = false;             // becomes true once the camera is running
let stareStage = 0;              // 0 = calm, 1 = angry, 2 = furious

window.addEventListener("watchedchange", (e) => {
  if (!started) {                                       // first signal from the camera
    started = true;
    watchedTime = 0;                                    // don't count camera loading time as staring
  }

  alive = !e.detail.watched;
  if (alive) {
    if (stareStage > 0) popFace();                      // angry face bursts into lines
    stareStage = 0;
    watchedTime = 0;
    tidySaid = false;
    awayTime = 0;
    eyesOpen = false;
    hideFace();                                         // looked away again: face disappears
    say(pick(WAKE_LINES));
    hasBeenAlive = true;
  } else if (hasBeenAlive) {
    if (eyesOpen) {                                     // caught with eyes open: the face reacts
      eyesOpen = false;
      reactToBeingCaught();
    }
    say(pick(CAUGHT_LINES));
  }
});

// ---- Clicking and poking ----
let pokes = 0;
let lastPoke = 0;

function poke() {
  const now = performance.now();
  pokes = now - lastPoke < 4000 ? pokes + 1 : 1;        // pokes only count if they're close together
  lastPoke = now;

  say(ANGRY_LINES[Math.min(pokes, ANGRY_LINES.length) - 1]);   // gets angrier with each poke
  play([
    { to: "angry", with: { scale: 1.12 }, dur: 0.1, ease: "out" },   // brows slam down
    { to: "angry", dur: 0.15, ease: "inOut" },
    { hold: 0.6 + pokes * 0.3 },                                      // angrier pokes stay longer
    { to: "calm", dur: 0.4, ease: "inOut" },
  ]);
}

window.addEventListener("click", (e) => {
  burst(e.clientX, e.clientY);                          // every click pops the lines

  if (!alive) {                                         // you're looking: it's frozen
    say(pick(FROZEN_POKE_LINES));
    return;
  }

  // The face sits in the middle of the screen
  const onFace =
    Math.abs(e.clientX - innerWidth / 2) < 220 &&
    Math.abs(e.clientY - innerHeight / 2) < 130;
  if (eyesOpen && onFace) poke();
});

// ---- The main loop ----
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;

  if (alive) {
    t += dt;
    awayTime += dt;

    if (milestoneIndex < MILESTONES.length && t >= MILESTONES[milestoneIndex].at) {
      say(MILESTONES[milestoneIndex].text);
      milestoneIndex++;
    }

    if (!eyesOpen && awayTime > 5) {                    // 5 seconds away: eyes open
      eyesOpen = true;
      openEyes();
    }
  }                                                     // <-- this closing brace was in the wrong place

  // Tidy up: after being watched for a while, everything slides back home
  if (alive) {
    spread = Math.min(1, spread + dt / 0.8);            // slides back out when you look away
  } else {
    watchedTime += dt;

    // 1) After a few seconds of being watched, everything slides home
    if (hasBeenAlive && watchedTime > HOLD_BEFORE_TIDY && spread > 0) {
      if (!tidySaid) { tidySaid = true; say(pick(TIDY_LINES)); }
      spread = Math.max(0, spread - dt / 0.8);
    }

    // 2) Staring for a long time makes it angry, then furious
    if (started && stareStage < 1 && watchedTime > STARE_ANGRY_AT) {
      stareStage = 1;
      say("What are you looking at?");
      play([
        { to: "angry", with: { scale: 1.12 }, dur: 0.12, ease: "out" },   // brows slam down
        { to: "angry", dur: 0.2, ease: "inOut" },
      ]);
    } else if (stareStage === 1 && watchedTime > STARE_FURIOUS_AT) {
      stareStage = 2;
      say("I'M WARNING YOU.");
      play([{ to: "angry", with: { scale: 1.18, shake: 9 }, dur: 0.3, ease: "out" }]);
    }
  }
  const home = spread * spread * (3 - 2 * spread);      // smooth start and stop
  const eased = Math.min(1, t / 3);
  const boldness = 0.4 + Math.min(1, t / 20) * 0.6;
  const amp = eased * boldness;
  const push = PUSH * Math.min(1, t / 6);

  for (const o of things) {
    const x = (Math.sin(t * o.sx + o.px) * 70 * amp + o.dirX * push) * home;
    const y = (Math.sin(t * o.sy + o.py) * 50 * amp + o.dirY * push) * home;
    const r = Math.sin(t * o.sr + o.pr) * 10 * amp * home;
    const s = 1 + Math.sin(t * 1.5 + o.pr) * 0.06 * amp * home;
    o.el.style.transform = `translate(${x}px, ${y}px) rotate(${r}deg) scale(${s})`;
  }

  // Irises wander while you're away
  wander.x = Math.sin(t * 0.9) * 16;
  wander.y = Math.sin(t * 1.3) * 7;

  tick(dt);                                             // the face animates in real time, even when the page is frozen
    document.title = `watched=${watchedTime.toFixed(1)} stage=${stareStage} started=${started} alive=${alive}`;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);