import { play, tick, wander } from "./face.js";
import { burst } from "./effects.js";
import { head } from "./shared.js";
import { buildEyes, setEyesOpen, lookAt } from "./eyes.js";
import { startAudio, sfx, loopOn, loopOff } from "./audio.js";

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
const EYES_EVERYWHERE_AT = 12;
const EYES_LINES = ["We're all awake.", "Don't turn around.", "Everyone's watching you now."];
const FROZEN_POKE_LINES = [
  "I can't move when you look at me. Stop poking.",
  "Please don't touch the website.",
  "I'm frozen. This is rude.",
];
const ANGRY_LINES = ["Hey.", "Stop it.", "I said STOP.", "...You're really doing this."];

// ---- The face's keyframe sequences ----
function openEyes() {
  sfx("eyes-open");
  play([{ to: "calm", dur: 0.7, ease: "out" }]);
}
function hideFace() {
  play([{ to: "hidden", dur: 0.2, ease: "in" }]);
}
// The face pops into the random lines at the centre of the screen
// The random lines burst at the centre of the screen (no sound)
function popLines() {
  burst(innerWidth / 2, innerHeight / 2, { count: 16, near: 70, far: 170 });
}
// Lines plus the pop sound
function popFace() {
  sfx("burst-pop");
  popLines();
}

function reactToBeingCaught() {
  if (Math.random() < 0.5) {
    sfx("gasp-shocked");
    play([                                              // SHOCKED: sharp pop, then settle
      { to: "shocked", with: { scale: 1.15 }, dur: 0.1, ease: "out" },
      { to: "shocked", dur: 0.15, ease: "inOut" },
      { hold: 1.4 },
      { to: "hidden", dur: 0.25, ease: "in", onStart: popFace },
    ]);
  } else {
    sfx("shy-eep");
    play([                                              // SHY: softer, with a little bounce
      { to: "shy", dur: 0.35, ease: "back" },
      { hold: 1.5 },
      { to: "hidden", dur: 0.3, ease: "in", onStart: popLines },
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

buildEyes();

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
const FOLLOW_SIGN = 1;           // change to -1 if the eyes look the wrong way
const follow = { x: 0, y: 0 };   // where the irises are looking (smoothed)
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// ---- Caught counter ----
const counter = document.getElementById("counter");
const counterNum = document.getElementById("caughtNum");
const CAUGHT_MILESTONES = {
  3: "Three times. Are you doing this on purpose?",
  5: "Five. You're relentless.",
  10: "Ten. We need to talk.",
  20: "Twenty. I'm calling security.",
};
let caught = 0;

function countCatch() {
  caught++;
  counterNum.textContent = caught;
  counter.classList.add("show");
  counter.classList.remove("bump");
  void counter.offsetWidth;                             // restarts the bump animation
  counter.classList.add("bump");
  return CAUGHT_MILESTONES[caught] || null;             // a special line at milestones
}

// ---- Confession headline ----
const headline = document.getElementById("headline");
// Only the words, so the little eyes living inside the headline stay put
const headlineText = [...headline.childNodes].find((n) => n.nodeType === 3);
const HEADLINE_NORMAL = headlineText.textContent;
const CONFESSIONS = [
  { at: 18, text: "Streamlining Tomorrow's Enterprise Feelings" },
  { at: 28, text: "We have been pretending to be busy." },
  { at: 40, text: "Nobody here has ever been a synergy." },
  { at: 55, text: "Please don't tell the investors." },
];
let confessionShown = -1;                               // -1 = the normal headline
// ---- Tab title and icon ----
const TITLE_NORMAL = "Synergix";
const TITLES_AWAY = ["...is he gone?", "psst. over here.", "are you still there?", "come back..."];
let titleTimer = 0;

// Find (or create) the tab icon element
let iconLink = document.querySelector("link[rel~='icon']");
if (!iconLink) {
  iconLink = document.createElement("link");
  iconLink.rel = "icon";
  document.head.appendChild(iconLink);
}

const ICON_SHUT =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
     <rect width="64" height="64" rx="12" fill="#fff"/>
     <path d="M6 34 Q18 38 28 34 M36 34 Q46 38 58 34" stroke="#111" stroke-width="5" stroke-linecap="round" fill="none"/>
   </svg>`;
const ICON_OPEN =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
     <rect width="64" height="64" rx="12" fill="#fff"/>
     <ellipse cx="18" cy="32" rx="13" ry="11" fill="#fff" stroke="#111" stroke-width="4"/>
     <ellipse cx="46" cy="32" rx="13" ry="11" fill="#fff" stroke="#111" stroke-width="4"/>
     <circle cx="18" cy="32" r="6" fill="#d62020"/>
     <circle cx="46" cy="32" r="6" fill="#d62020"/>
   </svg>`;

function setIcon(open) {
  iconLink.href = "data:image/svg+xml," + encodeURIComponent(open ? ICON_OPEN : ICON_SHUT);
}
setIcon(false);

// If you actually switch to another tab, it calls you back
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    document.title = "Come back...";
    setIcon(true);
  } else {
    document.title = alive ? pick(TITLES_AWAY) : TITLE_NORMAL;
    setIcon(alive);
  }
});

window.addEventListener("watchedchange", (e) => {
  if (!started) {                                       // first signal from the camera
    started = true;
    watchedTime = 0;                                    // don't count camera loading time as staring
  }

  alive = !e.detail.watched;
  document.title = alive ? pick(TITLES_AWAY) : TITLE_NORMAL;   // tab title follows the state
  setIcon(alive);
  titleTimer = 0;
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
     const milestone = awayTime > 2 ? countCatch() : null;   // only real catches count
    say(milestone || pick(CAUGHT_LINES));
  }
});// ---- Covering the camera ----
let covered = false;
window.addEventListener("coverchange", (e) => {
  covered = e.detail.covered;
  if (covered) {
    eyesOpen = true;                                    // the face is out now
    say(pick(["Hey! No fair!", "I can't see you! Rude!", "Take your hand off the camera."]));
    
    sfx("gasp-shocked");
        setTimeout(() => sfx("angry-growl"), 400);
    play([
      { to: "shocked", with: { scale: 1.2 }, dur: 0.1, ease: "out" },   // shock...
      { to: "angry", with: { scale: 1.1 }, dur: 0.3, ease: "inOut" },   // ...then offended
    ]);
  } else {
    eyesOpen = false;
    say("...Oh. There you are.");
    popFace();                                          // bursts into lines and vanishes
    hideFace();
  }
});

