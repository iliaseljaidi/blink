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
// ---- The face's keyframe sequences ----
function openEyes() {
  play([{ to: "calm", dur: 0.7, ease: "out" }]);
}
function hideFace() {
  play([{ to: "hidden", dur: 0.2, ease: "in" }]);
}
function reactToBeingCaught() {
  if (Math.random() < 0.5) {
    play([                                              // SHOCKED: sharp pop, then settle
      { to: "shocked", with: { scale: 1.15 }, dur: 0.1, ease: "out" },
      { to: "shocked", dur: 0.15, ease: "inOut" },
      { hold: 1.4 },
      { to: "hidden", dur: 0.25, ease: "in" },
    ]);
  } else {
    play([                                              // SHY: softer, with a little bounce
      { to: "shy", dur: 0.35, ease: "back" },
      { hold: 1.5 },
      { to: "hidden", dur: 0.3, ease: "in" },
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

window.addEventListener("watchedchange", (e) => {
  alive = !e.detail.watched;
  if (alive) {
    watchedTime = 0;
    tidySaid = false;
    awayTime = 0;
    eyesOpen = false;
    hideFace();
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
const FROZEN_POKE_LINES = [
  "I can't move when you look at me. Stop poking.",
  "Please don't touch the website.",
  "I'm frozen. This is rude.",
];
const OW_LINES = ["Ow!", "Hey!", "That tickles.", "Rude."];

let pokes = 0;
let lastPoke = 0;

function poke() {
  const now = performance.now();
  pokes = now - lastPoke < 4000 ? pokes + 1 : 1;   // pokes only count if they're close together
  lastPoke = now;

  if (pokes >= 3) {                                // third quick poke: fed up
    say("Okay. That's enough.");
    play([
      { to: "shocked", with: { scale: 1.2 }, dur: 0.08, ease: "out" },
      { to: "shocked", dur: 0.1 },
      { hold: 0.6 },
      { to: "calm", dur: 0.4 },
    ]);
    pokes = 0;
  } else {
    say(pick(OW_LINES));
    play([
      { to: Math.random() < 0.5 ? "shy" : "shocked", dur: 0.1, ease: "out" },
      { hold: 0.5 },
      { to: "calm", dur: 0.3 },
    ]);
  }
}

window.addEventListener("click", (e) => {
  burst(e.clientX, e.clientY);                      // every click pops the lines

  if (!alive) {                                     // you're looking: it's frozen
    say(pick(FROZEN_POKE_LINES));
    return;
  }

  // The face sits in the middle of the screen
  const onFace =
    Math.abs(e.clientX - innerWidth / 2) < 220 &&
    Math.abs(e.clientY - innerHeight / 2) < 130;
  if (eyesOpen && onFace) poke();
});

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
  }

    // Tidy up: after being watched for a while, everything slides back home
  if (alive) {
    spread = Math.min(1, spread + dt / 0.8);            // slides back out when you look away
  } else {
    watchedTime += dt;
    if (hasBeenAlive && watchedTime > HOLD_BEFORE_TIDY && spread > 0) {
      if (!tidySaid) { tidySaid = true; say(pick(TIDY_LINES)); }
      spread = Math.max(0, spread - dt / 0.8);          // slides home
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

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);