// ---- Clicking and poking ----
let pokes = 0;
let lastPoke = 0;

function poke() {
  const now = performance.now();
  pokes = now - lastPoke < 4000 ? pokes + 1 : 1;        // pokes only count if they're close together
  lastPoke = now;
  sfx("angry-growl", 0.6, 1);

  say(ANGRY_LINES[Math.min(pokes, ANGRY_LINES.length) - 1]);   // gets angrier with each poke
  play([
    { to: "angry", with: { scale: 1.12 }, dur: 0.1, ease: "out" },   // brows slam down
    { to: "angry", dur: 0.15, ease: "inOut" },
    { hold: 0.6 + pokes * 0.3 },                                      // angrier pokes stay longer
    { to: "calm", dur: 0.4, ease: "inOut" },
  ]);
}

window.addEventListener("click", (e) => {
  burst(e.clientX, e.clientY);
  sfx("burst-pop", 0.35, 0.6);               // every click pops the lines

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

    if (!eyesOpen && awayTime > 5 && !covered) {        // 5 seconds away: eyes open         // 5 seconds away: eyes open
      eyesOpen = true;
      openEyes();
    }
  }                                                     // <-- this closing brace was in the wrong place

  // Tidy up: after being watched for a while, everything slides back home
  if (alive) {
    spread = Math.min(1, spread + dt / 0.8);            // slides back out when you look away
    loopOn("ambient-away", 0.3);
    loopOff("heartbeat");
} else {
    watchedTime += dt;
    loopOff("ambient-away", 0.3);
    if (hasBeenAlive && watchedTime > 3) loopOn("heartbeat", 0.6);
    // 1) After a few seconds of being watched, everything slides home
    if (hasBeenAlive && watchedTime > HOLD_BEFORE_TIDY && spread > 0) {
      if (!tidySaid) { tidySaid = true; say(pick(TIDY_LINES)); }
      spread = Math.max(0, spread - dt / 0.8);
    }

    // 2) Staring for a long time makes it angry, then furious
    if (started && stareStage < 1 && watchedTime > STARE_ANGRY_AT) {
      stareStage = 1;
      say("What are you looking at?");
    sfx("angry-growl");
      play([
        { to: "angry", with: { scale: 1.12 }, dur: 0.12, ease: "out" },   // brows slam down
        { to: "angry", dur: 0.2, ease: "inOut" },
      ]);
    } else if (stareStage === 1 && watchedTime > STARE_FURIOUS_AT) {
      stareStage = 2;
      say("I'M WARNING YOU.");
    sfx("angry-growl", 1);
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
  titleTimer += dt;                                     // new tab title every few seconds while away
  if (alive && titleTimer > 4) { titleTimer = 0; document.title = pick(TITLES_AWAY); }

  // Irises follow your head when they can see it, otherwise they wander looking for you
  const wantX = head.seen ? head.x * 110 * FOLLOW_SIGN : Math.sin(t * 0.9) * 16;
  const wantY = head.seen ? head.y * 100 : Math.sin(t * 1.3) * 7;
  follow.x += (clamp(wantX, -28, 28) - follow.x) * Math.min(1, dt * 6);   // smooth glide
  follow.y += (clamp(wantY, -12, 12) - follow.y) * Math.min(1, dt * 6);
  wander.x = follow.x;
  wander.y = follow.y;
  const wantEyes = alive && awayTime > EYES_EVERYWHERE_AT && !covered;
  if (setEyesOpen(wantEyes)) {
    if (wantEyes) say(pick(EYES_LINES));
    else sfx("eyes-shut");                              // all the little eyes snap shut
  }
  lookAt(follow.x * 0.3, follow.y * 0.4);

  // Confession headline: the longer you're away, the more honest it gets
  let wantConf = -1;
  if (alive) CONFESSIONS.forEach((c, i) => { if (awayTime > c.at) wantConf = i; });
  if (wantConf !== confessionShown) {
    confessionShown = wantConf;
    headlineText.textContent = wantConf >= 0 ? CONFESSIONS[wantConf].text : HEADLINE_NORMAL;
  }
  tick(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

document.getElementById("startBtn").addEventListener("click", (e) => {
  e.stopPropagation();                                  // don't count it as a poke
  startAudio();
  document.getElementById("start").remove();
});